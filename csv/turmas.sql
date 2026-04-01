INSERT INTO turmas (id, nome, ano_ingresso, esquadrao, cor_hex, total_cadetes, ativo) VALUES 
  ('589da339-9ab8-43a7-96eb-aed7ea957201', 'Drakon', 2026, 1, NULL, 190, true),
  ('8897ac77-821f-41a6-97f5-c4035a79f99c', 'Perseu', 2025, 2, NULL, 190, true),
  ('eec5ab6f-29cd-4326-b251-0a68ddf27e6d', 'Uiraçu', 2024, 3, NULL, 190, true),
  ('50d9ab1c-9755-4dd9-9bb2-a6abdf350521', 'Athos', 2023, 4, NULL, 190, true)
ON CONFLICT (id) DO NOTHING;