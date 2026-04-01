const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Substitua estas chaves pelos valores reais do seu painel Supabase
// (Project Settings > API)
// ATENÇÃO: Use a chave SERVICE_ROLE secreta aqui para poder criar usuários bypassing o limite
const SUPABASE_URL = 'https://sgwrpkdgoeovdoepaweo.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'SUBSTITUA_PELA_SUA_CHAVE_SERVICE_ROLE_SECRETA_AQUI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function migrateUsers() {
  const users = JSON.parse(fs.readFileSync('./backup/auth-users.json'));
  const results = { success: [], failed: [] };

  console.log(`Iniciando migração de ${users.length} usuários para o Supabase...`);

  for (const user of users) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        email_confirm: true,
        user_metadata: {
          nome: user.displayName,
          firebase_uid: user.uid
        }
      });

      if (error) throw error;

      // Inserir role se existir (ajustar de acordo com a custom claim ou lógica existente)
      let role = 'cadete'; // default
      // if (user.customClaims && user.customClaims.role) role = user.customClaims.role;
      // Neste caso, talvez a lógica de definir 'admin', 'chefe', etc em "user_roles" possa ser feita via dashboard dps

      // Inserir na tabela user_roles
      const insertResult = await supabase.from('user_roles').insert({
        user_id: data.user.id,
        role: role
      });
      
      if (insertResult.error) {
         console.warn(`Aviso: não foi possível inserir role para ${user.email}`, insertResult.error);
      }

      results.success.push(user.email);
      console.log(`✓ ${user.email} migrado com sucesso`);
    } catch (e) {
      results.failed.push({ email: user.email, error: e.message });
      console.error(`✗ Erro em ${user.email}:`, e.message);
    }

    // Rate limit: evitar sobrecarregar a API do Supabase (5 chamadas por seg)
    await new Promise(r => setTimeout(r, 200));
  }

  fs.writeFileSync('./backup/migration-results.json', JSON.stringify(results, null, 2));
  console.log(`\n✅ Usuários Migrados: ${results.success.length} | ✗ Falhas: ${results.failed.length}`);
}

migrateUsers();
