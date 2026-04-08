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

  // ── upsert_discipline ───────────────────────────────────────────────────────
  if (action === "upsert_discipline") {
    const { sigla, data: disciplineData } = body;
    if (!sigla || !disciplineData) return err("sigla and data required");

    const { error: upsertErr } = await adminClient
      .from("disciplinas")
      .upsert({ ...disciplineData, sigla }, { onConflict: "sigla" });

    if (upsertErr) {
      console.error("upsert_discipline error:", upsertErr);
      return err(upsertErr.message, 500);
    }
    return ok({ success: true });
  }

  // ── update_discipline ───────────────────────────────────────────────────────
  if (action === "update_discipline") {
    const { sigla, updates } = body;
    if (!sigla || !updates) return err("sigla and updates required");

    const { error: updateErr } = await adminClient
      .from("disciplinas")
      .update(updates)
      .eq("sigla", sigla);

    if (updateErr) {
      console.error("update_discipline error:", updateErr);
      return err(updateErr.message, 500);
    }
    return ok({ success: true });
  }

  // ── delete_discipline ───────────────────────────────────────────────────────
  if (action === "delete_discipline") {
    const { sigla } = body;
    if (!sigla) return err("sigla required");

    const { error: delErr } = await adminClient
      .from("disciplinas")
      .delete()
      .eq("sigla", sigla);

    if (delErr) {
      console.error("delete_discipline error:", delErr);
      return err(delErr.message, 500);
    }
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

    const { error: updateErr } = await adminClient
      .from("instructors")
      .update(updates)
      .eq("trigram", trigram);

    if (updateErr) {
      console.error("update_instructor error:", updateErr);
      return err(updateErr.message, 500);
    }
    return ok({ success: true });
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
