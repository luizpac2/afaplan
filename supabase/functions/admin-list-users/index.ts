import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Sem autorização" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: callerRole } = await adminClient
      .from("user_roles").select("role").eq("user_id", caller.id).single();

    const isSuperAdmin = caller.email === "pelicano307@gmail.com";
    if (!isSuperAdmin && !["super_admin", "gestor"].includes(callerRole?.role ?? "")) {
      return new Response(JSON.stringify({ error: "Permissão insuficiente" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca usuários do Auth (até 1000)
    const { data: { users }, error: usersErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (usersErr) throw usersErr;

    // Busca todos os roles com cadet_id
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("user_id, role, turma_id, cadet_id");
    const rolesMap = new Map((roles ?? []).map((r: { user_id: string; role: string; turma_id?: string; cadet_id?: string }) => [r.user_id, r]));

    // Busca cadetes para pegar cohort_id via cadet_id
    const cadetIds = (roles ?? [])
      .filter((r: { cadet_id?: string }) => r.cadet_id)
      .map((r: { cadet_id: string }) => r.cadet_id);

    const cadetCohortMap = new Map<string, string>(); // cadet_id → cohort_id
    if (cadetIds.length > 0) {
      const { data: cadetes } = await adminClient
        .from("cadetes")
        .select("id, cohort_id")
        .in("id", cadetIds);
      (cadetes ?? []).forEach((c: { id: string; cohort_id: string }) => {
        cadetCohortMap.set(c.id, c.cohort_id);
      });
    }

    // Busca nomes dos cohorts para retornar nome legível em vez do id bruto
    const { data: cohortsData } = await adminClient.from("cohorts").select("id, nome, name");
    const cohortNameMap = new Map<string, string>();
    (cohortsData ?? []).forEach((c: { id: unknown; nome?: string; name?: string }) => {
      const nome = c.nome ?? c.name ?? String(c.id);
      cohortNameMap.set(String(c.id), nome);
    });

    const SUPER_ADMIN_EMAILS = new Set(["pelicano307@gmail.com"]);

    const result = users.map((u) => {
      const roleRow = rolesMap.get(u.id) as { role?: string; turma_id?: string; cadet_id?: string } | undefined;
      const meta = (u.user_metadata ?? {}) as Record<string, string>;
      const email = (u.email ?? "").trim().toLowerCase();

      // Esquadrão: usa cohort_id do cadete (fonte da verdade), fallback em turma_id legado
      const cadetId = roleRow?.cadet_id;
      const cohortId = (cadetId && cadetCohortMap.get(cadetId)) ?? null;
      const squadron = cohortId
        ? (cohortNameMap.get(cohortId) ?? cohortId)
        : (roleRow?.turma_id ?? null);

      return {
        uid: u.id,
        email: u.email ?? "",
        displayName: meta.nome ?? u.email ?? "",
        role: SUPER_ADMIN_EMAILS.has(email) ? "SUPER_ADMIN" : mapRole(roleRow?.role ?? ""),
        squadron,
        cadetId,
        createdAt: u.created_at,
        status: roleRow ? "APPROVED" : "NO_ROLE",
      };
    });

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function mapRole(dbRole: string): string {
  switch (dbRole) {
    case "super_admin": return "SUPER_ADMIN";
    case "gestor":      return "ADMIN";
    case "docente":     return "DOCENTE";
    case "cadete":      return "CADETE";
    default:            return "CADETE";
  }
}
