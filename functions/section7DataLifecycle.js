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

async function queryTeacherDocs(collectionName, teacherUid) {
  const snap = await db.collection(collectionName).where('uid', '==', teacherUid).get();
  return snap.docs;
}

async function deleteTeacherLocalStudentRecord(teacherUid, studentRecordId) {
  const studentRef = db.collection('ogrenciler').doc(studentRecordId);
  const studentSnap = await studentRef.get();
  if (!studentSnap.exists || studentSnap.get('uid') !== teacherUid) {
    throw new HttpsError('not-found', 'Öğretmene ait öğrenci kaydı bulunamadı.');
  }
  const student = studentSnap.data();
  if (student.kayitsizMi !== true) {
    throw new HttpsError('failed-precondition', 'Kalıcı silme yalnızca Kayıtsız Öğrenciler sınıfındaki kayıtlar için yapılabilir.');
  }
  if (student.sinifTasiIslemi || student.kayitsizTasiIslemi) {
    throw new HttpsError('failed-precondition', 'Öğrenci taşıma işlemi tamamlanmadan kayıt silinemez.');
  }

  const deleted = {};
  for (const collectionName of STUDENT_CHILD_COLLECTIONS) {
    const docs = await queryTeacherDocs(collectionName, teacherUid);
    const matched = docs.filter(doc => doc.get('ogrenciId') === studentRecordId);
    await deleteInChunks(matched.map(doc => doc.ref));
    deleted[collectionName] = matched.length;
  }

  // Sınıf ödevlerinde yalnızca bu öğrenci hedef listesinden çıkarılır.
  const homeworkDocs = await queryTeacherDocs('odevler', teacherUid);
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
  const [links, indexes, requests, completionNotices, newHomeworkNotices] = await Promise.all([
    db.collection('ogretmenOgrenciBaglantilari').where('ogretmenUid', '==', teacherUid).get(),
    db.collection('ogrenciKayitEslesmeleri').where('ogretmenUid', '==', teacherUid).get(),
    db.collection('ogrenciEslesmeTalepleri').where('ogretmenUid', '==', teacherUid).get(),
    db.collection('ogrenciOdevBildirimleri').where('ogretmenUid', '==', teacherUid).get(),
    db.collection('ogrenciYeniOdevBildirimleri').where('ogretmenUid', '==', teacherUid).get(),
  ]);
  const relatedLinks = links.docs.filter(doc => doc.get('ogrenciKayitId') === studentRecordId);
  const relatedIndexes = indexes.docs.filter(doc => doc.get('ogrenciKayitId') === studentRecordId);
  const relatedRequests = requests.docs.filter(doc => doc.get('ogrenciKayitId') === studentRecordId);
  const relatedCompletionNotices = completionNotices.docs.filter(doc => doc.get('ogrenciKayitId') === studentRecordId);
  const relatedNewHomeworkNotices = newHomeworkNotices.docs.filter(doc => doc.get('ogrenciKayitId') === studentRecordId);
  await deleteInChunks([
    ...relatedLinks, ...relatedIndexes, ...relatedRequests,
    ...relatedCompletionNotices, ...relatedNewHomeworkNotices,
  ].map(doc => doc.ref));
  deleted.ogretmenOgrenciBaglantilari = relatedLinks.length;
  deleted.ogrenciKayitEslesmeleri = relatedIndexes.length;
  deleted.ogrenciEslesmeTalepleri = relatedRequests.length;
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
]);
function istanbulDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { year: Number(values.year), month: Number(values.month) };
}
async function claimCleanup(lockRef, ownerUid, year, targetYear, token) {
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
    tx.set(lockRef, { ...patch, leaseExpiresAt: new Date(Date.now() + 10 * 60 * 1000) }, { merge: true });
  });
}
exports.uygulamaSahibiDonemTemizliginiOnayla = onCall({ region: REGION, timeoutSeconds: 540, memory: '1GiB' }, async request => {
  const ownerUid = requireTeacher(request);
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
  await claimCleanup(lockRef, ownerUid, year, targetYear, token);
  const counts = {};
  try {
    for (const collectionName of RETENTION_COLLECTIONS) {
      let deleted = Number((await lockRef.get()).get('counts')?.[collectionName] || 0);
      while (true) {
        const page = await db.collection(collectionName)
          .where('donemYili', '==', targetYear).limit(350).get();
        if (page.empty) break;
        await deleteInChunks(page.docs.map(doc => doc.ref));
        deleted += page.size;
        counts[collectionName] = deleted;
        await updateCleanupState(lockRef, token, { counts: { ...(await lockRef.get()).get('counts'), ...counts } });
      }
      counts[collectionName] = deleted;
    }
    const totalDeleted = Object.values(counts).reduce((sum, count) => sum + count, 0);
    await updateCleanupState(lockRef, token, {
      status: 'completed', counts, totalDeleted,
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
