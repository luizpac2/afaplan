---
name: afa-migration
description: >
  Skill especializada na migração do AFA Planner do Firebase para Supabase (PostgreSQL).
  Use esta skill SEMPRE que o usuário mencionar: migração do AFA, Firebase para Supabase,
  banco de dados do AFA Planner, tabelas de programação acadêmica, esquadrões, turmas,
  disciplinas, docentes, SAP (Solicitações de Alteração), automação de programação,
  RLS para cadetes/docentes, Edge Functions de conflito, importação de CSV de aulas,
  ou qualquer tarefa técnica relacionada ao sistema AFA Planner.
  Também use quando pedir SQL, queries, scripts de migração, políticas de segurança,
  ou código frontend (React/Supabase) relacionados a esse sistema.
---

# AFA Planner — Skill de Migração Firebase → Supabase

## Contexto do Sistema

O **AFA Planner** é um sistema de gestão acadêmica e operacional da Divisão de Ensino da AFA (Academia da Força Aérea). Não é um simples calendário — é um sistema complexo com:

- **4 Esquadrões** (1º Drakon, 2º Perseu, 3º Uiraçu, 4º Athos), cada um com turmas A–F
- **Seções por tipo**: AVI (40 alunos), INT (15 alunos), INF (15 alunos)
- **Módulos**: Programação, Docente, Planejamento, Relatórios, Inteligência/Automação
- **SAP** (Solicitações de Alteração de Programação) com fluxo de aprovação
- **Automação de programação** com detecção de conflitos
- **Calendário acadêmico** com dias letivos numerados (Dia 89, 90...) e semanas
- **Roles**: cadete, docente, gestor, super_admin (Luiz Pacheco)

Stack atual: Firebase Firestore + Firebase Auth
Stack destino: Supabase (PostgreSQL) + Supabase Auth + Edge Functions (Deno)
Frontend: Vite + React + Ant Design, versão v1.9.0

---

## Arquivos de Referência

Leia o arquivo relevante antes de responder sobre cada tema:

| Tema | Arquivo | Quando ler |
|------|---------|------------|
| Schema completo do banco | `references/schema.md` | Qualquer pergunta sobre tabelas, colunas, FKs, índices |
| Políticas RLS | `references/rls.md` | Segurança, permissões por role, políticas Row Level Security |
| Scripts de migração | `references/migration-scripts.md` | Exportação Firebase, transformação, importação Supabase |
| Edge Functions e Realtime | `references/intelligence.md` | Automação, detecção de conflitos, SAP Realtime, Views SQL |
| Frontend React/Supabase | `references/frontend.md` | Substituição de hooks Firebase, queries, auth, Realtime no cliente |

---

## Regras Gerais de Resposta

1. **Sempre gere SQL completo e funcional** — nunca pseudocódigo ou esqueletos. Inclua ENUMs, FKs, índices e comentários.
2. **Respeite a ordem de dependência das tabelas** ao gerar scripts de criação ou importação:
   `turmas → locais → disciplinas → docentes → turma_secoes → disciplina_criterios → docente_disciplinas → programacao_aulas → solicitacoes_sap → avisos`
3. **RLS é obrigatória em todas as tabelas** — nunca sugira desativar RLS mesmo que temporariamente (use service_role key para imports, não desative RLS).
4. **Trigramas são identificadores únicos** dos docentes (ex: ANC, CEC, DER) — preserve-os como campo separado do ID.
5. **Dias letivos numerados** (dia_letivo_num) são importantes para relatórios — sempre inclua nas queries de calendário.
6. **Shadow mode obrigatório**: qualquer plano de cutover deve incluir período de dupla escrita Firebase + Supabase antes do corte.
7. **Senhas Firebase não migram** — sempre inclua instrução de reset de senha por email no plano.
8. **Nomenclatura em português** nos nomes de tabelas e colunas (convenção já estabelecida no sistema).

---

## Fluxo de Trabalho para Tarefas Comuns

### Criar uma nova tabela
1. Leia `references/schema.md` para verificar dependências
2. Gere o SQL com: CREATE TYPE (se enum), CREATE TABLE, FKs, índices, comentário
3. Adicione a política RLS correspondente (leia `references/rls.md`)
4. Sugira o Realtime se a tabela precisar de atualização em tempo real

### Migrar dados do Firebase
1. Leia `references/migration-scripts.md`
2. Gere o script de exportação Firebase Admin SDK
3. Gere o script de transformação JSON → CSV normalizado
4. Forneça o comando de importação Supabase na ordem correta
5. Inclua queries de validação pós-importação

### Escrever código React com Supabase
1. Leia `references/frontend.md`
2. Substitua `onSnapshot` por `supabase.channel().on('postgres_changes', ...)`
3. Substitua `getDocs/getDoc` por `.from('tabela').select(...)`
4. Use `supabase.auth.getSession()` no lugar de `onAuthStateChanged`

### Criar Edge Function
1. Leia `references/intelligence.md`
2. Use Deno runtime (não Node.js)
3. Importe `createClient` do `@supabase/supabase-js`
4. Use `service_role` key apenas em Edge Functions server-side, nunca no cliente
