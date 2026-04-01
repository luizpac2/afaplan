const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp({
  credential: admin.credential.cert(require('../afa-planner-firebase-adminsdk-fbsvc-bd23998be5.json'))
});

const db = admin.firestore();

// Coleções a exportar e o nome do arquivo que vai ser salvo no backup (onde a Transformation espera)
const COLLECTIONS_MAP = {
  'cohorts': 'turmas',
  'disciplines': 'disciplinas',
  'instructors': 'docentes',
  'events': 'programacao',    
  'schedule_change_requests': 'solicitacoes',
  'notices': 'avisos',
  'occurrences': 'sap'
};

async function exportCollection(firestoreName, jsonName) {
  const snapshot = await db.collection(firestoreName).get();
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  fs.writeFileSync(
    path.join('./backup', `${jsonName}.json`),
    JSON.stringify(data, null, 2)
  );
  console.log(`✓ ${firestoreName} -> ${jsonName}.json: ${data.length} documentos exportados`);
  return data;
}

async function main() {
  fs.mkdirSync('./backup', { recursive: true });
  for (const [firestoreName, jsonName] of Object.entries(COLLECTIONS_MAP)) {
    try {
      await exportCollection(firestoreName, jsonName);
    } catch (e) {
      console.error(`✗ Erro em ${firestoreName}:`, e.message);
    }
  }
  console.log('\n✅ Exportação completa em ./backup/');
}

main();
