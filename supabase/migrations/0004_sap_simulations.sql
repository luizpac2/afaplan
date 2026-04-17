-- Tabela para armazenar mudanças dentro de simulações SAP
-- Cada registro representa uma alteração (mover, excluir ou adicionar aula)
-- feita dentro do workspace de simulação de uma SAP.

CREATE TABLE IF NOT EXISTS sap_simulations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sap_id        text NOT NULL,                                    -- ID ou numeroAlteracao da SAP
  action        text NOT NULL CHECK (action IN ('MOVE', 'DELETE', 'ADD', 'MODIFY')),
  event_id      text,                                             -- ID do evento original (null para ADD)
  original_data jsonb,                                            -- Estado antes da alteração (null para ADD)
  new_data      jsonb,                                            -- Estado após a alteração (null para DELETE)
  reverted      boolean NOT NULL DEFAULT false,                   -- true se o usuário desfez esta mudança
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_sap_simulations_sap_id ON sap_simulations(sap_id);
CREATE INDEX idx_sap_simulations_event_id ON sap_simulations(event_id);

ALTER TABLE sap_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read sap_simulations"
  ON sap_simulations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert sap_simulations"
  ON sap_simulations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update sap_simulations"
  ON sap_simulations FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete sap_simulations"
  ON sap_simulations FOR DELETE TO authenticated USING (true);

-- Adiciona coluna changeRequestId na tabela de aulas (se ainda não existe)
-- Usada para marcar aulas que foram alteradas por uma SAP após aplicação
ALTER TABLE programacao_aulas
  ADD COLUMN IF NOT EXISTS "changeRequestId" text;

CREATE INDEX IF NOT EXISTS idx_programacao_change_request
  ON programacao_aulas("changeRequestId");
