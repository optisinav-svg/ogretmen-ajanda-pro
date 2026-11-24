#!/usr/bin/env node
'use strict';

// Converts one verified-by-operator, unused teacher account into a student test account.
// Dry-run is the default. This script touches only the selected Auth custom claim and
// the selected user's profile. It never deletes the Auth user, alias, or school data.
const { createHash } = require('node:crypto');
const { initializeApp, applicationDefault, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const PROJECT_ID = 'ogretmen-takip';
const TARGET_UID = (process.env.TARGET_UID || '').trim();
const TARGET_EMAIL = (process.env.TARGET_EMAIL || '').trim().toLowerCase();
const OWNER_UID = (process.env.OWNER_UID || '').trim();
const OWNER_EMAIL = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
const APPLY = process.argv.includes('--apply');
const CLAIM_ONLY = process.argv.includes('--remove-owner-claim-only');

const OWNERSHIP_FIELDS = ['uid', 'ogretmenUid', 'ogrenciUid', 'ownerUid', 'createdByUid', 'startedBy'];
const COLLECTIONS = [
  'okullar', 'siniflar', 'ogrenciler', 'dersler', 'dersNotlari', 'odevler', 'yoklamalar',
  'kitaplar', 'konular', 'bireyselEtkinlikler', 'bireyselDersOturumlari',
  'ogretmenOgrenciBaglantilari', 'ogrenciKayitEslesmeleri', 'ogrenciEslesmeTalepleri',
  'ogrenciEslesmeKodlari', 'ogrenciOdevBildirimleri', 'ogrenciYeniOdevBildirimleri',
  'ogrenciOdevDurumBildirimleri', 'ogrenciPushTokenlari', 'kitapKutuphanesi',
  'kitapKutuphanesiKonulari', 'epostaAliaslari', 'rolDuzeltmeTalepleri',
  'hesapYasamDongusuDenetimi', 'donemTemizlikKayitlari',
];

function normalize(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  return name && domain ? name.slice(0, 1) + '***@' + domain : '(e-posta yok)';
}
async function listAllUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}
async function countRefs(db, collectionName, field, uid) {
  try {
    const result = await db.collection(collectionName).where(field, '==', uid).count().get();
    return result.data().count;
  } catch (error) {
    if (error && (error.code === 5 || error.code === 'not-found')) return 0;
    throw error;
  }
}

async function main() {
  if (!TARGET_UID || !TARGET_EMAIL || !OWNER_UID || !OWNER_EMAIL) {
    throw new Error('TARGET_UID, TARGET_EMAIL, OWNER_UID ve OWNER_EMAIL ortam değişkenleri zorunludur.');
  }
  if (TARGET_UID === OWNER_UID || TARGET_EMAIL === OWNER_EMAIL) {
    throw new Error('Hedef hesap ile ana uygulama sahibi hesabı aynı olamaz.');
  }
  if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });

  const auth = getAuth();
  const db = getFirestore();
  const [target, owner, users] = await Promise.all([
    auth.getUser(TARGET_UID),
    auth.getUser(OWNER_UID),
    listAllUsers(auth),
  ]);
  if (normalize(target.email) !== TARGET_EMAIL) throw new Error('Hedef UID/e-posta eşleşmedi.');
  if (normalize(owner.email) !== OWNER_EMAIL) throw new Error('Ana sahip UID/e-posta eşleşmedi.');
  if (owner.customClaims?.uygulamaSahibi !== true) throw new Error('Ana hesapta uygulamaSahibi claim true değil; işlem durduruldu.');
  if (target.customClaims?.uygulamaSahibi !== true) throw new Error('Hedef hesapta beklenen uygulamaSahibi claim true değil; tekrar inceleyin.');
  const ownerClaimUids = users.filter(u => u.customClaims?.uygulamaSahibi === true).map(u => u.uid).sort();
  const expectedOwnerUids = [OWNER_UID, TARGET_UID].sort();
  if (ownerClaimUids.length !== 2 || ownerClaimUids.some((uid, i) => uid !== expectedOwnerUids[i])) {
    throw new Error('Uygulama sahibi claim dağılımı beklenenden farklı. Hiçbir değişiklik yapılmadı.');
  }

  const profileRef = db.collection('kullanicilar').doc(TARGET_UID);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) throw new Error('Hedef hesabın Firestore profili bulunamadı.');
  const profile = profileSnap.data();
  if (profile.rol !== 'ogretmen') throw new Error('Hedef profilin rolü ogretmen değil.');
  if (normalize(profile.eposta) !== TARGET_EMAIL) throw new Error('Firestore profil e-postası Auth hesabıyla eşleşmiyor.');
  if (typeof profile.kullaniciAdi !== 'string' || profile.kullaniciAdi.trim().length < 2) {
    throw new Error('Profil kullanıcı adı eksik; otomatik rol dönüşümü güvenli değil.');
  }
  if (profile.hesapDurumu === 'kapali') throw new Error('Hedef hesap kapalı.');

  const aliasId = createHash('sha256').update(TARGET_EMAIL, 'utf8').digest('hex');
  const aliasSnap = await db.collection('epostaAliaslari').doc(aliasId).get();
  if (aliasSnap.exists && aliasSnap.get('ownerUid') !== TARGET_UID) {
    throw new Error('E-posta alias kaydı başka UID sahibi. Hiçbir değişiklik yapılmadı.');
  }

  const nonzero = [];
  for (const collectionName of COLLECTIONS) {
    for (const field of OWNERSHIP_FIELDS) {
      const count = await countRefs(db, collectionName, field, TARGET_UID);
      if (count > 0) nonzero.push({ collectionName, field, count });
    }
  }
  if (nonzero.length) {
    throw new Error('Hedef UID için sahiplik/bağlantı referansı bulundu: ' + JSON.stringify(nonzero));
  }

  console.log('GÜVENLİK ÖN KONTROLÜ: BAŞARILI');
  console.log('Proje: ' + PROJECT_ID);
  console.log('Ana sahip: ' + maskEmail(owner.email) + ' — claim korunacak.');
  console.log('Hedef: ' + maskEmail(target.email) + ' — UID son 6: ' + TARGET_UID.slice(-6));
  console.log('Hedef e-posta doğrulandı: ' + (target.emailVerified ? 'evet' : 'hayır; öğrenci eşleştirmesinden önce doğrulanmalı'));
  console.log('Hedef profil: ' + (CLAIM_ONLY ? 'şimdilik öğretmen olarak korunacak' : 'ogretmen → ogrenci'));
  console.log('Tarama: ' + COLLECTIONS.length + ' koleksiyon × ' + OWNERSHIP_FIELDS.length + ' sahiplik alanı; bulunan referans: 0');
  console.log('E-posta alias: ' + (aliasSnap.exists ? 'hedef UID tarafından tutuluyor, korunacak' : 'yok; eşleştirme sırasında oluşturulabilir'));
  console.log(CLAIM_ONLY ? 'İşlem modu: yalnızca hedef Auth claim içindeki uygulamaSahibi kaldırılacak.' : 'İşlem modu: hedef Auth claim kaldırılacak ve hedef profil öğrenciye dönüştürülecek.');
  console.log('Korunacaklar: Auth hesabı/şifresi/e-postası, kullanıcıAdi, eposta, alias ve ana sahip claim.');

  if (!APPLY) {
    console.log('\nDRY-RUN: hiçbir değişiklik yapılmadı. Uygulamak için --apply kullanın.');
    return;
  }

  const confirmation = process.env.CONFIRM_STUDENT_CONVERSION || '';
  if (confirmation !== 'IKINCI_HESABI_OGRENCIYE_DONUSTUR') {
    throw new Error('CONFIRM_STUDENT_CONVERSION=IKINCI_HESABI_OGRENCIYE_DONUSTUR olmadan --apply çalıştırılamaz.');
  }

  const originalClaims = target.customClaims || {};
  const nextClaims = { ...originalClaims };
  delete nextClaims.uygulamaSahibi;

  await auth.setCustomUserClaims(TARGET_UID, Object.keys(nextClaims).length ? nextClaims : null);
  if (!CLAIM_ONLY) {
    try {
      await profileRef.update({
        rol: 'ogrenci',
        brans: FieldValue.delete(),
        sezon: FieldValue.delete(),
      });
    } catch (error) {
      // Restore the exact original custom-claim set if the profile update fails.
      await auth.setCustomUserClaims(TARGET_UID, originalClaims);
      throw error;
    }
  }

  const [verifiedTarget, verifiedProfile, verifiedOwner] = await Promise.all([
    auth.getUser(TARGET_UID),
    profileRef.get(),
    auth.getUser(OWNER_UID),
  ]);
  const expectedRole = CLAIM_ONLY ? 'ogretmen' : 'ogrenci';
  if (verifiedTarget.customClaims?.uygulamaSahibi === true
    || verifiedProfile.get('rol') !== expectedRole
    || verifiedOwner.customClaims?.uygulamaSahibi !== true) {
    throw new Error('Son doğrulama başarısız. Auth claim ve profil durumunu yeniden denetleyin; otomatik ek değişiklik yapılmadı.');
  }
  console.log(CLAIM_ONLY
    ? '\nBAŞARILI: yalnızca hedef hesabın uygulama sahibi claim kaldırıldı; öğretmen profili korundu.'
    : '\nBAŞARILI: hedef hesabın uygulama sahibi claim kaldırıldı ve profil öğrenciye dönüştürüldü.');
  console.log('Ana hesabın uygulamaSahibi claim değeri true olarak doğrulandı.');
  if (CLAIM_ONLY) console.log('Öğrenci profili dönüşümü, gerçek öğrenci kaydı seçildikten sonra ayrı adımda yapılacak.');
  else console.log('Hesabın e-posta doğrulaması tamamlandıktan sonra öğrenci eşleştirme kodu kullanılabilir.');
}

main().catch(error => {
  console.error('İŞLEM DURDURULDU:', error.message || error);
  process.exitCode = 1;
});
