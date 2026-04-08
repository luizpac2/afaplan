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

  // Only ADMIN / SUPER_ADMIN can call this
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: roleRow } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const isSuperAdmin = user.email === "pelicano307@gmail.com";
  const role = roleRow?.role;
  if (!isSuperAdmin && role !== "gestor" && role !== "super_admin") {
    return err("Forbidden", 403);
  }

  const body = await req.json();
  const { action } = body;

  // helper: grava em disciplines (tabela lida pelo app) e também em disciplinas (legado)
  async function writeDiscipline(op: "upsert" | "update" | "delete", code: string, payload?: Record<string, unknown>) {
    if (op === "upsert" && payload) {
      await adminClient.from("disciplines").upsert({ ...payload, code }, { onConflict: "code" });
      await adminClient.from("disciplinas").upsert({ ...payload, code }, { onConflict: "code" }).catch(() => {});
    } else if (op === "update" && payload) {
      await adminClient.from("disciplines").update(payload).eq("code", code);
      await adminClient.from("disciplinas").update(payload).eq("code", code).catch(() => {});
    } else if (op === "delete") {
      await adminClient.from("disciplines").delete().eq("code", code);
      await adminClient.from("disciplinas").delete().eq("code", code).catch(() => {});
    }
  }

  // ── upsert_discipline ───────────────────────────────────────────────────────
  if (action === "upsert_discipline") {
    const { code, data: disciplineData } = body;
    if (!code || !disciplineData) return err("code and data required");
    try {
      await writeDiscipline("upsert", code as string, disciplineData as Record<string, unknown>);
    } catch (e: any) { return err(e.message, 500); }
    return ok({ success: true });
  }

  // ── update_discipline ───────────────────────────────────────────────────────
  if (action === "update_discipline") {
    const { code, updates } = body;
    if (!code || !updates) return err("code and updates required");
    try {
      await writeDiscipline("update", code as string, updates as Record<string, unknown>);
    } catch (e: any) { return err(e.message, 500); }
    return ok({ success: true });
  }

  // ── sync_discipline_instructor ──────────────────────────────────────────────
  if (action === "sync_discipline_instructor") {
    const { code, warName } = body;
    if (!code || !warName) return err("code and warName required");

    // Busca data atual de disciplines (fonte primária)
    const { data: row } = await adminClient
      .from("disciplines")
      .select("data")
      .eq("code", code)
      .maybeSingle();

    const newData = { ...(row?.data || {}), instructor: warName };
    await writeDiscipline("update", code as string, { data: newData });
    return ok({ success: true });
  }

  // ── delete_discipline ───────────────────────────────────────────────────────
  if (action === "delete_discipline") {
    const { code } = body;
    if (!code) return err("code required");
    try {
      await writeDiscipline("delete", code as string);
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

    if (upsertErr) {
      console.error("upsert_instructor error:", upsertErr);
      return err(upsertErr.message, 500);
    }
    return ok({ success: true });
  }

  // ── update_instructor ───────────────────────────────────────────────────────
  if (action === "update_instructor") {
    const { trigram, updates } = body;
    if (!trigram || !updates) return err("trigram and updates required");

    console.log("update_instructor trigram:", trigram, "updates keys:", Object.keys(updates));

    // Try by trigram column first
    const { data: updated, error: updateErr } = await adminClient
      .from("instructors")
      .update(updates)
      .eq("trigram", trigram)
      .select("trigram");

    if (updateErr) {
      console.error("update_instructor error:", updateErr);
      return err(updateErr.message, 500);
    }

    console.log("update_instructor rows updated:", updated?.length ?? 0);

    // Fallback: try by id (JS trigram might be the DB uuid)
    if (!updated || updated.length === 0) {
      const { data: updated2, error: updateErr2 } = await adminClient
        .from("instructors")
        .update(updates)
        .eq("id", trigram)
        .select("trigram");

      if (updateErr2) {
        console.error("update_instructor fallback error:", updateErr2);
        return err(updateErr2.message, 500);
      }
      console.log("update_instructor fallback by id rows updated:", updated2?.length ?? 0);
      return ok({ success: true, updatedByTrigram: 0, updatedById: updated2?.length ?? 0 });
    }

    return ok({ success: true, updatedByTrigram: updated.length });
  }

  // ── delete_instructor ───────────────────────────────────────────────────────
  if (action === "delete_instructor") {
    const { trigram } = body;
    if (!trigram) return err("trigram required");

    const { error: delErr } = await adminClient
      .from("instructors")
      .delete()
      .eq("trigram", trigram);

    if (delErr) {
      console.error("delete_instructor error:", delErr);
      return err(delErr.message, 500);
    }
    return ok({ success: true });
  }

  return err("Unknown action");
});
