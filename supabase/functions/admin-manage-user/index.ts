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

    // Verifica identidade do chamador
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

    // Verifica se o chamador é admin
    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    const isSuperAdmin = caller.email === "pelicano307@gmail.com";
    const isAdmin = isSuperAdmin || ["super_admin", "gestor"].includes(callerRole?.role ?? "");

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Permissão insuficiente" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as {
      action: "update_role" | "delete" | "update_details";
      userId: string;
      role?: string;
      turmaId?: string | null;
      displayName?: string;
      disciplines?: string[] | null;
    };

    const { action, userId } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Impede modificar a si mesmo (exceto update_details)
    if (action !== "update_details" && userId === caller.id) {
      return new Response(JSON.stringify({ error: "Não é possível modificar seu próprio usuário" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_role") {
      const { role } = body;
      if (!role) {
        return new Response(JSON.stringify({ error: "role é obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upsert para garantir que crie se não existir
      const { error } = await adminClient
        .from("user_roles")
        .upsert({ user_id: userId, role: role.toLowerCase() }, { onConflict: "user_id" });

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      // Apenas super_admin pode deletar
      if (!isSuperAdmin && callerRole?.role !== "super_admin") {
        return new Response(JSON.stringify({ error: "Apenas super administradores podem excluir usuários" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Remove das tabelas relacionadas
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      await adminClient.from("docente_disciplinas").delete().eq("docente_id", userId);

      // Remove do Auth
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_details") {
      const { turmaId, displayName, disciplines } = body;

      if (turmaId !== undefined) {
        const { error } = await adminClient
          .from("user_roles")
          .update({ turma_id: turmaId })
          .eq("user_id", userId);
        if (error) throw error;
      }

      if (displayName) {
        const { error } = await adminClient.auth.admin.updateUserById(userId, {
          user_metadata: { nome: displayName },
        });
        if (error) throw error;
      }

      if (disciplines !== undefined && disciplines !== null) {
        await adminClient.from("docente_disciplinas").delete().eq("docente_id", userId);
        if (disciplines.length > 0) {
          const { error } = await adminClient.from("docente_disciplinas").insert(
            disciplines.map((d: string) => ({ docente_id: userId, disciplina_id: d }))
          );
          if (error) throw error;
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
