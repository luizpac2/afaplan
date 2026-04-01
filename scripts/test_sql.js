const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function test() {
  const client = new Client({ 
    user: 'postgres.sgwrpkdgoeovdoepaweo',
    password: 'Afaplan2024!',
    host: 'aws-1-us-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const sql = fs.readFileSync('./csv/programacao_aulas_part1.sql', 'utf8');
    console.log('--- TESTANDO INSERT PART 1 ---');
    await client.query(sql);
    console.log('✅ SUCESSO NO TESTE!');
  } catch (err) {
    console.error('❌ ERRO NO TESTE:', err.message);
    console.error('DETALHE:', err.detail);
  } finally {
    await client.end();
  }
}

test();
