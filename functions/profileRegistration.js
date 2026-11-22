const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const REGION = 'europe-west1';

function requireAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Önce hesabınıza giriş yapın.');
  }
  return request.auth.uid;
}

function validateTeacherProfileInput(data) {
  const kullaniciAdi = typeof data?.kullaniciAdi === 'string'
    ? data.kullaniciAdi.normalize('NFKC').trim()
    : '';
  const brans = typeof data?.brans === 'string' ? data.brans.trim() : '';
  const sezon = typeof data?.sezon === 'string' ? data.sezon.trim() : '';

  if (kullaniciAdi.length < 2 || kullaniciAdi.length > 80) {
    throw new HttpsError('invalid-argument', 'Ad-soyad 2 ile 80 karakter arasında olmalıdır.');
  }
  if (!brans || brans.length > 50) {
    throw new HttpsError('invalid-argument', 'Geçerli bir branş seçin.');
  }
  const match = /^(\\d{4})\\/(\\d{4})$/.exec(sezon);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) {
    throw new HttpsError('invalid-argument', 'Eğitim-öğretim sezonu geçersiz.');
  }
  return { kullaniciAdi, brans, sezon };
}

exports.ogretmenProfiliOlustur = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request);
  const email = typeof request.auth.token.email === 'string'
    ? request.auth.token.email.trim().toLowerCase()
    : '';
  if (!email) {
    throw new HttpsError('failed-precondition', 'Hesapta doğrulanabilir bir e-posta adresi bulunmalıdır.');
  }

  const profile = validateTeacherProfileInput(request.data);
  const db = getFirestore();
  const profileRef = db.collection('kullanicilar').doc(uid);

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(profileRef);
    if (existing.exists) {
      throw new HttpsError('already-exists', 'Bu hesap için kullanıcı profili zaten oluşturulmuş.');
    }
    tx.create(profileRef, {
      ...profile,
      rol: 'ogretmen',
      eposta: email,
      olusturulmaTarihi: new Date().toISOString(),
      profilOlusturulma: FieldValue.serverTimestamp(),
    });
  });

  return { durum: 'created', rol: 'ogretmen' };
});

exports._test = { validateTeacherProfileInput };
