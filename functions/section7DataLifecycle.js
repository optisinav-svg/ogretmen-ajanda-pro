const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { randomUUID } = require('node:crypto');

const db = getFirestore();
const REGION = 'europe-west1';
const STUDENT_CHILD_COLLECTIONS = [
  'yoklamalar',
  'kitaplar',
  'konular',
  'bireyselEtkinlikler',
  'bireyselDersOturumlari',
  'dersNotlari',
];


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

function requireTeacher(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Önce hesabınıza giriş yapın.');
  return request.auth.uid;
}

async function deleteInChunks(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

async function queryStudentDocs(collectionName, field, value, teacherUid, ownerField = 'uid', operator = '==') {
  const snap = await db.collection(collectionName).where(field, operator, value).get();
  return snap.docs.filter(doc => doc.get(ownerField) === teacherUid || doc.get('uid') === teacherUid);
}

async function deleteTeacherLocalStudentRecord(teacherUid, studentRecordId) {
  const studentRef = db.collection('ogrenciler').doc(studentRecordId);
  const studentSnap = await studentRef.get();
  if (!studentSnap.exists || studentSnap.get('uid') !== teacherUid) {
    throw new HttpsError('not-found', 'Öğretmene ait öğrenci kaydı bulunamadı.');
  }
  const student = studentSnap.data();
  if (!isCurrentAcademicPeriodEditable(student.donemYili)) {
    throw new HttpsError('failed-precondition', 'Geçmiş dönem öğrenci kayıtları kalıcı silinemez; üç yıllık saklama ve uygulama sahibi onayı süreci uygulanır.');
  }
  const classSnap = typeof student.sinifId === 'string'
    ? await db.collection('siniflar').doc(student.sinifId).get()
    : null;
  if (!classSnap?.exists || classSnap.get('uid') !== teacherUid
    || classSnap.get('donemYili') !== student.donemYili
    || classSnap.get('ozelTur') !== 'kayitsiz') {
    throw new HttpsError('failed-precondition', 'Kalıcı silme yalnızca Kayıtsız Öğrenciler sınıfında bulunan öğrenci kayıtları için yapılabilir.');
  }
  if (student.sinifTasiIslemi || student.kayitsizTasiIslemi) {
    throw new HttpsError('failed-precondition', 'Öğrenci taşıma işlemi tamamlanmadan kayıt silinemez.');
  }

  const deleted = {};
  for (const collectionName of STUDENT_CHILD_COLLECTIONS) {
    const matched = await queryStudentDocs(collectionName, 'ogrenciId', studentRecordId, teacherUid);
    await deleteInChunks(matched.map(doc => doc.ref));
    deleted[collectionName] = matched.length;
  }

  // Sınıf ödevlerinde yalnızca bu öğrenci hedef listesinden çıkarılır.
  const homeworkDocs = await queryStudentDocs('odevler', 'hedefOgrenciIds', studentRecordId, teacherUid, 'uid', 'array-contains');
  let homeworkUpdated = 0;
  let homeworkDeleted = 0;
  for (let i = 0; i < homeworkDocs.length; i += 300) {
    const batch = db.batch();
    let writes = 0;
    for (const item of homeworkDocs.slice(i, i + 300)) {
      const data = item.data();
      const targets = Array.isArray(data.hedefOgrenciIds) ? data.hedefOgrenciIds : [];
      if (!targets.includes(studentRecordId)) continue;
      const nextTargets = targets.filter(id => id !== studentRecordId);
      if (!nextTargets.length) {
        batch.delete(item.ref);
        homeworkDeleted += 1;
      } else {
        const updates = { hedefOgrenciIds: nextTargets };
        for (const field of ['ogrenciDurumlari', 'konuEslestirmeleri']) {
          if (data[field] && typeof data[field] === 'object' && !Array.isArray(data[field])) {
            const nextMap = { ...data[field] };
            delete nextMap[studentRecordId];
            updates[field] = nextMap;
          }
        }
        batch.update(item.ref, updates);
        homeworkUpdated += 1;
      }
      writes += 1;
    }
    if (writes) await batch.commit();
  }
  deleted.odevler = homeworkDeleted;
  deleted.odevlerGuncellendi = homeworkUpdated;

  // Yalnızca bu öğretmenin öğrenci bağlantısı ve kayıt indeksi kaldırılır.
  const [relatedLinks, relatedIndexes, relatedRequests, relatedPairingCodes, relatedCompletionNotices, relatedNewHomeworkNotices] = await Promise.all([
    queryStudentDocs('ogretmenOgrenciBaglantilari', 'ogrenciKayitId', studentRecordId, teacherUid, 'ogretmenUid'),
    queryStudentDocs('ogrenciKayitEslesmeleri', 'ogrenciKayitId', studentRecordId, teacherUid, 'ogretmenUid'),
    queryStudentDocs('ogrenciEslesmeTalepleri', 'ogrenciKayitId', studentRecordId, teacherUid, 'ogretmenUid'),
    queryStudentDocs('ogrenciEslesmeKodlari', 'ogrenciKayitId', studentRecordId, teacherUid),
    queryStudentDocs('ogrenciOdevBildirimleri', 'ogrenciKayitId', studentRecordId, teacherUid, 'ogretmenUid'),
    queryStudentDocs('ogrenciYeniOdevBildirimleri', 'ogrenciKayitId', studentRecordId, teacherUid, 'ogretmenUid'),
  ]);
  await deleteInChunks([
    ...relatedLinks, ...relatedIndexes, ...relatedRequests, ...relatedPairingCodes,
    ...relatedCompletionNotices, ...relatedNewHomeworkNotices,
  ].map(doc => doc.ref));
  deleted.ogretmenOgrenciBaglantilari = relatedLinks.length;
  deleted.ogrenciKayitEslesmeleri = relatedIndexes.length;
  deleted.ogrenciEslesmeTalepleri = relatedRequests.length;
  deleted.ogrenciEslesmeKodlari = relatedPairingCodes.length;
  deleted.ogrenciOdevBildirimleri = relatedCompletionNotices.length;
  deleted.ogrenciYeniOdevBildirimleri = relatedNewHomeworkNotices.length;

  await studentRef.delete();
  return { deleted, studentAccountPreserved: true };
}

exports.ogretmenOgrenciKaydiniKaliciSil = onCall({ region: REGION, timeoutSeconds: 540, memory: '512MiB' }, async request => {
  const teacherUid = requireTeacher(request);
  const studentRecordId = request.data?.ogrenciKayitId;
  if (typeof studentRecordId !== 'string' || !studentRecordId.trim()) {
    throw new HttpsError('invalid-argument', 'Silinecek öğrenci kaydı seçilmelidir.');
  }
  if (request.data?.confirm !== true) {
    throw new HttpsError('failed-precondition', 'Kalıcı silme için açık onay gereklidir.');
  }
  const profile = await db.collection('kullanicilar').doc(teacherUid).get();
  if (!profile.exists || profile.get('rol') !== 'ogretmen') {
    throw new HttpsError('permission-denied', 'Bu işlem yalnızca öğretmen hesabı tarafından yapılabilir.');
  }
  return deleteTeacherLocalStudentRecord(teacherUid, studentRecordId);
});

const RETENTION_COLLECTIONS = Object.freeze([
  'dersler', 'dersNotlari', 'yoklamalar', 'odevler', 'kitaplar', 'konular',
  'bireyselEtkinlikler', 'bireyselDersOturumlari',
  'ogrenciler', 'siniflar', 'okullar',
  'ogretmenOgrenciBaglantilari', 'ogrenciKayitEslesmeleri',
  'ogrenciEslesmeTalepleri', 'ogrenciEslesmeKodlari',
  'ogrenciOdevBildirimleri', 'ogrenciYeniOdevBildirimleri',
]);
function istanbulDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { year: Number(values.year), month: Number(values.month) };
}
async function claimCleanup(lockRef, ownerUid, year, targetYear, token, plannedCounts) {
  return db.runTransaction(async tx => {
    const snap = await tx.get(lockRef);
    const now = Date.now();
    if (snap.exists) {
      const state = snap.data();
      if (state.status === 'completed') throw new HttpsError('already-exists', 'Bu yılın dönem temizliği zaten tamamlandı.');
      const leaseEnd = state.leaseExpiresAt?.toMillis?.() || 0;
      if (state.status === 'running' && leaseEnd > now) {
        throw new HttpsError('aborted', 'Başka bir temizlik işlemi devam ediyor. Daha sonra tekrar deneyin.');
      }
    }
    tx.set(lockRef, {
      cleanupId: String(year), currentYear: year, targetYear,
      status: 'running', leaseToken: token,
      leaseExpiresAt: new Date(now + 10 * 60 * 1000),
      startedBy: ownerUid, startedAt: FieldValue.serverTimestamp(),
      counts: snap.exists ? (snap.get('counts') || {}) : {},
      plannedCounts: snap.exists ? (snap.get('plannedCounts') || plannedCounts) : plannedCounts,
      policyVersion: 2,
    }, { merge: true });
  });
}
async function updateCleanupState(lockRef, token, patch) {
  await db.runTransaction(async tx => {
    const snap = await tx.get(lockRef);
    if (!snap.exists || snap.get('leaseToken') !== token || snap.get('status') !== 'running') {
      throw new HttpsError('aborted', 'Temizlik işlemi kilidi kaybedildi; güvenlik için işlem durduruldu.');
    }
    const update = { ...patch };
    update.leaseExpiresAt = patch.status === 'running'
      ? new Date(Date.now() + 10 * 60 * 1000)
      : FieldValue.delete();
    tx.set(lockRef, update, { merge: true });
  });
}
exports.uygulamaSahibiDonemTemizliginiOnizle = onCall({ region: REGION }, async request => {
  const ownerUid = requireTeacher(request);
  const ownerProfile = await db.collection('kullanicilar').doc(ownerUid).get();
  if (!ownerProfile.exists || ownerProfile.get('rol') !== 'ogretmen') {
    throw new HttpsError('permission-denied', 'Uygulama sahibi işlemi öğretmen profiline bağlı olmalıdır.');
  }
  if (request.auth.token.uygulamaSahibi !== true) {
    throw new HttpsError('permission-denied', 'Uygulama sahibi yetkisi gereklidir.');
  }
  const { year, month } = istanbulDateParts();
  if (month !== 7 || year < 2029) {
    throw new HttpsError('failed-precondition', 'Önizleme yalnızca Temmuz ayında ve üç yıllık saklama süresi dolduğunda açılır.');
  }
  const targetYear = year - 3;
  const lock = await db.collection('donemTemizlikKayitlari').doc(String(year)).get();
  if (lock.exists && lock.get('status') === 'completed') {
    return { status: 'completed', targetYear, counts: lock.get('counts') || {}, total: lock.get('totalDeleted') || 0 };
  }
  if (lock.exists && lock.get('status') === 'running') {
    const leaseEnd = lock.get('leaseExpiresAt')?.toMillis?.() || 0;
    if (leaseEnd > Date.now()) {
      return { status: 'running', targetYear, counts: lock.get('plannedCounts') || {}, total: 0 };
    }
  }
  if (lock.exists && lock.get('status') === 'failed' && lock.get('plannedCounts')) {
    const counts = lock.get('plannedCounts');
    return {
      status: 'failed', targetYear, counts,
      total: Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0),
    };
  }
  const entries = await Promise.all(RETENTION_COLLECTIONS.map(async name => {
    const count = await db.collection(name).where('donemYili', '==', targetYear).count().get();
    return [name, count.data().count];
  }));
  const counts = Object.fromEntries(entries);
  return { status: 'pending', targetYear, counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0) };
});

exports.uygulamaSahibiDonemTemizliginiOnayla = onCall({ region: REGION, timeoutSeconds: 540, memory: '1GiB' }, async request => {
  const ownerUid = requireTeacher(request);
  const ownerProfile = await db.collection('kullanicilar').doc(ownerUid).get();
  if (!ownerProfile.exists || ownerProfile.get('rol') !== 'ogretmen') {
    throw new HttpsError('permission-denied', 'Uygulama sahibi işlemi öğretmen profiline bağlı olmalıdır.');
  }
  if (request.auth.token.uygulamaSahibi !== true) {
    throw new HttpsError('permission-denied', 'Uygulama sahibi yetkisi gereklidir.');
  }
  if (request.data?.confirm !== true) {
    throw new HttpsError('failed-precondition', 'Silme işlemi için açık uygulama sahibi onayı gereklidir.');
  }
  const { year, month } = istanbulDateParts();
  if (month !== 7 || year < 2029) {
    throw new HttpsError('failed-precondition', 'Dönem temizliği yalnızca Temmuz ayında ve üç yıllık saklama süresi dolduğunda yapılabilir.');
  }
  const targetYear = year - 3;
  const token = randomUUID();
  const lockRef = db.collection('donemTemizlikKayitlari').doc(String(year));
  const existingLock = await lockRef.get();
  const plannedCounts = existingLock.exists && existingLock.get('plannedCounts')
    ? existingLock.get('plannedCounts')
    : Object.fromEntries(await Promise.all(RETENTION_COLLECTIONS.map(async name => {
      const count = await db.collection(name).where('donemYili', '==', targetYear).count().get();
      return [name, count.data().count];
    })));
  await claimCleanup(lockRef, ownerUid, year, targetYear, token, plannedCounts);
  const counts = {};
  try {
    for (const collectionName of RETENTION_COLLECTIONS) {
      while (true) {
        const page = await db.collection(collectionName)
          .where('donemYili', '==', targetYear).limit(350).get();
        if (page.empty) break;
        await deleteInChunks(page.docs.map(doc => doc.ref));
      }
      // The original planned count remains the audit total even if a retry
      // resumes after a batch committed but before its progress update.
      counts[collectionName] = Number(plannedCounts[collectionName] || 0);
      await updateCleanupState(lockRef, token, { counts: { ...(await lockRef.get()).get('counts'), ...counts } });
    }
    const totalDeleted = Object.values(plannedCounts).reduce((sum, count) => sum + Number(count || 0), 0);
    await updateCleanupState(lockRef, token, {
      status: 'completed', counts: plannedCounts, totalDeleted,
      completedBy: ownerUid, completedAt: FieldValue.serverTimestamp(),
      leaseToken: FieldValue.delete(), leaseExpiresAt: FieldValue.delete(),
    });
    return { status: 'completed', targetYear, counts, totalDeleted };
  } catch (error) {
    try {
      await updateCleanupState(lockRef, token, {
        status: 'failed', counts,
        lastError: String(error?.message || error).slice(0, 500),
        failedAt: FieldValue.serverTimestamp(),
        leaseToken: FieldValue.delete(), leaseExpiresAt: FieldValue.delete(),
      });
    } catch (_) {}
    throw error;
  }
});
