-- ============================================================
-- faltas_chefe_turma.sql
-- Módulo: Chefe de Turma — Lançamento de Faltas
-- Execute no SQL Editor do Supabase (em ordem)
-- ============================================================

-- ── 1. Colunas extras em user_roles para cadetes ─────────────
-- Vincula o usuário auth ao cadete e à sua turma de aula atual
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS cadet_id   text  REFERENCES public.cadetes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS turma_aula text;   -- 'TURMA_A'…'TURMA_F' (ano letivo corrente)

COMMENT ON COLUMN public.user_roles.cadet_id   IS 'Preenchido quando role = cadete. Liga auth → cadetes.id';
COMMENT ON COLUMN public.user_roles.turma_aula IS 'Turma de aula corrente do cadete (ex: TURMA_A). Admin atualiza no início de cada ano.';

-- ── 2. Tabela de nomeações de Chefe de Turma ────────────────
CREATE TABLE IF NOT EXISTS public.chefes_turma (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cadet_id    text NOT NULL REFERENCES public.cadetes(id) ON DELETE CASCADE,
  turma_aula  text NOT NULL,           -- 'TURMA_A'…'TURMA_F'
  cohort_id   text NOT NULL,           -- esquadrão (cohort) do chefe
  data_inicio date NOT NULL,           -- início da semana (segunda-feira)
  data_fim    date NOT NULL,           -- fim da semana (domingo)
  nomeado_por uuid REFERENCES auth.users(id),
  ativo       bool NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT chk_periodo CHECK (data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS idx_chefes_turma_aula_data
  ON public.chefes_turma(turma_aula, data_inicio, data_fim) WHERE ativo = true;

COMMENT ON TABLE public.chefes_turma IS
  'Registra qual cadete exerce a função de Chefe de Turma em cada semana letiva, por turma de aula.';

-- ── 3. Tabela de Faltas lançadas pelo Chefe de Turma ────────
CREATE TABLE IF NOT EXISTS public.faltas_cadetes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id         uuid NOT NULL REFERENCES public.programacao_aulas(id) ON DELETE CASCADE,
  cadet_id        text NOT NULL REFERENCES public.cadetes(id) ON DELETE CASCADE,
  motivo          text NOT NULL,       -- ver lista padronizada no frontend
  observacao      text,
  chefe_cadet_id  text NOT NULL REFERENCES public.cadetes(id), -- quem registrou
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (aula_id, cadet_id)           -- 1 registro por cadete por aula
);

CREATE INDEX IF NOT EXISTS idx_faltas_cadet   ON public.faltas_cadetes(cadet_id);
CREATE INDEX IF NOT EXISTS idx_faltas_aula    ON public.faltas_cadetes(aula_id);
CREATE INDEX IF NOT EXISTS idx_faltas_chefe   ON public.faltas_cadetes(chefe_cadet_id);

CREATE TRIGGER trg_faltas_updated_at
  BEFORE UPDATE ON public.faltas_cadetes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.faltas_cadetes IS
  'Faltas registradas pelo Chefe de Turma para cada aula já realizada.';

-- ── 4. Funções helper de RLS ─────────────────────────────────

-- Retorna o cadet_id do usuário logado (null se não for cadete)
CREATE OR REPLACE FUNCTION public.get_my_cadet_id()
RETURNS text AS $$
  SELECT cadet_id FROM public.user_roles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Retorna a turma_aula do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_turma_aula()
RETURNS text AS $$
  SELECT turma_aula FROM public.user_roles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Verifica se o usuário logado é Chefe de Turma ativo hoje
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

-- Retorna a turma_aula que o chefe logado gerencia hoje
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

-- ── 5. RLS para chefes_turma ─────────────────────────────────
ALTER TABLE public.chefes_turma ENABLE ROW LEVEL SECURITY;

-- Admins: acesso total
CREATE POLICY "admin_all_chefes" ON public.chefes_turma
  FOR ALL TO authenticated
  USING (get_my_role() IN ('gestor', 'super_admin'))
  WITH CHECK (get_my_role() IN ('gestor', 'super_admin'));

-- Cadetes: veem apenas o próprio registro
CREATE POLICY "cadete_select_proprio_chefia" ON public.chefes_turma
  FOR SELECT TO authenticated
  USING (
    cadet_id = get_my_cadet_id()
  );

-- ── 6. RLS para faltas_cadetes ───────────────────────────────
ALTER TABLE public.faltas_cadetes ENABLE ROW LEVEL SECURITY;

-- Admins: acesso total
CREATE POLICY "admin_all_faltas" ON public.faltas_cadetes
  FOR ALL TO authenticated
  USING (get_my_role() IN ('gestor', 'super_admin'))
  WITH CHECK (get_my_role() IN ('gestor', 'super_admin'));

-- Chefe de turma ativo: INSERT/UPDATE/DELETE apenas na própria turma
CREATE POLICY "chefe_insert_faltas" ON public.faltas_cadetes
  FOR INSERT TO authenticated
  WITH CHECK (
    is_chefe_turma_ativo()
    AND chefe_cadet_id = get_my_cadet_id()
    AND EXISTS (
      -- A aula pertence à turma de aula que o chefe gerencia
      SELECT 1 FROM public.programacao_aulas pa
      JOIN public.turma_secoes ts ON ts.id = pa.secao_id
      WHERE pa.id = faltas_cadetes.aula_id
        AND pa.data < CURRENT_DATE  -- apenas aulas passadas
    )
  );

CREATE POLICY "chefe_update_faltas" ON public.faltas_cadetes
  FOR UPDATE TO authenticated
  USING (
    is_chefe_turma_ativo()
    AND chefe_cadet_id = get_my_cadet_id()
  )
  WITH CHECK (
    is_chefe_turma_ativo()
    AND chefe_cadet_id = get_my_cadet_id()
  );

CREATE POLICY "chefe_delete_faltas" ON public.faltas_cadetes
  FOR DELETE TO authenticated
  USING (
    is_chefe_turma_ativo()
    AND chefe_cadet_id = get_my_cadet_id()
  );

-- Cadetes: veem as próprias faltas
CREATE POLICY "cadete_select_proprias_faltas" ON public.faltas_cadetes
  FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('gestor', 'super_admin')
    OR cadet_id = get_my_cadet_id()
    OR is_chefe_turma_ativo()
  );

-- ── 7. VIEW: resumo de faltas por cadete/turma ───────────────
CREATE OR REPLACE VIEW public.vw_faltas_resumo AS
SELECT
  f.id,
  f.cadet_id,
  c.nome_guerra,
  c.nome_completo,
  c.quadro,
  c.cohort_id,
  f.aula_id,
  pa.data                    AS data_aula,
  pa.horario_inicio,
  pa.horario_fim,
  d.sigla                    AS disciplina_sigla,
  d.nome                     AS disciplina_nome,
  t.nome                     AS turma_nome,
  ts.secao                   AS turma_aula,
  f.motivo,
  f.observacao,
  f.chefe_cadet_id,
  cc.nome_guerra             AS chefe_nome_guerra,
  f.created_at
FROM public.faltas_cadetes f
JOIN public.cadetes c          ON c.id = f.cadet_id
JOIN public.cadetes cc         ON cc.id = f.chefe_cadet_id
JOIN public.programacao_aulas pa ON pa.id = f.aula_id
JOIN public.disciplinas d      ON d.id = pa.disciplina_id
JOIN public.turmas t           ON t.id = pa.turma_id
LEFT JOIN public.turma_secoes ts ON ts.id = pa.secao_id;

-- ── 8. Permitir que cadetes leiam programacao_aulas da sua turma ─
-- (policy adicional: chefe de turma pode ver aulas passadas da sua turma para lançar faltas)
CREATE POLICY "chefe_select_aulas_turma" ON public.programacao_aulas
  FOR SELECT TO authenticated
  USING (
    is_chefe_turma_ativo()
    AND data < CURRENT_DATE
  );

-- ── 9. Índice de auditoria ───────────────────────────────────
CREATE TRIGGER audit_faltas
  AFTER INSERT OR UPDATE OR DELETE ON public.faltas_cadetes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
