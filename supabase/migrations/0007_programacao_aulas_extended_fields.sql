-- Adiciona campos para suportar o novo sistema de agendamento do frontend
-- Esses campos permitem armazenar metadados adicionais sobre as aulas

ALTER TABLE programacao_aulas ADD COLUMN IF NOT EXISTS type text DEFAULT 'CLASS';
-- type values: 'CLASS', 'EVALUATION', 'ACADEMIC', etc.

ALTER TABLE programacao_aulas ADD COLUMN IF NOT EXISTS evaluationType text;
-- evaluationType values: 'PARTIAL', 'EXAM', 'FINAL', 'SECOND_CHANCE', 'REVIEW', etc.

ALTER TABLE programacao_aulas ADD COLUMN IF NOT EXISTS color text;
-- Cor para exibição visual (hex, rgb, etc.)

ALTER TABLE programacao_aulas ADD COLUMN IF NOT EXISTS targetSquadron smallint;
-- Esquadrão alvo (1-4)

ALTER TABLE programacao_aulas ADD COLUMN IF NOT EXISTS targetCourse text;
-- Curso alvo (AVIATION, INTENDANCY, INFANTRY)

ALTER TABLE programacao_aulas ADD COLUMN IF NOT EXISTS targetClass text;
-- Turma alvo

ALTER TABLE programacao_aulas ADD COLUMN IF NOT EXISTS description text;
-- Descrição adicionais da aula

ALTER TABLE programacao_aulas ADD COLUMN IF NOT EXISTS notes text;
-- Notas internas

ALTER TABLE programacao_aulas ADD COLUMN IF NOT EXISTS "endDate" date;
-- Data de término para eventos multi-dia

CREATE INDEX IF NOT EXISTS idx_programacao_type ON programacao_aulas(type);
CREATE INDEX IF NOT EXISTS idx_programacao_target_squadron ON programacao_aulas(targetSquadron);
