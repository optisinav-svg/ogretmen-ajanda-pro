const { createHash } = require('node:crypto');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { beforeUserCreated, beforeUserSignedIn } = require('firebase-functions/v2/identity');

const REGION = 'europe-west1';
const db = getFirestore();
const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const emailAliasId = email => createHash('sha256').update(normalizeEmail(email), 'utf8').digest('hex');

function aliasRef(email) {
  return db.collection('epostaAliaslari').doc(emailAliasId(email));
}

async function claimAlias(emailValue, uid, { createIfMissing = true } = {}) {
  const email = normalizeEmail(emailValue);
  if (!email || !uid) throw new HttpsError('invalid-argument', 'E-posta ve hesap kimliği gereklidir.');
  const ref = aliasRef(email);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const now = Date.now();
    if (snap.exists) {
      const data = snap.data();
      const expiry = data.sonaErme?.toMillis?.() || 0;
      const expired = expiry > 0 && expiry <= now;
      if (data.ownerUid !== uid && !expired) {
        throw new HttpsError('already-exists', 'Bu e-posta adresi daha önce başka bir hesaba ait olarak rezerve edilmiş.');
      }
      if (data.ownerUid !== uid && expired) {
        tx.set(ref, {
          ownerUid: uid,
          emailHash: emailAliasId(email),
          rezerveEdilme: FieldValue.serverTimestamp(),
          sonKullanim: FieldValue.serverTimestamp(),
        });
      } else {
        tx.set(ref, { sonKullanim: FieldValue.serverTimestamp() }, { merge: true });
      }
      return;
    }
    if (createIfMissing) {
      tx.create(ref, {
        ownerUid: uid,
        emailHash: emailAliasId(email),
        rezerveEdilme: FieldValue.serverTimestamp(),
        sonKullanim: FieldValue.serverTimestamp(),
      });
    }
  });
}

exports.epostaAliasiniRezerveEt = onCall({ region: REGION }, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Önce hesabınıza giriş yapın.');
  if (request.auth.token.email_verified !== true) throw new HttpsError('failed-precondition', 'Mevcut e-posta adresi doğrulanmış olmalıdır.');
  const email = normalizeEmail(request.auth.token.email);
  if (!email) throw new HttpsError('failed-precondition', 'Hesabınızda doğrulanmış e-posta bulunamadı.');
  await claimAlias(email, request.auth.uid);
  return { durum: 'rezerve_edildi' };
});

// Identity Platform blocking triggers are the authoritative enforcement point.
// Enabling these triggers requires upgrading Firebase Authentication to Identity Platform.
exports.epostaAliasKaydiOncesiKontrol = beforeUserCreated({ region: REGION }, async event => {
  const user = event.data;
  if (user?.email) await claimAlias(user.email, user.uid, { createIfMissing: false });
});

exports.epostaAliasGirisKontrol = beforeUserSignedIn({ region: REGION }, async event => {
  const user = event.data;
  if (user?.email) await claimAlias(user.email, user.uid);
});

// Account closure retains aliases for the same three-year account-retention window.
// Reactivation clears the expiry while the account remains within that window.
exports.setEmailAliasRetention = async (uid, expiresAt = null) => {
  const snap = await db.collection('epostaAliaslari').where('ownerUid', '==', uid).get();
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = db.batch();
    snap.docs.slice(i, i + 450).forEach(item => {
      batch.update(item.ref, expiresAt
        ? { sonaErme: Timestamp.fromDate(expiresAt) }
        : { sonaErme: FieldValue.delete() });
    });
    await batch.commit();
  }
};

exports._test = { normalizeEmail, emailAliasId };
