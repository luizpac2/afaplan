-- ── Locais de Instrução ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS instruction_locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  type          text NOT NULL DEFAULT 'SALA',
  capacity      integer NOT NULL DEFAULT 0,
  equipment     jsonb NOT NULL DEFAULT '[]',
  status        text NOT NULL DEFAULT 'ATIVO',
  notes         text,
  observation_log jsonb NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Panes / Problemas ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS location_issues (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   uuid NOT NULL REFERENCES instruction_locations(id) ON DELETE CASCADE,
  date          date NOT NULL,
  description   text NOT NULL,
  severity      text NOT NULL DEFAULT 'MEDIA',
  status        text NOT NULL DEFAULT 'ABERTA',
  resolution    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    text NOT NULL DEFAULT ''
);

-- ── Reservas ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS location_reservations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   uuid NOT NULL REFERENCES instruction_locations(id) ON DELETE CASCADE,
  date          date NOT NULL,
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  event_id      text,
  class_id      text,
  label         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    text NOT NULL DEFAULT ''
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE instruction_locations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_issues          ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_reservations    ENABLE ROW LEVEL SECURITY;

-- Leitura pública autenticada
CREATE POLICY "loc_read"   ON instruction_locations    FOR SELECT TO authenticated USING (true);
CREATE POLICY "issue_read" ON location_issues          FOR SELECT TO authenticated USING (true);
CREATE POLICY "res_read"   ON location_reservations    FOR SELECT TO authenticated USING (true);

-- Escrita apenas via service role (edge function)
CREATE POLICY "loc_write"   ON instruction_locations    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "issue_write" ON location_issues          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "res_write"   ON location_reservations    FOR ALL TO service_role USING (true) WITH CHECK (true);
