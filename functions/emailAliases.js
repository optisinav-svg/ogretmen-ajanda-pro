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
    if (snap.exists) {
      const data = snap.data();
      if (data.ownerUid !== uid) {
        throw new HttpsError('already-exists', 'Bu e-posta adresi daha önce başka bir hesaba ait olarak rezerve edilmiş. Saklama süresi sona ermiş olsa bile uygulama sahibi tarafından imha kararı verilmeden başka hesaba aktarılamaz.');
      }
      tx.set(ref, { sonKullanim: FieldValue.serverTimestamp() }, { merge: true });
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

exports.epostaKaydiKontrolEt = onCall({ region: REGION }, async request => {
  const email = normalizeEmail(request.data?.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'Geçerli bir e-posta adresi girin.');
  const snap = await aliasRef(email).get();
  if (snap.exists && snap.get('ownerUid') !== request.auth?.uid) {
    throw new HttpsError('already-exists', 'Bu e-posta adresi daha önce bir hesaba ait olarak rezerve edilmiş. Lütfen eski hesabınıza giriş yapın veya hesap kurtarma adımlarını izleyin.');
  }
  return { kayitUygun: true };
});

exports.epostaAliasDegisikliginiKontrolEt = onCall({ region: REGION }, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Önce hesabınıza giriş yapın.');
  const email = normalizeEmail(request.data?.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'Geçerli bir e-posta adresi girin.');
  const snap = await aliasRef(email).get();
  if (snap.exists) {
    if (snap.get('ownerUid') !== request.auth.uid) {
      throw new HttpsError('already-exists', 'Bu e-posta adresi daha önce başka bir hesaba ait olarak rezerve edilmiş. Saklama süresi sona erse bile uygulama sahibi tarafından imha kararı verilmeden kullanılamaz.');
    }
  }
  return { kullanilabilir: true };
});

exports.epostaAliasiniRezerveEt = onCall({ region: REGION }, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Önce hesabınıza giriş yapın.');
  if (request.auth.token.email_verified !== true) return { durum: 'dogrulama_bekleniyor' };
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
  if (user?.email && user.emailVerified === true) await claimAlias(user.email, user.uid);
});

// Account closure retains aliases for the same three-year account-retention window.
// Reactivation clears the expiry while the account remains within that window.
exports.reserveEmailAlias = claimAlias;

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
