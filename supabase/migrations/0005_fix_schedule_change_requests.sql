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

-- RLS policies
ALTER TABLE schedule_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read schedule_change_requests"
  ON schedule_change_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert schedule_change_requests"
  ON schedule_change_requests FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update schedule_change_requests"
  ON schedule_change_requests FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete schedule_change_requests"
  ON schedule_change_requests FOR DELETE TO authenticated USING (true);
