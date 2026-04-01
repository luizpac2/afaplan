INSERT INTO disciplinas (id, sigla, nome, categoria, carga_horaria, ativo) VALUES 
  ('eb09969b-72df-4083-863a-2f39c35a2608', 'HEB09969B', 'Disciplina Histórica (eb09969b-72df-4083-863a-2f39c35a2608)', 'GERAL', 0, false),
  ('a6c70510-742d-4bb9-9060-3e4e406bea35', 'HA6C70510', 'Disciplina Histórica (ACADEMIC)', 'GERAL', 0, false),
  ('1102a3d7-dcf4-40b9-b564-a5a9025b1a3b', 'H1102A3D7', 'Disciplina Histórica (1102a3d7-dcf4-40b9-b564-a5a9025b1a3b)', 'GERAL', 0, false),
  ('15f1cd1c-ea27-43d1-af5e-fc37f5096bbc', 'H15F1CD1C', 'Disciplina Histórica (15f1cd1c-ea27-43d1-af5e-fc37f5096bbc)', 'GERAL', 0, false)
ON CONFLICT (sigla) DO NOTHING;