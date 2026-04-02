DROP VIEW IF EXISTS public.cohorts CASCADE;
DROP VIEW IF EXISTS public.disciplines CASCADE;

CREATE VIEW public.cohorts AS
SELECT id, name, "entryYear", color FROM public.turmas;
GRANT SELECT ON public.cohorts TO authenticated, anon;

CREATE VIEW public.disciplines AS
SELECT id, name, code, color, year, course, category, load_hours,
       scheduling_criteria, data
FROM public.disciplinas;
GRANT SELECT ON public.disciplines TO authenticated, anon;

CREATE TABLE IF NOT EXISTS public.docente_disciplinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  docente_id TEXT NOT NULL,
  disciplina_id TEXT NOT NULL,
  UNIQUE(docente_id, disciplina_id)
);
ALTER TABLE public.docente_disciplinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON public.docente_disciplinas;
CREATE POLICY "auth_all" ON public.docente_disciplinas FOR ALL TO authenticated USING (true);
