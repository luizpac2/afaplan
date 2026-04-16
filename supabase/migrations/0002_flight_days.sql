-- Tabela para dias de voo habilitados (T-25 e T-27)
-- Usada pelo módulo de Instrução Aérea para selecionar dias voáveis

CREATE TABLE IF NOT EXISTS flight_days (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date        date NOT NULL,
  aircraft    text NOT NULL CHECK (aircraft IN ('T-25', 'T-27')),
  "createdAt" timestamptz DEFAULT now(),
  "createdBy" uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (date, aircraft)
);

-- Índice para consultas por ano
CREATE INDEX idx_flight_days_date ON flight_days(date);

-- RLS: permitir leitura para todos os autenticados, escrita para admins
ALTER TABLE flight_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read flight_days"
  ON flight_days FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert flight_days"
  ON flight_days FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete flight_days"
  ON flight_days FOR DELETE
  TO authenticated
  USING (true);
