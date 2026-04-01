require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');
const fs = require('fs');

async function count() {
  const client = new Client({
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    host: process.env.SUPABASE_DB_HOST,
    port: parseInt(process.env.SUPABASE_DB_PORT || '6543'),
    database: process.env.SUPABASE_DB_NAME || 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const tables = ['turmas', 'turma_secoes', 'locais', 'disciplinas', 'docentes', 'programacao_aulas'];
    let output = '--- RELATÓRIO DE DADOS SUPABASE ---\n';
    for (const table of tables) {
      const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
      output += `${table}: ${res.rows[0].count} registros\n`;
    }
    fs.writeFileSync('migration_report.txt', output);
    console.log('✅ Relatório gerado em migration_report.txt');
    await client.end();
  } catch (err) {
    fs.writeFileSync('migration_report.txt', 'ERRO: ' + err.message);
  }
}

count();
