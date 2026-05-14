-- Adiciona suporte a múltiplos esquadrões e múltiplas categorias por evento
ALTER TABLE programacao_aulas ADD COLUMN IF NOT EXISTS "targetSquadrons" jsonb;
ALTER TABLE programacao_aulas ADD COLUMN IF NOT EXISTS "extraTypes" jsonb;
