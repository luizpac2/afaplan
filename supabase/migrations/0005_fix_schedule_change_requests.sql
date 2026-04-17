-- Garante que a tabela schedule_change_requests tem todas as colunas
-- que o frontend espera (modelo ScheduleChangeRequest do TypeScript)

ALTER TABLE schedule_change_requests
  ADD COLUMN IF NOT EXISTS "numeroAlteracao" text,
  ADD COLUMN IF NOT EXISTS "solicitante"     text,
  ADD COLUMN IF NOT EXISTS "motivo"          text,
  ADD COLUMN IF NOT EXISTS "descricao"       text,
  ADD COLUMN IF NOT EXISTS "dataSolicitacao" timestamptz,
  ADD COLUMN IF NOT EXISTS "status"          text DEFAULT 'PENDENTE',
  ADD COLUMN IF NOT EXISTS "eventIds"        jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "createdAt"       timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "createdBy"       text;
