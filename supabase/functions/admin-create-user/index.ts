import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "@#!";
  const all = upper + lower + digits + special;

  const rand = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const extra = Array.from({ length: 5 }, () => rand(all)).join("");

  const pwd = rand(upper) + rand(lower) + rand(digits) + rand(special) + extra;
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

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

    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
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

    const callerEmail = caller.email ?? "";
    const isSuperAdmin = callerEmail === "pelicano307@gmail.com";

    if (!isSuperAdmin && !["super_admin", "gestor"].includes(callerRole?.role ?? "")) {
      return new Response(JSON.stringify({ error: "Permissão insuficiente" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerMeta = caller.user_metadata as Record<string, string> | undefined;
    const callerName = callerMeta?.nome ?? callerEmail ?? caller.id;

    const { email, name, role, cadetId } = await req.json() as {
      email: string;
      name: string;
      role: string;
      cadetId?: string;
    };

    if (!email || !name || !role) {
      return new Response(JSON.stringify({ error: "email, name e role são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const password = generatePassword();

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome: name },
    });

    if (createErr || !created.user) {
      const msg = createErr?.message ?? "Erro ao criar usuário";
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roleRow: Record<string, unknown> = { user_id: created.user.id, role: role.toLowerCase() };
    if (cadetId) roleRow.cadet_id = cadetId;

    const { error: roleErr } = await adminClient.from("user_roles").insert(roleRow);

    if (roleErr) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: "Erro ao definir permissão: " + roleErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Grava log
    await adminClient.from("action_logs").insert({
      action:      "ADD",
      entity:      "USER",
      entity_id:   created.user.id,
      entity_name: name,
      changes:     { after: { email, role: role.toLowerCase() } },
      actor_name:  callerName,
      actor_id:    caller.id,
    });

    return new Response(
      JSON.stringify({ userId: created.user.id, email, name, password }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
