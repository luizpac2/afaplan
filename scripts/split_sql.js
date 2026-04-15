/**
 * Divide programacao_2026.sql em partes menores para colar no SQL Editor do Supabase.
 * Uso: node scripts/split_sql.js
 * Gera: scripts/parts/part_001.sql, part_002.sql, ...
 */

const fs = require('fs');
const path = require('path');

const ROWS_PER_PART = 2000;

const sqlPath = path.join(__dirname, 'programacao_2026.sql');
const outDir  = path.join(__dirname, 'parts');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const sql = fs.readFileSync(sqlPath, 'utf8');

// Extrai cabeçalho DELETE
const deleteMatch = sql.match(/DELETE FROM programacao_aulas[^;]+;/);
const deleteSQL = deleteMatch ? deleteMatch[0] : '';

// Extrai cabeçalho INSERT
const insertHeaderMatch = sql.match(/INSERT INTO programacao_aulas \([\s\S]*?\)\s*VALUES/);
const insertHeader = insertHeaderMatch ? insertHeaderMatch[0] : '';

// Extrai todas as linhas de valores
const valueLines = sql
  .split('\n')
  .filter(l => l.trimStart().startsWith("('"))
  .map(l => l.trim().replace(/,\s*$/, '').replace(/;\s*$/, ''));

console.log(`Total de registros: ${valueLines.length}`);
console.log(`Linhas por parte: ${ROWS_PER_PART}`);

const total = valueLines.length;
let partNum = 0;

// Parte 0: apenas o DELETE
const deletePart = path.join(outDir, 'part_000_DELETE.sql');
fs.writeFileSync(deletePart, deleteSQL + '\n', 'utf8');
console.log(`✅ ${path.basename(deletePart)} — DELETE`);

// Partes com INSERTs
for (let i = 0; i < total; i += ROWS_PER_PART) {
  partNum++;
  const batch = valueLines.slice(i, i + ROWS_PER_PART);
  const content = `${insertHeader}\n${batch.join(',\n')};\n`;
  const fileName = `part_${String(partNum).padStart(3, '0')}.sql`;
  fs.writeFileSync(path.join(outDir, fileName), content, 'utf8');
  const end = Math.min(i + ROWS_PER_PART, total);
  console.log(`✅ ${fileName} — registros ${i + 1}–${end}`);
}

console.log(`\n✨ ${partNum + 1} arquivos gerados em scripts/parts/`);
console.log(`Cole cada arquivo no SQL Editor do Supabase, começando pelo part_000_DELETE.sql`);
