#!/usr/bin/env node
'use strict';

// Repairs only lesson-link metadata for the 103 audited historical records.
// Default mode is dry-run. Pass --apply to write after a fresh backup is created.
const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const PROJECT_ID = 'ogretmen-takip';
const REPORT_PATH = path.resolve(__dirname, '..', 'second-class-date-audit-report.json');
const APPLY = process.argv.includes('--apply');

function dayName(date) {
  return ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][
    new Date(date + 'T12:00:00').getDay()
  ];
}
function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function getDocData(db, collectionName, id) {
  const snap = await db.collection(collectionName).doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function main() {
  assert(fs.existsSync(REPORT_PATH), 'Denetim raporu bulunamadı: ' + REPORT_PATH);
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  assert(report.projectId === PROJECT_ID, 'Rapor başka Firebase projesine ait.');
  assert(Array.isArray(report.mismatchRecords), 'Raporda mismatchRecords alanı yok.');
  assert(report.mismatchTotal === 103 && report.mismatchRecords.length === 103,
    'Beklenen 103 kayıt yerine farklı sayı bulundu. Yeni raporla tekrar denetleyin.');

  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const db = getFirestore();

  const scheduleIds = [...new Set(report.mismatchRecords.map(x => x.lessonId))];
  const classIds = [...new Set(report.mismatchRecords.map(x => x.recordClassId))];
  const recordRefs = report.mismatchRecords.map(item => ({
    ...item,
    ref: db.collection(item.collection).doc(item.recordId),
  }));

  const [scheduleSnaps, classSnaps, recordSnaps, allSchedulesSnap] = await Promise.all([
    Promise.all(scheduleIds.map(id => db.collection('dersler').doc(id).get())),
    Promise.all(classIds.map(id => db.collection('siniflar').doc(id).get())),
    Promise.all(recordRefs.map(item => item.ref.get())),
    db.collection('dersler').where('uid', '==', report.mismatchRecords[0] && report.mismatchRecords[0].uid || '___').get()
      .catch(() => db.collection('dersler').get()),
  ]);

  const schedules = new Map();
  scheduleSnaps.forEach((snap, i) => {
    assert(snap.exists, 'Ders programı bulunamadı: ' + scheduleIds[i]);
    schedules.set(scheduleIds[i], { id: snap.id, ...snap.data() });
  });
  const classes = new Map();
  classSnaps.forEach((snap, i) => {
    assert(snap.exists, 'Sınıf belgesi bulunamadı: ' + classIds[i]);
    classes.set(classIds[i], { id: snap.id, ...snap.data() });
  });

  const allScheduleDocs = allSchedulesSnap.docs.map(s => ({ id: s.id, ...s.data() }));
  const groups = new Map();
  const currentRecords = [];

  recordSnaps.forEach((snap, i) => {
    const item = recordRefs[i];
    assert(snap.exists, 'Kayıt bulunamadı: ' + item.collection + '/' + item.recordId);
    const data = snap.data();
    const schedule = schedules.get(item.lessonId);
    assert(data.uid === schedule.uid, 'Öğretmen UID uyuşmazlığı: ' + item.recordId);
    assert(data.sinifId === item.recordClassId, 'Kayıt sınıfı raporla uyuşmuyor: ' + item.recordId);
    assert(data.dersId === item.lessonId, 'Kayıt dersId raporla uyuşmuyor: ' + item.recordId);
    assert(data.donemYili === schedule.donemYili, 'Dönem uyuşmazlığı: ' + item.recordId);
    assert(schedule.sinifId === item.lessonClassId, 'Dersin mevcut sınıfı raporla uyuşmuyor: ' + item.lessonId);
    assert(data.sinifId !== schedule.sinifId, 'Artık uyumsuz olmayan kayıt raporda kalmış: ' + item.recordId);
    assert(typeof data.tarih === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.tarih),
      'Geçerli tarih bulunamadı: ' + item.recordId);

    const weekday = dayName(data.tarih);
    const key = [item.lessonId, data.sinifId, weekday].join('|');
    if (!groups.has(key)) groups.set(key, {
      lessonId: item.lessonId,
      classId: data.sinifId,
      weekday,
      records: [],
      dates: [],
    });
    groups.get(key).records.push({
      collection: item.collection,
      id: item.recordId,
      data,
    });
    groups.get(key).dates.push(data.tarih);
    currentRecords.push({ collection: item.collection, id: item.recordId, data });
  });

  const plans = [];
  for (const group of groups.values()) {
    const original = schedules.get(group.lessonId);
    const klass = classes.get(group.classId);
    const dates = [...new Set(group.dates)].sort();
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const cloneId = 'hist_' + safeName(group.lessonId) + '_' + safeName(group.classId) + '_' + safeName(group.weekday);
    const clone = {
      ...original,
      sinifId: klass.id,
      sinifAd: klass.ad || klass.sinifAd || original.sinifAd,
      okulId: klass.okulId || original.okulId || '',
      okulAd: klass.okulAd || original.okulAd || '',
      kademe: klass.kademe || original.kademe || '',
      ders: klass.ders || original.ders || '',
      gun: group.weekday,
      baslangicTarih: firstDate,
      bitisTarih: lastDate,
      periyot: dates.length > 1 ? 'haftalik' : 'tek',
      tarihceKopyasi: true,
      kaynakDersId: group.lessonId,
      uid: original.uid,
      donemYili: original.donemYili,
      olusturulma: original.olusturulma || new Date().toISOString(),
    };
    assert(clone.sinifAd, 'Sınıf adı bulunamadı: ' + group.classId);
    if (dates.length > 1) {
      assert(dates.every(d => dayName(d) === group.weekday),
        'Aynı sınıf/ders grubunda farklı haftanın günleri var: ' + cloneId);
    }

    const existingClone = await getDocData(db, 'dersler', cloneId);
    if (existingClone) {
      assert(existingClone.tarihceKopyasi === true
        && existingClone.kaynakDersId === group.lessonId
        && existingClone.sinifId === group.classId,
      'Aynı kimlikte fakat farklı içerikte tarihçe dersi var: ' + cloneId);
    }

    const conflicts = allScheduleDocs.filter(d =>
      d.id !== group.lessonId
      && d.id !== cloneId
      && d.sinifId === clone.sinifId
      && d.gun === clone.gun
      && d.baslangicSaat === clone.baslangicSaat
      && d.bitisSaat === clone.bitisSaat
      && d.baslangicTarih <= clone.bitisTarih
      && d.bitisTarih >= clone.baslangicTarih
    );
    assert(conflicts.length === 0,
      'Aynı sınıfta çakışan ders programı bulundu; otomatik düzeltme durduruldu: '
      + cloneId + ' -> ' + conflicts.map(x => x.id).join(', '));

    plans.push({
      cloneId,
      lessonId: group.lessonId,
      classId: group.classId,
      className: clone.sinifAd,
      weekday: group.weekday,
      firstDate,
      lastDate,
      recordCount: group.records.length,
      collections: group.records.reduce((a, r) => {
        a[r.collection] = (a[r.collection] || 0) + 1;
        return a;
      }, {}),
      clone,
      records: group.records,
    });
  }

  const total = plans.reduce((sum, p) => sum + p.recordCount, 0);
  assert(total === 103, 'Planlanan kayıt sayısı 103 değil: ' + total);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(__dirname, '..', 'repair-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, 'lesson-class-repair-before-' + stamp + '.json');
  const planPath = path.join(backupDir, 'lesson-class-repair-plan-' + stamp + '.json');

  const backup = {
    projectId: PROJECT_ID,
    generatedAt: new Date().toISOString(),
    schedules: [...schedules.values()],
    classes: [...classes.values()],
    records: currentRecords,
  };
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');
  fs.writeFileSync(planPath, JSON.stringify({
    projectId: PROJECT_ID,
    generatedAt: new Date().toISOString(),
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    totalRecords: total,
    totalHistoricalScheduleCopies: plans.length,
    plans: plans.map(({ records, ...p }) => p),
  }, null, 2), 'utf8');

  console.log('PROJE:', PROJECT_ID);
  console.log('UYUMSUZ KAYIT:', total);
  console.log('OLUŞTURULACAK TARİHÇE DERSİ:', plans.length);
  console.log('KOLEKSİYON DAĞILIMI:', JSON.stringify(
    currentRecords.reduce((a, r) => { a[r.collection] = (a[r.collection] || 0) + 1; return a; }, {})
  ));
  console.log('YEDEK:', backupPath);
  console.log('PLAN:', planPath);
  console.log('GRUPLAR:');
  for (const p of plans) {
    console.log(JSON.stringify({
      kaynakDersId: p.lessonId,
      yeniDersId: p.cloneId,
      sinif: p.className,
      gun: p.weekday,
      tarih: p.firstDate + ' - ' + p.lastDate,
      kayit: p.recordCount,
      koleksiyonlar: p.collections,
    }));
  }

  if (!APPLY) {
    console.log('DRY-RUN TAMAMLANDI. Firestore üzerinde hiçbir değişiklik yapılmadı.');
    console.log('Planı uygulamak için aynı dosyayı --apply parametresiyle çalıştırın.');
    return;
  }

  const batch = db.batch();
  for (const p of plans) {
    batch.set(db.collection('dersler').doc(p.cloneId), p.clone);
    for (const r of p.records) {
      batch.update(db.collection(r.collection).doc(r.id), {
        dersId: p.cloneId,
        oturumId: p.cloneId + '_' + r.data.tarih,
      });
    }
  }
  await batch.commit();

  let remaining = 0;
  for (const item of recordRefs) {
    const snap = await item.ref.get();
    const data = snap.data();
    const linked = await db.collection('dersler').doc(data.dersId).get();
    if (!linked.exists || linked.data().sinifId !== data.sinifId
      || data.oturumId !== data.dersId + '_' + data.tarih) remaining++;
  }
  assert(remaining === 0, 'Yazma sonrası denetimde kalan uyumsuz kayıt: ' + remaining);
  console.log('UYGULAMA TAMAMLANDI. 103 kayıt doğrulandı; kalan ders-sınıf uyumsuzluğu: 0.');
  console.log('Tarihçe ders kopyası:', plans.length);
}

main().catch(error => {
  console.error('DÜZELTME DURDURULDU:', error?.stack || error);
  process.exitCode = 1;
});
