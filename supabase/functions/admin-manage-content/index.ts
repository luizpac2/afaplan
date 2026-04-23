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

  // getUser uses the Supabase Auth server to validate the token (works with ES256 and HS256)
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    console.warn("auth error:", authErr?.message);
    return err("Unauthorized", 401);
  }

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

  // Escreve na tabela base "disciplinas" (não na VIEW "disciplines")
  async function writeDisciplinesEN(op: "upsert" | "delete", code: string, payload?: Record<string, unknown>) {
    if (op === "upsert" && payload) {
      const row: Record<string, unknown> = {};
      if (payload.name       !== undefined) row.name       = payload.name;
      if (payload.load_hours !== undefined) row.load_hours = payload.load_hours;
      if (payload.color      !== undefined) row.color      = payload.color;
      if (payload.data       !== undefined) row.data       = payload.data;
      let { data: existing } = await adminClient.from("disciplinas").select("id").eq("code", code).maybeSingle();
      if (!existing) {
        const { data: byId } = await adminClient.from("disciplinas").select("id").eq("id", code).maybeSingle();
        existing = byId;
      }
      if (existing) {
        const { error } = await adminClient.from("disciplinas").update(row).eq("id", existing.id);
        if (error) throw new Error(`disciplinas update error: ${error.message}`);
      } else {
        const { error } = await adminClient.from("disciplinas").insert({ ...row, code, id: crypto.randomUUID() });
        if (error) throw new Error(`disciplinas insert error: ${error.message}`);
      }
    } else if (op === "delete") {
      await adminClient.from("disciplinas").delete().eq("code", code);
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
      // writeDisciplinasPT omitido — tabela legada
    } catch (e: any) { return err(e.message, 500); }
    return ok({ success: true });
  }

  // ── update_discipline ───────────────────────────────────────────────────────
  if (action === "update_discipline") {
    const { code, updates } = body;
    if (!code || !updates) return err("code and updates required");
    const u = updates as Record<string, unknown>;
    try {
      // Busca a entrada canônica pelo id=code (padrão legado: id é o próprio código)
      const { data: byId } = await adminClient.from("disciplinas")
        .select("*").eq("id", code).maybeSingle();

      const currentData = (byId?.data && typeof byId.data === "object")
        ? byId.data as Record<string, unknown> : {};
      const incomingData = (u.data && typeof u.data === "object")
        ? u.data as Record<string, unknown> : {};

      const upsertRow: Record<string, unknown> = {
        id:   code,
        code: code,
        data: { ...currentData, ...incomingData },
      };
      if (u.name       !== undefined) upsertRow.name       = u.name;
      if (u.load_hours !== undefined) upsertRow.load_hours = u.load_hours;
      if (u.color      !== undefined) upsertRow.color      = u.color;

      // Upsert por id — nunca cria duplicata
      const { error: upsErr } = await adminClient.from("disciplinas")
        .upsert(upsertRow, { onConflict: "id" });
      if (upsErr) throw new Error(`update failed: ${upsErr.message}`);

      // Remove entradas duplicadas com mesmo code OU sigla mas id diferente
      const { data: allDups } = await adminClient.from("disciplinas").select("id, code, sigla");
      const dupIds = (allDups ?? [])
        .filter((r: any) => r.id !== code && (r.code === code || r.sigla === code))
        .map((r: any) => r.id);
      if (dupIds.length > 0) {
        // Migra eventos das duplicatas para o id canônico antes de deletar
        for (const dupId of dupIds) {
          await adminClient.from("programacao_aulas")
            .update({ disciplina_id: code }).eq("disciplina_id", dupId);
        }
        await adminClient.from("disciplinas").delete().in("id", dupIds);
        console.log("update_discipline: removidas duplicatas:", dupIds);
      }
    } catch (e: any) {
      console.error("update_discipline error:", e.message);
      return err(e.message, 500);
    }
    return ok({ success: true });
  }

  // ── sync_discipline_instructor ──────────────────────────────────────────────
  if (action === "sync_discipline_instructor") {
    const { code, warName } = body;
    if (!code || !warName) return err("code and warName required");
    const { data: row } = await adminClient.from("disciplinas").select("*").eq("code", code).maybeSingle();
    const newData = { ...(row?.data || {}), instructor: warName };
    await writeDisciplinesEN("upsert", code as string, {
      name: row?.name,
      load_hours: row?.load_hours,
      data: newData,
    });
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
    
    const e = event as any;

    // Resolve turma_id (nome "1A" -> UUID)
    let turmaId = e.classId;
    if (e.classId && e.classId.length <= 3) {
      const { data: tData } = await adminClient.from("turmas").select("id").eq("nome", e.classId).maybeSingle();
      if (tData) turmaId = tData.id;
    }
    
    // Mapeamento explícito de camelCase (frontend) → snake_case (banco de dados)
    const safeEvent: Record<string, unknown> = {
      id: e.id,
      data: e.date,
      horario_inicio: e.startTime,
      horario_fim: e.endTime,
      turma_id: turmaId,               // UUID resolvido
      disciplina_id: e.disciplineId,
      local_id: e.location || null,
      type: e.type || 'CLASS',
    };
    
    // Campos opcionais que existem no banco
    if (e.changeRequestId !== undefined) safeEvent.changeRequestId = e.changeRequestId;
    if (e.type !== undefined) safeEvent.type = e.type;
    if (e.evaluationType !== undefined) safeEvent.evaluationType = e.evaluationType;
    if (e.color !== undefined) safeEvent.color = e.color;
    if (e.targetSquadron !== undefined) safeEvent.targetSquadron = e.targetSquadron;
    if (e.targetCourse !== undefined) safeEvent.targetCourse = e.targetCourse;
    if (e.targetClass !== undefined) safeEvent.targetClass = e.targetClass;
    if (e.description !== undefined) safeEvent.description = e.description;
    if (e.notes !== undefined) safeEvent.notes = e.notes;
    if (e.endDate !== undefined) safeEvent.endDate = e.endDate;
    
    // Mapear instructorId se houver instructorTrigram
    // TODO: se necessário fazer lookup de docente_id por trigram, adicionar aqui
    if (e.instructorTrigram) safeEvent.instructorId = e.instructorTrigram;
    
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

    const u = updates as any;
    // Mapeamento explícito de camelCase (frontend) → snake_case (banco)
    const safeUpdates: Record<string, unknown> = {};
    
    if (u.date             !== undefined) safeUpdates.data             = u.date;
    if (u.startTime        !== undefined) safeUpdates.horario_inicio   = u.startTime;
    if (u.endTime          !== undefined) safeUpdates.horario_fim      = u.endTime;
    if (u.classId          !== undefined) safeUpdates.turma_id         = u.classId;
    if (u.disciplineId     !== undefined) safeUpdates.disciplina_id    = u.disciplineId;
    if (u.location         !== undefined) safeUpdates.local_id         = u.location;
    if (u.instructorTrigram !== undefined) safeUpdates.instructorId   = u.instructorTrigram || null;
    if (u.changeRequestId   !== undefined) safeUpdates.changeRequestId = u.changeRequestId;
    if (u.type              !== undefined) safeUpdates.type            = u.type;
    if (u.evaluationType    !== undefined) safeUpdates.evaluationType  = u.evaluationType;
    if (u.color             !== undefined) safeUpdates.color           = u.color;
    if (u.targetSquadron    !== undefined) safeUpdates.targetSquadron  = u.targetSquadron;
    if (u.targetCourse      !== undefined) safeUpdates.targetCourse    = u.targetCourse;
    if (u.targetClass       !== undefined) safeUpdates.targetClass     = u.targetClass;
    if (u.description       !== undefined) safeUpdates.description     = u.description;
    if (u.notes             !== undefined) safeUpdates.notes           = u.notes;
    if (u.endDate           !== undefined) safeUpdates.endDate         = u.endDate;
    
    console.log("update_event id:", id, "payload:", JSON.stringify(safeUpdates));

    // Upsert by id: atualiza se existir, cria se não existir (nunca deixa 0 linhas afetadas)
    const { error: upErr } = await adminClient
      .from("programacao_aulas")
      .upsert({ id, ...safeUpdates }, { onConflict: "id" });
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
      entity_id:   entry.entityId,
      entity_name: entry.entityName ?? null,
      changes:     entry.changes ?? null,
      actor_name:  entry.user ?? null,
      actor_id:    user.id,
    });
    if (insErr) {
      console.error("log_action insert error:", insErr.message);
      return err(insErr.message, 500);
    }
    return ok({ success: true });
  }

  // ── instruction_locations CRUD ──────────────────────────────────────────────
  if (action === "save_location") {
    const { location } = body;
    if (!location) return err("location required");
    const l = location as Record<string, unknown>;
    const row: Record<string, unknown> = {
      name:             l.name,
      type:             l.type,
      capacity:         l.capacity,
      equipment:        l.equipment ?? [],
      status:           l.status ?? "ATIVO",
      notes:            l.notes ?? null,
      observation_log:  l.observationLog ?? l.observation_log ?? [],
    };
    if (l.id) {
      // UPDATE existente
      const { error } = await adminClient.from("instruction_locations")
        .update(row).eq("id", l.id as string);
      if (error) { console.error("save_location update error:", error.message); return err(error.message, 500); }
      return ok({ success: true, id: l.id });
    } else {
      // INSERT novo — banco gera o uuid
      const { data, error } = await adminClient.from("instruction_locations")
        .insert(row).select("id").single();
      if (error) { console.error("save_location insert error:", error.message); return err(error.message, 500); }
      return ok({ success: true, id: data.id });
    }
  }

  if (action === "delete_location") {
    const { id } = body;
    if (!id) return err("id required");
    const { error } = await adminClient.from("instruction_locations").delete().eq("id", id as string);
    if (error) return err(error.message, 500);
    return ok({ success: true });
  }

  // ── location_issues CRUD ────────────────────────────────────────────────────
  if (action === "save_issue") {
    const { issue } = body;
    if (!issue) return err("issue required");
    const i = issue as Record<string, unknown>;
    const row: Record<string, unknown> = {
      location_id:  i.locationId ?? i.location_id,
      date:         i.date,
      description:  i.description,
      severity:     i.severity ?? "MEDIA",
      status:       i.status ?? "ABERTA",
      resolution:   i.resolution ?? null,
      created_by:   user.id,
    };
    if (i.id) row.id = i.id;
    const { error } = await adminClient.from("location_issues")
      .upsert(row, { onConflict: "id", ignoreDuplicates: false });
    if (error) return err(error.message, 500);
    return ok({ success: true });
  }

  if (action === "delete_issue") {
    const { id } = body;
    if (!id) return err("id required");
    const { error } = await adminClient.from("location_issues").delete().eq("id", id as string);
    if (error) return err(error.message, 500);
    return ok({ success: true });
  }

  // ── location_reservations CRUD ───────────────────────────────────────────────
  if (action === "save_reservation") {
    const { reservation } = body;
    if (!reservation) return err("reservation required");
    const r = reservation as Record<string, unknown>;
    const row: Record<string, unknown> = {
      location_id: r.locationId ?? r.location_id,
      date:        r.date,
      start_time:  r.startTime ?? r.start_time,
      end_time:    r.endTime   ?? r.end_time,
      event_id:    r.eventId   ?? r.event_id   ?? null,
      class_id:    r.classId   ?? r.class_id   ?? null,
      label:       r.label     ?? null,
      created_by:  user.id,
    };
    if (r.id) row.id = r.id;
    const { error } = await adminClient.from("location_reservations")
      .upsert(row, { onConflict: "id", ignoreDuplicates: false });
    if (error) return err(error.message, 500);
    return ok({ success: true });
  }

  if (action === "delete_reservation") {
    const { id } = body;
    if (!id) return err("id required");
    const { error } = await adminClient.from("location_reservations").delete().eq("id", id as string);
    if (error) return err(error.message, 500);
    return ok({ success: true });
  }

  // ── app_configs CRUD ─────────────────────────────────────────────────────────
  if (action === "save_app_config") {
    const { key, value } = body;
    if (!key) return err("key required");
    const { error } = await adminClient.from("app_configs")
      .upsert({ key, value }, { onConflict: "key" });
    if (error) { console.error("save_app_config error:", error.message); return err(error.message, 500); }
    return ok({ success: true });
  }

  // ── find_orphan_discipline_ids ───────────────────────────────────────────────
  // Retorna todos os disciplina_id em programacao_aulas que não existem em disciplinas
  if (action === "find_orphan_discipline_ids") {
    const { data: events } = await adminClient.from("programacao_aulas").select("disciplina_id");
    const { data: disciplines } = await adminClient.from("disciplinas").select("id");
    const validIds = new Set((disciplines ?? []).map((d: any) => d.id));
    const orphanIds = [...new Set((events ?? []).map((e: any) => e.disciplina_id).filter((id: any) => id && !validIds.has(id)))];
    const counts: Record<string, number> = {};
    for (const id of orphanIds) {
      counts[id] = (events ?? []).filter((e: any) => e.disciplina_id === id).length;
    }
    return ok({ orphanIds, counts, validDisciplines: disciplines });
  }

  // ── reassign_discipline_id ───────────────────────────────────────────────────
  // Atualiza todos os eventos que referenciam old_id para apontar para new_id
  if (action === "reassign_discipline_id") {
    const { old_id, new_id } = body;
    if (!old_id || !new_id) return err("old_id and new_id required");
    const { data, error } = await adminClient
      .from("programacao_aulas")
      .update({ disciplina_id: new_id })
      .eq("disciplina_id", old_id)
      .select("id");
    if (error) return err(error.message, 500);
    return ok({ success: true, updatedCount: data?.length ?? 0 });
  }

  // ── consolidate_discipline ──────────────────────────────────────────────────
  // Garante que a disciplina existe com id=code, migra todos os eventos para esse id
  // e apaga entradas duplicadas com id UUID.
  if (action === "consolidate_discipline") {
    const { code } = body;
    if (!code) return err("code required");

    // 1. Busca todas as linhas que representam essa disciplina (inclui coluna sigla)
    const { data: allRows } = await adminClient.from("disciplinas").select("*");
    const matches = (allRows ?? []).filter((r: any) =>
      r.code === code || r.id === code || r.sigla === code ||
      (r.name && r.name.toUpperCase().includes(code.toUpperCase())) ||
      (r.nome && r.nome.toUpperCase().includes(code.toUpperCase()))
    );

    // 2. Verifica se já existe uma entrada com id = code
    const canonical = matches.find((r: any) => r.id === code);
    const duplicates = matches.filter((r: any) => r.id !== code);

    let canonicalRow: any = canonical;

    if (!canonicalRow) {
      // Cria a entrada canônica com id = code
      const source = matches[0] ?? {};
      const { error: insErr } = await adminClient.from("disciplinas").insert({
        id:         code,
        code:       source.code ?? code,
        name:       source.name ?? source.nome ?? code,
        color:      source.color ?? null,
        data:       source.data ?? null,
        load_hours: source.load_hours ?? source.carga_horaria ?? 0,
      });
      if (insErr) return err(`Erro ao criar entrada canônica: ${insErr.message}`, 500);
      canonicalRow = { id: code };
    }

    // 3. Migra eventos de todas as variantes (ids UUID) para id=code
    let totalMigrated = 0;
    for (const dup of duplicates) {
      const { data: migrated, error: migErr } = await adminClient
        .from("programacao_aulas")
        .update({ disciplina_id: code })
        .eq("disciplina_id", dup.id)
        .select("id");
      if (migErr) console.warn("migrate error:", migErr.message);
      totalMigrated += migrated?.length ?? 0;
    }

    // 4. Apaga as entradas com id UUID (duplicatas)
    for (const dup of duplicates) {
      await adminClient.from("disciplinas").delete().eq("id", dup.id);
    }

    return ok({
      success: true,
      canonicalId: code,
      duplicatesRemoved: duplicates.map((d: any) => d.id),
      eventsMigrated: totalMigrated,
    });
  }

  // ── find_discipline_duplicates ──────────────────────────────────────────────
  if (action === "find_discipline_duplicates") {
    const { code } = body;
    if (!code) return err("code required");
    // Busca por qualquer coluna que possa conter o código
    const { data: allRows } = await adminClient.from("disciplinas").select("*");
    const matches = (allRows ?? []).filter((r: any) =>
      r.code === code || r.sigla === code ||
      (r.name && r.name.toUpperCase().includes(code.toUpperCase())) ||
      (r.nome && r.nome.toUpperCase().includes(code.toUpperCase()))
    );
    // Para cada match, conta eventos vinculados
    const results = await Promise.all(matches.map(async (d: any) => {
      const { count } = await adminClient.from("programacao_aulas")
        .select("id", { count: "exact", head: true })
        .eq("disciplina_id", d.id);
      return { ...d, eventCount: count ?? 0 };
    }));
    return ok({ matches: results });
  }

  // ── probe_schema (diagnóstico) ───────────────────────────────────────────────
  if (action === "probe_schema") {
    const { table } = body;
    if (!table) return err("table required");
    const { data, error } = await adminClient.from(table as string).select("*").limit(1);
    if (error) return err(`probe error: ${error.message}`, 500);
    const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
    return ok({ table, columns, sampleRow: data?.[0] ?? null });
  }

  return err("Unknown action");
});
