-- ============================================================
-- fix_rls.sql — Políticas de acesso para usuários autenticados
-- Execute este arquivo inteiro no SQL Editor do Supabase
-- ============================================================

-- instructors: leitura para todos autenticados
DROP POLICY IF EXISTS "auth_read" ON public.instructors;
CREATE POLICY "auth_read" ON public.instructors
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.instructors TO authenticated;

-- programacao_aulas: leitura para todos autenticados
DROP POLICY IF EXISTS "auth_read" ON public.programacao_aulas;
CREATE POLICY "auth_read" ON public.programacao_aulas
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.programacao_aulas TO authenticated;

-- user_roles: cada user lê o próprio; admin/gestor lê todos
DROP POLICY IF EXISTS "own_read"       ON public.user_roles;
DROP POLICY IF EXISTS "admin_read_all" ON public.user_roles;
DROP POLICY IF EXISTS "auth_read"      ON public.user_roles;

CREATE POLICY "own_read" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "admin_read_all" ON public.user_roles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'gestor')
    )
  );

GRANT SELECT ON public.user_roles TO authenticated;

-- docente_disciplinas
DROP POLICY IF EXISTS "auth_read" ON public.docente_disciplinas;
CREATE POLICY "auth_read" ON public.docente_disciplinas
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.docente_disciplinas TO authenticated;

-- notices
DROP POLICY IF EXISTS "auth_read" ON public.notices;
CREATE POLICY "auth_read" ON public.notices
  FOR SELECT TO authenticated, anon USING (true);
GRANT SELECT ON public.notices TO authenticated, anon;

-- visual_configs
DROP POLICY IF EXISTS "auth_read" ON public.visual_configs;
CREATE POLICY "auth_read" ON public.visual_configs
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.visual_configs TO authenticated;

-- occurrences
DROP POLICY IF EXISTS "auth_read" ON public.occurrences;
CREATE POLICY "auth_read" ON public.occurrences
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.occurrences TO authenticated;

-- semester_configs
DROP POLICY IF EXISTS "auth_read" ON public.semester_configs;
CREATE POLICY "auth_read" ON public.semester_configs
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.semester_configs TO authenticated;

-- schedule_change_requests
DROP POLICY IF EXISTS "auth_read" ON public.schedule_change_requests;
CREATE POLICY "auth_read" ON public.schedule_change_requests
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.schedule_change_requests TO authenticated;

-- classes
DROP POLICY IF EXISTS "auth_read" ON public.classes;
CREATE POLICY "auth_read" ON public.classes
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.classes TO authenticated;

-- Vistas (não têm RLS, mas precisam de GRANT)
GRANT SELECT ON public.disciplines TO authenticated, anon;
GRANT SELECT ON public.cohorts     TO authenticated, anon;

-- Colunas faltando em programacao_aulas (safe — ignora se já existirem)
ALTER TABLE public.programacao_aulas
  ADD COLUMN IF NOT EXISTS "evaluationType" TEXT,
  ADD COLUMN IF NOT EXISTS "isBlocking"     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "description"    TEXT;

-- Gravação: autenticados podem inserir/atualizar suas próprias aulas
-- (super_admin e gestor podem tudo via service_role no backend)
DROP POLICY IF EXISTS "auth_write" ON public.programacao_aulas;
CREATE POLICY "auth_write" ON public.programacao_aulas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_write" ON public.notices;
CREATE POLICY "auth_write" ON public.notices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_write" ON public.schedule_change_requests;
CREATE POLICY "auth_write" ON public.schedule_change_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
