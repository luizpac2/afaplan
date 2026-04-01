require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // service_role apenas em scripts server-side
);

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
