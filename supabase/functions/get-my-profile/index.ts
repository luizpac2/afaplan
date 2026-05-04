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

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roleRow, error: roleErr } = await admin
    .from("user_roles")
    .select("role, status")
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

  const userStatus = (roleRow as Record<string, unknown>).status as string ?? "ATIVO";

  if (userStatus === "INATIVO") {
    return new Response(JSON.stringify({ error: "user_inactive" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const role = roleMap[roleRow.role as string] ?? "CADETE";
  const profile: Record<string, unknown> = {
    uid: user.id,
    email: user.email,
    displayName: meta.nome ?? user.email,
    role,
    userStatus,
    status: "APPROVED",
    createdAt: user.created_at,
  };

  // Vincula docente ao registro de instructor via email
  if (role === "DOCENTE") {
    const { data: instrRow } = await admin
      .from("instructors")
      .select("trigram")
      .ilike("email", email)
      .maybeSingle();
    if (instrRow?.trigram) {
      profile.instructorTrigram = instrRow.trigram;
    }
  }

  // Vincula cadete ao registro via email
  if (role === "CADETE" || role === "CHEFE_TURMA") {
    const { data: cadetRow } = await admin
      .from("cadetes")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (cadetRow?.id) {
      profile.cadetId = cadetRow.id;
    }
  }

  return new Response(JSON.stringify(profile), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
