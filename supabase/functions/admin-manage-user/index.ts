import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Grava log assíncrono sem bloquear a resposta
async function writeLog(
  adminClient: ReturnType<typeof createClient>,
  opts: {
    action: string;
    entity: string;
    entityId: string;
    entityName: string;
    changes?: Record<string, unknown>;
    callerName: string;
    callerId: string;
  },
) {
  const { error } = await adminClient.from("action_logs").insert({
    action:      opts.action,
    entity:      opts.entity,
    entity_id:   opts.entityId,
    entity_name: opts.entityName,
    changes:     opts.changes ?? null,
    actor_name:  opts.callerName,
    actor_id:    opts.callerId,
  });
  if (error) console.error("[audit] writeLog error:", error.message);
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
    const isAdmin = isSuperAdmin || ["super_admin", "gestor"].includes(callerRole?.role ?? "");

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Permissão insuficiente" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerMeta = caller.user_metadata as Record<string, string> | undefined;
    const callerName = callerMeta?.nome ?? caller.email ?? caller.id;

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

    if (action !== "update_details" && userId === caller.id) {
      return new Response(JSON.stringify({ error: "Não é possível modificar seu próprio usuário" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca dados atuais do usuário para o log
    const { data: targetAuthData } = await adminClient.auth.admin.getUserById(userId);
    const targetUser = targetAuthData?.user;
    const targetMeta = (targetUser?.user_metadata ?? {}) as Record<string, string>;
    const targetName = targetMeta.nome ?? targetUser?.email ?? userId;

    if (action === "update_role") {
      const { role } = body;
      if (!role) {
        return new Response(JSON.stringify({ error: "role é obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Busca role anterior para o log
      const { data: prevRole } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      const dbRole = mapRoleToDB(role);

      const { error } = await adminClient
        .from("user_roles")
        .upsert({ user_id: userId, role: dbRole }, { onConflict: "user_id" });

      if (error) throw error;

      await writeLog(adminClient, {
        action:     "UPDATE",
        entity:     "USER",
        entityId:   userId,
        entityName: targetName,
        changes:    { before: { role: prevRole?.role ?? null }, after: { role: dbRole } },
        callerName,
        callerId:   caller.id,
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!isSuperAdmin && callerRole?.role !== "super_admin") {
        return new Response(JSON.stringify({ error: "Apenas super administradores podem excluir usuários" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("user_roles").delete().eq("user_id", userId);
      await adminClient.from("docente_disciplinas").delete().eq("docente_id", userId);

      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;

      await writeLog(adminClient, {
        action:     "DELETE",
        entity:     "USER",
        entityId:   userId,
        entityName: targetName,
        changes:    { before: { email: targetUser?.email, role: callerRole?.role } },
        callerName,
        callerId:   caller.id,
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_details") {
      const { turmaId, displayName, disciplines } = body;

      // Coleta estado anterior para o log
      const { data: prevRoleRow } = await adminClient
        .from("user_roles")
        .select("turma_id")
        .eq("user_id", userId)
        .single();

      const { data: prevDisciplinesData } = await adminClient
        .from("docente_disciplinas")
        .select("disciplina_id")
        .eq("docente_id", userId);

      const changesBefore: Record<string, unknown> = {};
      const changesAfter: Record<string, unknown> = {};

      if (turmaId !== undefined) {
        changesBefore.turma_id = prevRoleRow?.turma_id ?? null;
        changesAfter.turma_id  = turmaId;

        const { error } = await adminClient
          .from("user_roles")
          .update({ turma_id: turmaId })
          .eq("user_id", userId);
        if (error) throw error;
      }

      if (displayName) {
        changesBefore.nome = targetMeta.nome ?? null;
        changesAfter.nome  = displayName;

        const { error } = await adminClient.auth.admin.updateUserById(userId, {
          user_metadata: { nome: displayName },
        });
        if (error) throw error;
      }

      if (disciplines !== undefined && disciplines !== null) {
        const prevDisciplines = (prevDisciplinesData ?? []).map((d: { disciplina_id: string }) => d.disciplina_id);
        changesBefore.disciplines = prevDisciplines;
        changesAfter.disciplines  = disciplines;

        await adminClient.from("docente_disciplinas").delete().eq("docente_id", userId);
        if (disciplines.length > 0) {
          const { error } = await adminClient.from("docente_disciplinas").insert(
            disciplines.map((d: string) => ({ docente_id: userId, disciplina_id: d }))
          );
          if (error) throw error;
        }
      }

      if (Object.keys(changesBefore).length > 0) {
        await writeLog(adminClient, {
          action:     "UPDATE",
          entity:     "USER",
          entityId:   userId,
          entityName: targetName,
          changes:    { before: changesBefore, after: changesAfter },
          callerName,
          callerId:   caller.id,
        });
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

function mapRoleToDB(frontendRole: string): string {
  switch (frontendRole.toUpperCase()) {
    case "SUPER_ADMIN":   return "super_admin";
    case "ADMIN":         return "gestor";
    case "DOCENTE":       return "docente";
    case "CADETE":        return "cadete";
    case "CHEFE_TURMA":   return "cadete";
    default:              return "cadete";
  }
}
