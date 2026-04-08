import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "no_auth" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Identifica o usuário pelo token
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPER_ADMIN_EMAILS = new Set(["pelicano307@gmail.com"]);
  const email = (user.email ?? "").trim().toLowerCase();
  const meta  = (user.user_metadata ?? {}) as Record<string, string>;

  if (SUPER_ADMIN_EMAILS.has(email)) {
    return new Response(JSON.stringify({
      uid: user.id,
      email: user.email,
      displayName: meta.nome ?? user.email,
      role: "SUPER_ADMIN",
      status: "APPROVED",
      createdAt: user.created_at,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Usa service role para bypassar RLS
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roleRow, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleErr) {
    return new Response(JSON.stringify({ error: "db_error", detail: roleErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!roleRow) {
    return new Response(JSON.stringify({ error: "no_role" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const roleMap: Record<string, string> = {
    super_admin: "SUPER_ADMIN",
    gestor:      "ADMIN",
    docente:     "DOCENTE",
    cadete:      "CADETE",
  };

  return new Response(JSON.stringify({
    uid: user.id,
    email: user.email,
    displayName: meta.nome ?? user.email,
    role: roleMap[roleRow.role as string] ?? "CADETE",
    status: "APPROVED",
    createdAt: user.created_at,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
