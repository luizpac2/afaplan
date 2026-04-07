-- ============================================================
-- fix_security_linter.sql
-- Corrige erros do Supabase Security Linter
-- Execute no SQL Editor do Supabase (script idempotente)
-- ============================================================

-- ── 1. Habilitar RLS nas tabelas com policies mas RLS desativado ──────────────
ALTER TABLE public.schedule_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semester_configs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_configs           ENABLE ROW LEVEL SECURITY;

-- Recriar policies (idempotente) para que o acesso continue funcionando
DROP POLICY IF EXISTS "auth_read"  ON public.semester_configs;
CREATE POLICY "auth_read" ON public.semester_configs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_read"  ON public.visual_configs;
CREATE POLICY "auth_read" ON public.visual_configs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_read"  ON public.schedule_change_requests;
DROP POLICY IF EXISTS "auth_write" ON public.schedule_change_requests;
CREATE POLICY "auth_read" ON public.schedule_change_requests
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON public.schedule_change_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 2. Views SECURITY DEFINER → ativar SECURITY INVOKER ──────────────────────
-- ALTER VIEW é o jeito mais seguro: não precisa conhecer a definição da view.
-- Se "disciplines" ou "cohorts" for uma tabela (não view), este comando falha
-- silenciosamente ou com erro ignorável — sem impacto no dado.

ALTER VIEW IF EXISTS public.disciplines     SET (security_invoker = on);
ALTER VIEW IF EXISTS public.cohorts         SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_usuarios      SET (security_invoker = on);

-- vw_faltas_resumo: recriar completo (definição conhecida) com security_invoker
CREATE OR REPLACE VIEW public.vw_faltas_resumo
  WITH (security_invoker = on)
AS
SELECT
  f.id,
  f.cadet_id,
  c.nome_guerra,
  c.nome_completo,
  c.quadro,
  c.cohort_id,
  f.aula_id,
  pa.date                    AS data_aula,
  pa."startTime"             AS horario_inicio,
  pa."endTime"               AS horario_fim,
  COALESCE(d.code, d.id)     AS disciplina_sigla,
  COALESCE(d.name, d.id)     AS disciplina_nome,
  pa."classId"               AS turma_nome,
  CASE
    WHEN pa."classId" LIKE '%ESQ' THEN NULL
    ELSE RIGHT(pa."classId", 1)
  END                        AS turma_aula,
  f.motivo,
  f.observacao,
  f.chefe_cadet_id,
  cc.nome_guerra             AS chefe_nome_guerra,
  f.created_at
FROM public.faltas_cadetes f
JOIN public.cadetes c             ON c.id  = f.cadet_id
JOIN public.cadetes cc            ON cc.id = f.chefe_cadet_id
JOIN public.programacao_aulas pa  ON pa.id = f.aula_id
JOIN public.disciplines d         ON d.id  = pa."disciplineId";

-- ── 3. v_usuarios: restringir acesso anônimo (expõe auth.users) ───────────────
-- Revogar acesso de anon, manter apenas authenticated
REVOKE ALL ON public.v_usuarios FROM anon;
GRANT  SELECT ON public.v_usuarios TO authenticated;
