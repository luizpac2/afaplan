const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

async function upsertChunked(table, rows, chunkSize = 200, upsertOptions = {}) {
  let ok = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, upsertOptions);
    if (error) { console.log(`\n  ERR ${table}:`, error.message); return ok; }
    ok += chunk.length;
    process.stdout.write(`\r  ${table}: ${ok}/${rows.length}`);
  }
  console.log(`\r  ${table}: ${ok}/${rows.length} OK`);
  return ok;
}

async function importUsers() {
  console.log('\n1. Usuários via Auth API...');
  const users = JSON.parse(fs.readFileSync('./backup/auth-users.json', 'utf8'));
  const DEFAULT_PASS = 'Afaplan2024!';
  let ok = 0, skip = 0;

  for (const u of users) {
    const nome = u.displayName || u.email.split('@')[0];
    const { error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: DEFAULT_PASS,
      email_confirm: true,
      user_metadata: { nome },
      app_metadata: { provider: 'email' },
    });
    if (error?.message?.includes('already registered')) { skip++; }
    else if (error) { console.log(`  SKIP ${u.email}: ${error.message}`); skip++; }
    else ok++;
  }
  console.log(`  Criados: ${ok}, já existiam: ${skip}`);
}

async function importRoles() {
  console.log('\n2. Roles...');
  const users = JSON.parse(fs.readFileSync('./backup/auth-users.json', 'utf8'));

  // Busca todos os users criados para mapear email → id
  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const emailToId = {};
  (authUsers?.users || []).forEach(u => { emailToId[u.email] = u.id; });

  const roleMap = { SUPER_ADMIN: 'super_admin', ADMIN: 'gestor', DOCENTE: 'docente', CADETE: 'cadete' };

  const rows = users
    .filter(u => emailToId[u.email])
    .map(u => ({
      user_id: emailToId[u.email],
      role: roleMap[u.role] || 'visitante',
    }));

  // `user_id` é UNIQUE, então precisamos definir onConflict para upsert idempotente
  await upsertChunked('user_roles', rows, 200, { onConflict: 'user_id' });
}

async function importTurmas() {
  console.log('\n3. Turmas...');
  const turmas = JSON.parse(fs.readFileSync('./backup/turmas.json', 'utf8'));
  const rows = turmas.map(t => ({
    id: t.id,
    name: t.name,
    entryYear: t.entryYear,
    color: t.color,
  }));
  await upsertChunked('turmas', rows);
}

async function importDisciplinas() {
  console.log('\n4. Disciplinas...');
  const disc = JSON.parse(fs.readFileSync('./backup/disciplinas.json', 'utf8'));
  const rows = disc.map(d => ({
    id: d.id,
    name: d.name,
    code: d.code || null,
    color: d.color || '#6366f1',
    year: d.year ?? null,
    course: d.course || null,
    category: d.category || null,
    load_hours: d.load_hours ?? null,
    scheduling_criteria: d.scheduling_criteria || null,
    data: {
      trainingField: d.trainingField,
      enabledYears: d.enabledYears,
      enabledCourses: d.enabledCourses,
      ppcLoads: d.ppcLoads,
      location: d.location,
      instructor: d.instructor,
    },
  }));
  await upsertChunked('disciplinas', rows);
}

async function importProgramacao() {
  console.log('\n5. Programação (35k registros, pode demorar)...');
  const prog = JSON.parse(fs.readFileSync('./backup/programacao.json', 'utf8'));
  const rows = prog.map(e => ({
    id: e.id,
    disciplineId: e.disciplineId || null,
    classId: e.classId || null,
    // No schema atual do app/Supabase a coluna se chama `date` (não `data`)
    date: e.date || null,
    startTime: e.startTime || null,
    endTime: e.endTime || null,
    type: e.type || 'CLASS',
    color: e.color || null,
    location: e.location || null,
    instructorId: e.instructorId || null,
    targetSquadron: (e.targetSquadron && e.targetSquadron !== 'ALL') ? Number(e.targetSquadron) : null,
    targetClass: e.targetClass || null,
    targetCourse: e.targetCourse || null,
    status: e.status || 'confirmada',
    changeRequestId: e.changeRequestId || null,
  }));
  await upsertChunked('programacao_aulas', rows, 500);
}

async function main() {
  console.log('=== REIMPORTAÇÃO ===');
  await importUsers();
  await importRoles();
  await importTurmas();
  await importDisciplinas();
  await importProgramacao();
  console.log('\n=== CONCLUÍDO ===');
}

main().catch(console.error);
