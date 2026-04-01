const admin = require('firebase-admin');
const fs = require('fs');

admin.initializeApp({
  credential: admin.credential.cert(require('./afa-planner-firebase-adminsdk-fbsvc-bd23998be5.json'))
});

const db = admin.firestore();

async function main() {
  const collections = await db.listCollections();
  collections.forEach(col => console.log(col.id));
}

main().catch(err => console.error(err));
