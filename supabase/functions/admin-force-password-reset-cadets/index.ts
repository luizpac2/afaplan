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
    const isSuperAdmin = caller.email === "pelicano307@gmail.com";
    const { data: callerRole } = await adminClient
      .from("user_roles").select("role").eq("user_id", caller.id).single();
    if (!isSuperAdmin && !["super_admin", "gestor"].includes(callerRole?.role ?? "")) {
      return new Response(JSON.stringify({ error: "Permissão insuficiente" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca todos os user_ids com role cadete
    const { data: cadeteRoles } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "cadete");

    const userIds = (cadeteRoles ?? []).map((r: { user_id: string }) => r.user_id);

    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        // Verifica se já tem must_change_password = false (já trocou a senha)
        const { data: userData } = await adminClient.auth.admin.getUserById(userId);
        const meta = userData?.user?.user_metadata ?? {};

        // Se já trocou (must_change_password === false explicitamente), não reseta
        if (meta.must_change_password === false) {
          skipped++;
          continue;
        }

        await adminClient.auth.admin.updateUserById(userId, {
          user_metadata: { ...meta, must_change_password: true },
        });
        updated++;
      } catch (e) {
        errors.push(`${userId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(
      JSON.stringify({ updated, skipped, errors: errors.slice(0, 20) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
