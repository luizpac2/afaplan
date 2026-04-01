# Schema Completo — AFA Planner (Supabase/PostgreSQL)

## Ordem de criação (respeitar dependências)

```
1. ENUMs
2. turmas
3. locais
4. disciplinas
5. docentes
6. turma_secoes
7. disciplina_criterios
8. docente_disciplinas
9. programacao_aulas
10. solicitacoes_sap
11. avisos
12. audit_log
13. VIEWS
14. ÍNDICES
```

---

## 1. ENUMs

```sql
-- Categorias de disciplina (visível na tela de Disciplinas > Gerenciar)
CREATE TYPE categoria_disciplina AS ENUM (
  'GERAL',
  'PROFISSIONAL',
  'ATIVIDADES_COMPLEMENTARES'
);

-- Status de uma aula na programação
CREATE TYPE status_aula AS ENUM (
  'confirmada',
  'pendente',
  'alterada',
  'cancelada'
);

-- Status do fluxo SAP (Solicitação de Alteração de Programação)
CREATE TYPE status_sap AS ENUM (
  'pendente',
  'aprovada',
  'executada',
  'rejeitada'
);

-- Vínculo do docente com a instituição
CREATE TYPE vinculo_docente AS ENUM (
  'EFETIVO',
  'GOCON',    -- Contratado
  'PROFESSOR' -- Civil/externo (ex: Prof. Leomarcos Formiga)
);

-- Tipo de seção dentro de uma turma
CREATE TYPE tipo_secao AS ENUM (
  'AVI',  -- Aviação: 40 alunos
  'INT',  -- Intendência: 15 alunos
  'INF'   -- Infantaria: 15 alunos
);

-- Tipo de local para aulas
CREATE TYPE tipo_local AS ENUM (
  'SALA_AULA',
  'LABORATORIO',
  'CAMPO',
  'SIMULADOR',
  'SEF',      -- Seção de Educação Física
  'OUTRO'
);

-- Role do usuário no sistema
CREATE TYPE user_role AS ENUM (
  'cadete',
  'docente',
  'gestor',
  'super_admin'
);

-- Tipo de bloqueio no calendário
CREATE TYPE tipo_bloqueio AS ENUM (
  'FERIADO_NACIONAL',
  'FERIADO_MILITAR',
  'EVENTO_ACADEMICO',
  'VIAGEM',
  'BLOQUEIO_ESQUADRAO'
);
```

---

## 2. Tabela: turmas

```sql
-- Representa cada turma/ano de ingresso (Drakon, Perseu, Uiraçu, Athos)
CREATE TABLE turmas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,               -- "Drakon", "Perseu", etc.
  ano_ingresso    int4 NOT NULL,               -- 2026, 2025, 2024, 2023
  esquadrao       int2 NOT NULL CHECK (esquadrao BETWEEN 1 AND 4),
  cor_hex         varchar(7),                  -- "#1DB954" (cor exibida na UI)
  total_cadetes   int2 DEFAULT 190,
  ativo           bool DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE turmas IS 'Cada turma corresponde a um ano de ingresso e esquadrão. Ex: Drakon = 1º Esquadrão, ingresso 2026.';
```

---

## 3. Tabela: locais

```sql
-- Salas de aula, laboratórios, campos e instalações
CREATE TABLE locais (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,                   -- "Sala de Aula", "SEF", "Lab Info"
  tipo        tipo_local NOT NULL DEFAULT 'SALA_AULA',
  capacidade  int2,                            -- número máximo de alunos
  codigo      varchar(20),                     -- código interno (ex: "SA-01")
  ativo       bool DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
```

---

## 4. Tabela: disciplinas

```sql
-- Matriz curricular completa (visível em Planejamento > Disciplinas > Gerenciar)
CREATE TABLE disciplinas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sigla           varchar(10) NOT NULL UNIQUE,  -- "ADPP", "ING1", "CAL1", etc.
  nome            text NOT NULL,
  categoria       categoria_disciplina NOT NULL DEFAULT 'GERAL',
  carga_horaria   int2 NOT NULL DEFAULT 0,      -- horas totais na matriz
  ano_curso       int2,                         -- 1º, 2º, 3º, 4º ano (null = todos)
  campo           text,                         -- "Aviação", "Intendência", etc. (null = todos)
  ppc_referencia  text,                         -- referência no PPC
  ativo           bool DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

COMMENT ON COLUMN disciplinas.sigla IS 'Identificador curto único. Ex: ADPP, ING1, TFM1. Usado como trigrama de exibição na grade.';
```

---

## 5. Tabela: docentes

```sql
-- Corpo docente (visível em Planejamento > Docentes > Gerenciar)
-- Trigrama é o identificador de display: ANC, CEC, DER, DBR, AND, BAS...
CREATE TABLE docentes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trigrama            varchar(3) NOT NULL UNIQUE,  -- "ANC", "CEC", "AND"
  nome_guerra         text NOT NULL,               -- "Ana Cinta", "Cap André Dias"
  nome_completo       text,
  vinculo             vinculo_docente NOT NULL DEFAULT 'EFETIVO',
  titulacao           text,                        -- "Cel", "Cap", "Ten", "Maj", "Prof"
  carga_horaria_max   int2 DEFAULT 12,             -- CH semanal máxima
  ativo               bool DEFAULT true,
  created_at          timestamptz DEFAULT now()
);

COMMENT ON COLUMN docentes.trigrama IS 'Código de 3 letras único para identificação rápida na UI. Ex: ANC = Ana Cinta, AND = Cap André Dias.';
```

---

## 6. Tabela: turma_secoes

```sql
-- Seções dentro de cada turma (A=AVI, B=AVI, C=AVI, D=AVI, E=INT, F=INF)
-- Configuradas em Planejamento > Turmas (tela de "Quantidade de Alunos por Turma")
CREATE TABLE turma_secoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id    uuid NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  secao       varchar(1) NOT NULL CHECK (secao IN ('A','B','C','D','E','F')),
  tipo        tipo_secao NOT NULL,
  qtd_alunos  int2 NOT NULL DEFAULT 40,
  UNIQUE (turma_id, secao)
);

COMMENT ON TABLE turma_secoes IS 'A-D = AVI (40 alunos), E = INT (15), F = INF (15). Usado pelo módulo de Inteligência para validar capacidade de sala.';
```

---

## 7. Tabela: disciplina_criterios

```sql
-- Critérios de agendamento automático (Planejamento > Disciplinas > Critérios)
CREATE TABLE disciplina_criterios (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disciplina_id       uuid NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
  freq_semanal        int2 DEFAULT 2,           -- quantas vezes por semana
  max_aulas_dia       int2 DEFAULT 2,           -- máximo de aulas no mesmo dia
  dias_consecutivos   bool DEFAULT false,       -- pode ter em dias consecutivos?
  local_padrao_id     uuid REFERENCES locais(id),
  semestre            int2,                     -- 1 ou 2 (null = ambos)
  horarios_pref       time[],                   -- horários preferidos (array)
  created_at          timestamptz DEFAULT now(),
  UNIQUE (disciplina_id)
);
```

---

## 8. Tabela: docente_disciplinas

```sql
-- Vínculo M:N entre docentes e disciplinas que podem lecionar
CREATE TABLE docente_disciplinas (
  docente_id      uuid NOT NULL REFERENCES docentes(id) ON DELETE CASCADE,
  disciplina_id   uuid NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
  principal       bool DEFAULT true,           -- true = disciplina principal do docente
  PRIMARY KEY (docente_id, disciplina_id)
);
```

---

## 9. Tabela: programacao_aulas ⭐ (tabela central)

```sql
-- TABELA CENTRAL: grade de aulas de todos os esquadrões
-- Alimenta: telas de Esquadrão, Calendário, Relatórios e Automação
CREATE TABLE programacao_aulas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data            date NOT NULL,
  horario_inicio  time NOT NULL,
  horario_fim     time NOT NULL,
  turma_id        uuid NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  secao_id        uuid REFERENCES turma_secoes(id),   -- null = todas as seções da turma
  disciplina_id   uuid NOT NULL REFERENCES disciplinas(id),
  docente_id      uuid REFERENCES docentes(id),       -- null = sem instrutor (Setor)
  local_id        uuid REFERENCES locais(id),
  status          status_aula NOT NULL DEFAULT 'confirmada',
  dia_letivo_num  smallint,     -- ex: 89, 90, 91 (numeração corrida do ano letivo)
  semana_num      smallint,     -- ex: 14 (semana do ano letivo)
  observacao      text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id)
);

-- Índices críticos para performance do calendário semanal
CREATE INDEX idx_aulas_data_turma     ON programacao_aulas(data, turma_id);
CREATE INDEX idx_aulas_docente_data   ON programacao_aulas(docente_id, data) WHERE docente_id IS NOT NULL;
CREATE INDEX idx_aulas_local_horario  ON programacao_aulas(local_id, data, horario_inicio) WHERE local_id IS NOT NULL;
CREATE INDEX idx_aulas_semana         ON programacao_aulas(semana_num, turma_id);

-- CONSTRAINT: um docente não pode estar em dois lugares ao mesmo tempo
CREATE UNIQUE INDEX uniq_docente_horario
  ON programacao_aulas(docente_id, data, horario_inicio)
  WHERE docente_id IS NOT NULL AND status != 'cancelada';

-- CONSTRAINT: um local não pode ter duas turmas ao mesmo tempo
CREATE UNIQUE INDEX uniq_local_horario
  ON programacao_aulas(local_id, data, horario_inicio)
  WHERE local_id IS NOT NULL AND status != 'cancelada';

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_aulas_updated_at
  BEFORE UPDATE ON programacao_aulas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 10. Tabela: solicitacoes_sap

```sql
-- SAP = Solicitação de Alteração de Programação
-- Visível em Planejamento > Alterações (SAP)
CREATE TABLE solicitacoes_sap (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          text NOT NULL UNIQUE,        -- "SAP 001/26", gerado automaticamente
  aula_id         uuid NOT NULL REFERENCES programacao_aulas(id) ON DELETE CASCADE,
  solicitante_id  uuid REFERENCES auth.users(id),
  solicitante_nome text,                       -- nome legível para exibição
  motivo          text NOT NULL,               -- "Alteração no apoio aéreo"
  status          status_sap NOT NULL DEFAULT 'pendente',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  aprovado_por    uuid REFERENCES auth.users(id),
  aprovado_em     timestamptz,
  observacao_gestor text
);

-- Função para gerar número SAP automático: "SAP 001/26"
CREATE OR REPLACE FUNCTION gerar_numero_sap()
RETURNS TRIGGER AS $$
DECLARE
  seq int;
  ano text;
BEGIN
  ano := to_char(now(), 'YY');
  SELECT COALESCE(MAX(CAST(SPLIT_PART(numero, ' ', 2) AS int)), 0) + 1
    INTO seq FROM solicitacoes_sap WHERE numero LIKE '%/' || ano;
  NEW.numero := 'SAP ' || LPAD(seq::text, 3, '0') || '/' || ano;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sap_numero
  BEFORE INSERT ON solicitacoes_sap
  FOR EACH ROW EXECUTE FUNCTION gerar_numero_sap();
```

---

## 11. Tabela: avisos

```sql
-- Avisos do sistema (seção "Avisos" na tela Início)
CREATE TABLE avisos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo           text NOT NULL,
  conteudo         text,
  publico_alvo     user_role[] DEFAULT '{cadete,docente,gestor,super_admin}',
  data_publicacao  timestamptz DEFAULT now(),
  data_expiracao   timestamptz,
  ativo            bool DEFAULT true,
  criado_por       uuid REFERENCES auth.users(id)
);
```

---

## 12. Tabela: feriados_bloqueios

```sql
-- Bloqueios e feriados do calendário acadêmico
-- Visível em Planejamento > Calendário (panoramic + bloqueios)
CREATE TABLE feriados_bloqueios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_inicio   date NOT NULL,
  data_fim      date NOT NULL DEFAULT data_inicio,
  titulo        text NOT NULL,               -- "Paixão de Cristo", "TACF2"
  tipo          tipo_bloqueio NOT NULL,
  turma_id      uuid REFERENCES turmas(id),  -- null = afeta todos os esquadrões
  criado_por    uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_bloqueios_data ON feriados_bloqueios(data_inicio, data_fim);
```

---

## 13. Tabela: user_roles

```sql
-- Roles dos usuários (separado de auth.users para RLS granular)
CREATE TABLE user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        user_role NOT NULL,
  turma_id    uuid REFERENCES turmas(id),  -- obrigatório quando role = 'cadete'
  docente_id  uuid REFERENCES docentes(id), -- obrigatório quando role = 'docente'
  UNIQUE (user_id)
);

-- Função helper usada em TODAS as políticas RLS
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM user_roles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_turma_id()
RETURNS uuid AS $$
  SELECT turma_id FROM user_roles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

---

## 14. Tabela: audit_log

```sql
-- Rastreabilidade completa de alterações (quem alterou o quê e quando)
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  tabela      text NOT NULL,
  operacao    text NOT NULL,           -- INSERT, UPDATE, DELETE
  registro_id uuid,
  dados_antes jsonb,
  dados_depois jsonb,
  user_id     uuid REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now()
);

-- Trigger genérico de auditoria (aplicar em programacao_aulas e solicitacoes_sap)
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (tabela, operacao, registro_id, dados_antes, dados_depois, user_id)
  VALUES (
    TG_TABLE_NAME, TG_OP,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_programacao
  AFTER INSERT OR UPDATE OR DELETE ON programacao_aulas
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_sap
  AFTER INSERT OR UPDATE ON solicitacoes_sap
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
```

---

## 15. Views SQL para o Frontend

```sql
-- VIEW: Grade semanal completa (alimenta tela de Esquadrão)
CREATE OR REPLACE VIEW grade_semanal AS
SELECT
  a.id,
  a.data,
  a.horario_inicio,
  a.horario_fim,
  a.status,
  a.dia_letivo_num,
  a.semana_num,
  t.nome           AS turma_nome,
  t.esquadrao,
  ts.secao,
  ts.tipo          AS secao_tipo,
  d.sigla          AS disciplina_sigla,
  d.nome           AS disciplina_nome,
  d.categoria      AS disciplina_categoria,
  dc.trigrama      AS docente_trigrama,
  dc.nome_guerra   AS docente_nome,
  l.nome           AS local_nome
FROM programacao_aulas a
JOIN turmas t          ON t.id = a.turma_id
LEFT JOIN turma_secoes ts   ON ts.id = a.secao_id
JOIN disciplinas d     ON d.id = a.disciplina_id
LEFT JOIN docentes dc  ON dc.id = a.docente_id
LEFT JOIN locais l     ON l.id = a.local_id;

-- VIEW: Painel do Docente (alimenta Docente > Relatórios)
CREATE OR REPLACE VIEW painel_docente AS
SELECT
  a.id,
  a.data,
  a.horario_inicio,
  a.horario_fim,
  a.status,
  dc.id            AS docente_id,
  dc.trigrama,
  dc.nome_guerra,
  d.sigla          AS disciplina_sigla,
  d.nome           AS disciplina_nome,
  t.nome           AS turma_nome,
  ts.secao,
  l.nome           AS local_nome
FROM programacao_aulas a
JOIN docentes dc       ON dc.id = a.docente_id
JOIN disciplinas d     ON d.id = a.disciplina_id
JOIN turmas t          ON t.id = a.turma_id
LEFT JOIN turma_secoes ts ON ts.id = a.secao_id
LEFT JOIN locais l     ON l.id = a.local_id;

-- FUNCTION: Detectar conflitos de docente e local em um período
CREATE OR REPLACE FUNCTION detectar_conflitos(
  p_data_inicio date,
  p_data_fim    date,
  p_turma_id    uuid DEFAULT NULL
)
RETURNS TABLE (
  tipo_conflito    text,
  data             date,
  horario_inicio   time,
  aula1_id         uuid,
  aula2_id         uuid,
  recurso          text
) AS $$
BEGIN
  -- Conflito de docente
  RETURN QUERY
  SELECT
    'DOCENTE_DUPLO'::text,
    a1.data, a1.horario_inicio,
    a1.id, a2.id,
    dc.nome_guerra
  FROM programacao_aulas a1
  JOIN programacao_aulas a2
    ON a1.docente_id = a2.docente_id
    AND a1.data = a2.data
    AND a1.horario_inicio = a2.horario_inicio
    AND a1.id < a2.id
    AND a1.status != 'cancelada'
    AND a2.status != 'cancelada'
  JOIN docentes dc ON dc.id = a1.docente_id
  WHERE a1.data BETWEEN p_data_inicio AND p_data_fim
    AND (p_turma_id IS NULL OR a1.turma_id = p_turma_id);

  -- Conflito de local
  RETURN QUERY
  SELECT
    'LOCAL_DUPLO'::text,
    a1.data, a1.horario_inicio,
    a1.id, a2.id,
    l.nome
  FROM programacao_aulas a1
  JOIN programacao_aulas a2
    ON a1.local_id = a2.local_id
    AND a1.data = a2.data
    AND a1.horario_inicio = a2.horario_inicio
    AND a1.id < a2.id
    AND a1.status != 'cancelada'
    AND a2.status != 'cancelada'
  JOIN locais l ON l.id = a1.local_id
  WHERE a1.data BETWEEN p_data_inicio AND p_data_fim
    AND (p_turma_id IS NULL OR a1.turma_id = p_turma_id);
END;
$$ LANGUAGE plpgsql;
```
