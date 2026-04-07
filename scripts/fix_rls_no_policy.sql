-- ============================================================
-- fix_rls_no_policy.sql
-- Tabelas com RLS ativo mas sem policies (acesso bloqueado)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- avisos
CREATE POLICY "auth_read"  ON public.avisos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON public.avisos
  FOR ALL TO authenticated
  USING     (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- disciplina_criterios
CREATE POLICY "auth_read"  ON public.disciplina_criterios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON public.disciplina_criterios
  FOR ALL TO authenticated
  USING     (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- feriados_bloqueios
CREATE POLICY "auth_read"  ON public.feriados_bloqueios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON public.feriados_bloqueios
  FOR ALL TO authenticated
  USING     (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- solicitacoes_sap
CREATE POLICY "auth_read"  ON public.solicitacoes_sap
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write" ON public.solicitacoes_sap
  FOR ALL TO authenticated
  USING     (public.is_admin_user())
  WITH CHECK (public.is_admin_user());
