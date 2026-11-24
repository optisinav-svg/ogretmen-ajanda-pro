#!/usr/bin/env node
'use strict';

// Spark-compatible, owner-authorized manual retention cleanup.
// Runs locally with Firebase Admin SDK credentials; it deploys no Cloud Function.
// Default operation is read-only preview. Deletion is possible only in July 2028+
// for the single period exactly two years before the current Istanbul year.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldPath, FieldValue, Timestamp } = require('firebase-admin/firestore');
const {
  RETENTION_COLLECTIONS,
  expiredPeriodStartYear,
  istanbulDateParts,
} = require('../retentionPolicy');

const PROJECT_ID = 'ogretmen-takip';
const BATCH_SIZE = 400;
const BACKUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LEASE_MS = 15 * 60 * 1000;
const BACKUP_DIR = path.resolve(__dirname, '../../firestore-backups');

function getEligibleCleanupTarget(now = new Date()) {
  const targetYear = expiredPeriodStartYear(now);
  if (targetYear === null) return null;
  const { year, month } = istanbulDateParts(now);
  return { currentYear: year, month, targetYear };
}

function parseArg(argv, name) {
  const prefix = name + '=';
  const item = argv.find(value => value.startsWith(prefix));
  return item ? item.slice(prefix.length) : null;
}

function validateBackupManifest(manifest, now = new Date(), { requireFresh = true } = {}) {
  if (!manifest || manifest.projectId !== PROJECT_ID || manifest.readOnly !== true) {
    throw new Error('Yedek manifesti ogretmen-takip projesine ait salt okunur yedek değil.');
  }
  if (typeof manifest.createdAt !== 'string' || !Number.isFinite(Date.parse(manifest.createdAt))) {
    throw new Error('Yedek oluşturulma zamanı doğrulanamadı.');
  }
  const age = now.getTime() - Date.parse(manifest.createdAt);
  if (age < 0 || (requireFresh && age > BACKUP_MAX_AGE_MS)) {
    throw new Error(requireFresh
      ? 'Silme öncesi son 24 saat içinde alınmış yeni bir Firestore yedeği gerekiyor.'
      : 'Kayıtlı temizleme yedeğinin zamanı geçersiz.');
  }
  if (typeof manifest.archive !== 'string'
    || path.basename(manifest.archive) !== manifest.archive
    || !manifest.archive.endsWith('.jsonl.gz')) {
    throw new Error('Yedek arşiv dosya adı geçersiz.');
  }
  if (typeof manifest.archiveSha256 !== 'string'
    || !/^[a-f0-9]{64}$/i.test(manifest.archiveSha256)) {
    throw new Error('Yedek SHA-256 özeti bulunamadı.');
  }
  if (!manifest.collections || typeof manifest.collections !== 'object'
    || !Number.isInteger(manifest.totalDocuments) || manifest.totalDocuments < 1) {
    throw new Error('Yedek manifestinde koleksiyon sayımları bulunamadı.');
  }
  for (const name of RETENTION_COLLECTIONS) {
    if (Object.prototype.hasOwnProperty.call(manifest.collections, name)
      && (!Number.isInteger(manifest.collections[name]) || manifest.collections[name] < 0)) {
      throw new Error('Yedek manifestinde ' + name + ' koleksiyonunun sayımı geçersiz.');
    }
  }
  return true;
}

function validateDeleteConfirmation({ argv, ownerUid, targetYear, total, backupSha256 }) {
  if (!ownerUid) throw new Error('--owner-uid=<uygulama-sahibi-UID> zorunludur.');
  if (!argv.includes('--delete')) throw new Error('Silme modu açıkça seçilmedi.');
  if (argv.includes('--preview')) throw new Error('--preview ve --delete birlikte kullanılamaz.');
  if (parseArg(argv, '--confirm-target') !== PROJECT_ID + ':' + targetYear) {
    throw new Error('Hedef dönem onayı eşleşmedi. Beklenen: --confirm-target=' + PROJECT_ID + ':' + targetYear);
  }
  if (parseArg(argv, '--confirm-total') !== String(total)) {
    throw new Error('Belge sayısı onayı eşleşmedi. Beklenen: --confirm-total=' + total);
  }
  if (parseArg(argv, '--confirm-backup-sha256') !== backupSha256) {
    throw new Error('Yedek SHA-256 onayı eşleşmedi. Son yedek manifestindeki özeti aynen kullanın.');
  }
  return true;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function loadLatestVerifiedBackup(now = new Date()) {
  if (!fs.existsSync(BACKUP_DIR)) {
    throw new Error('firestore-backups klasörü bulunamadı. Önce yeni salt okunur yedek alın.');
  }
  const files = fs.readdirSync(BACKUP_DIR).filter(name => name.endsWith('.manifest.json'));
  if (!files.length) throw new Error('Yedek manifesti bulunamadı.');
  const manifests = files.map(name => {
    const manifestPath = path.join(BACKUP_DIR, name);
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      throw new Error('Yedek manifestlerinden biri okunamıyor: ' + name);
    }
    return { name, manifest, manifestPath };
  }).filter(item => item.manifest.projectId === PROJECT_ID)
    .sort((a, b) => Date.parse(b.manifest.createdAt || 0) - Date.parse(a.manifest.createdAt || 0));
  if (!manifests.length) throw new Error('ogretmen-takip projesine ait yedek manifesti bulunamadı.');

  const latest = manifests[0];
  validateBackupManifest(latest.manifest, now);
  const archivePath = path.join(BACKUP_DIR, latest.manifest.archive);
  if (!fs.existsSync(archivePath) || fs.statSync(archivePath).size <= 0) {
    throw new Error('Yedek arşiv dosyası bulunamadı veya boş.');
  }
  const actualHash = await sha256File(archivePath);
  if (actualHash.toLowerCase() !== latest.manifest.archiveSha256.toLowerCase()) {
    throw new Error('Yedek arşivinin SHA-256 özeti manifest ile eşleşmiyor.');
  }
  return {
    manifestPath: latest.manifestPath,
    archivePath,
    manifest: latest.manifest,
    sha256: actualHash,
  };
}

async function loadStoredBackup(lock, now = new Date()) {
  const manifestName = lock?.backupManifest;
  const expectedHash = lock?.backupSha256;
  if (typeof manifestName !== 'string' || path.basename(manifestName) !== manifestName
    || !manifestName.endsWith('.manifest.json')
    || typeof expectedHash !== 'string') {
    throw new Error('Devam eden temizliğin ilk yedek bilgisi bulunamadı; işlem güvenli biçimde sürdürülemez.');
  }
  const manifestPath = path.join(BACKUP_DIR, manifestName);
  if (!fs.existsSync(manifestPath)) throw new Error('İlk temizleme yedeğinin manifesti bulunamadı.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  validateBackupManifest(manifest, now, { requireFresh: false });
  if (manifest.archiveSha256.toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error('Devam eden temizliğin yedek özeti kayıtla eşleşmiyor.');
  }
  const startedAt = lock.startedAt?.toDate?.();
  if (!startedAt || Date.parse(manifest.createdAt) > startedAt.getTime()) {
    throw new Error('İlk yedek, temizleme başlangıcından sonra oluşturulmuş; devam işlemi reddedildi.');
  }
  const archivePath = path.join(BACKUP_DIR, manifest.archive);
  if (!fs.existsSync(archivePath) || fs.statSync(archivePath).size <= 0) {
    throw new Error('İlk temizleme yedeğinin arşivi bulunamadı veya boş.');
  }
  const actualHash = await sha256File(archivePath);
  if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error('İlk temizleme yedeğinin SHA-256 özeti doğrulanamadı.');
  }
  return { manifestPath, archivePath, manifest, sha256: actualHash };
}

async function getCleanupCounts(db, targetYear) {
  const entries = await Promise.all(RETENTION_COLLECTIONS.map(async name => {
    const result = await db.collection(name).where('donemYili', '==', targetYear).count().get();
    return [name, result.data().count];
  }));
  return Object.fromEntries(entries);
}

function sumCounts(counts) {
  return Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
}

async function assertNoSubcollections(db, targetYear) {
  const found = new Set();
  for (const name of RETENTION_COLLECTIONS) {
    let cursor = null;
    while (true) {
      let query = db.collection(name).where('donemYili', '==', targetYear)
        .orderBy(FieldPath.documentId()).limit(BATCH_SIZE);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      for (const document of page.docs) {
        const children = await document.ref.listCollections();
        for (const child of children) found.add(name + '/' + child.id);
      }
      if (page.empty || page.size < BATCH_SIZE) break;
      cursor = page.docs[page.docs.length - 1];
    }
  }
  if (found.size) {
    throw new Error('Silinecek belgelerin altında alt koleksiyon bulundu. Veri kaybını önlemek için işlem durduruldu: ' + [...found].sort().join(', '));
  }
}

async function verifyOwner(auth, db, ownerUid) {
  if (!ownerUid) throw new Error('--owner-uid=<uygulama-sahibi-UID> zorunludur.');
  const user = await auth.getUser(ownerUid);
  if (user.customClaims?.uygulamaSahibi !== true) {
    throw new Error('Belirtilen Auth hesabında uygulamaSahibi=true yetkisi doğrulanamadı.');
  }
  const profile = await db.collection('kullanicilar').doc(ownerUid).get();
  if (!profile.exists || profile.get('rol') !== 'ogretmen'
    || profile.get('hesapDurumu') === 'kapali') {
    throw new Error('Uygulama sahibi profili etkin öğretmen hesabı olarak doğrulanamadı.');
  }
}

async function readPlan(db, currentYear, targetYear) {
  const lockRef = db.collection('donemTemizlikKayitlari').doc(String(currentYear));
  const lockSnap = await lockRef.get();
  const remainingCounts = await getCleanupCounts(db, targetYear);
  if (lockSnap.exists && lockSnap.get('status') === 'completed') {
    if (lockSnap.get('targetYear') !== targetYear) {
      throw new Error('Tamamlandı işaretli temizleme kaydının hedef yılı uyuşmuyor.');
    }
    if (sumCounts(remainingCounts) !== 0) {
      throw new Error('Temizlik kaydı tamamlandı gösteriyor ancak hedef döneme ait kayıtlar hâlâ var. İkinci silme otomatik başlatılmayacak.');
    }
    return { status: 'completed', lockRef, lock: lockSnap.data(), remainingCounts, plannedCounts: lockSnap.get('plannedCounts') || lockSnap.get('counts') || {} };
  }
  const resumable = lockSnap.exists && ['running', 'failed'].includes(lockSnap.get('status'));
  const plannedCounts = resumable ? lockSnap.get('plannedCounts') : remainingCounts;
  if (resumable && lockSnap.get('targetYear') !== targetYear) {
    throw new Error('Mevcut dönem temizliği kilidinin hedef yılı uyuşmuyor. Otomatik devam ettirilmeyecek.');
  }
  if (resumable && (!plannedCounts || RETENTION_COLLECTIONS.some(name => !Number.isInteger(plannedCounts[name])))) {
    throw new Error('Mevcut temizleme kilidinde plan sayımları eksik; otomatik devam ettirilmeyecek.');
  }
  for (const name of RETENTION_COLLECTIONS) {
    if (remainingCounts[name] > Number(plannedCounts[name] || 0)) {
      throw new Error(name + ' koleksiyonunda ilk plandan fazla belge var. Yeni kayıt ihtimali nedeniyle işlem durduruldu.');
    }
  }
  return {
    status: resumable ? 'resumable' : 'pending',
    lockRef,
    lock: lockSnap.exists ? lockSnap.data() : null,
    plannedCounts,
    remainingCounts,
  };
}

async function acquireCleanupLock(db, plan, ownerUid, currentYear, targetYear, backup) {
  const runToken = crypto.randomUUID();
  const now = Date.now();
  const leaseExpiresAt = Timestamp.fromMillis(now + LEASE_MS);
  return db.runTransaction(async transaction => {
    const snap = await transaction.get(plan.lockRef);
    if (!snap.exists) {
      transaction.create(plan.lockRef, {
        cleanupId: String(currentYear),
        currentYear,
        targetYear,
        status: 'running',
        startedBy: ownerUid,
        startedAt: FieldValue.serverTimestamp(),
        plannedCounts: plan.plannedCounts,
        plannedTotal: sumCounts(plan.plannedCounts),
        backupManifest: path.basename(backup.manifestPath),
        backupSha256: backup.sha256,
        completedCollections: [],
        runToken,
        leaseExpiresAt,
        policyVersion: 1,
      });
      return runToken;
    }
    const data = snap.data();
    if (data.status === 'completed') throw new Error('Bu yılın dönem temizliği zaten tamamlanmış.');
    if (data.targetYear !== targetYear || data.startedBy !== ownerUid
      || Number(data.plannedTotal) !== sumCounts(plan.plannedCounts)
      || data.backupSha256 !== backup.sha256
      || data.backupManifest !== path.basename(backup.manifestPath)) {
      throw new Error('Mevcut temizleme kaydı bu hedef veya uygulama sahibi ile eşleşmiyor.');
    }
    const activeUntil = data.leaseExpiresAt?.toMillis?.() || 0;
    if (data.status === 'running' && activeUntil > now) {
      throw new Error('Başka bir temizleme işlemi hâlen etkin görünüyor. Aynı anda ikinci işlem başlatılmadı.');
    }
    if (!['running', 'failed'].includes(data.status)) {
      throw new Error('Temizleme kaydının durumu güvenli biçimde devam ettirilemiyor.');
    }
    transaction.update(plan.lockRef, {
      status: 'running',
      runToken,
      leaseExpiresAt,
      resumedAt: FieldValue.serverTimestamp(),
    });
    return runToken;
  });
}

async function updateProgress(db, lockRef, runToken, update) {
  await db.runTransaction(async transaction => {
    const snap = await transaction.get(lockRef);
    if (!snap.exists || snap.get('runToken') !== runToken) {
      throw new Error('Temizleme kilidi başka bir oturuma geçti. Güvenlik için işlem durduruldu.');
    }
    transaction.update(lockRef, {
      ...update,
      leaseExpiresAt: Timestamp.fromMillis(Date.now() + LEASE_MS),
    });
  });
}

async function deleteTargetPeriod(db, plan, runToken) {
  const completedCollections = new Set(plan.lock?.completedCollections || []);
  for (const name of RETENTION_COLLECTIONS) {
    let deletedThisRun = 0;
    while (true) {
      const page = await db.collection(name).where('donemYili', '==', plan.lock?.targetYear ?? null)
        .orderBy(FieldPath.documentId()).limit(BATCH_SIZE).get();
      if (page.empty) break;
      const batch = db.batch();
      page.docs.forEach(document => batch.delete(document.ref));
      await batch.commit();
      deletedThisRun += page.size;
      await updateProgress(db, plan.lockRef, runToken, {
        activeCollection: name,
        activeCollectionDeletedThisRun: deletedThisRun,
      });
    }
    const remaining = await db.collection(name)
      .where('donemYili', '==', plan.lock?.targetYear ?? null).count().get();
    if (remaining.data().count !== 0) {
      throw new Error(name + ' koleksiyonunda silinmemiş kayıt kaldı.');
    }
    completedCollections.add(name);
    await updateProgress(db, plan.lockRef, runToken, {
      completedCollections: [...completedCollections],
      activeCollection: FieldValue.delete(),
      activeCollectionDeletedThisRun: FieldValue.delete(),
    });
  }
  const remainingCounts = await getCleanupCounts(db, plan.lock?.targetYear);
  if (sumCounts(remainingCounts) !== 0) {
    throw new Error('Son doğrulamada hedef döneme ait kayıt kaldı; işlem tamamlandı olarak işaretlenmedi.');
  }
  return remainingCounts;
}

async function main() {
  const argv = process.argv.slice(2);
  const ownerUid = parseArg(argv, '--owner-uid');
  const mode = argv.includes('--delete') ? 'delete' : argv.includes('--preview') ? 'preview' : null;
  if (!mode || (argv.includes('--delete') && argv.includes('--preview'))) {
    throw new Error('Kullanım: node .\\scripts\\manual-period-cleanup.js --preview --owner-uid=<UID> veya --delete ile açık onay parametreleri.');
  }
  const now = new Date();
  const target = getEligibleCleanupTarget(now);
  if (!target) {
    throw new Error('Dönem temizliği yalnızca Temmuz 2028 ve sonrasında, iki yıl önceki tek dönem için kullanılabilir. Hiçbir veri değiştirilmedi.');
  }

  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const auth = getAuth();
  const db = getFirestore();
  await verifyOwner(auth, db, ownerUid);

  const plan = await readPlan(db, target.currentYear, target.targetYear);
  if (plan.status === 'completed') {
    console.log(JSON.stringify({
      status: 'already_completed',
      currentYear: target.currentYear,
      targetYear: target.targetYear,
      counts: plan.lock.counts || {},
      totalDeleted: plan.lock.totalDeleted || 0,
    }, null, 2));
    return;
  }

  const total = sumCounts(plan.plannedCounts);
  if (mode === 'preview') {
    console.log('READ-ONLY PREVIEW — Firestore verisi değiştirilmedi.');
    console.log(JSON.stringify({
      projectId: PROJECT_ID,
      currentYear: target.currentYear,
      targetYear: target.targetYear,
      status: plan.status,
      plannedCounts: plan.plannedCounts,
      remainingCounts: plan.remainingCounts,
      plannedTotal: total,
      requiredConfirmTarget: PROJECT_ID + ':' + target.targetYear,
      requiredConfirmTotal: total,
    }, null, 2));
    return;
  }

  const backup = plan.status === 'resumable'
    ? await loadStoredBackup(plan.lock, now)
    : await loadLatestVerifiedBackup(now);
  for (const name of RETENTION_COLLECTIONS) {
    if (Number(backup.manifest.collections[name] || 0) < Number(plan.plannedCounts[name] || 0)) {
      throw new Error('Yedekte ' + name + ' koleksiyonu sayısı temizleme planını karşılamıyor.');
    }
  }
  validateDeleteConfirmation({
    argv,
    ownerUid,
    targetYear: target.targetYear,
    total,
    backupSha256: backup.sha256,
  });
  if (total < 1) throw new Error('Silinecek kayıt bulunmuyor; temizleme başlatılmadı.');

  await assertNoSubcollections(db, target.targetYear);
  // Recheck counts after backup and subcollection preflight; no writes occurred yet.
  const latestCounts = await getCleanupCounts(db, target.targetYear);
  for (const name of RETENTION_COLLECTIONS) {
    if (latestCounts[name] > Number(plan.plannedCounts[name] || 0)) {
      throw new Error(name + ' koleksiyonuna önizlemeden sonra yeni kayıt eklenmiş. Yeni önizleme alın.');
    }
  }

  const runToken = await acquireCleanupLock(db, plan, ownerUid, target.currentYear, target.targetYear, backup);
  const executionPlan = { ...plan, lock: { ...(plan.lock || {}), targetYear: target.targetYear } };
  try {
    await deleteTargetPeriod(db, executionPlan, runToken);
    const completedCounts = plan.plannedCounts;
    await updateProgress(db, plan.lockRef, runToken, {
      status: 'completed',
      completedBy: ownerUid,
      completedAt: FieldValue.serverTimestamp(),
      counts: completedCounts,
      totalDeleted: total,
      policyVersion: 1,
      runToken: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
      activeCollection: FieldValue.delete(),
      activeCollectionDeletedThisRun: FieldValue.delete(),
    });
    console.log('DÖNEM TEMİZLİĞİ TAMAMLANDI');
    console.log(JSON.stringify({
      projectId: PROJECT_ID,
      currentYear: target.currentYear,
      targetYear: target.targetYear,
      counts: completedCounts,
      totalDeleted: total,
      backupManifest: path.basename(backup.manifestPath),
      backupSha256: backup.sha256,
    }, null, 2));
  } catch (error) {
    try {
      await updateProgress(db, plan.lockRef, runToken, {
        status: 'failed',
        lastError: String(error?.message || error).slice(0, 240),
        leaseExpiresAt: Timestamp.fromMillis(0),
      });
    } catch {}
    throw error;
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('MANUAL PERIOD CLEANUP STOPPED — no success was reported.');
    console.error(error?.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  getEligibleCleanupTarget,
  validateBackupManifest,
  validateDeleteConfirmation,
  sumCounts,
};
