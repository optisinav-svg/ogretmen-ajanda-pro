const { randomBytes, createHash } = require('node:crypto');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = getFirestore();
const REGION = 'europe-west1';
const CODE_TTL_MS = 12 * 60 * 60 * 1000;
const PERMISSION_KEYS = [
  'dersProgrami',
  'dersNotlari',
  'konular',
  'yoklama',
  'odevler',
  'kitaplar',
];

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function isAllowedStudentGrade(value) {
  return ['9', '10', '11', '12', 'TYT', 'AYT'].includes(String(value || '').trim().toUpperCase());
}

function createPairingCode() {
  return randomBytes(8).toString('hex').toUpperCase();
}

function createLinkId(teacherUid, studentUid, classId) {
  return [teacherUid, studentUid, classId].join('__');
}

function createRecordLinkIndexId(teacherUid, studentRecordId) {
  return [teacherUid, studentRecordId].join('__');
}

function assertStudentRecordAvailable(existing, studentUid) {
  if (existing?.durum === 'active' && existing.ogrenciUid !== studentUid) {
    throw new HttpsError('already-exists', 'Bu öğrenci kaydı başka bir öğrenci hesabına bağlı. Aynı öğrenci kaydı iki hesaba açılamaz.');
  }
}

function normalizeIdentityEmail(value) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('en-US') : '';
}

function normalizeIdentityName(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]/gu, '')
    : '';
}

function istanbulDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isAcademicPeriodEditable(period, date = new Date()) {
  if (!Number.isInteger(period)) return false;
  const today = istanbulDateString(date);
  return today >= `${period}-06-01` && today <= `${period + 1}-06-30`;
}

function assertStudentIdentityMatches(student, email, name, emailVerified) {
  const registeredEmail = normalizeIdentityEmail(student?.eposta || student?.email);
  const accountEmail = normalizeIdentityEmail(email);
  const registeredName = normalizeIdentityName(student?.adSoyad || [student?.ad, student?.soyad].filter(Boolean).join(' '));
  const accountName = normalizeIdentityName(name);
  if (!emailVerified) {
    throw new HttpsError('failed-precondition', 'Öğrenci hesabının e-posta adresi doğrulanmalıdır.');
  }
  if (!registeredEmail || !accountEmail || registeredEmail !== accountEmail) {
    throw new HttpsError('permission-denied', 'Hesabın e-posta adresi öğrenci kaydındaki e-posta ile eşleşmiyor. Öğretmeninizden kaydı kontrol etmesini isteyin.');
  }
  if (!registeredName || !accountName || registeredName !== accountName) {
    throw new HttpsError('permission-denied', 'Hesap adı öğrenci kaydındaki ad-soyad ile eşleşmiyor.');
  }
  return true;
}

function normalizePermissions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Paylaşım izinleri belirtilmelidir.');
  }
  const unknown = Object.keys(value).filter((key) => !PERMISSION_KEYS.includes(key));
  if (unknown.length) {
    throw new HttpsError('invalid-argument', 'Bilinmeyen paylaşım izni.');
  }
  return Object.fromEntries(PERMISSION_KEYS.map((key) => {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') {
      throw new HttpsError('invalid-argument', 'Paylaşım izinleri yalnızca açık veya kapalı olabilir.');
    }
    return [key, value[key] === true];
  }));
}

async function requireRole(uid, expectedRole) {
  const profile = await db.collection('kullanicilar').doc(uid).get();
  if (!profile.exists) {
    throw new HttpsError('failed-precondition', 'Kullanıcı profili bulunamadı.');
  }
  const role = profile.get('rol') || 'ogretmen'; // Eski rol alanı olmayan hesaplar öğretmendir.
  if (role !== expectedRole) {
    throw new HttpsError('permission-denied', 'Bu işlem için hesap rolünüz uygun değil.');
  }
  return profile;
}

function requireAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Önce hesabınıza giriş yapın.');
  }
  return request.auth.uid;
}

exports.eskiOgretmenRolunuTanimla = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request);
  const ref = db.collection('kullanicilar').doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'Kullanıcı profili bulunamadı.');
    const role = snap.get('rol');
    if (role === 'ogrenci') {
      throw new HttpsError('permission-denied', 'Öğrenci rolü öğretmen rolüne çevrilemez.');
    }
    if (role && role !== 'ogretmen') {
      throw new HttpsError('permission-denied', 'Geçersiz hesap rolü.');
    }
    if (!role) tx.update(ref, { rol: 'ogretmen' });
  });
  return { rol: 'ogretmen' };
});

exports.ogrenciEslesmeKoduOlustur = onCall({ region: REGION }, async (request) => {
  const teacherUid = requireAuth(request);
  await requireRole(teacherUid, 'ogretmen');
  const studentRecordId = request.data?.ogrenciKayitId;
  if (typeof studentRecordId !== 'string' || !studentRecordId.trim()) {
    throw new HttpsError('invalid-argument', 'Öğrenci kaydı seçilmelidir.');
  }

  const studentRef = db.collection('ogrenciler').doc(studentRecordId);
  const studentSnap = await studentRef.get();
  if (!studentSnap.exists || studentSnap.get('uid') !== teacherUid) {
    throw new HttpsError('not-found', 'Öğrenci kaydı bulunamadı.');
  }
  const student = studentSnap.data();
  if (!isAcademicPeriodEditable(student.donemYili)) {
    throw new HttpsError('failed-precondition', 'Bu öğrenci kaydının dönemi yeni hesap bağlantısı için kapalı.');
  }
  if (typeof student.eposta !== 'string' || !student.eposta.trim()) {
    throw new HttpsError('failed-precondition', 'Öğrenci kaydına hesapta kullanılacak e-posta adresi eklenmelidir.');
  }
  if (typeof student.sinifId !== 'string' || !student.sinifId) {
    throw new HttpsError('failed-precondition', 'Öğrencinin geçerli bir sınıf kaydı bulunmuyor.');
  }
  const classSnap = await db.collection('siniflar').doc(student.sinifId).get();
  if (!classSnap.exists || classSnap.get('uid') !== teacherUid) {
    throw new HttpsError('failed-precondition', 'Öğrencinin sınıf sahipliği doğrulanamadı.');
  }

  if (!isAllowedStudentGrade(classSnap.get('kademe'))) {
    throw new HttpsError('failed-precondition', 'Öğrenci hesabı yalnızca lise düzeyi doğrulanmış sınıflar için açılabilir. Ortaokul hesapları veli/vasi süreci netleşene kadar kapalıdır.');
  }

  const code = createPairingCode();
  const codeHash = sha256(code);
  const now = Date.now();
  await db.collection('ogrenciEslesmeKodlari').doc(codeHash).create({
    uid: teacherUid,
    ogretmenUid: teacherUid,
    ogrenciKayitId: studentRecordId,
    sinifId: student.sinifId,
    donemYili: Number.isInteger(student.donemYili) ? student.donemYili : null,
    kullanildi: false,
    olusturulma: Timestamp.fromMillis(now),
    sonaErme: Timestamp.fromMillis(now + CODE_TTL_MS),
  });
  return { kod: code, sonaErme: new Date(now + CODE_TTL_MS).toISOString() };
});

exports.ogrenciEslesmeTalebiGonder = onCall({ region: REGION }, async (request) => {
  const studentUid = requireAuth(request);
  const rawCode = request.data?.kod;
  if (typeof rawCode !== 'string' || !/^[A-Fa-f0-9]{16}$/.test(rawCode.trim())) {
    throw new HttpsError('invalid-argument', 'Geçerli bir eşleştirme kodu girin.');
  }
  const codeRef = db.collection('ogrenciEslesmeKodlari').doc(sha256(rawCode.trim().toUpperCase()));
  const profileRef = db.collection('kullanicilar').doc(studentUid);
  const requestRef = db.collection('ogrenciEslesmeTalepleri').doc();
  await db.runTransaction(async (tx) => {
    const [codeSnap, profileSnap] = await Promise.all([tx.get(codeRef), tx.get(profileRef)]);
    if (!codeSnap.exists) throw new HttpsError('not-found', 'Eşleştirme kodu geçersiz veya kullanılmış.');
    const codeData = codeSnap.data();
    const [teacherProfileSnap, classSnap, studentSnap] = await Promise.all([
      tx.get(db.collection('kullanicilar').doc(codeData.ogretmenUid)),
      tx.get(db.collection('siniflar').doc(codeData.sinifId)),
      tx.get(db.collection('ogrenciler').doc(codeData.ogrenciKayitId)),
    ]);
    if (!teacherProfileSnap.exists || (teacherProfileSnap.get('rol') && teacherProfileSnap.get('rol') !== 'ogretmen')
      || !classSnap.exists || classSnap.get('uid') !== codeData.ogretmenUid
      || !studentSnap.exists || studentSnap.get('uid') !== codeData.ogretmenUid
      || studentSnap.get('sinifId') !== codeData.sinifId) {
      throw new HttpsError('failed-precondition', 'Öğretmen, sınıf veya öğrenci kaydı artık geçerli değil. Yeni kod isteyin.');
    }
    if (!isAcademicPeriodEditable(studentSnap.get('donemYili'))) {
      throw new HttpsError('failed-precondition', 'Bu eğitim öğretim dönemi sona erdiği için yeni öğrenci bağlantısı kurulamaz.');
    }
    if (codeData.kullanildi || codeData.sonaErme.toMillis() <= Date.now()) {
      throw new HttpsError('deadline-exceeded', 'Eşleştirme kodunun süresi dolmuş veya kod daha önce kullanılmış.');
    }
    if (codeData.ogretmenUid === studentUid) {
      throw new HttpsError('failed-precondition', 'Kendi öğretmen hesabınızla eşleşme isteği gönderemezsiniz.');
    }
    if (profileSnap.exists && profileSnap.get('rol') !== 'ogrenci') {
      throw new HttpsError('permission-denied', 'Bu hesap öğrenci hesabı olarak tanımlanmamış.');
    }
    const email = request.auth.token.email || '';
    const suppliedName = typeof request.data?.adSoyad === 'string' ? request.data.adSoyad.trim().slice(0, 80) : '';
    const displayName = suppliedName || request.auth.token.name || '';
    assertStudentIdentityMatches(studentSnap.data(), email, displayName, request.auth.token.email_verified === true);
    if (!profileSnap.exists) {
      tx.create(profileRef, {
        rol: 'ogrenci',
        eposta: email,
        kullaniciAdi: displayName,
        olusturulmaTarihi: new Date().toISOString(),
      });
    } else if (suppliedName) {
      tx.update(profileRef, { kullaniciAdi: suppliedName, eposta: email });
    }
    tx.create(requestRef, {
      uid: codeData.ogretmenUid,
      ogrenciUid: studentUid,
      ogretmenUid: codeData.ogretmenUid,
      ogrenciKayitId: codeData.ogrenciKayitId,
      sinifId: codeData.sinifId,
      sinifAd: classSnap.get('ad') || '',
      donemYili: Number.isInteger(studentSnap.get('donemYili')) ? studentSnap.get('donemYili') : null,
      ogretmenHesapAdi: teacherProfileSnap.get('kullaniciAdi') || '',
      ogrenciHesapAdi: displayName,
      ogrenciEposta: request.auth.token.email || (profileSnap.exists ? profileSnap.get('eposta') : '') || '',
      durum: 'bekliyor',
      olusturulma: FieldValue.serverTimestamp(),
    });
    tx.update(codeRef, { kullanildi: true, kullanilma: FieldValue.serverTimestamp(), talepId: requestRef.id });
  });
  return { talepId: requestRef.id, durum: 'bekliyor' };
});

exports.ogrenciEslesmeTalebiniOnayla = onCall({ region: REGION }, async (request) => {
  const teacherUid = requireAuth(request);
  await requireRole(teacherUid, 'ogretmen');
  const requestId = request.data?.talepId;
  if (typeof requestId !== 'string' || !requestId) {
    throw new HttpsError('invalid-argument', 'Eşleştirme talebi seçilmelidir.');
  }
  const permissions = normalizePermissions(request.data?.izinler);
  const requestRef = db.collection('ogrenciEslesmeTalepleri').doc(requestId);

  const result = await db.runTransaction(async (tx) => {
    const reqSnap = await tx.get(requestRef);
    if (!reqSnap.exists || reqSnap.get('ogretmenUid') !== teacherUid) {
      throw new HttpsError('not-found', 'Eşleştirme talebi bulunamadı.');
    }
    if (reqSnap.get('durum') !== 'bekliyor') {
      throw new HttpsError('failed-precondition', 'Bu talep daha önce işlenmiş.');
    }
    const data = reqSnap.data();
    const studentRef = db.collection('ogrenciler').doc(data.ogrenciKayitId);
    const classRef = db.collection('siniflar').doc(data.sinifId);
    const [studentSnap, classSnap, profileSnap, teacherProfileSnap] = await Promise.all([
      tx.get(studentRef), tx.get(classRef),
      tx.get(db.collection('kullanicilar').doc(data.ogrenciUid)),
      tx.get(db.collection('kullanicilar').doc(teacherUid)),
    ]);
    if (!studentSnap.exists || studentSnap.get('uid') !== teacherUid
      || !isAcademicPeriodEditable(studentSnap.get('donemYili'))
      || studentSnap.get('sinifId') !== data.sinifId
      || !classSnap.exists || classSnap.get('uid') !== teacherUid
      || !profileSnap.exists || profileSnap.get('rol') !== 'ogrenci'
      || !teacherProfileSnap.exists) {
      throw new HttpsError('failed-precondition', 'Öğrenci kaydı veya hesap eşleşmesi doğrulanamadı.');
    }
    const linkId = createLinkId(teacherUid, data.ogrenciUid, data.sinifId);
    const linkRef = db.collection('ogretmenOgrenciBaglantilari').doc(linkId);
    const recordIndexRef = db.collection('ogrenciKayitEslesmeleri').doc(createRecordLinkIndexId(teacherUid, data.ogrenciKayitId));
    const [linkSnap, recordIndexSnap] = await Promise.all([tx.get(linkRef), tx.get(recordIndexRef)]);
    assertStudentRecordAvailable(recordIndexSnap.exists ? recordIndexSnap.data() : null, data.ogrenciUid);
    if (linkSnap.exists && linkSnap.get('durum') === 'active') {
      throw new HttpsError('already-exists', 'Bu öğrenciyle etkin bağlantı zaten bulunuyor.');
    }
    tx.set(linkRef, {
      uid: teacherUid,
      ogretmenUid: teacherUid,
      ogretmenHesapAdi: teacherProfileSnap.get('kullaniciAdi') || '',
      ogrenciAd: studentSnap.get('adSoyad') || studentSnap.get('ad') || '',
      sinifAd: classSnap.get('ad') || '',
      okulAd: studentSnap.get('okulAd') || classSnap.get('okulAd') || '',
      donemYili: Number.isInteger(studentSnap.get('donemYili')) ? studentSnap.get('donemYili') : null,
      kademe: classSnap.get('kademe') || studentSnap.get('kademe') || '',
      ders: classSnap.get('ders') || studentSnap.get('brans') || '',
      ogrenciUid: data.ogrenciUid,
      ogrenciKayitId: data.ogrenciKayitId,
      ogrenciHesapAdi: profileSnap.get('kullaniciAdi') || '',
      ogrenciEposta: profileSnap.get('eposta') || '',
      sinifId: data.sinifId,
      izinler: permissions,
      durum: 'active',
      olusturulma: FieldValue.serverTimestamp(),
      iptalTarihi: null,
    });
    tx.set(recordIndexRef, {
      uid: teacherUid,
      donemYili: Number.isInteger(studentSnap.get('donemYili')) ? studentSnap.get('donemYili') : null,
      ogretmenUid: teacherUid,
      ogrenciKayitId: data.ogrenciKayitId,
      ogrenciUid: data.ogrenciUid,
      sinifId: data.sinifId,
      baglantiId: linkId,
      durum: 'active',
      guncellenme: FieldValue.serverTimestamp(),
    });
    tx.update(requestRef, {
      durum: 'onaylandi',
      baglantiId: linkId,
      yanitTarihi: FieldValue.serverTimestamp(),
    });
    return { baglantiId: linkId };
  });
  return { ...result, durum: 'active' };
});


exports.ogrenciEslesmeTalebiniReddet = onCall({ region: REGION }, async (request) => {
  const teacherUid = requireAuth(request);
  await requireRole(teacherUid, 'ogretmen');
  const requestId = request.data?.talepId;
  if (typeof requestId !== 'string' || !requestId) {
    throw new HttpsError('invalid-argument', 'Eşleştirme talebi seçilmelidir.');
  }
  const ref = db.collection('ogrenciEslesmeTalepleri').doc(requestId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get('ogretmenUid') !== teacherUid) {
      throw new HttpsError('not-found', 'Eşleştirme talebi bulunamadı.');
    }
    if (snap.get('durum') !== 'bekliyor') {
      throw new HttpsError('failed-precondition', 'Bu talep daha önce işlenmiş.');
    }
    tx.update(ref, { durum: 'reddedildi', yanitTarihi: FieldValue.serverTimestamp() });
  });
  return { durum: 'reddedildi' };
});

exports.ogrenciBaglantisiniIptalEt = onCall({ region: REGION }, async (request) => {
  const teacherUid = requireAuth(request);
  await requireRole(teacherUid, 'ogretmen');
  const linkId = request.data?.baglantiId;
  if (typeof linkId !== 'string' || !linkId) {
    throw new HttpsError('invalid-argument', 'Öğrenci bağlantısı seçilmelidir.');
  }
  const ref = db.collection('ogretmenOgrenciBaglantilari').doc(linkId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get('ogretmenUid') !== teacherUid) {
      throw new HttpsError('not-found', 'Öğrenci bağlantısı bulunamadı.');
    }
    if (snap.get('durum') === 'revoked') return;
    const indexRef = db.collection('ogrenciKayitEslesmeleri').doc(createRecordLinkIndexId(teacherUid, snap.get('ogrenciKayitId')));
    const indexSnap = await tx.get(indexRef);
    tx.update(ref, { durum: 'revoked', iptalTarihi: FieldValue.serverTimestamp() });
    if (indexSnap.exists && indexSnap.get('baglantiId') === linkId) {
      tx.update(indexRef, { durum: 'revoked', iptalTarihi: FieldValue.serverTimestamp() });
    }
  });
  return { durum: 'revoked' };
});

exports.ogrenciBaglantiIzinleriniGuncelle = onCall({ region: REGION }, async (request) => {
  const teacherUid = requireAuth(request);
  await requireRole(teacherUid, 'ogretmen');
  const linkId = request.data?.baglantiId;
  const permissions = normalizePermissions(request.data?.izinler);
  if (typeof linkId !== 'string' || !linkId) {
    throw new HttpsError('invalid-argument', 'Öğrenci bağlantısı seçilmelidir.');
  }
  const ref = db.collection('ogretmenOgrenciBaglantilari').doc(linkId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get('ogretmenUid') !== teacherUid || snap.get('durum') !== 'active') {
      throw new HttpsError('not-found', 'Etkin öğrenci bağlantısı bulunamadı.');
    }
    tx.update(ref, { izinler: permissions, izinGuncelleme: FieldValue.serverTimestamp() });
  });
  return { durum: 'updated' };
});

exports.ogrenciOdevTamamlandiBildir = onCall({ region: REGION }, async (request) => {
  const studentUid = requireAuth(request);
  await requireRole(studentUid, 'ogrenci');
  const { baglantiId, odevId } = request.data || {};
  if (typeof baglantiId !== 'string' || typeof odevId !== 'string' || !baglantiId || !odevId) {
    throw new HttpsError('invalid-argument', 'Ödev ve öğretmen bağlantısı seçilmelidir.');
  }
  const linkRef = db.collection('ogretmenOgrenciBaglantilari').doc(baglantiId);
  const notificationId = sha256([studentUid, baglantiId, odevId].join(':'));
  const notificationRef = db.collection('ogrenciOdevBildirimleri').doc(notificationId);

  await db.runTransaction(async (tx) => {
    const linkSnap = await tx.get(linkRef);
    if (!linkSnap.exists || linkSnap.get('ogrenciUid') !== studentUid
      || linkSnap.get('durum') !== 'active' || linkSnap.get('izinler.odevler') !== true) {
      throw new HttpsError('permission-denied', 'Bu öğretmenin ödev paylaşım izni bulunmuyor.');
    }
    const link = linkSnap.data();
    const homeworkRef = db.collection('odevler').doc(odevId);
    const studentRef = db.collection('ogrenciler').doc(link.ogrenciKayitId);
    const [homeworkSnap, studentSnap, notificationSnap] = await Promise.all([tx.get(homeworkRef), tx.get(studentRef), tx.get(notificationRef)]);
    if (!studentSnap.exists || studentSnap.get('uid') !== link.ogretmenUid) {
      throw new HttpsError('permission-denied', 'Öğrenci kaydı artık etkin değil.');
    }
    if (!homeworkSnap.exists || homeworkSnap.get('uid') !== link.ogretmenUid
      || homeworkSnap.get('sinifId') !== link.sinifId) {
      throw new HttpsError('not-found', 'Paylaşılan ödev bulunamadı.');
    }
    const period = homeworkSnap.get('donemYili');
    if (!Number.isInteger(period)) {
      throw new HttpsError('failed-precondition', 'Ödevin akademik dönem bilgisi doğrulanamadı.');
    }
    if (!isAcademicPeriodEditable(period)) {
      throw new HttpsError('failed-precondition', 'Bu eğitim öğretim dönemi sona erdi. Eski dönem ödevleri artık yalnızca görüntülenebilir.');
    }
    if (Number.isInteger(link.donemYili) && period !== link.donemYili) {
      throw new HttpsError('permission-denied', 'Bu ödev, öğrenci bağlantısının akademik dönemine ait değil.');
    }
    const targeted = homeworkSnap.get('hedefOgrenciIds') || [];
    if (!targeted.includes(link.ogrenciKayitId)) {
      throw new HttpsError('permission-denied', 'Bu ödev bu öğrenciye verilmemiş.');
    }
    if (notificationSnap.exists) return;
    tx.create(notificationRef, {
      uid: link.ogretmenUid,
      ogrenciUid: studentUid,
      ogretmenUid: link.ogretmenUid,
      donemYili: period,
      ogrenciKayitId: link.ogrenciKayitId,
      baglantiId,
      odevId,
      odevAciklama: homeworkSnap.get('aciklama') || 'Ödev',
      teslimTarihi: homeworkSnap.get('teslimTarihi') || '',
      kitapAd: homeworkSnap.get('kitapAd') || '',
      sinifAd: link.sinifAd || '',
      ogrenciHesapAdi: link.ogrenciHesapAdi || '',
      durum: 'tamamlandi_bildirildi',
      bildirimTarihi: FieldValue.serverTimestamp(),
    });
  });
  return { durum: 'bildirildi' };
});

module.exports._test = {
  sha256,
  createPairingCode,
  isAllowedStudentGrade,
  createLinkId,
  createRecordLinkIndexId,
  assertStudentRecordAvailable,
  normalizeIdentityEmail,
  normalizeIdentityName,
  assertStudentIdentityMatches,
  istanbulDateString,
  isAcademicPeriodEditable,
  normalizePermissions,
  CODE_TTL_MS,
  PERMISSION_KEYS,
};
