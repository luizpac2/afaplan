#!/usr/bin/env node
/**
 * Converte CSVs de programação 2026 em SQL para programacao_aulas.
 *
 * Uso: node scripts/generate_sql_from_csv.js
 *
 * Coloque os CSVs em scripts/csv/ com os nomes:
 *   "Banco de dados PROGRAMACAO_2026 - 1º ano.csv"
 *   "Banco de dados PROGRAMACAO_2026 - 2º ano.csv"
 *   "Banco de dados PROGRAMACAO_2026 - 3º ano.csv"
 *   "Banco de dados PROGRAMACAO_2026 - 4º ano.csv"
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// Mapa Tempo → [startTime, endTime]
const TIME_SLOTS = {
  1: ['07:00', '08:00'],
  2: ['08:10', '09:10'],
  3: ['09:30', '10:30'],
  4: ['10:40', '11:40'],
  5: ['13:20', '14:20'],
  6: ['14:30', '15:30'],
  7: ['15:50', '16:50'],
  8: ['16:50', '17:50'],
};

// Eventos especiais → SPECIAL (feriados, férias, etc.)
const SPECIAL_EVENTS = new Set([
  'FÉRIAS', 'RECESSO', 'FERIADO', 'SEM EXPEDIENTE', 'PÁSCOA DOS MILITARES',
  'PÁSCOA', 'NATAL', 'ANO NOVO', 'CARNAVAL',
]);

// Eventos informativos → INFORMATIONAL (eventos pontuais, não são disciplinas)
const INFORMATIONAL_EVENTS = new Set([
  'ASPIRANTADO', 'ESPADIM', 'ENTREGA DE PLATINAS', 'AULA MAGNA',
  'INTERAFA', 'SEM. OF GEN INT', 'SEM. OF GEN INT ', 'SEMINÁRIO DE OF GEN INT ',
  'CAFÉ DA MANHÃ', 'ORDEM DA CÁTEDRA', 'JSVO', 'INSP', 'OHMA', 'PVAE', 'BAVA',
  'ACANTEX', 'CEM DIAS', 'PALESTRA', 'PREMIAÇÃO DA DOA', 'PREMIAÇÃO DOA',
  'ESCOLHA DAS AVIAÇÕES', 'APRONTO PNE', 'SIMP INF', 'SIMP INT',
  'VIAGEM EEAR', 'VIAGEM 4º ANO', 'VIAGEM A MANAUS', 'VIAGEM AO DCTA',
  'VIAGEM BASG CAMPO GRANDE/MT', 'VIAGEM DCTA', 'VIAGEM RIO DE JANEIRO',
  'VISITA AO GAP-SP', 'VISITA À EMBRAER',
]);

// Converte "DD/MM/YYYY" → "YYYY-MM-DD"
function parseDate(d) {
  const [dd, mm, yyyy] = d.split('/');
  return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
}

function escape(s) {
  return s.replace(/'/g, "''");
}

function processCSV(filePath, squadronNumber) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  const rows = lines.slice(1); // skip header

  const inserts = [];

  for (const line of rows) {
    // Parse CSV: Data,Turma,Tempo,Materia
    const parts = line.split(',');
    if (parts.length < 4) continue;

    const [rawDate, turma, rawTempo, ...materiaParts] = parts;
    const materia = materiaParts.join(',').trim().replace(/\r/g, '');
    const tempo = parseInt(rawTempo.trim(), 10);

    if (!rawDate || !turma || !materia || isNaN(tempo)) continue;

    const date = parseDate(rawDate.trim());
    const classId = `${squadronNumber}${turma.trim()}`;
    const slot = TIME_SLOTS[tempo];
    if (!slot) continue;
    const [startTime, endTime] = slot;

    const id = randomUUID();
    let disciplineId, type, evaluationType = null, description = null;

    // PRX suffix → EVALUATION / EXAM
    if (materia.endsWith(' PRX')) {
      disciplineId = materia.slice(0, -4).trim();
      type = 'EVALUATION';
      evaluationType = 'EXAM';
    } else if (SPECIAL_EVENTS.has(materia)) {
      disciplineId = materia;
      type = 'SPECIAL';
      description = materia;
    } else if (INFORMATIONAL_EVENTS.has(materia) ||
               materia.startsWith('VIAGEM') || materia.startsWith('VISITA') ||
               materia.startsWith('SEMINÁRIO')) {
      disciplineId = materia;
      type = 'INFORMATIONAL';
      description = materia;
    } else {
      // CLASS normal
      disciplineId = materia;
      type = 'CLASS';
    }

    const evalTypeSQL = evaluationType ? `'${evaluationType}'` : 'NULL';
    const descSQL = description ? `'${escape(description)}'` : 'NULL';

    inserts.push(
      `('${id}', '${classId}', '${disciplineId}', '${date}', '${startTime}', '${endTime}', '${type}', ${evalTypeSQL}, ${descSQL})`
    );
  }

  return inserts;
}

// Descobrir arquivos CSV
const csvDir = path.join(__dirname, 'csv');
const srcDir = path.join(__dirname, '..', 'app', 'src');

const csvFiles = [
  { name: 'Base de Dados Programação 2026 - 1º ano.csv', squadron: 1 },
  { name: 'Base de Dados Programação 2026 - 2º ano.csv', squadron: 2 },
  { name: 'Base de Dados Programação 2026 - 3º ano.csv', squadron: 3 },
  { name: 'Base de Dados Programação 2026 - 4º ano.csv', squadron: 4 },
];

let allInserts = [];

for (const { name, squadron } of csvFiles) {
  // Tenta primeiro em scripts/csv/, depois em app/src/
  let filePath = path.join(__dirname, name);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(csvDir, name);
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.join(srcDir, name);
  }
  if (!fs.existsSync(filePath)) {
    console.warn(`[AVISO] CSV não encontrado: ${name}`);
    continue;
  }
  console.log(`Processando ${name} (esquadrão ${squadron})...`);
  const inserts = processCSV(filePath, squadron);
  console.log(`  → ${inserts.length} registros`);
  allInserts = allInserts.concat(inserts);
}

if (allInserts.length === 0) {
  console.error('Nenhum registro gerado. Verifique os arquivos CSV.');
  process.exit(1);
}

const outputPath = path.join(__dirname, 'programacao_2026.sql');

const sql = `-- ============================================================
-- PROGRAMAÇÃO 2026 — Gerado automaticamente em ${new Date().toISOString()}
-- ============================================================

-- 1. Apaga todos os eventos de 2026
DELETE FROM programacao_aulas
WHERE date >= '2026-01-01' AND date <= '2026-12-31';

-- 2. Insere novos eventos
INSERT INTO programacao_aulas (id, "classId", "disciplineId", date, "startTime", "endTime", type, "evaluationType", description)
VALUES
${allInserts.join(',\n')};

-- Total: ${allInserts.length} registros inseridos
`;

fs.writeFileSync(outputPath, sql, 'utf8');
console.log(`\nSQL gerado: ${outputPath}`);
console.log(`Total de registros: ${allInserts.length}`);
