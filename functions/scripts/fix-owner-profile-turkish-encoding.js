const { initializeApp, applicationDefault, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'ogretmen-takip';
const TARGET_UID = process.env.TARGET_UID;
const TARGET_EMAIL = process.env.TARGET_EMAIL;
const APPLY = process.argv.includes('--apply');

const EXPECTED_NAME = 'R\\u0131za G\\u00f6k\\u00e7e';
const EXPECTED_BRANCH = 'Co\\u011frafya';
const CORRUPTED_NAME = 'R?za G?k?e';
const CORRUPTED_BRANCH = 'Co?rafya';

async function main() {
  if (!TARGET_UID || !TARGET_EMAIL) {
    throw new Error('TARGET_UID ve TARGET_EMAIL ortam değişkenleri zorunludur. Hiçbir veri değiştirilmedi.');
  }
  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }

  const auth = getAuth();
  const db = getFirestore();
  const user = await auth.getUser(TARGET_UID);
  if (user.email !== TARGET_EMAIL) {
    throw new Error('UID/e-posta eşleşmesi doğrulanamadı. Hiçbir veri değiştirilmedi.');
  }
  if (user.displayName !== EXPECTED_NAME) {
    throw new Error('Firebase Authentication görünen adı beklenen doğru Türkçe adla eşleşmiyor. Hiçbir veri değiştirilmedi.');
  }
  if (user.customClaims?.uygulamaSahibi !== true) {
    throw new Error('Hedef hesapta uygulama sahibi yetkisi doğrulanamadı. Hiçbir veri değiştirilmedi.');
  }

  const profileRef = db.collection('kullanicilar').doc(TARGET_UID);
  const profileSnapshot = await profileRef.get();
  if (!profileSnapshot.exists) {
    throw new Error('Hedef Firestore profili bulunamadı. Hiçbir veri değiştirilmedi.');
  }
  const profile = profileSnapshot.data();
  if (profile.rol !== 'ogretmen') {
    throw new Error('Profil rolü ogretmen değil. Hiçbir veri değiştirilmedi.');
  }

  const alreadyCorrect = profile.kullaniciAdi === EXPECTED_NAME
    && profile.brans === EXPECTED_BRANCH;
  if (alreadyCorrect) {
    console.log('Profil adı ve branş zaten doğru. Değişiklik gerekmedi.');
    return;
  }

  if (profile.kullaniciAdi !== CORRUPTED_NAME || profile.brans !== CORRUPTED_BRANCH) {
    throw new Error('Mevcut profil alanları beklenen bozuk değerlerle eşleşmiyor. Beklenmeyen verinin üzerine yazılmadı.');
  }

  console.log('Doğrulanan hesap:', user.email);
  console.log('Doğrulanan rol:', profile.rol);
  console.log('Ad alanı: bozuk Türkçe karakterler -> doğru Türkçe karakterler');
  console.log('Branş alanı: bozuk Türkçe karakterler -> doğru Türkçe karakterler');
  console.log('Güncellenecek alanlar yalnızca: kullaniciAdi, brans');
  console.log('UID, e-posta, rol, sezon, özel yetkiler ve diğer belgeler değiştirilmeyecek.');
  console.log(APPLY ? 'UYGULAMA MODU: onay bekleniyor.' : 'DRY-RUN: hiçbir veri yazılmayacak.');

  if (!APPLY) {
    console.log('Önizleme tamamlandı. Gerçek yazma için tam yedek ve kullanıcı onayı gereklidir.');
    return;
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const confirmation = (await rl.question('Yalnızca bu iki profil alanını düzeltmek için RIZA GOKCE PROFILINI DUZELT yazın: ')).trim();
    if (confirmation !== 'RIZA GOKCE PROFILINI DUZELT') {
      console.log('İşlem iptal edildi; hiçbir veri değiştirilmedi.');
      return;
    }
    await profileRef.update({
      kullaniciAdi: EXPECTED_NAME,
      brans: EXPECTED_BRANCH,
    });

    const verified = (await profileRef.get()).data();
    if (verified.kullaniciAdi !== EXPECTED_NAME || verified.brans !== EXPECTED_BRANCH) {
      throw new Error('Yazma sonrası doğrulama başarısız. Profil tekrar kontrol edilmeli.');
    }
    console.log('İki alan güncellendi ve tekrar okunarak doğrulandı.');
  } finally {
    rl.close();
  }
}

main().catch(error => {
  console.error('İŞLEM DURDURULDU:', error.message || error);
  process.exitCode = 1;
});
