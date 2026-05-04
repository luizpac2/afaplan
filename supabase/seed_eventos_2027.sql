-- Seed: Programação Acadêmica 2027 — 86 eventos (92 linhas após expansão por esquadrão)
-- Gerado em 2026-05-02
-- Todas as colunas camelCase foram criadas com aspas no banco → precisam de aspas no SQL.

INSERT INTO programacao_aulas (
  id, "disciplineId", "classId", date, "startTime", "endTime", type, description, notes, "endDate", "targetSquadron", "targetCourse", "targetClass"
) VALUES

-- JANEIRO ─────────────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'ACADEMIC', '', '2027-01-10', NULL, NULL, 'MILITARY',          'EAMI',                          'Adaptação Militar',    '2027-02-18', 1,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-01-11', NULL, NULL, 'ACADEMIC',          'Início Ano Letivo (4º Ano)',     'Abertura das aulas',   '2027-01-11', 4,    'AVIATION',  NULL),
-- Aula Inaugural Intendência → 3 linhas (2º, 3º e 4º Esq)
  (gen_random_uuid(), 'ACADEMIC', '', '2027-01-18', NULL, NULL, 'INFORMATIVE',       'Aula Inaugural Intendência',    'Sala 200',             '2027-01-18', 2,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-01-18', NULL, NULL, 'INFORMATIVE',       'Aula Inaugural Intendência',    'Sala 200',             '2027-01-18', 3,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-01-18', NULL, NULL, 'INFORMATIVE',       'Aula Inaugural Intendência',    'Sala 200',             '2027-01-18', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-01-19', NULL, NULL, 'FLIGHT_INSTRUCTION','Simulador Virtual (A/B)',        'Turmas A e B',         '2027-01-19', 4,    'AVIATION',  NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-01-19', NULL, NULL, 'FLIGHT_INSTRUCTION','Simulador Virtual (C/D)',        'Turmas C e D',         '2027-01-20', 4,    'AVIATION',  NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-01-21', NULL, NULL, 'FLIGHT_INSTRUCTION','Início Instrução T-27/25',       'Instrução básica',     '2027-01-21', 4,    'AVIATION',  NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-01-28', NULL, NULL, 'EVALUATION',        'TDIE (Estagiários Civis)',       'Salas de línguas',     '2027-01-28', 1,    NULL,        NULL),

-- FEVEREIRO ────────────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'ACADEMIC', '', '2027-02-05', NULL, NULL, 'INFORMATIVE',       'Briefing Licenciamento',         'Carnaval',             '2027-02-05', NULL, NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-02-11', NULL, NULL, 'ACADEMIC',          'TCC1 (Entrega Qualificação)',    'Via Moodle',           '2027-02-11', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-02-12', NULL, NULL, 'EVALUATION',        'TCC1 (Avaliação Docente)',       'Correção',             '2027-02-22', NULL, NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-02-18', NULL, NULL, 'FLIGHT_INSTRUCTION','Simulador Virtual (ITVP)',       NULL,                   '2027-02-18', 2,    'AVIATION',  NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-02-19', NULL, NULL, 'COMMEMORATIVE',     'Entrega de Platinas',            'Formatura CCAER',      '2027-02-19', 1,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-02-22', NULL, NULL, 'SPORTS',            'TACF 1 (4º Esquadrão)',          'Teste Físico',         '2027-02-22', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-02-23', NULL, NULL, 'SPORTS',            'TACF 1 (3º Esquadrão)',          'Teste Físico',         '2027-02-23', 3,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-02-24', NULL, NULL, 'SPORTS',            'TACF 1 (2º Esquadrão)',          'Teste Físico',         '2027-02-24', 2,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-02-25', NULL, NULL, 'SPORTS',            'TACF 1 (1º Esquadrão)',          'Teste Físico',         '2027-02-25', 1,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-02-22', NULL, NULL, 'INFORMATIVE',       'Aula Inaugural DA/SSUB',         'Sala 209',             '2027-02-23', 1,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-02-22', NULL, NULL, 'FLIGHT_INSTRUCTION','Início Instrução T-25',          'Instrução primária',   '2027-02-22', 2,    'AVIATION',  NULL),

-- MARÇO ────────────────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'ACADEMIC', '', '2027-03-08', NULL, NULL, 'TRIP',              'Viagem BACG (PIN2)',             'Campo Grande-MS',      '2027-03-10', 2,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-03-14', NULL, NULL, 'TRIP',              'Viagem Manaus (Leva 1)',         'Turmas A, B e F',      '2027-03-18', 3,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-03-15', NULL, NULL, 'MILITARY',          'Estágio Op. Urbanas',           'BASP',                 '2027-04-09', 3,    'INFANTRY',  NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-03-15', NULL, NULL, 'ACADEMIC',          'LOGC Teórico',                  'Sala 203',             '2027-03-19', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-03-21', NULL, NULL, 'TRIP',              'Viagem Manaus (Leva 2)',         'Turmas C e E',         '2027-03-25', 3,    NULL,        NULL),
-- Salto Emergência (Leva 1) → 2 linhas (1º e 2º Esq)
  (gen_random_uuid(), 'ACADEMIC', '', '2027-03-21', NULL, NULL, 'MILITARY',          'Salto Emergência (Leva 1)',      'Turmas A, B e C',      '2027-03-28', 1,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-03-21', NULL, NULL, 'MILITARY',          'Salto Emergência (Leva 1)',      'Turmas A, B e C',      '2027-03-28', 2,    NULL,        NULL),
-- Salto Emergência (Leva 2) → 2 linhas (1º e 2º Esq)
  (gen_random_uuid(), 'ACADEMIC', '', '2027-03-29', NULL, NULL, 'MILITARY',          'Salto Emergência (Leva 2)',      'Turmas D, E e G',      '2027-04-04', 1,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-03-29', NULL, NULL, 'MILITARY',          'Salto Emergência (Leva 2)',      'Turmas D, E e G',      '2027-04-04', 2,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-03-30', NULL, NULL, 'INFORMATIVE',       'Abertura PFV 2027',              'Cinema',               '2027-03-30', NULL, NULL,        NULL),

-- ABRIL ────────────────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'ACADEMIC', '', '2027-04-05', NULL, NULL, 'TRIP',              'Viagem COMGAP (PIN2)',           'São Paulo',            '2027-04-07', 3,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-04-06', NULL, NULL, 'MILITARY',          'ATC 1 (Subsistência)',           'Campanha',             '2027-04-16', 1,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-04-20', NULL, NULL, 'MILITARY',          'ATC 2 (Selva)',                  'Campanha',             '2027-04-23', 2,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-04-28', NULL, NULL, 'ACADEMIC',          'OHMA',                          'Tarde/Noite',          '2027-04-29', NULL, NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-04-30', NULL, NULL, 'SPORTS',            'INTERAFA 2027',                 'Jogos Internos',       '2027-05-07', NULL, NULL,        NULL),

-- MAIO ─────────────────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'ACADEMIC', '', '2027-05-03', NULL, NULL, 'MILITARY',          'TICT (Combate Terrestre)',       NULL,                   '2027-05-08', 2,    'INFANTRY',  NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-05-09', NULL, NULL, 'MILITARY',          'Estágio Instrutor de Tiro',     NULL,                   '2027-05-18', 4,    'INFANTRY',  NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-05-12', NULL, NULL, 'MILITARY',          'ATC 3 (Evasão)',                 'Campanha',             '2027-05-21', 3,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-05-17', NULL, NULL, 'TRIP',              'Viagem CINDACTA II (PIN2)',      'Curitiba-PR',          '2027-05-19', 3,    NULL,        NULL),
-- Dia do Instrutor de Voo → 2 linhas (2º e 4º Esq)
  (gen_random_uuid(), 'ACADEMIC', '', '2027-05-21', NULL, NULL, 'COMMEMORATIVE',     'Dia do Instrutor de Voo',        'Sem instrução',        '2027-05-21', 2,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-05-21', NULL, NULL, 'COMMEMORATIVE',     'Dia do Instrutor de Voo',        'Sem instrução',        '2027-05-21', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-05-21', NULL, NULL, 'COMMEMORATIVE',     'Churrasco Pré-Solo',             'Dia Inteiro',          '2027-05-21', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-05-27', NULL, NULL, 'INFORMATIVE',       'PFV Maio',                       'Cinema',               '2027-05-27', NULL, NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-05-31', NULL, NULL, 'SPORTS',            'TACF 2',                         'Avaliação',            '2027-06-03', NULL, NULL,        NULL),

-- JUNHO ────────────────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'ACADEMIC', '', '2027-06-01', NULL, NULL, 'ACADEMIC',          'ISSE (Teórico)',                 'Intendência',          '2027-06-03', 3,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-06-07', NULL, NULL, 'TRIP',              'EPI1',                           'Canoas-RS',            '2027-06-11', 2,    NULL,        'TURMA_F'),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-06-10', NULL, NULL, 'ACADEMIC',          'TCC PROJ (Entrega)',             'Moodle',               '2027-06-10', 3,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-06-14', NULL, NULL, 'MILITARY',          'LOGC Prática',                  'Lagoa Santa-MG',       '2027-06-25', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-06-17', NULL, NULL, 'MILITARY',          'ISSE (Fase Prática)',            'Novo Progresso-PA',    '2027-06-29', 3,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-06-18', NULL, NULL, 'ACADEMIC',          'TCC (Entrega Artigo)',           'Moodle',               '2027-06-18', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-06-21', NULL, NULL, 'MILITARY',          'TNAV',                           NULL,                   '2027-06-25', 2,    NULL,        'TURMA_F'),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-06-29', NULL, NULL, 'INFORMATIVE',       'PFV Junho',                      'Cinema',               '2027-06-29', NULL, NULL,        NULL),

-- JULHO ────────────────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'ACADEMIC', '', '2027-07-12', NULL, NULL, 'MILITARY',          'EMAD',                           NULL,                   '2027-07-24', 3,    NULL,        'TURMA_F'),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-07-12', NULL, NULL, 'ACADEMIC',          'TCPA',                           NULL,                   '2027-10-23', 4,    NULL,        'TURMA_F'),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-07-19', NULL, NULL, 'TRIP',              'Viagem DIRAD (PIN2)',            'Rio de Janeiro-RJ',    '2027-07-22', 3,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-07-20', NULL, NULL, 'INFORMATIVE',       'Visita EMBRAER (Leva 1)',        'Turmas A, B e E',      '2027-07-20', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-07-26', NULL, NULL, 'MILITARY',          'TEFT',                           NULL,                   '2027-07-30', 2,    NULL,        'TURMA_F'),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-07-27', NULL, NULL, 'INFORMATIVE',       'Visita EMBRAER (Leva 2)',        'Turmas C, D e F',      '2027-07-27', 4,    NULL,        NULL),

-- AGOSTO ───────────────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'ACADEMIC', '', '2027-08-02', NULL, NULL, 'EVALUATION',        'Bancas de TCC (Defesas)',        NULL,                   '2027-08-27', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-08-02', NULL, NULL, 'TRIP',              'Visita EEAR',                    'Guaratinguetá-SP',     '2027-08-03', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-08-02', NULL, NULL, 'TRIP',              'Viagem SEFA (PIN2)',             'São Paulo-SP',         '2027-08-04', 2,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-08-03', NULL, NULL, 'TRIP',              'EBCM',                           'Belo Horizonte-MG',    '2027-08-07', 3,    NULL,        'TURMA_F'),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-08-26', NULL, NULL, 'INFORMATIVE',       'PFV Agosto',                     'Cinema',               '2027-08-26', NULL, NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-08-30', NULL, NULL, 'SPORTS',            'TACF 3',                         'Avaliação Final',      '2027-09-02', NULL, NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-08-30', NULL, NULL, 'ACADEMIC',          'Seminário Of. Gen. Int.',        'Sala 200',             '2027-08-30', NULL, NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-08-31', NULL, NULL, 'ACADEMIC',          'Seminário CENCIAR',              'Sala 203',             '2027-09-01', 4,    NULL,        NULL),

-- SETEMBRO ─────────────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'ACADEMIC', '', '2027-09-06', NULL, NULL, 'TRIP',              'EPI2',                           'Manaus-AM',            '2027-09-11', 4,    NULL,        'TURMA_F'),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-09-06', NULL, NULL, 'MILITARY',          'TPAT',                           NULL,                   '2027-09-17', 2,    NULL,        'TURMA_F'),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-09-10', NULL, NULL, 'COMMEMORATIVE',     'Churrasco HS-100',               NULL,                   '2027-09-10', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-09-13', NULL, NULL, 'MILITARY',          'OPSE (CIGS)',                    'Manaus-AM',            '2027-09-19', 4,    NULL,        'TURMA_F'),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-09-28', NULL, NULL, 'INFORMATIVE',       'PFV Setembro',                   'Cinema',               '2027-09-28', NULL, NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-09-28', NULL, NULL, 'ACADEMIC',          'ISMA (Teórico)',                 'Sobrevivência Mar',    '2027-09-30', 2,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-09-29', NULL, NULL, 'EVALUATION',        'TDIE / TAAI',                    'Idiomas',              '2027-09-30', NULL, NULL,        NULL),

-- OUTUBRO ──────────────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'ACADEMIC', '', '2027-10-04', NULL, NULL, 'MILITARY',          'ISMA (Fase Prática)',            'Guarujá-SP',           '2027-10-15', 2,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-10-10', NULL, NULL, 'TRIP',              'Viagem Internacional',           NULL,                   '2027-10-18', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-10-15', NULL, NULL, 'COMMEMORATIVE',     'Ordem da Cátedra',               'Hall do Cinema',       '2027-10-15', NULL, NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-10-18', NULL, NULL, 'TRIP',              'Viagem Brasília / OMA',          'Brasília-DF',          '2027-10-23', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-10-18', NULL, NULL, 'TRIP',              'Viagem DCTA (PIN2)',             'S. J. Campos',         '2027-10-20', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-10-26', NULL, NULL, 'ACADEMIC',          'Melhores TCC',                   'Cinema',               '2027-10-26', NULL, NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-10-28', NULL, NULL, 'COMMEMORATIVE',     'Entrega Lachês',                 'ADCE',                 '2027-10-28', 2,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-10-28', NULL, NULL, 'INFORMATIVE',       'PFV Outubro',                    'Cinema',               '2027-10-28', NULL, NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-10-29', NULL, NULL, 'FLIGHT_INSTRUCTION','Término Voo T-25',               NULL,                   '2027-10-29', 2,    'AVIATION',  NULL),

-- NOVEMBRO ─────────────────────────────────────────────────────────────────────
  (gen_random_uuid(), 'ACADEMIC', '', '2027-11-03', NULL, NULL, 'ACADEMIC',          'Instrução ADLI',                 NULL,                   '2027-11-05', 2,    NULL,        'TURMA_F'),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-11-14', NULL, NULL, 'EVALUATION',        'Prova AFA (EVV)',                'EVV',                  '2027-11-21', NULL, NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-11-16', NULL, NULL, 'MILITARY',          'ATC 4 (Guerra)',                 'Campanha Final',       '2027-11-19', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-11-16', NULL, NULL, 'ACADEMIC',          'Processos Licitatórios',         'Sala 205',             '2027-11-19', 3,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-11-22', NULL, NULL, 'ACADEMIC',          'Prática SIAFI',                  'Sala 203',             '2027-11-25', 4,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-11-24', NULL, NULL, 'INFORMATIVE',       'Encontro Pedagógico',            'Sem cadetes',          '2027-11-25', NULL, NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-11-29', NULL, NULL, 'INFORMATIVE',       'Escolha Aviação',                NULL,                   '2027-11-30', 4,    'AVIATION',  NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-11-30', NULL, NULL, 'COMMEMORATIVE',     'Encerramento PFV',               'Cinema',               '2027-11-30', NULL, NULL,        NULL),

-- DEZEMBRO ─────────────────────────────────────────────────────────────────────
-- Premiação DOA → 2 linhas (2º e 4º Esq)
  (gen_random_uuid(), 'ACADEMIC', '', '2027-12-03', NULL, NULL, 'COMMEMORATIVE',     'Premiação DOA',                  NULL,                   '2027-12-03', 2,    NULL,        NULL),
  (gen_random_uuid(), 'ACADEMIC', '', '2027-12-03', NULL, NULL, 'COMMEMORATIVE',     'Premiação DOA',                  NULL,                   '2027-12-03', 4,    NULL,        NULL)

;
-- Total: 92 linhas
