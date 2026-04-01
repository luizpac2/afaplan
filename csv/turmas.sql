INSERT INTO turmas (id, nome, ano_ingresso, esquadrao, cor_hex, total_cadetes, ativo) VALUES 
  ('b3a0cf21-1170-4fba-94aa-72ef26a55954', 'Drakon', 2026, 1, NULL, 190, true),
  ('fff5ff02-1586-402c-a97f-86ae261377be', 'Perseu', 2025, 2, NULL, 190, true),
  ('9ca3be92-57bd-44d3-858e-a064942f9298', 'Uiraçu', 2024, 3, NULL, 190, true),
  ('ca202064-cb84-4668-8ec6-cd35a4f02226', 'Athos', 2023, 4, NULL, 190, true)
ON CONFLICT (id) DO NOTHING;