-- Add status column to user_roles for ATIVO/INATIVO management
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ATIVO'
  CHECK (status IN ('ATIVO', 'INATIVO'));
