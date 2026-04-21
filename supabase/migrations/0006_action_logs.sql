-- Recria action_logs com colunas snake_case (padrão Postgres)
DROP TABLE IF EXISTS action_logs;

CREATE TABLE action_logs (
  id           bigserial PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  action       text        NOT NULL,  -- ADD | UPDATE | DELETE | IMPORT
  entity       text        NOT NULL,  -- USER | DISCIPLINE | EVENT | CLASS | COHORT | NOTICE | ...
  entity_id    text,
  entity_name  text,
  changes      jsonb,
  actor_name   text,                  -- nome legível do executor
  actor_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read action_logs"
  ON action_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'gestor')
    )
    OR auth.email() = 'pelicano307@gmail.com'
  );

CREATE POLICY "Service role can insert action_logs"
  ON action_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE INDEX idx_action_logs_created_at ON action_logs (created_at DESC);
CREATE INDEX idx_action_logs_entity     ON action_logs (entity);
CREATE INDEX idx_action_logs_actor_id   ON action_logs (actor_id);
