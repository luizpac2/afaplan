const fs = require('fs');
const { Client } = require('pg');
const path = require('path');

const user = 'postgres.sgwrpkdgoeovdoepaweo';
const password = 'Afaplan2024!';
const host = 'aws-1-us-east-1.pooler.supabase.com';

async function migrate() {
  console.log(`🚀 Iniciando migração final...`);
  console.log(`🔗 Usando Pooler: ${host}:6543`);
  
  const client = new Client({ 
    user: user,
    password: password,
    host: host,
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log('✅ CONECTADO AO SUPABASE!');
  } catch (err) {
    console.error('❌ ERRO DE CONEXÃO:', err.message);
    if (err.message.includes('authentication failed')) {
        console.log('\n🚨 A senha "Afaplan2024!" não foi aceita.');
        console.log('Verifique se não há espaços extras ou se você esqueceu de clicar em "Save" no painel do Supabase.');
    }
    process.exit(1);
  }

  const csvDir = path.join(__dirname, '../csv');
  const files = [
    'turmas.sql',
    'turma_secoes.sql',
    'locais.sql',
    'disciplinas.sql',
    'docentes.sql',
    'turmas_complemento.sql',
    'secoes_complemento.sql'
  ];

  const allFiles = fs.readdirSync(csvDir);
  const progParts = allFiles
    .filter(f => f.startsWith('programacao_aulas') && f.endsWith('.sql'))
    .sort((a, b) => {
        const aNum = parseInt(a.match(/\d+/) || '0');
        const bNum = parseInt(b.match(/\d+/) || '0');
        return aNum - bNum;
    });

  files.push(...progParts);

  for (const file of files) {
    const filePath = path.join(csvDir, file);
    if (!fs.existsSync(filePath)) continue;

    try {
      console.log(`📦 Rodando ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
      console.log(`✅ ${file} OK`);
    } catch (err) {
      console.error(`❌ Erro em ${file}:`, err.message);
    }
  }

  await client.end();
  console.log('\n✨✨✨ MIGRAÇÃO CONCLUÍDA! ✨✨✨');
}

migrate();
