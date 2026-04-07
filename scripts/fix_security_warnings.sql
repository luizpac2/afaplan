-- ============================================================
-- fix_security_warnings.sql
-- Corrige warnings do Supabase Security Linter
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ── 1. function_search_path_mutable ──────────────────────────────────────────
-- Corrige todas as funções públicas para usar search_path fixo.
-- Isso impede ataques de search_path injection.

ALTER FUNCTION public.get_my_cadet_id()      SET search_path = public;
ALTER FUNCTION public.get_my_turma_aula()    SET search_path = public;
ALTER FUNCTION public.is_chefe_turma_ativo() SET search_path = public;
ALTER FUNCTION public.get_chefe_turma_aula() SET search_path = public;
ALTER FUNCTION public.is_admin_user()        SET search_path = public;
ALTER FUNCTION public.update_updated_at()    SET search_path = public;
ALTER FUNCTION public.get_my_turma_id()      SET search_path = public;

-- gerar_numero_sap, fn_audit_log, detectar_conflitos podem ter parâmetros
-- Alterar via pg_proc para não precisar conhecer a assinatura exata
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS sig FROM pg_proc
    WHERE proname IN ('gerar_numero_sap','fn_audit_log','detectar_conflitos')
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
  END LOOP;
END $$;

-- ── 2. rls_policy_always_true — restringir writes a admins ───────────────────
-- Tabelas com auth_write USING(true)/WITH CHECK(true) permitem que qualquer
-- usuário autenticado modifique dados. O correto é restringir escrita a admins.

-- user_roles (CRÍTICO: qualquer um poderia elevar seu próprio role)
DROP POLICY IF EXISTS "auth_write" ON public.user_roles;
CREATE POLICY "auth_write" ON public.user_roles
  FOR ALL TO authenticated
  USING     (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- cadetes
DROP POLICY IF EXISTS "auth_write" ON public.cadetes;
CREATE POLICY "auth_write" ON public.cadetes
  FOR ALL TO authenticated
  USING     (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- cadete_alocacoes
DROP POLICY IF EXISTS "auth_write" ON public.cadete_alocacoes;
CREATE POLICY "auth_write" ON public.cadete_alocacoes
  FOR ALL TO authenticated
  USING     (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- programacao_aulas
DROP POLICY IF EXISTS "auth_write" ON public.programacao_aulas;
CREATE POLICY "auth_write" ON public.programacao_aulas
  FOR ALL TO authenticated
  USING     (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- turmas
DROP POLICY IF EXISTS "auth_write" ON public.turmas;
CREATE POLICY "auth_write" ON public.turmas
  FOR ALL TO authenticated
  USING     (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- disciplinas
DROP POLICY IF EXISTS "auth_write" ON public.disciplinas;
CREATE POLICY "auth_write" ON public.disciplinas
  FOR ALL TO authenticated
  USING     (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- classes
DROP POLICY IF EXISTS "auth_all" ON public.classes;
CREATE POLICY "auth_all" ON public.classes
  FOR ALL TO authenticated
  USING     (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- instructors
DROP POLICY IF EXISTS "auth_all" ON public.instructors;
CREATE POLICY "auth_all" ON public.instructors
  FOR ALL TO authenticated
  USING     (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- occurrences
DROP POLICY IF EXISTS "auth_all" ON public.occurrences;
CREATE POLICY "auth_all" ON public.occurrences
  FOR ALL TO authenticated
  USING     (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- docentes
DROP POLICY IF EXISTS "Acesso Total" ON public.docentes;
CREATE POLICY "Acesso Total" ON public.docentes
  FOR ALL TO authenticated
  USING     (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- notices (avisos do sistema — só admin publica)
DROP POLICY IF EXISTS "auth_write" ON public.notices;
CREATE POLICY "auth_write" ON public.notices
  FOR ALL TO authenticated
  USING     (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- audit_log — nenhum usuário deve escrever diretamente (só via trigger)
DROP POLICY IF EXISTS "auth_write" ON public.audit_log;
CREATE POLICY "auth_write" ON public.audit_log
  FOR ALL TO authenticated
  USING     (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- messages — qualquer autenticado pode enviar/ler (sistema de inbox)
-- INSERT: qualquer um; UPDATE/DELETE: próprias mensagens ou admin
DROP POLICY IF EXISTS "auth_write" ON public.messages;
CREATE POLICY "auth_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "auth_modify" ON public.messages
  FOR ALL TO authenticated
  USING (
    public.is_admin_user()
    OR "senderId" = auth.uid()
    OR "recipientId" = auth.uid()
  )
  WITH CHECK (
    public.is_admin_user()
    OR "senderId" = auth.uid()
  );

-- schedule_change_requests — qualquer autenticado pode submeter pedidos;
-- somente admins podem aprovar/deletar pedidos de outros
DROP POLICY IF EXISTS "auth_write" ON public.schedule_change_requests;
CREATE POLICY "auth_insert_scr" ON public.schedule_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "auth_modify_scr" ON public.schedule_change_requests
  FOR ALL TO authenticated
  USING (
    public.is_admin_user()
    OR "createdBy" = auth.uid()
  )
  WITH CHECK (
    public.is_admin_user()
    OR "createdBy" = auth.uid()
  );

-- ── 3. auth_leaked_password_protection ───────────────────────────────────────
-- Esta configuração NÃO pode ser feita via SQL.
-- Acesse: Supabase Dashboard → Authentication → Settings → Password Protection
-- Ative "Enable Leaked Password Protection" (HaveIBeenPwned.org check).
