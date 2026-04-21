// Diagnóstico: verifica se action_logs existe e tem dados
// Usa a edge function admin-manage-content para testar inserção
const https = require('https');

const SUPABASE_URL = 'https://kqysbdtveefzzgzhapxo.supabase.co';
// Token do usuário — passe via argumento: node check_action_logs.js <token>
const TOKEN = process.argv[2];

if (!TOKEN) {
  console.error('Uso: node scripts/check_action_logs.js <bearer_token>');
  console.error('Pegue o token no DevTools > Application > Local Storage > supabase.auth.token > access_token');
  process.exit(1);
}

async function fetchJSON(url, opts = {}) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': opts.anonKey || '',
        'Authorization': `Bearer ${TOKEN}`,
        ...opts.headers,
      },
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

async function main() {
  console.log('=== Diagnóstico action_logs ===\n');

  // 1. Testa inserção via edge function log_action
  console.log('1. Testando inserção via admin-manage-content log_action...');
  const insert = await fetchJSON(`${SUPABASE_URL}/functions/v1/admin-manage-content`, {
    method: 'POST',
    body: {
      action: 'log_action',
      entry: {
        action: 'ADD',
        entity: 'USER',
        entityId: 'test-diagnostic',
        entityName: 'Teste Diagnóstico',
        user: 'Sistema (diagnóstico)',
      },
    },
  });
  console.log('  Status:', insert.status);
  console.log('  Resposta:', JSON.stringify(insert.data));

  // 2. Testa leitura direta da tabela
  console.log('\n2. Lendo action_logs diretamente...');
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxeXNiZHR2ZWVmenpnemhhcHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzNTM4MDEsImV4cCI6MjA1MTkyOTgwMX0.tnBMlby5ByxBj5WlCnpIqTEVAMqSnRtMVAv56qz2a5A';
  const read = await fetchJSON(
    `${SUPABASE_URL}/rest/v1/action_logs?select=*&order=timestamp.desc&limit=5`,
    { headers: { apikey: ANON_KEY } },
  );
  console.log('  Status:', read.status);
  if (read.status === 200) {
    console.log('  Registros:', read.data.length);
    if (read.data.length > 0) {
      console.log('  Último:', JSON.stringify(read.data[0], null, 2));
    }
  } else {
    console.log('  Erro:', JSON.stringify(read.data));
  }
}

main().catch(console.error);
