-- ============================================================
-- faltas_chefe_turma.sql
-- Módulo: Chefe de Turma — Lançamento de Faltas
-- Execute no SQL Editor do Supabase (script idempotente)
-- ============================================================

-- ── 1. Colunas extras em user_roles para cadetes ─────────────
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS cadet_id   text  REFERENCES public.cadetes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS turma_aula text;

-- ── 2. Tabela de nomeações de Chefe de Turma ────────────────
CREATE TABLE IF NOT EXISTS public.chefes_turma (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cadet_id    text NOT NULL REFERENCES public.cadetes(id) ON DELETE CASCADE,
  turma_aula  text NOT NULL,
  cohort_id   text NOT NULL,
  data_inicio date NOT NULL,
  data_fim    date NOT NULL,
  nomeado_por uuid REFERENCES auth.users(id),
  ativo       bool NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT chk_periodo CHECK (data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS idx_chefes_turma_aula_data
  ON public.chefes_turma(turma_aula, data_inicio, data_fim) WHERE ativo = true;

-- ── 3. Tabela de Faltas lançadas pelo Chefe de Turma ────────
CREATE TABLE IF NOT EXISTS public.faltas_cadetes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id         text NOT NULL REFERENCES public.programacao_aulas(id) ON DELETE CASCADE,
  cadet_id        text NOT NULL REFERENCES public.cadetes(id) ON DELETE CASCADE,
  motivo          text NOT NULL,
  observacao      text,
  chefe_cadet_id  text NOT NULL REFERENCES public.cadetes(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (aula_id, cadet_id)
);

CREATE INDEX IF NOT EXISTS idx_faltas_cadet  ON public.faltas_cadetes(cadet_id);
CREATE INDEX IF NOT EXISTS idx_faltas_aula   ON public.faltas_cadetes(aula_id);
CREATE INDEX IF NOT EXISTS idx_faltas_chefe  ON public.faltas_cadetes(chefe_cadet_id);

DROP TRIGGER IF EXISTS trg_faltas_updated_at ON public.faltas_cadetes;
CREATE TRIGGER trg_faltas_updated_at
  BEFORE UPDATE ON public.faltas_cadetes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 4. Funções helper (sem dependência de get_my_role) ───────

CREATE OR REPLACE FUNCTION public.get_my_cadet_id()
RETURNS text AS $$
  SELECT cadet_id FROM public.user_roles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_my_turma_aula()
RETURNS text AS $$
  SELECT turma_aula FROM public.user_roles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_chefe_turma_ativo()
RETURNS bool AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chefes_turma ct
    JOIN public.user_roles ur ON ur.cadet_id = ct.cadet_id
    WHERE ur.user_id = auth.uid()
      AND ct.ativo = true
      AND CURRENT_DATE BETWEEN ct.data_inicio AND ct.data_fim
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_chefe_turma_aula()
RETURNS text AS $$
  SELECT ct.turma_aula
  FROM public.chefes_turma ct
  JOIN public.user_roles ur ON ur.cadet_id = ct.cadet_id
  WHERE ur.user_id = auth.uid()
    AND ct.ativo = true
    AND CURRENT_DATE BETWEEN ct.data_inicio AND ct.data_fim
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper inline para verificar se é gestor/super_admin
-- (substitui get_my_role() que não existe neste banco)
-- Inclui fallback por email para super_admins sem linha em user_roles
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS bool AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('gestor', 'super_admin')
  )
  OR (auth.jwt() ->> 'email') = 'pelicano307@gmail.com';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── 5. RLS para chefes_turma ─────────────────────────────────
ALTER TABLE public.chefes_turma ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_chefes"             ON public.chefes_turma;
DROP POLICY IF EXISTS "cadete_select_proprio_chefia" ON public.chefes_turma;

CREATE POLICY "admin_all_chefes" ON public.chefes_turma
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "cadete_select_proprio_chefia" ON public.chefes_turma
  FOR SELECT TO authenticated
  USING (cadet_id = public.get_my_cadet_id());

-- ── 6. RLS para faltas_cadetes ───────────────────────────────
ALTER TABLE public.faltas_cadetes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_faltas"              ON public.faltas_cadetes;
DROP POLICY IF EXISTS "chefe_insert_faltas"           ON public.faltas_cadetes;
DROP POLICY IF EXISTS "chefe_update_faltas"           ON public.faltas_cadetes;
DROP POLICY IF EXISTS "chefe_delete_faltas"           ON public.faltas_cadetes;
DROP POLICY IF EXISTS "cadete_select_proprias_faltas" ON public.faltas_cadetes;

CREATE POLICY "admin_all_faltas" ON public.faltas_cadetes
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "chefe_insert_faltas" ON public.faltas_cadetes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_chefe_turma_ativo()
    AND chefe_cadet_id = public.get_my_cadet_id()
    AND EXISTS (
      SELECT 1 FROM public.programacao_aulas pa
      WHERE pa.id = aula_id AND pa.date < CURRENT_DATE
    )
  );

CREATE POLICY "chefe_update_faltas" ON public.faltas_cadetes
  FOR UPDATE TO authenticated
  USING  (public.is_chefe_turma_ativo() AND chefe_cadet_id = public.get_my_cadet_id())
  WITH CHECK (public.is_chefe_turma_ativo() AND chefe_cadet_id = public.get_my_cadet_id());

CREATE POLICY "chefe_delete_faltas" ON public.faltas_cadetes
  FOR DELETE TO authenticated
  USING (public.is_chefe_turma_ativo() AND chefe_cadet_id = public.get_my_cadet_id());

CREATE POLICY "cadete_select_proprias_faltas" ON public.faltas_cadetes
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR cadet_id = public.get_my_cadet_id()
    OR public.is_chefe_turma_ativo()
  );

-- ── 7. VIEW: resumo de faltas ────────────────────────────────
-- Nota: programacao_aulas usa colunas camelCase (disciplineId, classId,
-- startTime, endTime) e não tem FK para turmas/turma_secoes.
CREATE OR REPLACE VIEW public.vw_faltas_resumo AS
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
  -- Última letra do classId é a seção (ex: "1A" → "A"), "ESQ" = turma inteira
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
JOIN public.disciplines d          ON d.id  = pa."disciplineId";

-- ── 8. Policy em programacao_aulas para chefe ver aulas passadas
DROP POLICY IF EXISTS "chefe_select_aulas_turma" ON public.programacao_aulas;

CREATE POLICY "chefe_select_aulas_turma" ON public.programacao_aulas
  FOR SELECT TO authenticated
  USING (
    public.is_chefe_turma_ativo()
    AND date < CURRENT_DATE
  );

-- ── 9. Trigger de auditoria ──────────────────────────────────
DROP TRIGGER IF EXISTS audit_faltas ON public.faltas_cadetes;

CREATE TRIGGER audit_faltas
  AFTER INSERT OR UPDATE OR DELETE ON public.faltas_cadetes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
