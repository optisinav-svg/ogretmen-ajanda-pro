const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = getFirestore();
const REGION = 'europe-west1';
function isCurrentAcademicPeriodEditable(period, date = new Date()) {
  if (!Number.isInteger(period)) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  return (year === period && month >= 6) || (year === period + 1 && month <= 6);
}


exports.ogretmenOgrenciKaydiniTasi = onCall({ region: REGION }, async request => {
  const teacherUid = request.auth?.uid;
  if (!teacherUid) throw new HttpsError('unauthenticated', 'Önce hesabınıza giriş yapın.');
  const profile = await db.collection('kullanicilar').doc(teacherUid).get();
  if (!profile.exists || profile.get('rol') !== 'ogretmen') {
    throw new HttpsError('permission-denied', 'Bu işlem yalnızca öğretmen hesabı tarafından yapılabilir.');
  }
  const { ogrenciKayitId, kaynakSinifId, hedefSinifId, donemYili, tasimaTarihi, neden } = request.data || {};
  if (![ogrenciKayitId, kaynakSinifId, hedefSinifId].every(x => typeof x === 'string' && x.trim())
    || !Number.isInteger(donemYili)) {
    throw new HttpsError('invalid-argument', 'Öğrenci ve kaynak/hedef sınıf bilgileri geçerli olmalıdır.');
  }
  const studentRef = db.collection('ogrenciler').doc(ogrenciKayitId);
  const targetRef = db.collection('siniflar').doc(hedefSinifId);
  const sourceRef = db.collection('siniflar').doc(kaynakSinifId);
  const linksQuery = db.collection('ogretmenOgrenciBaglantilari')
    .where('ogrenciKayitId', '==', ogrenciKayitId);
  const indexRef = db.collection('ogrenciKayitEslesmeleri').doc([teacherUid, ogrenciKayitId].join('__'));
  await db.runTransaction(async tx => {
    const [studentSnap, targetSnap, sourceSnap, indexSnap] = await Promise.all([
      tx.get(studentRef), tx.get(targetRef), tx.get(sourceRef), tx.get(indexRef),
    ]);
    const targetSchoolId = targetSnap.exists ? targetSnap.get('okulId') : '';
    const targetSchoolSnap = typeof targetSchoolId === 'string' && targetSchoolId
      ? await tx.get(db.collection('okullar').doc(targetSchoolId))
      : null;
    let indexedLinkSnap = null;
    if (indexSnap.exists && typeof indexSnap.get('baglantiId') === 'string') {
      indexedLinkSnap = await tx.get(db.collection('ogretmenOgrenciBaglantilari').doc(indexSnap.get('baglantiId')));
    }
    const indexedLinkIsActive = indexedLinkSnap?.exists
      && indexedLinkSnap.get('ogrenciKayitId') === ogrenciKayitId
      && indexedLinkSnap.get('durum') === 'active';
    let fallbackActiveLinks = [];
    if (!indexedLinkIsActive) {
      const linksSnap = await tx.get(linksQuery);
      fallbackActiveLinks = linksSnap.docs.filter(doc =>
        doc.get('ogrenciKayitId') === ogrenciKayitId && doc.get('ogretmenUid') === teacherUid && doc.get('durum') === 'active');
    }
    if (!studentSnap.exists || studentSnap.get('uid') !== teacherUid
      || studentSnap.get('sinifId') !== kaynakSinifId
      || studentSnap.get('donemYili') !== donemYili
      || !sourceSnap.exists || sourceSnap.get('uid') !== teacherUid
      || sourceSnap.get('donemYili') !== donemYili) {
      throw new HttpsError('failed-precondition', 'Öğrencinin mevcut sınıfı veya dönem bilgisi değişmiş.');
    }
    if (!targetSnap.exists || targetSnap.get('uid') !== teacherUid
      || targetSnap.get('donemYili') !== donemYili
      || targetSnap.get('arsivlendi') === true
      || targetSnap.get('arsivDurumu') === 'isleniyor'
      || (targetSchoolSnap && (!targetSchoolSnap.exists
        || targetSchoolSnap.get('uid') !== teacherUid
        || targetSchoolSnap.get('arsivlendi') === true
        || targetSchoolSnap.get('arsivDurumu') === 'isleniyor'))) {
      throw new HttpsError('failed-precondition', 'Hedef sınıf veya okul kaldırılma sürecinde ya da bu dönem için etkin değil.');
    }
    const student = studentSnap.data();
    const target = targetSnap.data();
    const sourceSchoolId = student.okulId || sourceSnap.get('okulId') || '';
    if (neden === 'kayitsizlara_tasima'
      && (target.ozelTur !== 'kayitsiz' || !sourceSchoolId || target.okulId !== sourceSchoolId)) {
      throw new HttpsError('failed-precondition', 'Öğrenci yalnızca kendi okulunun Kayıtsız Öğrenciler sınıfına taşınabilir.');
    }
    if (!isCurrentAcademicPeriodEditable(donemYili)) {
      throw new HttpsError('failed-precondition', 'Geçmiş dönem öğrenci kayıtları taşınamaz.');
    }
    const movedAt = typeof tasimaTarihi === 'string' && tasimaTarihi ? tasimaTarihi : new Date().toISOString();
    const activeLinks = indexedLinkIsActive ? [indexedLinkSnap] : fallbackActiveLinks;
    const currentLink = activeLinks.find(doc => doc.get('sinifId') === kaynakSinifId) || activeLinks[0] || null;
    let newLinkRef = null;
    let newLinkSnap = null;
    let newLinkId = null;
    if (currentLink && currentLink.get('sinifId') !== hedefSinifId) {
      const oldData = currentLink.data();
      newLinkId = [teacherUid, oldData.ogrenciUid, hedefSinifId].join('__');
      newLinkRef = db.collection('ogretmenOgrenciBaglantilari').doc(newLinkId);
      newLinkSnap = await tx.get(newLinkRef);
      if (newLinkSnap.exists && newLinkSnap.get('durum') === 'active'
        && newLinkSnap.get('ogrenciKayitId') !== ogrenciKayitId) {
        throw new HttpsError('already-exists', 'Hedef sınıfta aynı öğrenci hesabına ait başka bir etkin bağlantı var.');
      }
    }

    // All transaction reads are complete before the first write.
    tx.update(studentRef, {
      sinifGecmisiIds: FieldValue.arrayUnion(kaynakSinifId),
      sinifGecmisi: FieldValue.arrayUnion({
        sinifId: student.sinifId,
        sinifAd: student.sinifAd || sourceSnap.get('ad') || '',
        okulId: student.okulId || sourceSnap.get('okulId') || '',
        okulAd: student.okulAd || sourceSnap.get('okulAd') || '',
        donemYili,
        tarih: movedAt,
        neden: neden === 'kayitsizlara_tasima' ? 'kayitsizlara_tasima' : 'sinif_degisikligi',
      }),
      sinifId: hedefSinifId,
      sinifAd: target.ad || '',
      okulId: target.okulId || '',
      okulAd: target.okulAd || '',
      kademe: target.kademe || '',
      brans: target.ders || '',
      kayitsizMi: target.ozelTur === 'kayitsiz',
      ...(target.ozelTur === 'kayitsiz' ? { kayitsizTarihi: movedAt } : {}),
      sinifTasiIslemi: FieldValue.delete(),
      kayitsizTasiIslemi: FieldValue.delete(),
    });

    // Eski sınıf bağlantıları etkin kalır: öğrenci geçmiş yoklama/ödevlerini
    // kendi uygulamasında görebilsin. Yeni sınıf için ayrı aktif bağlantı açılır.
    if (currentLink && newLinkRef && newLinkId) {
      const oldData = currentLink.data();
      const nextLink = {
        ...oldData,
        sinifId: hedefSinifId,
        sinifAd: target.ad || '',
        okulAd: target.okulAd || '',
        kademe: target.kademe || '',
        ders: target.ders || '',
        durum: 'active',
        iptalTarihi: null,
        tasinmaTarihi: FieldValue.serverTimestamp(),
      };
      if (newLinkSnap.exists) tx.set(newLinkRef, nextLink, { merge: true });
      else tx.create(newLinkRef, nextLink);
      tx.set(indexRef, {
        ...(indexSnap.exists ? indexSnap.data() : {}),
        uid: teacherUid,
        ogretmenUid: teacherUid,
        donemYili,
        ogrenciKayitId,
        ogrenciUid: oldData.ogrenciUid,
        sinifId: hedefSinifId,
        baglantiId: newLinkId,
        durum: 'active',
        iptalTarihi: null,
        guncellenme: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });
  return { durum: 'tasindi', ogrenciKayitId, hedefSinifId };
});
