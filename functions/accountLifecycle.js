const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { setEmailAliasRetention } = require('./emailAliases');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const REGION = 'europe-west1';
const db = getFirestore();

function requireUid(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Önce hesabınıza giriş yapın.');
  return request.auth.uid;
}
function normalizePersonName(value, label) {
  const result = typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ') : '';
  if (result.length < 1 || result.length > 60) {
    throw new HttpsError('invalid-argument', label + ' 1 ile 60 karakter arasında olmalıdır.');
  }
  return result;
}
function normalizeRole(value) {
  if (!['ogretmen', 'ogrenci'].includes(value)) throw new HttpsError('invalid-argument', 'Geçersiz hesap türü.');
  return value;
}
async function getProfile(uid) {
  const ref = db.collection('kullanicilar').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('failed-precondition', 'Kullanıcı profili bulunamadı.');
  return { ref, snap, data: snap.data() };
}

exports.profilAdSoyadGuncelle = onCall({ region: REGION }, async request => {
  const uid = requireUid(request);
  const ad = normalizePersonName(request.data?.ad, 'Ad');
  const soyad = normalizePersonName(request.data?.soyad, 'Soyad');
  const { ref, data } = await getProfile(uid);
  if (data.hesapDurumu === 'kapali') throw new HttpsError('failed-precondition', 'Kapalı hesapta profil değiştirilemez.');
  await ref.update({
    ad, soyad, kullaniciAdi: (ad + ' ' + soyad).trim(),
    profilGuncellenme: FieldValue.serverTimestamp(),
  });
  return { durum: 'guncellendi' };
});

exports.hesapKapatmaTalebiOlustur = onCall({ region: REGION }, async request => {
  const uid = requireUid(request);
  if (request.auth.token.uygulamaSahibi === true) throw new HttpsError('failed-precondition', 'Uygulama sahibi hesabı kapatılmadan önce sahiplik yetkisi güvenli biçimde devredilmelidir.');
  if (request.auth.token.email_verified !== true) throw new HttpsError('failed-precondition', 'Hesap kapatma öncesinde e-posta doğrulanmalıdır.');
  const { ref, data } = await getProfile(uid);
  if (data.hesapDurumu === 'kapali') {
    const expiry = data.hesapSaklamaSonu?.toDate?.();
    if (expiry) await setEmailAliasRetention(uid, expiry);
    return { durum: 'zaten_kapali' };
  }
  const saklamaSonu = new Date();
  saklamaSonu.setFullYear(saklamaSonu.getFullYear() + 3);
  await ref.update({
    hesapDurumu: 'kapali',
    hesapKapatmaTalepTarihi: FieldValue.serverTimestamp(),
    hesapSaklamaBaslangic: FieldValue.serverTimestamp(),
    hesapSaklamaSonu: Timestamp.fromDate(saklamaSonu),
    hesapKapatmaTalepUid: uid,
  });
  await setEmailAliasRetention(uid, saklamaSonu);
  await db.collection('hesapYasamDongusuDenetimi').add({
    uid, islem: 'hesap_kapatildi', rol: data.rol || null,
    zaman: FieldValue.serverTimestamp(), sonuc: 'basarili',
  });
  return { durum: 'kapali', yenidenEtkinlestirme: true };
});

exports.hesabiYenidenEtkinlestir = onCall({ region: REGION }, async request => {
  const uid = requireUid(request);
  if (request.auth.token.email_verified !== true) throw new HttpsError('failed-precondition', 'Yeniden etkinleştirme için e-posta doğrulanmalıdır.');
  const { ref, data } = await getProfile(uid);
  if (data.hesapDurumu !== 'kapali') return { durum: 'zaten_aktif' };
  if (data.hesapSaklamaSonu?.toMillis?.() && data.hesapSaklamaSonu.toMillis() <= Date.now()) {
    throw new HttpsError('failed-precondition', 'Hesabın üç yıllık saklama ve yeniden etkinleştirme süresi sona ermiş. Destekle iletişime geçin.');
  }
  await setEmailAliasRetention(uid, null);
  await ref.update({
    hesapDurumu: 'aktif',
    hesapSaklamaSonu: FieldValue.delete(),
    hesapYenidenEtkinlestirmeTarihi: FieldValue.serverTimestamp(),
  });
  await db.collection('hesapYasamDongusuDenetimi').add({
    uid, islem: 'hesap_yeniden_etkinlestirildi', rol: data.rol || null,
    zaman: FieldValue.serverTimestamp(), sonuc: 'basarili',
  });
  return { durum: 'aktif' };
});

exports.rolDuzeltmeTalebiOlustur = onCall({ region: REGION }, async request => {
  const uid = requireUid(request);
  const hedefRol = normalizeRole(request.data?.hedefRol);
  const gerekce = typeof request.data?.gerekce === 'string' ? request.data.gerekce.trim().slice(0, 1000) : '';
  if (gerekce.length < 10) throw new HttpsError('invalid-argument', 'Düzeltme gerekçesi en az 10 karakter olmalıdır.');
  const { data } = await getProfile(uid);
  if (!['ogretmen', 'ogrenci'].includes(data.rol) || data.rol === hedefRol) {
    throw new HttpsError('failed-precondition', 'Mevcut hesap türü veya hedef tür düzeltme talebine uygun değil.');
  }
  if (data.hesapDurumu === 'kapali') throw new HttpsError('failed-precondition', 'Kapalı hesap için talep oluşturulamaz.');
  const pending = await db.collection('rolDuzeltmeTalepleri').where('uid', '==', uid).where('durum', '==', 'bekliyor').limit(1).get();
  if (!pending.empty) throw new HttpsError('already-exists', 'Bekleyen bir rol düzeltme talebiniz zaten var.');
  const ref = await db.collection('rolDuzeltmeTalepleri').add({
    uid, mevcutRol: data.rol, hedefRol, gerekce, durum: 'bekliyor',
    olusturulma: FieldValue.serverTimestamp(),
  });
  return { durum: 'bekliyor', talepId: ref.id, inceleyen: 'uygulama_sahibi' };
});

exports.rolDuzeltmeTalebiniKararaBagla = onCall({ region: REGION }, async request => {
  const ownerUid = requireUid(request);
  if (request.auth.token.uygulamaSahibi !== true) throw new HttpsError('permission-denied', 'Bu işlem yalnızca uygulama sahibi tarafından yapılabilir.');
  const talepId = typeof request.data?.talepId === 'string' ? request.data.talepId : '';
  const karar = request.data?.karar;
  if (!talepId || !['onayla', 'reddet'].includes(karar)) throw new HttpsError('invalid-argument', 'Talep ve karar bilgisi gereklidir.');
  const ref = db.collection('rolDuzeltmeTalepleri').doc(talepId);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get('durum') !== 'bekliyor') throw new HttpsError('not-found', 'Bekleyen talep bulunamadı.');
    const profileRef = db.collection('kullanicilar').doc(snap.get('uid'));
    const profileSnap = await tx.get(profileRef);
    if (!profileSnap.exists || profileSnap.get('rol') !== snap.get('mevcutRol')) throw new HttpsError('failed-precondition', 'Hesap rolü talep sonrasında değişmiş.');
    if (karar === 'onayla') {
      const target = snap.get('hedefRol');
      // Role conversion is intentionally blocked while teacher-owned or linked records exist.
      // A later reviewed migration can preserve these records without silently orphaning them.
      const ownedCollections = ['okullar','siniflar','ogrenciler','dersler','odevler','yoklamalar','dersNotlari','kitaplar','konular','bireyselEtkinlikler','bireyselDersOturumlari','kitapKutuphanesi','kitapKutuphanesiKonulari'];
      if (snap.get('mevcutRol') === 'ogretmen') {
        for (const name of ownedCollections) {
          const found = await db.collection(name).where('uid','==',snap.get('uid')).limit(1).get();
          if (!found.empty) throw new HttpsError('failed-precondition', 'Öğretmen verileri bulundu. Veri sahipliği aktarımı tamamlanmadan rol değiştirilemez.');
        }
      }
      const teacherLinks = await db.collection('ogretmenOgrenciBaglantilari').where('ogretmenUid','==',snap.get('uid')).limit(1).get();
      const studentLinks = await db.collection('ogretmenOgrenciBaglantilari').where('ogrenciUid','==',snap.get('uid')).limit(1).get();
      if (!teacherLinks.empty || !studentLinks.empty) {
        throw new HttpsError('failed-precondition', 'Geçmiş veya etkin öğretmen-öğrenci bağlantıları bulundu. Bağlantı geçmişi güvenli biçimde taşınmadan rol değiştirilemez.');
      }
      if (target === 'ogretmen' && (!request.data.brans || !request.data.sezon)) {
        throw new HttpsError('invalid-argument', 'Öğretmen rolü için branş ve eğitim dönemi gereklidir.');
      }
      const update = { rol: target, rolGuncellenme: FieldValue.serverTimestamp() };
      if (target === 'ogretmen') { update.brans = String(request.data.brans).slice(0,50); update.sezon = String(request.data.sezon); }
      else { update.brans = FieldValue.delete(); update.sezon = FieldValue.delete(); }
      tx.update(profileRef, update);
    }
    tx.update(ref, {
      durum: karar === 'onayla' ? 'onaylandi' : 'reddedildi',
      kararVerenUid: ownerUid, kararZamani: FieldValue.serverTimestamp(),
    });
    return { durum: karar === 'onayla' ? 'onaylandi' : 'reddedildi' };
  });
});


exports.epostaDegisikliginiProfileYansit = onCall({ region: REGION }, async request => {
  const uid = requireUid(request);
  const email = typeof request.auth.token.email === 'string' ? request.auth.token.email.trim().toLowerCase() : '';
  if (!email || request.auth.token.email_verified !== true) {
    throw new HttpsError('failed-precondition', 'Yeni e-posta adresi doğrulanmalıdır.');
  }
  const { ref, data } = await getProfile(uid);
  if (data.hesapDurumu === 'kapali') throw new HttpsError('failed-precondition', 'Kapalı hesapta e-posta değiştirilemez.');
  await claimAlias(email, uid);
  await ref.update({ eposta: email, epostaGuncellenme: FieldValue.serverTimestamp() });
  return { durum: 'guncellendi' };
});

exports._test = { normalizePersonName, normalizeRole };
