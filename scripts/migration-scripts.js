// scripts/export-firebase.js
// Rodar com: node scripts/export-firebase.js
// Requer: npm install firebase-admin

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey.json'))
});

const db = admin.firestore();

// Coleções a exportar (ajuste conforme sua estrutura Firebase)
const COLLECTIONS = [
  'turmas',
  'disciplinas',
  'docentes',
  'locais',
  'programacao',    // → programacao_aulas
  'solicitacoes',   // → solicitacoes_sap
  'avisos',
  'bloqueios'
];

async function exportCollection(name) {
  const snapshot = await db.collection(name).get();
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  fs.writeFileSync(
    path.join('./backup', `${name}.json`),
    JSON.stringify(data, null, 2)
  );
  console.log(`✓ ${name}: ${data.length} documentos exportados`);
  return data;
}

async function main() {
  fs.mkdirSync('./backup', { recursive: true });
  for (const col of COLLECTIONS) {
    try {
      await exportCollection(col);
    } catch (e) {
      console.error(`✗ Erro em ${col}:`, e.message);
    }
  }
  console.log('\n✅ Exportação completa em ./backup/');
}

main();

// scripts/export-auth.js
const admin = require('firebase-admin');
const fs = require('fs');

admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey.json'))
});

async function exportAllUsers() {
  let users = [];
  let nextPageToken;

  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    users = users.concat(result.users.map(u => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      disabled: u.disabled,
      customClaims: u.customClaims // inclui role se você usar custom claims
    })));
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  fs.writeFileSync('./backup/auth-users.json', JSON.stringify(users, null, 2));
  console.log(`✓ ${users.length} usuários exportados`);
}

exportAllUsers();

// scripts/transform.js
// Converte os JSONs do Firebase para CSVs prontos para importar no Supabase
// Rodar com: node scripts/transform.js

const fs = require('fs');
const { v4: uuidv4 } = require('uuid'); // npm install uuid

const backup = './backup';
const output = './csv';
fs.mkdirSync(output, { recursive: true });

// Mapa de IDs Firebase → UUIDs Postgres (para resolver FKs)
const idMap = {};
function getUUID(firebaseId) {
  if (!idMap[firebaseId]) idMap[firebaseId] = uuidv4();
  return idMap[firebaseId];
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = rows.map(row =>
    headers.map(h => {
      const v = row[h];
      if (v === null || v === undefined) return '';
      if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`;
      return v;
    }).join(',')
  );
  return [headers.join(','), ...lines].join('\n');
}

// Transformar turmas
function transformTurmas() {
  const raw = JSON.parse(fs.readFileSync(`${backup}/turmas.json`));
  const rows = raw.map(t => ({
    id: getUUID(t.id),
    nome: t.nome || t.name,
    ano_ingresso: t.anoIngresso || t.year,
    esquadrao: t.esquadrao || t.squadron,
    cor_hex: t.cor || t.color || null,
    total_cadetes: t.totalCadetes || 190,
    ativo: true
  }));
  fs.writeFileSync(`${output}/turmas.csv`, toCsv(rows));
  console.log(`✓ turmas.csv: ${rows.length} linhas`);
}

// Transformar disciplinas
function transformDisciplinas() {
  const raw = JSON.parse(fs.readFileSync(`${backup}/disciplinas.json`));
  const rows = raw.map(d => ({
    id: getUUID(d.id),
    sigla: d.sigla || d.code,
    nome: d.nome || d.name,
    categoria: (d.categoria || d.category || 'GERAL').toUpperCase(),
    carga_horaria: d.cargaHoraria || d.hours || 0,
    ano_curso: d.anoCurso || d.year || null,
    campo: d.campo || null,
    ativo: true
  }));
  fs.writeFileSync(`${output}/disciplinas.csv`, toCsv(rows));
  console.log(`✓ disciplinas.csv: ${rows.length} linhas`);
}

// Transformar docentes
function transformDocentes() {
  const raw = JSON.parse(fs.readFileSync(`${backup}/docentes.json`));
  const rows = raw.map(d => ({
    id: getUUID(d.id),
    trigrama: (d.trigrama || d.code || '???').toUpperCase().substring(0, 3),
    nome_guerra: d.nomeGuerra || d.name,
    nome_completo: d.nomeCompleto || null,
    vinculo: (d.vinculo || 'EFETIVO').toUpperCase(),
    titulacao: d.titulacao || null,
    carga_horaria_max: d.cargaHoraria || 12,
    ativo: true
  }));
  fs.writeFileSync(`${output}/docentes.csv`, toCsv(rows));
  console.log(`✓ docentes.csv: ${rows.length} linhas`);
}

// Transformar programação (a mais complexa — ajuste os campos conforme seu Firebase)
function transformProgramacao() {
  const raw = JSON.parse(fs.readFileSync(`${backup}/programacao.json`));
  const rows = raw.map(a => ({
    id: getUUID(a.id),
    data: a.data || a.date,                           // formato: YYYY-MM-DD
    horario_inicio: a.horarioInicio || a.startTime,   // formato: HH:MM:SS
    horario_fim: a.horarioFim || a.endTime,
    turma_id: a.turmaId ? getUUID(a.turmaId) : null,
    disciplina_id: a.disciplinaId ? getUUID(a.disciplinaId) : null,
    docente_id: a.docenteId ? getUUID(a.docenteId) : null,
    local_id: a.localId ? getUUID(a.localId) : null,
    status: a.status || 'confirmada',
    dia_letivo_num: a.diaLetivoNum || a.dayNumber || null,
    semana_num: a.semanaNum || a.weekNumber || null
  }));
  fs.writeFileSync(`${output}/programacao_aulas.csv`, toCsv(rows));
  console.log(`✓ programacao_aulas.csv: ${rows.length} linhas`);
}

transformTurmas();
transformDisciplinas();
transformDocentes();
transformProgramacao();

// Salvar mapa de IDs para referência
fs.writeFileSync('./backup/id-map.json', JSON.stringify(idMap, null, 2));
console.log(`\n✅ CSVs gerados em ./csv/`);
console.log(`📋 Mapa de IDs salvo em ./backup/id-map.json`);

// scripts/migrate-users.js
// IMPORTANTE: senhas Firebase NÃO são exportáveis
// Usuários receberão email para redefinir senha

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // usar service_role para criar usuários
);

async function migrateUsers() {
  const users = JSON.parse(fs.readFileSync('./backup/auth-users.json'));
  const results = { success: [], failed: [] };

  for (const user of users) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        email_confirm: true,
        user_metadata: {
          nome: user.displayName,
          firebase_uid: user.uid  // manter referência para o id-map.json
        }
      });

      if (error) throw error;

      // Inserir role (ajuste conforme sua lógica de mapeamento)
      const role = user.customClaims?.role || 'cadete';
      await supabase.from('user_roles').insert({
        user_id: data.user.id,
        role: role
      });

      results.success.push(user.email);
      console.log(`✓ ${user.email} (${role})`);
    } catch (e) {
      results.failed.push({ email: user.email, error: e.message });
      console.error(`✗ ${user.email}:`, e.message);
    }

    // Rate limit: evitar sobrecarregar a API
    await new Promise(r => setTimeout(r, 200));
  }

  fs.writeFileSync('./backup/migration-results.json', JSON.stringify(results, null, 2));
  console.log(`\n✅ Migrados: ${results.success.length} | ✗ Falhas: ${results.failed.length}`);
}

migrateUsers();

// scripts/send-password-reset.js
for (const email of results.success) {
  await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: email
  });
  // enviar o link por email ou notificar diretamente no sistema
}

// No seu código React atual, adicione escrita paralela no Supabase
// enquanto mantém o Firebase como fonte de verdade

import { supabase } from './supabaseClient'; // novo cliente

async function salvarAula(dados) {
  // 1. Escrever no Firebase (fonte de verdade atual)
  await firebaseSetDoc(dadosFirebase);

  // 2. Escrever no Supabase em paralelo (shadow)
  try {
    const { error } = await supabase
      .from('programacao_aulas')
      .upsert(transformarParaSupabase(dados));
    if (error) console.warn('[Shadow] Supabase write failed:', error);
  } catch (e) {
    console.warn('[Shadow] Supabase unreachable:', e);
  }
}

