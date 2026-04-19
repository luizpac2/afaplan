import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PASSWORD = "fab1941";

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

    // Verifica se chamador é admin
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
    const isAdmin = isSuperAdmin || ["super_admin", "gestor"].includes(callerRole?.role ?? "");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Permissão insuficiente" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca todos os cadetes com email
    const { data: cadetes, error: cadetErr } = await adminClient
      .from("cadetes")
      .select("id, nome_guerra, nome_completo, email, cohort_id")
      .not("email", "is", null);

    if (cadetErr) throw cadetErr;
    if (!cadetes || cadetes.length === 0) {
      return new Response(JSON.stringify({ created: 0, skipped: 0, errors: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca usuários já existentes em user_roles com cadet_id preenchido
    const { data: existingRoles } = await adminClient
      .from("user_roles")
      .select("cadet_id")
      .not("cadet_id", "is", null);

    const alreadyCreated = new Set((existingRoles ?? []).map((r: { cadet_id: string }) => r.cadet_id));

    const toCreate = cadetes.filter((c: { id: string }) => !alreadyCreated.has(c.id));

    let created = 0;
    let skipped = cadetes.length - toCreate.length;
    const errors: string[] = [];

    for (const cadet of toCreate) {
      try {
        // Cria usuário no Auth com senha padrão e flag de troca obrigatória
        const { data: authData, error: createErr } = await adminClient.auth.admin.createUser({
          email: cadet.email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: {
            nome: cadet.nome_guerra,
            must_change_password: true,
          },
        });

        if (createErr || !authData.user) {
          // Email já existe no auth — tenta vincular pelo email
          if (createErr?.message?.includes("already been registered")) {
            const { data: listData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
            const existing = listData?.users?.find((u) => u.email === cadet.email);
            if (existing) {
              await adminClient.from("user_roles").upsert(
                { user_id: existing.id, role: "cadete", cadet_id: cadet.id },
                { onConflict: "user_id" },
              );
              created++;
              continue;
            }
          }
          errors.push(`${cadet.id} (${cadet.email}): ${createErr?.message ?? "erro desconhecido"}`);
          continue;
        }

        // Insere em user_roles
        const { error: roleErr } = await adminClient.from("user_roles").insert({
          user_id: authData.user.id,
          role: "cadete",
          cadet_id: cadet.id,
        });

        if (roleErr) {
          await adminClient.auth.admin.deleteUser(authData.user.id);
          errors.push(`${cadet.id}: role insert failed — ${roleErr.message}`);
          continue;
        }

        created++;
      } catch (e) {
        errors.push(`${cadet.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(
      JSON.stringify({ created, skipped, errors: errors.slice(0, 20) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
