/**
 * Importa programacao_2026.sql via API REST do Supabase.
 * Não usa conexão pg — funciona em qualquer rede.
 *
 * Uso:
 *   $env:SUPABASE_URL="https://kqysbdtveefzzgzhapxo.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   node scripts/import_via_api.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BATCH_SIZE = 200;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  console.error('   $env:SUPABASE_URL="https://SEU_PROJECT.supabase.co"');
  console.error('   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."');
  process.exit(1);
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(buf ? JSON.parse(buf) : null);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${buf}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
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
      if (ch === "'" && inner[i + 1] === "'") { current += "'"; i += 2; continue; }
      else if (ch === "'") { inStr = false; current += ch; }
      else { current += ch; }
    } else {
      if (ch === "'") { inStr = true; current += ch; }
      else if (ch === ',') { cols.push(current.trim()); current = ''; i++; continue; }
      else { current += ch; }
    }
    i++;
  }
  if (current.trim()) cols.push(current.trim());
  return cols;
}

function unquote(s) {
  if (!s) return null;
  s = s.trim();
  if (s === 'NULL') return null;
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  return s;
}

async function run() {
  // 1. Busca disciplinas via API
  console.log('📚 Buscando disciplinas...');
  const disciplines = await request('GET', '/rest/v1/disciplines?select=id,code&limit=1000');
  const codeToUUID = {};
  for (const d of disciplines) codeToUUID[d.code] = d.id;
  console.log(`✅ ${disciplines.length} disciplinas encontradas\n`);

  // 2. Lê e parseia o SQL
  const sqlPath = path.join(__dirname, 'programacao_2026.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const valueLines = sql.split('\n')
    .filter(l => l.trimStart().startsWith("('"))
    .map(l => l.trim().replace(/,\s*$/, '').replace(/;\s*$/, ''));

  console.log(`📊 ${valueLines.length} registros no SQL\n`);

  // 3. Resolve UUIDs e monta objetos
  const rows = [];
  const unknown = new Set();

  for (const line of valueLines) {
    const inner = line.slice(1, -1);
    const cols = splitSQLTuple(inner);
    if (cols.length < 9) continue;

    const [id, classId, disciplineCode, date, startTime, endTime, type, evaluationType, description] = cols;
    const code = unquote(disciplineCode);
    const uuid = codeToUUID[code];

    if (!uuid) { unknown.add(code); continue; } // pula se não tem UUID

    rows.push({
      id: unquote(id),
      classId: unquote(classId),
      disciplineId: uuid,
      date: unquote(date),
      startTime: unquote(startTime),
      endTime: unquote(endTime),
      type: unquote(type),
      evaluationType: unquote(evaluationType),
      description: unquote(description),
    });
  }

  if (unknown.size > 0) {
    console.warn(`⚠️  ${unknown.size} códigos sem disciplina cadastrada (serão pulados):`);
    for (const c of [...unknown].slice(0, 30)) console.warn(`   - ${c}`);
    console.log('');
  }

  // 4. DELETE via API
  console.log('🗑️  Apagando eventos 2026...');
  await request('DELETE', '/rest/v1/programacao_aulas?date=gte.2026-01-01&date=lte.2026-12-31');
  console.log('✅ DELETE OK\n');

  // 5. INSERT em lotes
  const total = rows.length;
  let inserted = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      await request('POST', '/rest/v1/programacao_aulas', batch);
      inserted += batch.length;
    } catch (err) {
      console.error(`❌ Erro no lote ${Math.ceil((i+1)/BATCH_SIZE)}:`, err.message.slice(0, 200));
    }
    const pct = ((Math.min(i + BATCH_SIZE, total) / total) * 100).toFixed(1);
    process.stdout.write(`\r📦 ${Math.min(i + BATCH_SIZE, total)}/${total} (${pct}%)`);
  }

  console.log(`\n\n✨ CONCLUÍDO! ${inserted}/${total} registros inseridos.`);
  if (unknown.size > 0) console.log(`   ${unknown.size} códigos pulados por não ter disciplina cadastrada.`);
}

run().catch(err => { console.error('\n❌', err.message); process.exit(1); });
