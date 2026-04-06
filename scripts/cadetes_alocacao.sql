-- ============================================================
-- cadetes_alocacao.sql
-- Separa turma_aula (anual) de cohort_id (permanente).
--
-- Regra de negócio:
--   - cohort_id (Drakon, Perseu…) = pertencimento permanente
--   - turma_aula (A, B, C…)       = alocação anual, muda a cada ano
--
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Cria tabela de alocações anuais
CREATE TABLE IF NOT EXISTS public.cadete_alocacoes (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  cadet_id    TEXT  NOT NULL,        -- FK lógica para cadetes.id
  ano         INT   NOT NULL,        -- ex: 2026
  turma_aula  TEXT  NOT NULL,        -- TURMA_A … TURMA_F
  UNIQUE (cadet_id, ano)
);

ALTER TABLE public.cadete_alocacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read"  ON public.cadete_alocacoes;
DROP POLICY IF EXISTS "auth_write" ON public.cadete_alocacoes;
CREATE POLICY "auth_read"  ON public.cadete_alocacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON public.cadete_alocacoes FOR ALL    TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cadete_alocacoes TO authenticated;

-- 2. Migra turma_aula atual → cadete_alocacoes (ano = 2026)
INSERT INTO public.cadete_alocacoes (cadet_id, ano, turma_aula)
SELECT id, 2026, turma_aula
FROM   public.cadetes
WHERE  turma_aula IS NOT NULL
ON CONFLICT (cadet_id, ano) DO UPDATE SET turma_aula = EXCLUDED.turma_aula;

-- 3. Remove turma_aula da tabela cadetes (agora gerenciada por cadete_alocacoes)
ALTER TABLE public.cadetes DROP COLUMN IF EXISTS turma_aula;
