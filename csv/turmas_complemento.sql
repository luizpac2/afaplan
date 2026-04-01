INSERT INTO turmas (id, nome, ano_ingresso, esquadrao, cor_hex, total_cadetes, ativo) VALUES 
  ('2b5061ac-3d2e-48d4-861e-b94d5007b402', 'Esquadrão ALL (Histórico)', NaN, 1, '#aaaaaa', 190, false)
ON CONFLICT (id) DO NOTHING;