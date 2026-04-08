-- Adiciona colunas de cadete na tabela user_roles (se não existirem)
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS cadet_id text;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS turma_aula text;
