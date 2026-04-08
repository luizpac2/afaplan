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

    // Verifica se o chamador é admin
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
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    const isSuperAdmin = caller.email === "pelicano307@gmail.com";
    if (!isSuperAdmin && !["super_admin", "gestor"].includes(callerRole?.role ?? "")) {
      return new Response(JSON.stringify({ error: "Permissão insuficiente" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca todos os usuários do Auth (paginado, até 1000)
    const { data: { users }, error: usersErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (usersErr) throw usersErr;

    // Busca todos os roles
    const { data: roles } = await adminClient.from("user_roles").select("*");
    const rolesMap = new Map((roles ?? []).map((r: { user_id: string; role: string; turma_id?: string }) => [r.user_id, r]));

    const SUPER_ADMIN_EMAILS = new Set(["pelicano307@gmail.com"]);

    const result = users.map((u) => {
      const roleRow = rolesMap.get(u.id) as { role?: string; turma_id?: string } | undefined;
      const meta = (u.user_metadata ?? {}) as Record<string, string>;
      const email = (u.email ?? "").trim().toLowerCase();
      return {
        uid: u.id,
        email: u.email ?? "",
        displayName: meta.nome ?? u.email ?? "",
        role: SUPER_ADMIN_EMAILS.has(email) ? "SUPER_ADMIN" : mapRole(roleRow?.role ?? ""),
        squadron: roleRow?.turma_id ?? null,
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
