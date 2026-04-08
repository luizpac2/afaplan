-- Adiciona campo email na tabela cadetes
ALTER TABLE cadetes ADD COLUMN IF NOT EXISTS email text;
