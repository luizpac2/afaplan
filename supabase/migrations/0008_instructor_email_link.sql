-- Garante coluna email na tabela instructors (chave secundária para vincular ao auth.users)
ALTER TABLE public.instructors
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Índice único parcial: email não nulo deve ser único por instructor
CREATE UNIQUE INDEX IF NOT EXISTS instructors_email_unique
  ON public.instructors(email)
  WHERE email IS NOT NULL AND email <> '';

-- Garante que docente_disciplinas aceita docente_id como TEXT (trigram) além de UUID
-- Já é TEXT na tabela, mas garantimos que o índice existe
CREATE INDEX IF NOT EXISTS docente_disciplinas_docente_id_idx
  ON public.docente_disciplinas(docente_id);
