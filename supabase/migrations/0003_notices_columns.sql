-- Adiciona colunas ao sistema de avisos para compatibilidade com o frontend
ALTER TABLE notices
  ADD COLUMN IF NOT EXISTS title          text,
  ADD COLUMN IF NOT EXISTS description    text,
  ADD COLUMN IF NOT EXISTS type           text DEFAULT 'INFO',
  ADD COLUMN IF NOT EXISTS "startDate"    date,
  ADD COLUMN IF NOT EXISTS "endDate"      date,
  ADD COLUMN IF NOT EXISTS "targetSquadron" int2,
  ADD COLUMN IF NOT EXISTS "targetCourse"  text,
  ADD COLUMN IF NOT EXISTS "targetClass"   text,
  ADD COLUMN IF NOT EXISTS "targetRoles"   text[],
  ADD COLUMN IF NOT EXISTS "createdAt"     timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "createdBy"     text;
