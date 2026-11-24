const { initializeApp, applicationDefault, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'ogretmen-takip';
const OWNER_UID = (process.env.OWNER_UID || '').trim();
const OWNER_EMAIL = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
const APPLY = process.argv.includes('--apply');

function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return 'E-posta bilgisi yok';
  const [name, domain] = email.split('@');
  return `${name.slice(0, 1)}***@${domain}`;
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

async function main() {
  if (!OWNER_UID || !OWNER_EMAIL) {
    throw new Error('OWNER_UID ve OWNER_EMAIL ortam değişkenleri zorunludur. Hedef hesap kimliği kod içine yazılmamıştır.');
  }
  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }

  const auth = getAuth();
  const db = getFirestore();
  const [targetUser, targetProfile, allUsers] = await Promise.all([
    auth.getUser(OWNER_UID),
    db.collection('kullanicilar').doc(OWNER_UID).get(),
    listAllUsers(auth),
  ]);

  if ((targetUser.email || '').trim().toLowerCase() !== OWNER_EMAIL) {
    throw new Error('OWNER_UID ile OWNER_EMAIL aynı Firebase Authentication hesabına ait değil. Hiçbir değişiklik yapılmadı.');
  }
  if (targetUser.emailVerified !== true) {
    throw new Error('Uygulama sahibi hesabının e-posta adresi doğrulanmamış. Hiçbir değişiklik yapılmadı.');
  }
  if (!targetProfile.exists || targetProfile.get('rol') !== 'ogretmen') {
    throw new Error('Hedef UID için etkin öğretmen profili bulunamadı. Profil veya rol alanı değiştirilmedi.');
  }
  if (targetProfile.get('hesapDurumu') === 'kapali') {
    throw new Error('Hedef öğretmen hesabı kapalı. Hiçbir değişiklik yapılmadı.');
  }

  const conflictingOwners = allUsers.filter(user =>
    user.customClaims?.uygulamaSahibi === true && user.uid !== OWNER_UID
  );
  if (conflictingOwners.length) {
    throw new Error(`Başka hesaplarda uygulama sahibi claim'i bulundu (${conflictingOwners.length}). Önce çakışma incelenmeli; hiçbir değişiklik yapılmadı.`);
  }

  console.log('\nUygulama sahibi claim kontrolü:');
  console.log(`Proje: ${PROJECT_ID}`);
  console.log(`Hedef hesap: ${maskEmail(targetUser.email)}`);
  console.log(`Hedef UID son 6 karakter: ${OWNER_UID.slice(-6)}`);
  console.log(`Firestore rolü: ${targetProfile.get('rol')}`);
  console.log(`E-posta doğrulandı: ${targetUser.emailVerified ? 'evet' : 'hayır'}`);
  console.log(`Mevcut claim: ${targetUser.customClaims?.uygulamaSahibi === true ? 'zaten true' : 'yok'}`);
  console.log('Firestore profili, rol, öğrenci kayıtları ve diğer belgeler bu script tarafından değiştirilmez.');

  if (targetUser.customClaims?.uygulamaSahibi === true) {
    console.log('\nHedef hesapta claim zaten true. Değişiklik yapılmadı.');
    return;
  }
  if (!APPLY) {
    console.log('\nDRY-RUN: hiçbir değişiklik yapılmadı. Uygulamak için --apply ile tekrar çalıştırın.');
    return;
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const confirmation = (await rl.question('\nYalnızca yukarıdaki UID/e-posta eşleşmesine claim vermek için UYGULAMA_SAHIBI_YETKISI_VER yazın: ')).trim();
    if (confirmation !== 'UYGULAMA_SAHIBI_YETKISI_VER') {
      console.log('İşlem iptal edildi; hiçbir değişiklik yapılmadı.');
      return;
    }

    const currentUser = await auth.getUser(OWNER_UID);
    await auth.setCustomUserClaims(OWNER_UID, {
      ...(currentUser.customClaims || {}),
      uygulamaSahibi: true,
    });

    console.log('\nClaim başarıyla yazıldı. Uygulamada görünmesi için hedef hesapta oturumu kapatıp yeniden açın veya ID token yenileyin.');
    console.log('Firestore profil alanları ve diğer kullanıcı verileri değiştirilmedi.');
  } finally {
    rl.close();
  }
}

main().catch(error => {
  console.error('İŞLEM DURDURULDU:', error.message || error);
  process.exitCode = 1;
});
