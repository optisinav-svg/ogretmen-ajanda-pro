const { getFirestore, FieldPath } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const REGION = 'europe-west1';
const PAGE_SIZE = 500;

function isApplicationOwner(request) {
  return request?.auth?.token?.uygulamaSahibi === true;
}

async function readCollection(db, collectionName, selectedFields, filters = []) {
  const records = [];
  let cursor = null;
  while (true) {
    let page = db.collection(collectionName);
    for (const [field, value] of filters) page = page.where(field, '==', value);
    if (selectedFields?.length) page = page.select(...selectedFields);
    page = page.orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);
    if (cursor) page = page.startAfter(cursor);
    const snapshot = await page.get();
    if (snapshot.empty) break;
    records.push(...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    cursor = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < PAGE_SIZE) break;
  }
  return records;
}

function buildStatistics(teacherProfiles, links, requests, studentAccountCount) {
  const teachers = new Map();
  for (const profile of teacherProfiles) {
    teachers.set(profile.id, {
      displayName: String(profile.kullaniciAdi || 'Öğretmen hesabı').slice(0, 80),
      branch: String(profile.brans || 'Branş belirtilmemiş').slice(0, 60),
      activeLinkCount: 0,
      linkedStudentIds: new Set(),
      pendingRequestCount: 0,
    });
  }

  let activeLinkCount = 0;
  let revokedLinkCount = 0;
  const allLinkedStudentIds = new Set();
  for (const link of links) {
    if (link.durum === 'revoked') revokedLinkCount += 1;
    if (link.durum !== 'active' || !teachers.has(link.ogretmenUid)) continue;
    activeLinkCount += 1;
    const teacher = teachers.get(link.ogretmenUid);
    if (typeof link.ogrenciUid === 'string' && link.ogrenciUid) {
      teacher.linkedStudentIds.add(link.ogrenciUid);
      allLinkedStudentIds.add(link.ogrenciUid);
    }
    teacher.activeLinkCount += 1;
  }

  let pendingRequestCount = 0;
  for (const request of requests) {
    if (request.durum !== 'bekliyor' || !teachers.has(request.ogretmenUid)) continue;
    pendingRequestCount += 1;
    teachers.get(request.ogretmenUid).pendingRequestCount += 1;
  }

  const teacherRows = [...teachers.values()]
    .map(teacher => ({
      displayName: teacher.displayName,
      branch: teacher.branch,
      activeLinkCount: teacher.activeLinkCount,
      linkedStudentAccounts: teacher.linkedStudentIds.size,
      pendingRequestCount: teacher.pendingRequestCount,
    }))
    .sort((a, b) => a.branch.localeCompare(b.branch, 'tr') || a.displayName.localeCompare(b.displayName, 'tr'));

  const branchMap = new Map();
  for (const teacher of teachers.values()) {
    if (!branchMap.has(teacher.branch)) {
      branchMap.set(teacher.branch, { branch: teacher.branch, teacherCount: 0, linkedStudentIds: new Set() });
    }
    const branch = branchMap.get(teacher.branch);
    branch.teacherCount += 1;
    for (const studentId of teacher.linkedStudentIds) branch.linkedStudentIds.add(studentId);
  }
  const branches = [...branchMap.values()]
    .map(branch => ({
      branch: branch.branch,
      teacherCount: branch.teacherCount,
      linkedStudentAccounts: branch.linkedStudentIds.size,
    }))
    .sort((a, b) => a.branch.localeCompare(b.branch, 'tr'));

  return {
    teacherAccountCount: teacherProfiles.length,
    studentAccountCount,
    activeLinkCount,
    uniqueLinkedStudentAccountCount: allLinkedStudentIds.size,
    pendingRequestCount,
    revokedLinkCount,
    branches,
    teachers: teacherRows,
    // No student names, e-mail addresses, contact data, or academic records are returned.
  };
}

exports.getUygulamaSahibiIstatistikleri = onCall(
  { region: REGION, timeoutSeconds: 120, memory: '256MiB' },
  async request => {
    if (!isApplicationOwner(request)) {
      throw new HttpsError('permission-denied', 'Bu panel yalnızca uygulama sahibine açıktır.');
    }

    const db = getFirestore();
    const ownerProfile = await db.collection('kullanicilar').doc(request.auth.uid).get();
    if (!ownerProfile.exists || ownerProfile.get('rol') !== 'ogretmen') {
      throw new HttpsError('permission-denied', 'Uygulama sahibi hesabı aynı zamanda öğretmen olarak tanımlı olmalıdır.');
    }
    const [teachers, studentCountSnapshot, links, requests] = await Promise.all([
      readCollection(db, 'kullanicilar', ['kullaniciAdi', 'brans'], [['rol', 'ogretmen']]),
      db.collection('kullanicilar').where('rol', '==', 'ogrenci').count().get(),
      readCollection(db, 'ogretmenOgrenciBaglantilari', ['ogretmenUid', 'ogrenciUid', 'durum']),
      readCollection(db, 'ogrenciEslesmeTalepleri', ['ogretmenUid', 'durum']),
    ]);

    return {
      ...buildStatistics(teachers, links, requests, studentCountSnapshot.data().count),
      generatedAt: new Date().toISOString(),
    };
  },
);

exports._test = { isApplicationOwner, buildStatistics };
