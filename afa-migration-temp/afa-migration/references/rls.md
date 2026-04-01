# Políticas RLS — AFA Planner

## Princípio de Segurança

- **RLS SEMPRE ativa** em todas as tabelas públicas
- Usar `service_role` key apenas em Edge Functions e scripts de migração server-side
- Nunca expor `service_role` no frontend
- Usar as funções `get_my_role()` e `get_my_turma_id()` (definidas em schema.md) em todas as políticas

---

## Ativar RLS em todas as tabelas

```sql
ALTER TABLE turmas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE locais              ENABLE ROW LEVEL SECURITY;
ALTER TABLE disciplinas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE docentes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE turma_secoes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE disciplina_criterios ENABLE ROW LEVEL SECURITY;
ALTER TABLE docente_disciplinas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE programacao_aulas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes_sap    ENABLE ROW LEVEL SECURITY;
ALTER TABLE avisos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE feriados_bloqueios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;
```

---

## Políticas por Tabela

### programacao_aulas

```sql
-- Cadetes: veem apenas a programação de sua própria turma
CREATE POLICY "cadete_select_propria_turma" ON programacao_aulas
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'cadete'
    AND turma_id = get_my_turma_id()
  );

-- Docentes: veem apenas as aulas onde são o instrutor
CREATE POLICY "docente_select_suas_aulas" ON programacao_aulas
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'docente'
    AND docente_id = (SELECT id FROM docentes WHERE user_id = auth.uid())
  );

-- Gestores e Super Admin: acesso total
CREATE POLICY "gestor_all" ON programacao_aulas
  FOR ALL TO authenticated
  USING (get_my_role() IN ('gestor', 'super_admin'))
  WITH CHECK (get_my_role() IN ('gestor', 'super_admin'));
```

### solicitacoes_sap

```sql
-- Docentes: podem criar SAPs apenas para suas próprias aulas
CREATE POLICY "docente_insert_sap" ON solicitacoes_sap
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'docente'
    AND EXISTS (
      SELECT 1 FROM programacao_aulas a
      JOIN docentes d ON d.id = a.docente_id
      WHERE a.id = aula_id AND d.user_id = auth.uid()
    )
  );

-- Docentes: veem suas próprias SAPs
CREATE POLICY "docente_select_suas_sap" ON solicitacoes_sap
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'docente'
    AND solicitante_id = auth.uid()
  );

-- Gestores: acesso total (aprovar, rejeitar, executar)
CREATE POLICY "gestor_all_sap" ON solicitacoes_sap
  FOR ALL TO authenticated
  USING (get_my_role() IN ('gestor', 'super_admin'))
  WITH CHECK (get_my_role() IN ('gestor', 'super_admin'));
```

### docentes

```sql
-- Cadetes: não veem docentes
-- Docentes: veem apenas o próprio perfil
CREATE POLICY "docente_select_proprio" ON docentes
  FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('gestor', 'super_admin')
    OR (get_my_role() = 'docente' AND user_id = auth.uid())
  );

-- Gestores: acesso total
CREATE POLICY "gestor_all_docentes" ON docentes
  FOR ALL TO authenticated
  USING (get_my_role() IN ('gestor', 'super_admin'))
  WITH CHECK (get_my_role() IN ('gestor', 'super_admin'));
```

### disciplinas, turmas, locais (leitura pública autenticada)

```sql
-- Todos os usuários autenticados podem ler dados de referência
CREATE POLICY "authenticated_select" ON disciplinas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select" ON turmas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select" ON locais
  FOR SELECT TO authenticated USING (true);

-- Apenas gestores podem modificar
CREATE POLICY "gestor_all_disciplinas" ON disciplinas
  FOR ALL TO authenticated
  USING (get_my_role() IN ('gestor', 'super_admin'))
  WITH CHECK (get_my_role() IN ('gestor', 'super_admin'));

CREATE POLICY "gestor_all_turmas" ON turmas
  FOR ALL TO authenticated
  USING (get_my_role() IN ('gestor', 'super_admin'))
  WITH CHECK (get_my_role() IN ('gestor', 'super_admin'));
```

### avisos

```sql
-- Usuários veem avisos cujo publico_alvo contém seu role
CREATE POLICY "select_avisos_publico_alvo" ON avisos
  FOR SELECT TO authenticated
  USING (
    ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now())
    AND get_my_role() = ANY(publico_alvo)
  );

CREATE POLICY "gestor_all_avisos" ON avisos
  FOR ALL TO authenticated
  USING (get_my_role() IN ('gestor', 'super_admin'))
  WITH CHECK (get_my_role() IN ('gestor', 'super_admin'));
```

### user_roles

```sql
-- Usuários veem apenas o próprio role
CREATE POLICY "select_proprio_role" ON user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Apenas super_admin gerencia roles
CREATE POLICY "super_admin_all_roles" ON user_roles
  FOR ALL TO authenticated
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');
```

### audit_log

```sql
-- Apenas gestores podem consultar o log
CREATE POLICY "gestor_select_audit" ON audit_log
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('gestor', 'super_admin'));

-- Ninguém pode inserir manualmente (apenas via trigger)
-- INSERT é feito pela função fn_audit_log com SECURITY DEFINER
```

---

## Checklist de Validação RLS

Após aplicar, testar com cada role:

```sql
-- Simular login como cadete (substituir pelo UUID real)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"UUID-DO-CADETE","role":"authenticated"}';

-- Deve retornar apenas aulas da turma do cadete
SELECT count(*) FROM programacao_aulas;

-- Deve retornar 0 (cadetes não veem docentes)
SELECT count(*) FROM docentes;

-- Resetar
RESET ROLE;
```
