-- Áreas acadêmicas das disciplinas
CREATE TABLE IF NOT EXISTS discipline_areas (
  id               text PRIMARY KEY,
  name             text NOT NULL,
  code             text,
  "trainingField"  text,
  "coordinatorName"  text,
  "coordinatorEmail" text,
  "coordinatorUserId" text,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE discipline_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discipline_areas: leitura autenticada" ON discipline_areas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "discipline_areas: escrita service_role" ON discipline_areas
  FOR ALL TO service_role USING (true);

-- Dados iniciais
INSERT INTO discipline_areas (id, name, code, "trainingField", "coordinatorName", "coordinatorEmail") VALUES
  ('COORD_GERAL',  'Coordenação Geral',                                     NULL,  NULL,           'Profa. Marina',        NULL),
  ('EXATAS',       'Ciências Exatas',                                        'A1',  'GERAL',        'Prof. Alessandro',     'lezandro@gmail.com'),
  ('ADMIN',        'Ciências da Administração',                              'A2',  'GERAL',        'Profa. Paulina',       'paulimontejano@gmail.com'),
  ('HUMANAS',      'Ciências Humanas',                                       'A3',  'GERAL',        'Profa. Iliane',        'ilianeijsf@gmail.com'),
  ('LINGUAGEM',    'Ciências da Linguagem',                                  'A4',  'GERAL',        'Profa. Elaine',        'elainerisques@gmail.com'),
  ('ESPORTE',      'Ciências do Esporte',                                    NULL,  'MILITAR',      'Ten Bertolucci',       'bertoluccicrb@fab.mil.br'),
  ('AERONAUTICA',  'Ciências Aeronáuticas',                                  NULL,  'PROFISSIONAL', 'Maj Puhle',            'puhlesapj@fab.mil.br'),
  ('LOGISTICA',    'Ciências Logísticas',                                    NULL,  'PROFISSIONAL', 'Cel Lopes / Ten Kazu', 'lopesosl@fab.mil.br'),
  ('MILITARES',    'Ciências Militares',                                     NULL,  'MILITAR',      'TCel Muriel',          NULL),
  ('PESQUISA',     'Subdivisão de Pesquisa e Produção Científica',           'TCC', NULL,           'Maj Mendes',           'sppc.de.afa@fab.mil.br')
ON CONFLICT (id) DO NOTHING;
