const { createHash, randomBytes } = require('node:crypto');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const REGION = 'europe-west1';
const db = getFirestore();
const MAX_BATCH = 400;
const OWNER_COLLECTIONS = Object.freeze({
  ogretmen: {
    okullar: ['uid'], siniflar: ['uid'], ogrenciler: ['uid'], dersler: ['uid'],
    dersNotlari: ['uid'], yoklamalar: ['uid'], odevler: ['uid'], kitaplar: ['uid'],
    konular: ['uid'], bireyselEtkinlikler: ['uid'], bireyselDersOturumlari: ['uid'],
    kitapKutuphanesi: ['uid'], kitapKutuphanesiKonulari: ['uid'],
    ogretmenOgrenciBaglantilari: ['uid','ogretmenUid'],
    ogrenciKayitEslesmeleri: ['uid','ogretmenUid'],
    ogrenciEslesmeTalepleri: ['uid','ogretmenUid'],
    ogrenciEslesmeKodlari: ['uid','ogretmenUid'],
    ogrenciOdevBildirimleri: ['uid','ogretmenUid'],
    ogrenciYeniOdevBildirimleri: ['uid','ogretmenUid'],
    rolDuzeltmeTalepleri: ['uid'],
  },
  ogrenci: {
    ogretmenOgrenciBaglantilari: ['ogrenciUid'],
    ogrenciKayitEslesmeleri: ['ogrenciUid'],
    ogrenciEslesmeTalepleri: ['ogrenciUid'],
    ogrenciOdevBildirimleri: ['ogrenciUid'],
    ogrenciYeniOdevBildirimleri: ['ogrenciUid'],
    ogrenciPushTokenlari: ['ogrenciUid'],
    rolDuzeltmeTalepleri: ['uid'],
  },
});

function requireOwner(request) {
  const uid = request.auth?.uid;
  if (!uid || request.auth.token.uygulamaSahibi !== true) {
    throw new HttpsError('permission-denied', 'Bu işlem yalnızca uygulama sahibi tarafından yapılabilir.');
  }
  return uid;
}
function expiryMillis(profile) {
  const value = profile?.hesapSaklamaSonu;
  if (value?.toMillis) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return 0;
}
async function verifyOwnerProfile(ownerUid) {
  const owner = await db.collection('kullanicilar').doc(ownerUid).get();
  if (!owner.exists || owner.get('rol') !== 'ogretmen' || owner.get('hesapDurumu') === 'kapali') {
    throw new HttpsError('permission-denied', 'Etkin uygulama sahibi öğretmen profili doğrulanamadı.');
  }
}
async function readAccountRefs(uid, role) {
  const definition = OWNER_COLLECTIONS[role];
  if (!definition) throw new HttpsError('failed-precondition', 'Hesap rolü imha kapsamı için tanımlı değil.');
  const result = {};
  for (const [collectionName, fields] of Object.entries(definition)) {
    const docs = new Map();
    for (const field of fields) {
      const snapshot = await db.collection(collectionName).where(field, '==', uid).get();
      snapshot.docs.forEach(item => docs.set(item.id, item.ref));
    }
    if (docs.size) result[collectionName] = [...docs.values()];
  }
  return result;
}
async function buildAccountPreview(uid, profile) {
  const role = profile.rol;
  const refs = await readAccountRefs(uid, role);
  const counts = Object.fromEntries(Object.entries(refs).map(([name, docs]) => [name, docs.length]));
  counts.kullanicilar = 1;
  let authCount = 1;
  try { await getAuth().getUser(uid); } catch (e) { if (e.code === 'auth/user-not-found') authCount = 0; else throw e; }
  counts.firebaseAuth = authCount;
  const total = Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0);
  return { uid, role, displayName: String(profile.kullaniciAdi || [profile.ad,profile.soyad].filter(Boolean).join(' ') || 'İsimsiz hesap').slice(0,80), expiresAt: new Date(expiryMillis(profile)).toISOString(), counts, total };
}
async function deleteRefsInChunks(refs) {
  for (let i=0;i<refs.length;i+=MAX_BATCH) {
    const batch=db.batch();
    refs.slice(i,i+MAX_BATCH).forEach(ref=>batch.delete(ref));
    await batch.commit();
  }
}
function countsMatch(expected, actual) {
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) return false;
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
  return keys.every(key => Number(expected[key] || 0) === Number(actual[key] || 0));
}

exports.uygulamaSahibiKapaliHesaplariListele = onCall({ region: REGION }, async request => {
  const ownerUid = requireOwner(request);
  await verifyOwnerProfile(ownerUid);
  const snapshot = await db.collection('kullanicilar').where('hesapDurumu','==','kapali').get();
  const now = Date.now();
  return {
    accounts: snapshot.docs
      .filter(item => item.id !== ownerUid && ['ogretmen','ogrenci'].includes(item.get('rol')) && expiryMillis(item.data()) > 0 && expiryMillis(item.data()) <= now)
      .map(item => ({
        uid: item.id,
        role: item.get('rol') || 'unknown',
        displayName: String(item.get('kullaniciAdi') || [item.get('ad'),item.get('soyad')].filter(Boolean).join(' ') || 'İsimsiz hesap').slice(0,80),
        expiresAt: new Date(expiryMillis(item.data())).toISOString(),
      }))
      .sort((a,b)=>a.displayName.localeCompare(b.displayName,'tr')),
  };
});

exports.uygulamaSahibiKapaliHesapImhasiniOnizle = onCall({ region: REGION, timeoutSeconds: 120, memory: '512MiB' }, async request => {
  const ownerUid = requireOwner(request);
  await verifyOwnerProfile(ownerUid);
  const targetUid = typeof request.data?.targetUid === 'string' ? request.data.targetUid.trim() : '';
  if (!targetUid || targetUid === ownerUid) throw new HttpsError('invalid-argument', 'İmha edilecek hesap seçilmelidir.');
  const profile = await db.collection('kullanicilar').doc(targetUid).get();
  if (!profile.exists || profile.get('hesapDurumu') !== 'kapali') throw new HttpsError('failed-precondition', 'Hesap kapalı değil veya profili bulunamadı.');
  if (!expiryMillis(profile.data()) || expiryMillis(profile.data()) > Date.now()) throw new HttpsError('failed-precondition', 'Hesabın üç yıllık saklama süresi henüz dolmadı.');
  return await buildAccountPreview(targetUid, profile.data());
});

exports.uygulamaSahibiKapaliHesabiImhaEt = onCall({ region: REGION, timeoutSeconds: 540, memory: '1GiB' }, async request => {
  const ownerUid = requireOwner(request);
  await verifyOwnerProfile(ownerUid);
  const targetUid = typeof request.data?.targetUid === 'string' ? request.data.targetUid.trim() : '';
  if (!targetUid || targetUid === ownerUid || request.data?.confirm !== true) {
    throw new HttpsError('failed-precondition', 'Hesap seçimi ve açık imha onayı gereklidir.');
  }
  const profileRef = db.collection('kullanicilar').doc(targetUid);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists || profileSnap.get('hesapDurumu') !== 'kapali' || expiryMillis(profileSnap.data()) > Date.now()) {
    throw new HttpsError('failed-precondition', 'Hesap kapalı olmalı ve üç yıllık saklama süresi dolmuş olmalıdır.');
  }
  const preview = await buildAccountPreview(targetUid, profileSnap.data());
  if (!countsMatch(request.data?.expectedCounts, preview.counts)) {
    throw new HttpsError('aborted', 'Önizlemeden sonra kayıt sayısı değişmiş. Güncel önizleme alıp tekrar onaylayın.');
  }

  const lockRef = db.collection('hesapImhaKayitlari').doc(targetUid);
  const token = randomBytes(24).toString('hex');
  await db.runTransaction(async tx => {
    const lock = await tx.get(lockRef);
    if (lock.exists && lock.get('status') === 'completed') throw new HttpsError('already-exists', 'Bu hesap için imha daha önce tamamlandı.');
    if (lock.exists && lock.get('status') === 'running' && (lock.get('leaseExpiresAt')?.toMillis?.() || 0) > Date.now()) {
      throw new HttpsError('aborted', 'Bu hesap için başka bir imha işlemi devam ediyor.');
    }
    tx.set(lockRef, {
      targetUid, role: preview.role, status: 'running', leaseToken: token,
      leaseExpiresAt: new Date(Date.now()+10*60*1000),
      startedBy: ownerUid, startedAt: FieldValue.serverTimestamp(),
      expectedCounts: preview.counts,
    }, { merge: true });
  });

  try {
    // Account is already closed; owner-approved deletion is explicit and resumable.
    const refsByCollection = await readAccountRefs(targetUid, preview.role);
    const currentCounts = Object.fromEntries(Object.entries(refsByCollection).map(([name, refs]) => [name, refs.length]));
    currentCounts.kullanicilar = 1;
    let authCount = 1;
    try { await getAuth().getUser(targetUid); } catch (e) { if (e.code === 'auth/user-not-found') authCount = 0; else throw e; }
    currentCounts.firebaseAuth = authCount;
    if (!countsMatch(preview.counts, currentCounts)) throw new HttpsError('aborted', 'Kayıt sayısı işlem sırasında değişti. Yeni önizleme gereklidir.');

    for (const refs of Object.values(refsByCollection)) await deleteRefsInChunks(refs);
    try { await getAuth().deleteUser(targetUid); } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }

    const batch = db.batch();
    batch.delete(profileRef);
    batch.set(lockRef, {
      targetUid, role: preview.role, status: 'completed',
      completedBy: ownerUid, completedAt: FieldValue.serverTimestamp(),
      deletedCounts: preview.counts, leaseToken: FieldValue.delete(), leaseExpiresAt: FieldValue.delete(),
    }, { merge: true });
    batch.set(db.collection('hesapYasamDongusuDenetimi').doc(), {
      uidHash: createHash('sha256').update(targetUid).digest('hex'),
      rol: preview.role, islem: 'uc_yil_sonunda_hesap_imhasi',
      uygulamaSahibiUid: ownerUid, zaman: FieldValue.serverTimestamp(),
      sonuc: 'basarili', silinenKayitSayilari: preview.counts,
    });
    await batch.commit();
    // Historical email aliases intentionally remain reserved; they are not reassigned to another UID.
    return { durum: 'tamamlandi', deletedCounts: preview.counts, totalDeleted: preview.total };
  } catch (error) {
    await lockRef.set({
      status: 'failed', failedAt: FieldValue.serverTimestamp(),
      errorCode: error.code || 'unknown', leaseToken: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
    }, { merge: true }).catch(() => {});
    throw error;
  }
});

exports._test = { expiryMillis, countsMatch, OWNER_COLLECTIONS };
