import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

const err = (msg: string, status = 400) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return err("Unauthorized", 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return err("Unauthorized", 401);

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Role check — aceita super_admin, gestor, SUPER_ADMIN, ADMIN (case insensitive)
  const { data: roleRow } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const isSuperAdmin = user.email === "pelicano307@gmail.com";
  const role = (roleRow?.role ?? "").toLowerCase();
  const allowedRoles = ["gestor", "super_admin", "admin"];
  if (!isSuperAdmin && !allowedRoles.includes(role)) {
    return err(`Forbidden (role=${role})`, 403);
  }

  const body = await req.json();
  const { action } = body;

  // ── helpers ─────────────────────────────────────────────────────────────────

  // Tabela `disciplines` usa colunas em inglês (code/sigla, name, load_hours, data jsonb)
  async function writeDisciplinesEN(op: "upsert" | "update" | "delete", code: string, payload?: Record<string, unknown>) {
    if (op === "upsert" && payload) {
      // Tenta upsert por code, depois por sigla
      const { error: e1 } = await adminClient.from("disciplines")
        .upsert({ ...payload, code }, { onConflict: "code" });
      if (e1) {
        const { error: e2 } = await adminClient.from("disciplines")
          .upsert({ ...payload, sigla: code }, { onConflict: "sigla" });
        if (e2) console.error("disciplines upsert error:", e2.message);
      }
    } else if (op === "update" && payload) {
      // Colunas reais da tabela `disciplines`: code, name, load_hours, data (jsonb)
      // NÃO enviar colunas inexistentes (color, sigla, nome, campo, carga_horaria)
      const p = payload as any;
      const rest: Record<string, unknown> = {};
      if (p.name       !== undefined) rest.name       = p.name;
      if (p.load_hours !== undefined) rest.load_hours = p.load_hours;
      // data jsonb — fetch current data from DB and deep-merge to avoid losing fields
      if (p.data !== undefined) {
        const { data: currentRow } = await adminClient.from("disciplines")
          .select("data").eq("code", code).maybeSingle();
        const currentData = (currentRow?.data && typeof currentRow.data === "object") ? currentRow.data : {};
        const incomingData = typeof p.data === "object" ? p.data : {};
        rest.data = {
          ...currentData,
          ...incomingData,
          ...(p.color !== undefined ? { color: p.color } : {}),
        };
      }

      console.log("disciplines update payload:", JSON.stringify(rest), "lookup code:", code);

      // Tenta por 'code' primeiro (coluna canônica da tabela EN)
      const { data: r1, error: e1 } = await adminClient.from("disciplines")
        .update(rest).eq("code", code).select("id");
      console.log("update by code — rows:", r1?.length ?? 0, "error:", e1?.message ?? "none");

      if (!e1 && (!r1 || r1.length === 0)) {
        // Fallback: tenta por 'sigla' (caso a tabela use esse nome)
        const { data: r2, error: e2 } = await adminClient.from("disciplines")
          .update(rest).eq("sigla", code).select("id");
        console.log("update by sigla — rows:", r2?.length ?? 0, "error:", e2?.message ?? "none");
        if (e2) throw new Error(`disciplines update failed: ${e2.message}`);
        if (!r2 || r2.length === 0) throw new Error(`disciplines: nenhuma linha encontrada para code/sigla="${code}"`);
      } else if (e1) {
        throw new Error(`disciplines update error: ${e1.message}`);
      }
    } else if (op === "delete") {
      await adminClient.from("disciplines").delete().eq("code", code);
      await adminClient.from("disciplines").delete().eq("sigla", code);
    }
  }

  // Tabela `disciplinas` usa colunas em português (sigla, nome, carga_horaria)
  async function writeDisciplinasPT(op: "upsert" | "update" | "delete", code: string, payload?: Record<string, unknown>) {
    try {
      if (op === "upsert" && payload) {
        const ptPayload = {
          sigla: code,
          nome: (payload.name as string) || (payload.nome as string) || code,
          carga_horaria: (payload.load_hours as number) ?? (payload.carga_horaria as number) ?? 0,
        };
        await adminClient.from("disciplinas").upsert({ ...ptPayload, sigla: code }, { onConflict: "sigla" });
      } else if (op === "update" && payload) {
        const ptPayload: Record<string, unknown> = {};
        if (payload.name !== undefined)       ptPayload.nome = payload.name;
        if (payload.nome !== undefined)        ptPayload.nome = payload.nome;
        if (payload.load_hours !== undefined)  ptPayload.carga_horaria = payload.load_hours;
        if (payload.carga_horaria !== undefined) ptPayload.carga_horaria = payload.carga_horaria;
        if (Object.keys(ptPayload).length > 0) {
          await adminClient.from("disciplinas").update(ptPayload).eq("sigla", code);
        }
      } else if (op === "delete") {
        await adminClient.from("disciplinas").delete().eq("sigla", code);
      }
    } catch (e: any) {
      console.warn("disciplinas write (ignorado):", e.message);
    }
  }

  // ── upsert_discipline ───────────────────────────────────────────────────────
  if (action === "upsert_discipline") {
    const { code, data: disciplineData } = body;
    if (!code || !disciplineData) return err("code and data required");
    try {
      await writeDisciplinesEN("upsert", code as string, disciplineData as Record<string, unknown>);
      await writeDisciplinasPT("upsert", code as string, disciplineData as Record<string, unknown>);
    } catch (e: any) { return err(e.message, 500); }
    return ok({ success: true });
  }

  // ── update_discipline ───────────────────────────────────────────────────────
  // Usa upsert em vez de update para não depender do schema exato de colunas.
  // O upsert já funciona (é o mesmo caminho de upsert_discipline).
  if (action === "update_discipline") {
    const { code, updates } = body;
    if (!code || !updates) return err("code and updates required");
    console.log("update_discipline→upsert code:", code, "keys:", Object.keys(updates));
    try {
      await writeDisciplinesEN("upsert", code as string, { ...(updates as Record<string, unknown>), code });
      await writeDisciplinasPT("update", code as string, updates as Record<string, unknown>);
    } catch (e: any) { return err(e.message, 500); }
    return ok({ success: true });
  }

  // ── sync_discipline_instructor ──────────────────────────────────────────────
  if (action === "sync_discipline_instructor") {
    const { code, warName } = body;
    if (!code || !warName) return err("code and warName required");
    const { data: row } = await adminClient.from("disciplines").select("data").eq("code", code).maybeSingle();
    const newData = { ...(row?.data || {}), instructor: warName };
    await writeDisciplinesEN("update", code as string, { data: newData });
    return ok({ success: true });
  }

  // ── delete_discipline ───────────────────────────────────────────────────────
  if (action === "delete_discipline") {
    const { code } = body;
    if (!code) return err("code required");
    try {
      await writeDisciplinesEN("delete", code as string);
      await writeDisciplinasPT("delete", code as string);
    } catch (e: any) { return err(e.message, 500); }
    return ok({ success: true });
  }

  // ── upsert_instructor ───────────────────────────────────────────────────────
  if (action === "upsert_instructor") {
    const { trigram, data: instData } = body;
    if (!trigram || !instData) return err("trigram and data required");
    const { error: upsertErr } = await adminClient
      .from("instructors")
      .upsert({ ...instData, trigram }, { onConflict: "trigram" });
    if (upsertErr) return err(upsertErr.message, 500);
    return ok({ success: true });
  }

  // ── update_instructor ───────────────────────────────────────────────────────
  if (action === "update_instructor") {
    const { trigram, updates } = body;
    if (!trigram || !updates) return err("trigram and updates required");
    console.log("update_instructor trigram:", trigram, "keys:", Object.keys(updates));

    const { data: updated, error: updateErr } = await adminClient
      .from("instructors")
      .update(updates)
      .eq("trigram", trigram)
      .select("trigram");

    if (updateErr) return err(updateErr.message, 500);

    if (!updated || updated.length === 0) {
      // Fallback: try by id
      const { data: updated2, error: updateErr2 } = await adminClient
        .from("instructors")
        .update(updates)
        .eq("id", trigram)
        .select("trigram");
      if (updateErr2) return err(updateErr2.message, 500);
      return ok({ success: true, updatedByTrigram: 0, updatedById: updated2?.length ?? 0 });
    }

    return ok({ success: true, updatedByTrigram: updated.length });
  }

  // ── delete_instructor ───────────────────────────────────────────────────────
  if (action === "delete_instructor") {
    const { trigram } = body;
    if (!trigram) return err("trigram required");
    const { error: delErr } = await adminClient.from("instructors").delete().eq("trigram", trigram);
    if (delErr) return err(delErr.message, 500);
    return ok({ success: true });
  }

  // ── save_event ──────────────────────────────────────────────────────────────
  if (action === "save_event") {
    const { event } = body;
    if (!event || !event.id) return err("event with id required");
    const { classIds: _ci, isBlocking: _ib, changeRequestId: _cr, instructorTrigram, evaluationType, ...rest } = event as any;
    const safeEvent = { ...rest, instructorId: instructorTrigram || null, ...(evaluationType !== undefined ? { evaluationType } : {}) };
    console.log("save_event upsert payload:", JSON.stringify(safeEvent));
    // Upsert by id — cria se não existir, atualiza se já existir (evita duplicatas)
    const { error: upsErr } = await adminClient
      .from("programacao_aulas")
      .upsert(safeEvent, { onConflict: "id" });
    if (upsErr) {
      console.error("save_event upsert error:", upsErr.code, upsErr.message, upsErr.details);
      return err(`${upsErr.code}: ${upsErr.message}`, 500);
    }
    return ok({ success: true });
  }

  // ── update_event ────────────────────────────────────────────────────────────
  if (action === "update_event") {
    const { id, updates } = body;
    if (!id || !updates) return err("id and updates required");

    // Mapeia apenas campos conhecidos da tabela — evita enviar campos inválidos
    const u = updates as any;
    const safeUpdates: Record<string, unknown> = { id };
    if (u.date             !== undefined) safeUpdates.date            = u.date;
    if (u.startTime        !== undefined) safeUpdates.startTime       = u.startTime;
    if (u.endTime          !== undefined) safeUpdates.endTime         = u.endTime;
    if (u.classId          !== undefined) safeUpdates.classId         = u.classId;
    if (u.disciplineId     !== undefined) safeUpdates.disciplineId    = u.disciplineId;
    if (u.location         !== undefined) safeUpdates.location        = u.location;
    if (u.type             !== undefined) safeUpdates.type            = u.type;
    if (u.evaluationType   !== undefined) safeUpdates.evaluationType  = u.evaluationType;
    if (u.color            !== undefined) safeUpdates.color           = u.color;
    if (u.description      !== undefined) safeUpdates.description     = u.description;
    if (u.notes            !== undefined) safeUpdates.notes           = u.notes;
    if (u.targetSquadron   !== undefined) safeUpdates.targetSquadron  = u.targetSquadron;
    if (u.targetCourse     !== undefined) safeUpdates.targetCourse    = u.targetCourse;
    if (u.targetClass      !== undefined) safeUpdates.targetClass     = u.targetClass;
    if (u.endDate          !== undefined) safeUpdates.endDate         = u.endDate;
    if (u.instructorTrigram !== undefined) safeUpdates.instructorId   = u.instructorTrigram || null;
    console.log("update_event upsert id:", id, "payload:", JSON.stringify(safeUpdates));

    // Upsert by id: atualiza se existir, cria se não existir (nunca deixa 0 linhas afetadas)
    const { error: upErr } = await adminClient
      .from("programacao_aulas")
      .upsert(safeUpdates, { onConflict: "id" });
    if (upErr) {
      console.error("update_event error:", upErr.code, upErr.message, upErr.details);
      return err(upErr.message, 500);
    }
    return ok({ success: true });
  }

  // ── delete_event ────────────────────────────────────────────────────────────
  if (action === "delete_event") {
    const { id } = body;
    if (!id) return err("id required");
    const { error: delErr } = await adminClient
      .from("programacao_aulas")
      .delete()
      .eq("id", id);
    if (delErr) return err(delErr.message, 500);
    return ok({ success: true });
  }

  // ── save_notice ─────────────────────────────────────────────────────────────
  if (action === "save_notice") {
    const { notice } = body;
    if (!notice || !notice.id) return err("notice with id required");
    // Descobre colunas reais fazendo select vazio (schema probe)
    const n = notice as any;
    // Primeiro tenta insert com todos os campos; se falhar por coluna desconhecida, retorna erro detalhado
    const { error: upsErr } = await adminClient.from("notices").upsert({
      id:             n.id,
      title:          n.title,
      description:    n.description ?? null,
      type:           n.type ?? "INFO",
      startDate:      n.startDate ?? null,
      endDate:        n.endDate ?? null,
      targetSquadron: n.targetSquadron ?? null,
      targetCourse:   n.targetCourse ?? null,
      targetClass:    n.targetClass ?? null,
      targetRoles:    n.targetRoles ?? null,
      createdAt:      n.createdAt ?? new Date().toISOString(),
      createdBy:      n.createdBy ?? null,
    });
    if (upsErr) {
      console.error("save_notice upsert error:", upsErr.code, upsErr.message);
      // Tenta versão mínima se houver coluna desconhecida
      const { error: minErr } = await adminClient.from("notices").upsert({
        id:          n.id,
        title:       n.title,
        description: n.description ?? null,
        type:        n.type ?? "INFO",
        startDate:   n.startDate ?? null,
        endDate:     n.endDate ?? null,
      });
      if (minErr) return err(`${minErr.code}: ${minErr.message}`, 500);
    }
    return ok({ success: true });
  }

  // ── update_notice ────────────────────────────────────────────────────────────
  if (action === "update_notice") {
    const { id, updates } = body;
    if (!id || !updates) return err("id and updates required");
    const u = updates as any;
    const safeUpdates: Record<string, unknown> = {};
    if (u.title       !== undefined) safeUpdates.title       = u.title;
    if (u.description !== undefined) safeUpdates.description = u.description;
    if (u.type        !== undefined) safeUpdates.type        = u.type;
    if (u.startDate   !== undefined) safeUpdates.startDate   = u.startDate;
    if (u.endDate     !== undefined) safeUpdates.endDate     = u.endDate;
    const { error: upErr } = await adminClient.from("notices").update(safeUpdates).eq("id", id);
    if (upErr) {
      console.error("update_notice error:", upErr.code, upErr.message);
      return err(`${upErr.code}: ${upErr.message}`, 500);
    }
    return ok({ success: true });
  }

  // ── delete_notice ────────────────────────────────────────────────────────────
  if (action === "delete_notice") {
    const { id } = body;
    if (!id) return err("id required");
    const { error: delErr } = await adminClient.from("notices").delete().eq("id", id);
    if (delErr) return err(delErr.message, 500);
    return ok({ success: true });
  }

  // ── log_action ──────────────────────────────────────────────────────────────
  if (action === "log_action") {
    const { entry } = body;
    if (!entry) return err("entry required");
    const { error: insErr } = await adminClient.from("action_logs").insert({
      action:      entry.action,
      entity:      entry.entity,
      entityId:    entry.entityId,
      entityName:  entry.entityName ?? null,
      changes:     entry.changes ?? null,
      user:        entry.user ?? null,
      userId:      user.id,
    });
    if (insErr) {
      console.error("log_action insert error:", insErr.message);
      return err(insErr.message, 500);
    }
    return ok({ success: true });
  }

  return err("Unknown action");
});
