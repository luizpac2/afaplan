// Roda com: node scripts/create_cadets_auth.js
// Precisa de: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente ou hardcoded abaixo

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kqysbdtveefzzgzhapxo.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'COLE_AQUI';
const DEFAULT_PASSWORD = 'fab1941';

const cadets = [
  { id: '24-010', email: 'tp.gregoriorgfr@fab.mil.br',         name: 'GREGÓRIO' },
  { id: '23-007', email: 'tp.juliajfr@fab.mil.br',             name: 'JÚLIA' },
  { id: '23-105', email: 'tp.custodiomac@fab.mil.br',          name: 'CUSTÓDIO' },
  { id: '23-106', email: 'tp.alefetao@fab.mil.br',             name: 'ÁLEF' },
  { id: '23-120', email: 'tp.pecanhaldlp@fab.mil.br',          name: 'PEÇANHA' },
  { id: '23-122', email: 'tp.magalhaesdsvm@fab.mil.br',        name: 'MAGALHÃES' },
  { id: '23-141', email: 'tp.viniciusalvesvoa@fab.mil.br',     name: 'VINÍCIUS ALVES' },
  { id: '23-159', email: 'tp.viniciusdivinovsad@fab.mil.br',   name: 'VINÍCIUS DIVINO' },
  { id: '23-206', email: 'tp.aragaocaa@fab.mil.br',            name: 'ARAGÃO' },
  { id: '23-212', email: 'tp.juliabrandaojbmt@fab.mil.br',     name: 'JÚLIA BRANDÃO' },
  { id: '23-213', email: 'tp.juliasousajts@fab.mil.br',        name: 'JÚLIA SOUSA' },
  { id: '23-223', email: 'tp.annaleticiaaldm@fab.mil.br',      name: 'ANNA LETÍCIA' },
  { id: '23-229', email: 'tp.andreoliveiraalos@fab.mil.br',    name: 'ANDRÉ OLIVEIRA' },
  { id: '23-235', email: 'tp.thainatcmb@fab.mil.br',           name: 'THAÍNAT' },
  { id: '23-238', email: 'tp.esthefanyebc@fab.mil.br',         name: 'ESTHÉFANY' },
  { id: '23-241', email: 'tp.josefelipejfs@fab.mil.br',        name: 'JOSÉ FELIPE' },
  { id: '23-245', email: 'tp.laislbsc@fab.mil.br',             name: 'LAÍS' },
  { id: '23-309', email: 'tp.venanciojvvgm@fab.mil.br',        name: 'VENÂNCIO' },
  { id: '23-316', email: 'tp.magalhaesresendewmvr@fab.mil.br', name: 'MAGALHÃES RESENDE' },
  { id: '24-025', email: 'tp.jessicacallegarijcso@fab.mil.br', name: 'JÉSSICA' },
];

async function createUser(cadet) {
  // 1. Cria no Auth
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      email: cadet.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { nome: cadet.name, must_change_password: true },
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.msg || data.error || `HTTP ${res.status}`);
  }

  const userId = data.id;

  // 2. Insere em user_roles
  const roleRes = await fetch(`${SUPABASE_URL}/rest/v1/user_roles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ user_id: userId, role: 'cadete', cadet_id: cadet.id }),
  });

  if (!roleRes.ok) {
    const roleData = await roleRes.text();
    // Reverte usuário criado
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY },
    });
    throw new Error(`role insert failed: ${roleData}`);
  }

  // 3. Atualiza email na tabela cadetes (já normalizado)
  await fetch(`${SUPABASE_URL}/rest/v1/cadetes?id=eq.${encodeURIComponent(cadet.id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ email: cadet.email }),
  });

  return userId;
}

async function run() {
  if (SERVICE_ROLE_KEY === 'COLE_AQUI') {
    console.error('❌ Defina SUPABASE_SERVICE_ROLE_KEY no ambiente ou cole no script.');
    process.exit(1);
  }

  let created = 0, errors = 0;
  for (const cadet of cadets) {
    try {
      const uid = await createUser(cadet);
      console.log(`✅ ${cadet.id} ${cadet.name} → ${cadet.email} (${uid.slice(0,8)}...)`);
      created++;
    } catch (e) {
      console.error(`❌ ${cadet.id}: ${e.message}`);
      errors++;
    }
  }
  console.log(`\nConcluído: ${created} criados, ${errors} erros.`);
}

run();
