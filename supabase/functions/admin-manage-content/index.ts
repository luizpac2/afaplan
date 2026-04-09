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
  if (!isSuperAdmin && role !== "gestor" && role !== "super_admin") {
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
      // Remove colunas que não pertencem à tabela disciplines
      const { code: _c, sigla: _s, nome: _n, carga_horaria: _ch, ...rest } = payload as any;
      console.log("disciplines update payload:", JSON.stringify(rest), "lookup code:", code);

      // Tenta por 'code' primeiro
      const { data: r1, error: e1 } = await adminClient.from("disciplines")
        .update(rest).eq("code", code).select("id");
      console.log("update by code — rows:", r1?.length ?? 0, "error:", e1?.message ?? "none");

      if (!e1 && (!r1 || r1.length === 0)) {
        // Fallback: tenta por 'sigla'
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
  if (action === "update_discipline") {
    const { code, updates } = body;
    if (!code || !updates) return err("code and updates required");
    console.log("update_discipline code:", code, "keys:", Object.keys(updates));
    try {
      await writeDisciplinesEN("update", code as string, updates as Record<string, unknown>);
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
