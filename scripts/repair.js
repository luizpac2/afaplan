/**
 * repair.js — Script de reparo completo pós-migração Firebase → Supabase
 *
 * O que este script faz:
 *  1. Corrige colunas UUID → TEXT na tabela docente_disciplinas (via API DDL)
 *  2. Importa instructors a partir de backup/docentes.json
 *  3. Importa user_roles a partir de backup/auth-users.json
 *  4. Importa programacao_aulas a partir de backup/programacao.json
 *  5. Importa docente_disciplinas (vínculos docente ↔ disciplina)
 *
 * Uso:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<sua_chave_service_role> \
 *   node scripts/repair.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Variáveis de ambiente obrigatórias:');
  console.error('   SUPABASE_URL=https://<projeto>.supabase.co');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=<chave_service_role>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const BACKUP = path.join(__dirname, '..', 'backup');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function upsertChunked(table, rows, chunkSize = 300, opts = {}) {
  if (!rows.length) { console.log(`  ${table}: 0 linhas, pulando`); return 0; }
  let ok = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, opts);
    if (error) {
      console.error(`\n  ❌ ERR ${table} (chunk ${i}):`, error.message);
      return ok;
    }
    ok += chunk.length;
    process.stdout.write(`\r  ${table}: ${ok}/${rows.length}`);
  }
  console.log(`\r  ${table}: ${ok}/${rows.length} ✓`);
  return ok;
}

function readBackup(filename) {
  const file = path.join(BACKUP, filename);
  if (!fs.existsSync(file)) {
    console.warn(`  ⚠️  Arquivo não encontrado: ${file}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ---------------------------------------------------------------------------
// 1. Corrigir colunas docente_disciplinas (UUID → TEXT)
// ---------------------------------------------------------------------------

async function fixDocenteDisciplinasColumns() {
  console.log('\n1. Corrigindo colunas de docente_disciplinas (UUID → TEXT)...');

  // Testa se as colunas já são TEXT inserindo um valor não-UUID
  const testId = 'REPAIR_TEST_' + Date.now();
  const { error: testErr } = await supabase
    .from('docente_disciplinas')
    .insert({ docente_id: testId, disciplina_id: testId });

  if (!testErr) {
    // Limpeza do registro de teste
    await supabase.from('docente_disciplinas').delete().eq('docente_id', testId);
    console.log('  ✓ Colunas já são TEXT, nenhuma alteração necessária.');
    return true;
  }

  if (!testErr.message.includes('uuid')) {
    console.error('  ❌ Erro inesperado ao testar colunas:', testErr.message);
    return false;
  }

  console.log('  Colunas são UUID. Recriando tabela com TEXT...');

  // Recria a tabela com os tipos corretos usando a Management API do Supabase
  // Como não temos acesso direto ao PostgreSQL, vamos usar o endpoint REST de queries SQL
  // (disponível via service_role na API do Supabase)
  const sqlStatements = [
    'DROP TABLE IF EXISTS public.docente_disciplinas CASCADE',
    `CREATE TABLE public.docente_disciplinas (
      id   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
      docente_id   TEXT NOT NULL,
      disciplina_id TEXT NOT NULL,
      UNIQUE(docente_id, disciplina_id)
    )`,
    'ALTER TABLE public.docente_disciplinas ENABLE ROW LEVEL SECURITY',
    'GRANT SELECT ON public.docente_disciplinas TO authenticated, anon',
    `CREATE POLICY "Leitura pública" ON public.docente_disciplinas
     FOR SELECT USING (true)`,
    `CREATE POLICY "Service role gerencia" ON public.docente_disciplinas
     FOR ALL USING (auth.role() = 'service_role')`,
  ];

  for (const sql of sqlStatements) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    });

    if (!res.ok) {
      // exec_sql pode não estar disponível; tenta via supabase.rpc
      console.warn(`  exec_sql não disponível (${res.status}). Tentando método alternativo...`);

      // Método alternativo: usa pg connection string via supabase-js (não disponível)
      // Neste caso, instrui o usuário a executar manualmente
      console.error('\n  ─────────────────────────────────────────────────────────');
      console.error('  ⚠️  NÃO FOI POSSÍVEL ALTERAR A TABELA AUTOMATICAMENTE.');
      console.error('  Execute o seguinte SQL no painel do Supabase (SQL Editor):');
      console.error('\n  DROP TABLE IF EXISTS public.docente_disciplinas CASCADE;');
      console.error(`  CREATE TABLE public.docente_disciplinas (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    docente_id     TEXT NOT NULL,
    disciplina_id  TEXT NOT NULL,
    UNIQUE(docente_id, disciplina_id)
  );`);
      console.error('  ALTER TABLE public.docente_disciplinas ENABLE ROW LEVEL SECURITY;');
      console.error('  GRANT SELECT ON public.docente_disciplinas TO authenticated, anon;');
      console.error(`  CREATE POLICY "Leitura" ON public.docente_disciplinas FOR SELECT USING (true);`);
      console.error('  ─────────────────────────────────────────────────────────\n');
      return false;
    }
  }

  console.log('  ✓ Tabela recriada com colunas TEXT.');
  return true;
}

// ---------------------------------------------------------------------------
// 2. Importar Instructors (docentes)
// ---------------------------------------------------------------------------

async function importInstructors() {
  console.log('\n2. Importando instructors (docentes)...');
  const docentes = readBackup('docentes.json');
  if (!docentes) return;

  // Colunas reais da tabela: id, warName, name, email, trigram, specialty, data (JSONB)
  // Campos adicionais ficam no JSONB data (igual ao padrão da tabela disciplines)
  const rows = docentes.map(d => ({
    id:        d.id,
    trigram:   d.trigram,
    name:      d.fullName,      // fullName → name
    warName:   d.warName,
    email:     d.email ?? null,
    specialty: d.specialty ?? null,
    data: {
      fullName:        d.fullName,
      rank:            d.rank,
      cpf_saram:       d.cpf_saram ?? null,
      phone:           d.phone ?? null,
      venture:         d.venture ?? 'EFETIVO',
      maxTitle:        d.maxTitle ?? null,
      weeklyLoadLimit: d.weeklyLoadLimit ?? 20,
      fixedBlocks:     d.fixedBlocks ?? [],
      plannedAbsences: d.plannedAbsences ?? [],
      preferences:     d.preferences ?? '',
      enabledClasses:  d.enabledClasses ?? [],
    },
  }));

  await upsertChunked('instructors', rows);
}

// ---------------------------------------------------------------------------
// 3. Importar User Roles
// ---------------------------------------------------------------------------

async function importUserRoles() {
  console.log('\n3. Importando user_roles...');
  const users = readBackup('auth-users.json');
  if (!users) return;

  // Busca todos os auth.users para mapear email → uuid
  let allAuthUsers = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    allAuthUsers = allAuthUsers.concat(data.users);
    if (data.users.length < 1000) break;
    page++;
  }
  console.log(`  Encontrados ${allAuthUsers.length} usuários em auth.users`);

  const emailToId = {};
  allAuthUsers.forEach(u => { emailToId[u.email.toLowerCase()] = u.id; });

  const roleMap = {
    SUPER_ADMIN: 'super_admin',
    ADMIN:       'gestor',
    DOCENTE:     'docente',
    CADETE:      'cadete',
  };

  const rows = users
    .filter(u => emailToId[u.email?.toLowerCase()])
    .map(u => ({
      user_id: emailToId[u.email.toLowerCase()],
      role:    roleMap[u.role] ?? 'visitante',
    }));

  console.log(`  ${rows.length} de ${users.length} usuários mapeados para auth.users`);
  await upsertChunked('user_roles', rows, 300, { onConflict: 'user_id' });
}

// ---------------------------------------------------------------------------
// 4. Importar Programação de Aulas
// ---------------------------------------------------------------------------

async function importProgramacao() {
  console.log('\n4. Importando programacao_aulas...');
  const prog = readBackup('programacao.json');
  if (!prog) return;

  // NOTA: as colunas do DB são: instructorId (não instructorTrigram),
  //       sem evaluationType, isBlocking, description (adicionados abaixo se possível).
  const rows = prog.map(e => ({
    id:              e.id,
    disciplineId:    e.disciplineId ?? null,
    classId:         e.classId ?? null,
    date:            e.date ?? null,
    startTime:       e.startTime ?? null,
    endTime:         e.endTime ?? null,
    type:            e.type ?? 'CLASS',
    color:           e.color ?? null,
    location:        e.location ?? null,
    // DB usa instructorId; o frontend normaliza para instructorTrigram ao ler
    instructorId:    e.instructorTrigram ?? e.instructorId ?? null,
    targetSquadron:  (e.targetSquadron == null || e.targetSquadron === 'ALL')
                       ? null
                       : Number(e.targetSquadron),
    targetClass:     e.targetClass ?? null,
    targetCourse:    e.targetCourse ?? null,
    changeRequestId: e.changeRequestId ?? null,
  }));

  await upsertChunked('programacao_aulas', rows, 500);
}

// ---------------------------------------------------------------------------
// 5. Importar Docente–Disciplina
// ---------------------------------------------------------------------------

async function importDocenteDisciplinas() {
  console.log('\n5. Importando docente_disciplinas...');
  const docentes = readBackup('docentes.json');
  if (!docentes) return;

  const rows = [];
  for (const d of docentes) {
    if (!d.enabledDisciplines?.length) continue;
    for (const discId of d.enabledDisciplines) {
      rows.push({ docente_id: d.id, disciplina_id: discId });
    }
  }

  await upsertChunked('docente_disciplinas', rows, 300, { onConflict: 'docente_id,disciplina_id' });
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log('══════════════════════════════════════════════');
  console.log('  REPAIR — AFA Planner (Supabase post-migration)');
  console.log(`  URL: ${SUPABASE_URL}`);
  console.log('══════════════════════════════════════════════');

  // Instruções DDL para colunas faltando em programacao_aulas
  // Execute estas queries no SQL Editor do Supabase antes de rodar este script
  // se as colunas ainda não existirem:
  console.log('\n── DDL necessário (execute no SQL Editor do Supabase se ainda não foi feito) ──');
  console.log(`ALTER TABLE public.programacao_aulas
  ADD COLUMN IF NOT EXISTS "evaluationType" TEXT,
  ADD COLUMN IF NOT EXISTS "isBlocking"     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "description"    TEXT;`);
  console.log('── (pode ignorar erros "already exists") ───────────────────────────────────\n');

  const ddOk = await fixDocenteDisciplinasColumns();
  await importInstructors();
  await importUserRoles();
  await importProgramacao();
  if (ddOk) await importDocenteDisciplinas();

  console.log('\n══════════════════════════════════════════════');
  console.log('  CONCLUÍDO');
  if (!ddOk) {
    console.log('\n  ⚠️  Execute o SQL manualmente no Supabase e rode:');
    console.log('     SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/repair.js');
    console.log('  (docente_disciplinas será reimportado automaticamente)');
  }
  console.log('══════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
