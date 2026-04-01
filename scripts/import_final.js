require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const { Client } = require('pg');
const path = require('path');

async function migrate() {
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
    console.log('✅ CONECTADO PARA IMPORTAÇÃO FINAL (COM PHANTOMS)');
    
    const csvDir = path.join(__dirname, '../csv');
    
    const masterFiles = [
      'turmas.sql',
      'turmas_phantom.sql',
      'turma_secoes.sql',
      'secoes_phantom.sql',
      'locais.sql',
      'locais_phantom.sql',
      'disciplinas.sql',
      'disciplinas_phantom.sql',
      'docentes.sql'
    ];

    for (const file of masterFiles) {
        const p = path.join(csvDir, file);
        if (!fs.existsSync(p)) continue;
        console.log(`💎 Mestre: ${file}...`);
        await client.query(fs.readFileSync(p, 'utf8'));
    }

    const progFiles = fs.readdirSync(csvDir)
      .filter(f => f.startsWith('programacao_aulas') && f.endsWith('.sql'))
      .sort((a, b) => {
          const aN = parseInt(a.match(/\d+/)[0]);
          const bN = parseInt(b.match(/\d+/)[0]);
          return aN - bN;
      });

    console.log(`📦 Importando ${progFiles.length} partes da programação...`);
    let count = 0;
    for (const f of progFiles) {
        try {
            await client.query(fs.readFileSync(path.join(csvDir, f), 'utf8'));
            count++;
            if (count % 20 === 0) console.log(`🚀 Progresso: ${count}/${progFiles.length}`);
        } catch (err) {
            console.warn(`⚠️ Aviso em ${f}: ${err.message.substring(0, 80)}...`);
        }
    }

    const tables = ['turmas', 'turma_secoes', 'locais', 'disciplinas', 'docentes', 'programacao_aulas'];
    let output = '--- RELATÓRIO DE DADOS SUPABASE ---\n';
    for (const table of tables) {
      const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
      output += `${table}: ${res.rows[0].count} registros\n`;
    }
    fs.writeFileSync('migration_report.txt', output);
    console.log('\n--- CONTAGEM FINAL ---');
    console.log(output);

    await client.end();
    console.log('\n🌟 MIGRAÇÃO MASSIVA FINALIZADA!');
  } catch (err) {
    console.error('💥 Erro fatal:', err.message);
    process.exit(1);
  }
}

migrate();
