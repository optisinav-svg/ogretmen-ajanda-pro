const { createHash } = require('node:crypto');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = getFirestore();
const REGION = 'europe-west1';
const GRADES = new Set(['1','2','3','4','5','6','7','8','9','10','11','12','TYT','AYT']);
const MAX_STUDENTS = 500;
const MAX_WRITES_PER_BATCH = 400;

function stableId(kind, targetYear, sourceId) {
  const digest = createHash('sha256').update(kind + ':' + targetYear + ':' + sourceId).digest('hex').slice(0, 24);
  return 'aktar_' + targetYear + '_' + digest;
}
function normalizedGrade(sourceGrade, requestedGrade) {
  const source = String(sourceGrade || '').trim().toUpperCase();
  if (['12','TYT','AYT'].includes(source)) return 'TYT';
  const target = String(requestedGrade || '').trim().toUpperCase();
  if (!GRADES.has(target)) throw new HttpsError('invalid-argument', 'Hedef kademe geçerli olmalıdır.');
  return target;
}
function isEditablePeriod(period, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const today = values.year + '-' + String(values.month).padStart(2, '0') + '-' + String(values.day).padStart(2, '0');
  return today >= period + '-06-01' && today <= (period + 1) + '-06-30';
}
function stripUndefined(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}
function resetTopicProgress(topic) {
  const copy = { ...topic };
  // Keep topic definition/page range; do not carry homework or completion history.
  for (const key of ['durum','odevDurumu','tamamlandi','tamamlanmaTarihi','ilerleme','ogrenciDurumlari','durumGecmisi','odevId']) delete copy[key];
  return copy;
}
function cleanSchoolOrClass(data) {
  const copy = { ...data };
  for (const key of ['arsivlendi','arsivDurumu','arsivBaslangic','arsivTarihi','silmeKilidi','aktarimKaynakId','aktarimKaynakDonem']) delete copy[key];
  return copy;
}
function cleanStudent(data) {
  const copy = { ...data };
  for (const key of ['sinifGecmisi','sinifGecmisiIds','sinifTasiIslemi','kayitsizTasiIslemi','kayitsizMi','kayitsizTarihi','aktarimKaynakId','aktarimKaynakDonem']) delete copy[key];
  return copy;
}
async function commitInChunks(operations) {
  for (let i = 0; i < operations.length; i += MAX_WRITES_PER_BATCH) {
    const batch = db.batch();
    for (const operation of operations.slice(i, i + MAX_WRITES_PER_BATCH)) {
      if (operation.type === 'create') batch.create(operation.ref, operation.data);
      else batch.set(operation.ref, operation.data, { merge: true });
    }
    await batch.commit();
  }
}
exports.ogretmenDonemAktariminiBaslat = onCall({ region: REGION, timeoutSeconds: 540, memory: '1GiB' }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Önce öğretmen hesabınıza giriş yapın.');
  const profile = await db.collection('kullanicilar').doc(uid).get();
  if (!profile.exists || profile.get('rol') !== 'ogretmen' || profile.get('hesapDurumu') === 'kapali') {
    throw new HttpsError('permission-denied', 'Etkin öğretmen hesabı gereklidir.');
  }

  const sourceYear = Number(request.data?.sourceYear);
  const targetYear = Number(request.data?.targetYear);
  const selections = request.data?.classes;
  if (!Number.isInteger(sourceYear) || !Number.isInteger(targetYear) || targetYear !== sourceYear + 1) {
    throw new HttpsError('invalid-argument', 'Aktarım ardışık iki eğitim dönemi arasında yapılmalıdır.');
  }
  if (!isEditablePeriod(targetYear)) {
    throw new HttpsError('failed-precondition', 'Hedef dönem henüz başlamadı veya düzenleme süresi sona erdi. Aktarım 1 Haziran–30 Haziran aralığında açık olan hedef dönem için yapılabilir.');
  }
  if (!Array.isArray(selections) || !selections.length || selections.length > 100) {
    throw new HttpsError('invalid-argument', 'Aktarılacak sınıfları seçin.');
  }

  const seenClasses = new Set();
  const globallySelectedStudents = new Set();
  const globallySelectedBooks = new Set();
  const normalizedSelections = selections.map(item => {
    const sourceClassId = typeof item?.sourceClassId === 'string' ? item.sourceClassId.trim() : '';
    const studentIds = Array.isArray(item?.studentIds) ? [...new Set(item.studentIds.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()))] : [];
    if (!sourceClassId || seenClasses.has(sourceClassId)) throw new HttpsError('invalid-argument', 'Sınıf seçimleri boş veya yinelenmiş olamaz.');
    seenClasses.add(sourceClassId);
    if (studentIds.length > MAX_STUDENTS) throw new HttpsError('invalid-argument', 'Tek aktarımda en fazla 500 öğrenci seçilebilir.');
    for (const id of studentIds) {
      if (globallySelectedStudents.has(id)) throw new HttpsError('invalid-argument', 'Bir öğrenci aynı aktarımda birden fazla sınıfta seçilemez.');
      globallySelectedStudents.add(id);
    }
    const bookIds = Array.isArray(item?.bookIds) ? [...new Set(item.bookIds.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()))] : [];
    for (const id of bookIds) {
      if (globallySelectedBooks.has(id)) throw new HttpsError('invalid-argument', 'Bir kitap aktarımda birden fazla kez seçilemez.');
      globallySelectedBooks.add(id);
    }
    return { sourceClassId, studentIds, bookIds, targetGrade: item.targetGrade };
  });
  const totalStudents = normalizedSelections.reduce((sum, item) => sum + item.studentIds.length, 0);
  if (totalStudents > MAX_STUDENTS) throw new HttpsError('resource-exhausted', 'Tek aktarımda en fazla 500 öğrenci seçilebilir.');

  const sourceClassRefs = normalizedSelections.map(x => db.collection('siniflar').doc(x.sourceClassId));
  const sourceClassSnaps = await db.getAll(...sourceClassRefs);
  const classById = new Map(sourceClassSnaps.map(s => [s.id, s]));
  const sourceSchoolIds = new Set();
  const studentIds = new Set(normalizedSelections.flatMap(x => x.studentIds));
  const sourceStudentRefs = [...studentIds].map(id => db.collection('ogrenciler').doc(id));
  const sourceStudentSnaps = await db.getAll(...sourceStudentRefs);
  const studentById = new Map(sourceStudentSnaps.map(s => [s.id, s]));

  const classPlans = [];
  const schoolPlans = new Map();
  for (const selection of normalizedSelections) {
    const sourceClass = classById.get(selection.sourceClassId);
    if (!sourceClass?.exists || sourceClass.get('uid') !== uid || Number(sourceClass.get('donemYili')) !== sourceYear || sourceClass.get('ozelTur') || sourceClass.get('arsivlendi') || sourceClass.get('arsivDurumu') === 'isleniyor') {
      throw new HttpsError('failed-precondition', 'Seçilen kaynak sınıf öğretmene ait, etkin ve kaynak döneme kayıtlı olmalıdır.');
    }
    const source = sourceClass.data();
    const schoolId = typeof source.okulId === 'string' ? source.okulId : '';
    if (!schoolId) throw new HttpsError('failed-precondition', 'Okul bağlantısı olmayan sınıf aktarılamaz.');
    sourceSchoolIds.add(schoolId);
    const targetGrade = normalizedGrade(source.kademe, selection.targetGrade);
    const students = selection.studentIds.map(id => {
      const snap = studentById.get(id);
      if (!snap?.exists || snap.get('uid') !== uid || snap.get('sinifId') !== sourceClass.id || Number(snap.get('donemYili')) !== sourceYear) {
        throw new HttpsError('failed-precondition', 'Seçilen öğrencilerden biri kaynak sınıfta veya kaynak dönemde bulunmuyor.');
      }
      return { id, snap, data: snap.data() };
    });
    classPlans.push({ sourceClassId: sourceClass.id, sourceClass: source, schoolId, targetGrade, students });
  }

  const sourceSchoolRefs = [...sourceSchoolIds].map(id => db.collection('okullar').doc(id));
  const sourceSchoolSnaps = await db.getAll(...sourceSchoolRefs);
  const schoolById = new Map(sourceSchoolSnaps.map(s => [s.id, s]));
  for (const id of sourceSchoolIds) {
    const snap = schoolById.get(id);
    if (!snap?.exists || snap.get('uid') !== uid || Number(snap.get('donemYili')) !== sourceYear || snap.get('arsivlendi') || snap.get('arsivDurumu') === 'isleniyor') {
      throw new HttpsError('failed-precondition', 'Aktarılacak sınıflardan birinin okulu kaynak dönemde etkin değil.');
    }
    schoolPlans.set(id, { source: snap.data(), targetId: stableId('school', targetYear, id) });
  }

  // Load only selected students' assigned books and topics. Old-period docs are never modified.
  const [bookSnap, topicSnap] = await Promise.all([
    db.collection('kitaplar').where('uid', '==', uid).where('donemYili', '==', sourceYear).get(),
    db.collection('konular').where('uid', '==', uid).where('donemYili', '==', sourceYear).get(),
  ]);
  const selectedStudentIds = new Set([...studentIds]);
  const selectedBookIds = new Set(normalizedSelections.flatMap(x => x.bookIds));
  const books = bookSnap.docs.filter(s => selectedBookIds.has(s.id));
  if (books.length !== selectedBookIds.size) throw new HttpsError('failed-precondition', 'Seçilen kitaplardan biri kaynak dönemde bulunamadı.');
  for (const selection of normalizedSelections) {
    const studentSet = new Set(selection.studentIds);
    for (const bookId of selection.bookIds) {
      const book = books.find(x => x.id === bookId);
      if (!book || !studentSet.has(book.get('ogrenciId')) || book.get('sinifId') !== selection.sourceClassId) {
        throw new HttpsError('failed-precondition', 'Seçilen kitap, aynı sınıfta seçilmiş bir öğrenciye ait değil.');
      }
    }
  }
  const bookIds = new Set(books.map(s => s.id));
  const topics = topicSnap.docs.filter(s => bookIds.has(s.get('kitapId')));

  const operations = [];
  const schoolIdMap = new Map();
  const classIdMap = new Map();
  const studentIdMap = new Map();
  const bookIdMap = new Map();

  for (const [sourceSchoolId, plan] of schoolPlans) {
    const targetId = plan.targetId;
    schoolIdMap.set(sourceSchoolId, targetId);
    const ref = db.collection('okullar').doc(targetId);
    const existing = await ref.get();
    if (existing.exists && (existing.get('aktarimKaynakId') !== sourceSchoolId || existing.get('uid') !== uid || Number(existing.get('donemYili')) !== targetYear)) {
      throw new HttpsError('already-exists', 'Hedef dönemde aktarım kimliğiyle çakışan okul kaydı var.');
    }
    if (!existing.exists) operations.push({ type: 'create', ref, data: { ...cleanSchoolOrClass(plan.source), uid, donemYili: targetYear, aktarimKaynakId: sourceSchoolId, aktarimKaynakDonem: sourceYear, olusturulma: new Date().toISOString(), arsivlendi: false } });
  }

  for (const plan of classPlans) {
    const targetId = stableId('class', targetYear, plan.sourceClassId);
    classIdMap.set(plan.sourceClassId, targetId);
    const ref = db.collection('siniflar').doc(targetId);
    const existing = await ref.get();
    if (existing.exists && (existing.get('aktarimKaynakId') !== plan.sourceClassId || existing.get('uid') !== uid || Number(existing.get('donemYili')) !== targetYear)) {
      throw new HttpsError('already-exists', 'Hedef dönemde aktarım kimliğiyle çakışan sınıf kaydı var.');
    }
    if (existing.exists && existing.get('kademe') !== plan.targetGrade) {
      throw new HttpsError('failed-precondition', 'Bu kaynak sınıf hedef döneme daha önce farklı bir kademeyle aktarılmış. Var olan aktarım otomatik değiştirilmedi.');
    }
    if (!existing.exists) operations.push({ type: 'create', ref, data: { ...cleanSchoolOrClass(plan.sourceClass), uid, donemYili: targetYear, okulId: schoolIdMap.get(plan.schoolId), okulAd: schoolPlans.get(plan.schoolId).source.ad || plan.sourceClass.okulAd || '', kademe: plan.targetGrade, aktarimKaynakId: plan.sourceClassId, aktarimKaynakDonem: sourceYear, olusturulma: new Date().toISOString(), arsivlendi: false } });
    for (const student of plan.students) {
      const newStudentId = stableId('student', targetYear, student.id);
      studentIdMap.set(student.id, newStudentId);
      const studentRef = db.collection('ogrenciler').doc(newStudentId);
      const studentExisting = await studentRef.get();
      if (studentExisting.exists && (studentExisting.get('aktarimKaynakId') !== student.id || studentExisting.get('uid') !== uid || Number(studentExisting.get('donemYili')) !== targetYear)) {
        throw new HttpsError('already-exists', 'Hedef dönemde aktarım kimliğiyle çakışan öğrenci kaydı var.');
      }
      if (studentExisting.exists && (studentExisting.get('sinifId') !== targetId || studentExisting.get('kademe') !== plan.targetGrade)) {
        throw new HttpsError('failed-precondition', 'Bu öğrenci hedef döneme daha önce farklı sınıf veya kademeyle aktarılmış. Var olan aktarım otomatik değiştirilmedi.');
      }
      if (!studentExisting.exists) operations.push({ type: 'create', ref: studentRef, data: {
        ...cleanStudent(student.data), uid, donemYili: targetYear, sinifId: targetId,
        sinifAd: plan.sourceClass.ad || '', okulId: schoolIdMap.get(plan.schoolId),
        okulAd: schoolPlans.get(plan.schoolId).source.ad || '',
        kademe: plan.targetGrade, brans: plan.sourceClass.ders || student.data.brans || '',
        adSoyad: student.data.adSoyad || [student.data.ad, student.data.soyad].filter(Boolean).join(' '),
        aktarimKaynakId: student.id, aktarimKaynakDonem: sourceYear,
        olusturulma: new Date().toISOString(), kayitsizMi: false,
      } });
    }
  }

  const bookSourceById = new Map(books.map(s => [s.id, s]));
  for (const book of books) {
    const source = book.data();
    const newBookId = stableId('book', targetYear, book.id);
    bookIdMap.set(book.id, newBookId);
    const newStudentId = studentIdMap.get(source.ogrenciId);
    const newClassId = classIdMap.get(source.sinifId);
    if (!newStudentId || !newClassId) continue;
    const plan = classPlans.find(x => x.sourceClassId === source.sinifId);
    const ref = db.collection('kitaplar').doc(newBookId);
    const existing = await ref.get();
    if (existing.exists && (existing.get('aktarimKaynakId') !== book.id || existing.get('uid') !== uid || Number(existing.get('donemYili')) !== targetYear)) {
      throw new HttpsError('already-exists', 'Hedef dönemde aktarım kimliğiyle çakışan kitap kaydı var.');
    }
    if (existing.exists && (existing.get('ogrenciId') !== newStudentId || existing.get('sinifId') !== newClassId)) {
      throw new HttpsError('failed-precondition', 'Bu kitap hedef döneme farklı öğrenci veya sınıfla aktarılmış. Var olan aktarım otomatik değiştirilmedi.');
    }
    if (!existing.exists) operations.push({ type: 'create', ref, data: {
      ad: source.ad, sayfaSayisi: source.sayfaSayisi, uid, donemYili: targetYear,
      ogrenciId: newStudentId, ogrenciAd: source.ogrenciAd,
      sinifId: newClassId, sinifAd: plan?.sourceClass.ad || '',
      okulId: schoolIdMap.get(plan?.schoolId) || '', okulAd: schoolPlans.get(plan?.schoolId)?.source.ad || '',
      kademe: plan?.targetGrade || source.kademe || '', brans: plan?.sourceClass.ders || source.brans || '',
      kitapKutuphanesiId: source.kitapKutuphanesiId || null,
      aktarimKaynakId: book.id, aktarimKaynakDonem: sourceYear,
      olusturulma: new Date().toISOString(),
    } });
  }

  // Carry active student-account permissions to the newly created student record.
  const activeIndexesSnap = await db.collection('ogrenciKayitEslesmeleri').where('ogretmenUid', '==', uid).get();
  const selectedIndexByStudent = new Map(activeIndexesSnap.docs
    .filter(index => selectedStudentIds.has(index.get('ogrenciKayitId')) && index.get('durum') === 'active')
    .map(index => [index.get('ogrenciKayitId'), index]));
  const sourceLinkRefs = [...selectedIndexByStudent.values()]
    .map(index => db.collection('ogretmenOgrenciBaglantilari').doc(index.get('baglantiId')));
  const sourceLinkSnaps = sourceLinkRefs.length ? await db.getAll(...sourceLinkRefs) : [];
  const sourceLinkById = new Map(sourceLinkSnaps.filter(link => link.exists && link.get('durum') === 'active').map(link => [link.id, link]));
  let transferredLinkCount = 0;
  for (const [sourceStudentId, index] of selectedIndexByStudent) {
    const sourceLink = sourceLinkById.get(index.get('baglantiId'));
    const newStudentId = studentIdMap.get(sourceStudentId);
    const plan = classPlans.find(item => item.students.some(student => student.id === sourceStudentId));
    if (!sourceLink || !newStudentId || !plan || !['9','10','11','12','TYT','AYT'].includes(String(plan.targetGrade))) continue;
    const linkData = sourceLink.data();
    const targetLinkId = [uid, linkData.ogrenciUid, classIdMap.get(plan.sourceClassId)].join('__');
    const targetLinkRef = db.collection('ogretmenOgrenciBaglantilari').doc(targetLinkId);
    const targetIndexRef = db.collection('ogrenciKayitEslesmeleri').doc([uid, newStudentId].join('__'));
    const [targetLinkSnap, targetIndexSnap] = await Promise.all([targetLinkRef.get(), targetIndexRef.get()]);
    if (targetLinkSnap.exists && (targetLinkSnap.get('ogrenciUid') !== linkData.ogrenciUid || targetLinkSnap.get('ogrenciKayitId') !== newStudentId || targetLinkSnap.get('ogretmenUid') !== uid)) {
      throw new HttpsError('already-exists', 'Hedef dönemde öğrenci hesap bağlantısı kimliğiyle çakışma var.');
    }
    if (targetIndexSnap.exists && (targetIndexSnap.get('ogrenciUid') !== linkData.ogrenciUid || targetIndexSnap.get('ogrenciKayitId') !== newStudentId || targetIndexSnap.get('ogretmenUid') !== uid)) {
      throw new HttpsError('already-exists', 'Hedef dönemde öğrenci bağlantı indeksi kimliğiyle çakışma var.');
    }
    if (!targetLinkSnap.exists) operations.push({ type: 'create', ref: targetLinkRef, data: {
      ...linkData,
      uid, ogretmenUid: uid, ogrenciUid: linkData.ogrenciUid,
      ogrenciKayitId: newStudentId, sinifId: classIdMap.get(plan.sourceClassId),
      sinifAd: plan.sourceClass.ad || '', okulAd: schoolPlans.get(plan.schoolId).source.ad || '',
      donemYili: targetYear, kademe: plan.targetGrade, ders: plan.sourceClass.ders || '',
      ogrenciAd: studentById.get(sourceStudentId)?.get('adSoyad') || linkData.ogrenciAd || '',
      durum: 'active', iptalTarihi: null, aktarimKaynakBaglantiId: index.get('baglantiId'),
      olusturulma: FieldValue.serverTimestamp(),
    }});
    if (!targetIndexSnap.exists) operations.push({ type: 'create', ref: targetIndexRef, data: {
      uid, ogretmenUid: uid, ogrenciKayitId: newStudentId, ogrenciUid: linkData.ogrenciUid,
      sinifId: classIdMap.get(plan.sourceClassId), baglantiId: targetLinkId,
      donemYili: targetYear, durum: 'active', guncellenme: FieldValue.serverTimestamp(),
    }});
    transferredLinkCount += 1;
  }

  const topicOps = [];
  for (const topic of topics) {
    const source = topic.data();
    const newBookId = bookIdMap.get(source.kitapId);
    const newStudentId = studentIdMap.get(source.ogrenciId);
    if (!newBookId || !newStudentId) continue;
    const newTopicId = stableId('topic', targetYear, topic.id);
    const ref = db.collection('konular').doc(newTopicId);
    const existing = await ref.get();
    if (existing.exists && (existing.get('aktarimKaynakId') !== topic.id || existing.get('uid') !== uid || Number(existing.get('donemYili')) !== targetYear)) {
      throw new HttpsError('already-exists', 'Hedef dönemde aktarım kimliğiyle çakışan konu kaydı var.');
    }
    if (existing.exists && (existing.get('kitapId') !== newBookId || existing.get('ogrenciId') !== newStudentId)) {
      throw new HttpsError('failed-precondition', 'Bu konu hedef döneme farklı kitap veya öğrenciyle aktarılmış. Var olan aktarım otomatik değiştirilmedi.');
    }
    if (!existing.exists) {
      const plan = classPlans.find(x => x.sourceClassId === source.sinifId);
      const clean = resetTopicProgress(source);
      topicOps.push({ type: 'create', ref, data: stripUndefined({
        ...clean, uid, donemYili: targetYear, kitapId: newBookId,
        ogrenciId: newStudentId, sinifId: classIdMap.get(source.sinifId),
        sinifAd: plan?.sourceClass.ad || '', okulId: schoolIdMap.get(plan?.schoolId) || '',
        okulAd: schoolPlans.get(plan?.schoolId)?.source.ad || '',
        kademe: plan?.targetGrade || source.kademe || '',
        brans: plan?.sourceClass.ders || source.brans || '',
        aktarimKaynakId: topic.id, aktarimKaynakDonem: sourceYear,
        olusturulma: new Date().toISOString(),
      }) });
    }
  }

  await commitInChunks([...operations, ...topicOps]);
  return {
    durum: 'tamamlandi', sourceYear, targetYear,
    okulSayisi: schoolPlans.size, sinifSayisi: classPlans.length,
    ogrenciSayisi: studentIds.size, kitapSayisi: books.length, konuSayisi: topicOps.length,
    sinifHaritasi: Object.fromEntries(classIdMap), ogrenciHaritasi: Object.fromEntries(studentIdMap),
  };
});

exports._test = { stableId, normalizedGrade, resetTopicProgress, isEditablePeriod, cleanSchoolOrClass, cleanStudent };
