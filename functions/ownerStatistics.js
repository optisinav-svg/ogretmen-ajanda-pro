const { getFirestore, FieldPath } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = getFirestore();
const REGION = 'europe-west1';
const PAGE_SIZE = 500;

function isApplicationOwner(request) {
  return request?.auth?.token?.uygulamaSahibi === true;
}

async function readCollection(collectionName) {
  const records = [];
  let cursor = null;
  while (true) {
    let page = db.collection(collectionName)
      .orderBy(FieldPath.documentId())
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

function buildStatistics(profiles, links, requests) {
  const teacherProfiles = profiles.filter(profile => profile.rol === 'ogretmen');
  const studentProfiles = profiles.filter(profile => profile.rol === 'ogrenci');
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
    studentAccountCount: studentProfiles.length,
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

    const [profiles, links, requests] = await Promise.all([
      readCollection('kullanicilar'),
      readCollection('ogretmenOgrenciBaglantilari'),
      readCollection('ogrenciEslesmeTalepleri'),
    ]);

    return {
      ...buildStatistics(profiles, links, requests),
      generatedAt: new Date().toISOString(),
    };
  },
);

exports._test = { isApplicationOwner, buildStatistics };
