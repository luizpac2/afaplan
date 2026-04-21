const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Session mode (port 5432) para DDL com RLS/policies
const client = new Client({
  user: 'postgres.kqysbdtveefzzgzhapxo',
  password: 'Afaplan2024!',
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function run() {
  await client.connect();
  console.log('Conectado.');

  const sql = fs.readFileSync(
    path.join(__dirname, '../supabase/migrations/0006_action_logs.sql'),
    'utf8'
  );

  try {
    await client.query(sql);
    console.log('✅ Migration 0006_action_logs aplicada com sucesso.');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('ℹ️  Tabela/política já existe, pulando.');
    } else {
      console.error('❌ Erro:', err.message);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
