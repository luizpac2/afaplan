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

    // Busca todos os usuários de uma vez (evita N+1 requests)
    const { data: listData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const allUsers = listData?.users ?? [];

    // Aplica flag apenas em quem ainda não trocou a senha
    // (must_change_password !== false significa: nunca trocou ou não tem o flag)
    const toUpdate = allUsers.filter((u) =>
      u.user_metadata?.must_change_password !== false
    );

    // Processa em paralelo em lotes de 20 para não sobrecarregar
    const BATCH = 20;
    let updated = 0;
    let skipped = allUsers.length - toUpdate.length;
    const errors: string[] = [];

    for (let i = 0; i < toUpdate.length; i += BATCH) {
      const batch = toUpdate.slice(i, i + BATCH);
      await Promise.all(batch.map(async (u) => {
        try {
          const meta = u.user_metadata ?? {};
          await adminClient.auth.admin.updateUserById(u.id, {
            user_metadata: { ...meta, must_change_password: true },
          });
          updated++;
        } catch (e) {
          errors.push(`${u.email ?? u.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }));
    }

    return new Response(
      JSON.stringify({ total: allUsers.length, updated, skipped, errors: errors.slice(0, 20) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
