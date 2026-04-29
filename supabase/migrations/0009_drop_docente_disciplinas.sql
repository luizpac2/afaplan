-- ============================================================
-- Consolida disciplinas/turmas habilitadas em instructors.
-- docente_disciplinas era legado do sistema docentes (UUID-keyed)
-- e causava conflito com instructors (trigram-keyed).
-- ============================================================

-- 1. Garante colunas TEXT[] em instructors
--    Se a coluna já existe como JSONB (criada antes como data-field),
--    converte o tipo extraindo os valores antes de recriar.
DO $$
BEGIN
  -- enabledDisciplines
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'instructors'
      AND column_name  = 'enabledDisciplines'
      AND data_type   <> 'ARRAY'
  ) THEN
    ALTER TABLE public.instructors
      ALTER COLUMN "enabledDisciplines" TYPE TEXT[]
      USING CASE
        WHEN "enabledDisciplines" IS NULL THEN '{}'::TEXT[]
        ELSE ARRAY(SELECT jsonb_array_elements_text("enabledDisciplines"::jsonb))
      END;
  ELSE
    ALTER TABLE public.instructors
      ADD COLUMN IF NOT EXISTS "enabledDisciplines" TEXT[] DEFAULT '{}';
  END IF;

  -- enabledClasses
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'instructors'
      AND column_name  = 'enabledClasses'
      AND data_type   <> 'ARRAY'
  ) THEN
    ALTER TABLE public.instructors
      ALTER COLUMN "enabledClasses" TYPE TEXT[]
      USING CASE
        WHEN "enabledClasses" IS NULL THEN '{}'::TEXT[]
        ELSE ARRAY(SELECT jsonb_array_elements_text("enabledClasses"::jsonb))
      END;
  ELSE
    ALTER TABLE public.instructors
      ADD COLUMN IF NOT EXISTS "enabledClasses" TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- 2. Migra dados de docente_disciplinas → instructors (apenas entradas com trigram)
UPDATE public.instructors i
SET "enabledDisciplines" = (
  SELECT ARRAY_AGG(DISTINCT d.disciplina_id ORDER BY d.disciplina_id)
  FROM public.docente_disciplinas d
  WHERE d.docente_id = i.trigram
)
WHERE EXISTS (
  SELECT 1 FROM public.docente_disciplinas d WHERE d.docente_id = i.trigram
);

-- 3. Remove a tabela junction legada
DROP TABLE IF EXISTS public.docente_disciplinas CASCADE;
