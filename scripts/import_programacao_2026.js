/**
 * Importa programacao_2026.sql diretamente no Supabase via pg (bypass do SQL Editor).
 * Faz lookup dos UUIDs das disciplinas pelo código antes de inserir.
 * Uso: node scripts/import_programacao_2026.js
 */

const fs = require('fs');
const { Client } = require('pg');
const path = require('path');

const BATCH_SIZE = 500;

// Carrega .env se existir
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
  });
}

const client = new Client({
  user:     process.env.SUPABASE_DB_USER     || 'postgres.kqysbdtveefzzgzhapxo',
  password: process.env.SUPABASE_DB_PASSWORD || 'Afaplan2024',
  host:     process.env.SUPABASE_DB_HOST     || 'aws-0-us-east-1.pooler.supabase.com',
  port:     parseInt(process.env.SUPABASE_DB_PORT || '6543'),
  database: process.env.SUPABASE_DB_NAME     || 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
  family: 4,  // força IPv4
});

async function run() {
  await client.connect();
  console.log('✅ Conectado ao Supabase!\n');

  // 1. Busca todos os UUIDs das disciplinas
  console.log('📚 Buscando disciplinas...');
  const discResult = await client.query('SELECT id, code FROM disciplines');
  const codeToUUID = {};
  for (const row of discResult.rows) {
    codeToUUID[row.code] = row.id;
  }
  console.log(`✅ ${discResult.rows.length} disciplinas encontradas\n`);

  // 2. Lê o SQL gerado
  const sqlPath = path.join(__dirname, 'programacao_2026.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ Arquivo não encontrado:', sqlPath);
    process.exit(1);
  }

  console.log('📂 Lendo programacao_2026.sql...');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // 3. Extrai o DELETE
  const deleteMatch = sql.match(/DELETE FROM programacao_aulas[^;]+;/);
  if (!deleteMatch) {
    console.error('❌ DELETE não encontrado no SQL.');
    process.exit(1);
  }

  // 4. Extrai todos os value tuples
  const valueLines = sql
    .split('\n')
    .filter(l => l.trimStart().startsWith("('"))
    .map(l => l.trim().replace(/,\s*$/, '').replace(/;\s*$/, ''));

  console.log(`📊 Total de registros encontrados: ${valueLines.length}`);

  // 5. Faz o parse das linhas e resolve os UUIDs das disciplinas
  // Formato: ('uuid', 'classId', 'disciplineCode', 'date', 'startTime', 'endTime', 'type', evalType, desc)
  const resolved = [];
  const unknownCodes = new Set();

  for (const line of valueLines) {
    // Parse da tupla SQL: extrai os valores
    // Remove parênteses externos
    const inner = line.slice(1, -1);
    const cols = splitSQLTuple(inner);

    if (cols.length < 9) continue;

    const [id, classId, disciplineCode, date, startTime, endTime, type, evaluationType, description] = cols;
    const code = unquote(disciplineCode);
    const uuid = codeToUUID[code];

    if (!uuid) {
      unknownCodes.add(code);
      // Para eventos SPECIAL e INFORMATIONAL, cria um UUID fictício ou pula
      // Vamos pular — esses eventos usam o próprio código como disciplineId
      // mas podem não existir na tabela disciplines
      // Tentativa: usar o código direto (pode falhar se houver FK constraint)
      resolved.push({ id: unquote(id), classId: unquote(classId), disciplineId: code, date: unquote(date), startTime: unquote(startTime), endTime: unquote(endTime), type: unquote(type), evaluationType: evaluationType === 'NULL' ? null : unquote(evaluationType), description: description === 'NULL' ? null : unquote(description) });
    } else {
      resolved.push({ id: unquote(id), classId: unquote(classId), disciplineId: uuid, date: unquote(date), startTime: unquote(startTime), endTime: unquote(endTime), type: unquote(type), evaluationType: evaluationType === 'NULL' ? null : unquote(evaluationType), description: description === 'NULL' ? null : unquote(description) });
    }
  }

  if (unknownCodes.size > 0) {
    console.warn(`⚠️  Códigos sem UUID na tabela disciplines (${unknownCodes.size}):`);
    for (const c of [...unknownCodes].slice(0, 20)) console.warn(`   - ${c}`);
    if (unknownCodes.size > 20) console.warn(`   ... e mais ${unknownCodes.size - 20}`);
    console.log('');
  }

  // 6. DELETE
  console.log('🗑️  Apagando eventos 2026...');
  await client.query(deleteMatch[0]);
  console.log('✅ DELETE OK\n');

  // 7. INSERT em lotes usando $1,$2,... (parametrizado)
  const total = resolved.length;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = resolved.slice(i, i + BATCH_SIZE);
    const values = [];
    const params = [];
    let pIdx = 1;

    for (const r of batch) {
      values.push(`($${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++},$${pIdx++})`);
      params.push(r.id, r.classId, r.disciplineId, r.date, r.startTime, r.endTime, r.type, r.evaluationType, r.description);
    }

    const batchSQL = `INSERT INTO programacao_aulas (id, "classId", "disciplineId", date, "startTime", "endTime", type, "evaluationType", description) VALUES ${values.join(',\n')}`;

    try {
      await client.query(batchSQL, params);
      inserted += batch.length;
    } catch (err) {
      console.error(`❌ Erro no lote ${Math.ceil((i + 1) / BATCH_SIZE)}:`, err.message);
      // Tenta linha a linha para identificar problema
      for (const r of batch) {
        const singleSQL = `INSERT INTO programacao_aulas (id, "classId", "disciplineId", date, "startTime", "endTime", type, "evaluationType", description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`;
        try {
          await client.query(singleSQL, [r.id, r.classId, r.disciplineId, r.date, r.startTime, r.endTime, r.type, r.evaluationType, r.description]);
          inserted++;
        } catch (e2) {
          skipped++;
          if (skipped <= 10) console.error(`   ⚠ Pulando ${r.disciplineId} (${r.classId} ${r.date}): ${e2.message}`);
        }
      }
    }

    const pct = ((Math.min(i + BATCH_SIZE, total) / total) * 100).toFixed(1);
    console.log(`📦 Lote ${Math.ceil((i + BATCH_SIZE) / BATCH_SIZE)} — ${Math.min(i + BATCH_SIZE, total)}/${total} (${pct}%)`);
  }

  await client.end();
  console.log(`\n✨ IMPORTAÇÃO CONCLUÍDA!`);
  console.log(`   Inseridos: ${inserted}`);
  if (skipped > 0) console.log(`   Pulados (erro): ${skipped}`);
}

// Parse de uma tupla SQL respeitando strings com aspas simples escapadas
function splitSQLTuple(inner) {
  const cols = [];
  let current = '';
  let inStr = false;
  let i = 0;
  while (i < inner.length) {
    const ch = inner[i];
    if (inStr) {
      if (ch === "'" && inner[i + 1] === "'") {
        current += "'";
        i += 2;
        continue;
      } else if (ch === "'") {
        inStr = false;
        current += ch;
      } else {
        current += ch;
      }
    } else {
      if (ch === "'") {
        inStr = true;
        current += ch;
      } else if (ch === ',') {
        cols.push(current.trim());
        current = '';
        i++;
        continue;
      } else {
        current += ch;
      }
    }
    i++;
  }
  if (current.trim()) cols.push(current.trim());
  return cols;
}

function unquote(s) {
  if (!s) return s;
  s = s.trim();
  if (s.startsWith("'") && s.endsWith("'")) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

run().catch(err => {
  console.error('❌ Erro:', err.message);
  client.end().catch(() => {});
  process.exit(1);
});
