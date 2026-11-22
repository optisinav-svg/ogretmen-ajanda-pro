const { initializeApp, applicationDefault, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'ogretmen-takip';
const APPLY = process.argv.includes('--apply');

function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return 'E-posta bilgisi yok';
  const [name, domain] = email.split('@');
  return `${name.slice(0, 1)}***@${domain}`;
}

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }
  const auth = getAuth();
  const db = getFirestore();
  const profilesSnapshot = await db.collection('kullanicilar').get();

  if (profilesSnapshot.size !== 2) {
    throw new Error(`Beklenen iki mevcut profil yerine ${profilesSnapshot.size} profil bulundu. Hiçbir değişiklik yapılmadı; önce hesap envanteri incelenmeli.`);
  }

  const candidates = [];
  for (const profileDoc of profilesSnapshot.docs) {
    const profile = profileDoc.data();
    if (profile.rol && profile.rol !== 'ogretmen') {
      throw new Error('Mevcut profillerden birinin rolü öğretmen değil. Güvenlik için işlem durduruldu.');
    }
    let user;
    try {
      user = await auth.getUser(profileDoc.id);
    } catch {
      throw new Error('Firestore profillerinden biriyle eşleşen Firebase Authentication hesabı bulunamadı. Hiçbir değişiklik yapılmadı.');
    }
    candidates.push({
      uid: profileDoc.id,
      profileRef: profileDoc.ref,
      profile,
      user,
    });
  }

  for (const candidate of candidates) {
    if (candidate.user.customClaims?.uygulamaSahibi === true) {
      throw new Error('Mevcut hesaplardan birinde zaten uygulama sahibi yetkisi var. Çakışma giderilmeden işlem yapılmadı.');
    }
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    console.log('\nEşleşen mevcut hesaplar (özel kimlikler ve tam e-posta adresleri gösterilmez):');
    candidates.forEach((item, index) => {
      console.log(`${index + 1}) ${item.profile.kullaniciAdi || item.user.displayName || 'Kullanıcı'} — ${maskEmail(item.user.email)} — mevcut rol: ${item.profile.rol || 'tanımlanmamış'}`);
    });
    const choice = Number((await rl.question('\nUygulama sahibi olacak kendi hesabınızın numarasını girin: ')).trim());
    if (!Number.isInteger(choice) || choice < 1 || choice > candidates.length) {
      throw new Error('Geçersiz seçim. Hiçbir değişiklik yapılmadı.');
    }
    const owner = candidates[choice - 1];
    console.log('\nPlan:');
    console.log('- İki mevcut profilin rolü ogretmen olarak tanımlanacak (zaten ogretmen olan korunur).');
    console.log('- Seçtiğiniz tek hesaba uygulama sahibi özel yetkisi verilecek.');
    console.log('- Diğer hesap öğretmen olarak kalacak.');
    console.log('- Öğrenci kayıtları ve diğer Firestore belgeleri değiştirilmeyecek.');
    console.log(APPLY ? '\nUYGULAMA MODU: değişiklikler yazılacak.' : '\nDENEME MODU: hiçbir değişiklik yazılmayacak.');
    const confirmation = (await rl.question('\nDevam etmek için TAMAM yazın: ')).trim();
    if (confirmation !== 'TAMAM') {
      console.log('İşlem iptal edildi; hiçbir değişiklik yapılmadı.');
      return;
    }
    if (!APPLY) {
      console.log('\nDRY-RUN TAMAMLANDI. Hiçbir veri değiştirilmedi. Uygulamak için aynı komutu --apply ile çalıştırın.');
      return;
    }

    const batch = db.batch();
    let roleUpdates = 0;
    for (const candidate of candidates) {
      if (!candidate.profile.rol) {
        batch.update(candidate.profileRef, { rol: 'ogretmen' });
        roleUpdates += 1;
      }
    }
    if (roleUpdates > 0) await batch.commit();

    const currentOwner = await auth.getUser(owner.uid);
    await auth.setCustomUserClaims(owner.uid, {
      ...(currentOwner.customClaims || {}),
      uygulamaSahibi: true,
    });

    console.log('\nTAMAMLANDI: iki mevcut profil öğretmen olarak tanımlandı ve seçilen hesaba uygulama sahibi yetkisi verildi.');
    console.log('Yetkinin uygulamada görünmesi için seçilen hesapta oturumu kapatıp yeniden açın.');
  } finally {
    rl.close();
  }
}

main().catch(error => {
  console.error('İŞLEM DURDURULDU:', error.message || error);
  process.exitCode = 1;
});
