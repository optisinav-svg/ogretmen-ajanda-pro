// Dry-run by default. Use --apply only after explicit production-change approval.
const admin = require('firebase-admin');
const { createHash } = require('node:crypto');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const apply = process.argv.includes('--apply');
const normalize = value => String(value || '').trim().toLowerCase();
const aliasId = email => createHash('sha256').update(normalize(email), 'utf8').digest('hex');

async function main() {
  let pageToken;
  let scanned = 0;
  let planned = 0;
  let existing = 0;
  const conflicts = [];
  const writes = [];
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    pageToken = page.pageToken;
    for (const user of page.users) {
      const email = normalize(user.email);
      if (!email) continue;
      scanned += 1;
      const ref = db.collection('epostaAliaslari').doc(aliasId(email));
      const snap = await ref.get();
      if (snap.exists) {
        if (snap.get('ownerUid') !== user.uid) conflicts.push({ emailHash: aliasId(email), authUid: user.uid, reservedUid: snap.get('ownerUid') });
        else existing += 1;
        continue;
      }
      planned += 1;
      writes.push({ ref, data: {
        ownerUid: user.uid,
        emailHash: aliasId(email),
        rezerveEdilme: admin.firestore.FieldValue.serverTimestamp(),
        kaynak: 'auth_backfill',
      }});
    }
  } while (pageToken);

  process.stdout.write(JSON.stringify({
    mode: apply ? 'APPLY' : 'DRY_RUN',
    scannedAuthUsersWithEmail: scanned,
    alreadyReserved: existing,
    aliasesToCreate: planned,
    conflicts,
    note: 'This backfill sees only current Firebase Auth email addresses. Historical addresses changed before alias tracking cannot be reconstructed from Auth alone.',
  }, null, 2) + '\n');

  if (!apply) return;
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach(item => batch.create(item.ref, item.data));
    await batch.commit();
  }
  process.stdout.write('Alias backfill completed.\n');
}

main().catch(error => {
  process.stderr.write((error.stack || error.message || String(error)) + '\n');
  process.exitCode = 1;
});
