const admin = require('firebase-admin');
const fs = require('fs');

admin.initializeApp({
  credential: admin.credential.cert(require('../afa-planner-firebase-adminsdk-fbsvc-bd23998be5.json'))
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
