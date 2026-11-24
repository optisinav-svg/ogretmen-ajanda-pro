#!/usr/bin/env node
'use strict';

// Read-only compatibility audit for existing Firestore documents against the
// current tablet branch's Firestore Rules. It never writes or deletes data.
// Output contains counts only: no document IDs, names, emails, or field values.

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldPath } = require('firebase-admin/firestore');

const PROJECT_ID = 'ogretmen-takip';
const PAGE_SIZE = 400;
const COLLECTIONS = [
  'kullanicilar',
  'okullar',
  'siniflar',
  'ogrenciler',
  'dersler',
  'dersNotlari',
  'odevler',
  'yoklamalar',
  'kitaplar',
  'konular',
  'kitapKutuphanesi',
  'kitapKutuphanesiKonulari',
  'bireyselEtkinlikler',
  'bireyselDersOturumlari',
];

function exactKeys(data, expected) {
  const actual = Object.keys(data || {}).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}

function addIssue(report, collection, code, severity = 'error') {
  const target = report.collections[collection];
  const bucket = severity === 'warning' ? target.warnings : target.errors;
  bucket[code] = (bucket[code] || 0) + 1;
}

function samePeriod(a, b) {
  return Number.isInteger(a?.donemYili)
    && Number.isInteger(b?.donemYili)
    && a.donemYili === b.donemYili;
}

async function readCollection(db, name) {
  const result = [];
  let cursor = null;
  while (true) {
    let query = db.collection(name).orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    result.push(...page.docs.map(document => ({ id: document.id, data: document.data() })));
    if (page.empty || page.size < PAGE_SIZE) break;
    cursor = page.docs[page.docs.length - 1];
  }
  return result;
}

function initializeSummary(report, collection, docs) {
  const summary = { scanned: docs.length, periodCounts: {}, errors: {}, warnings: {} };
  report.collections[collection] = summary;
  for (const { data } of docs) {
    if (Number.isInteger(data.donemYili)) {
      const key = String(data.donemYili);
      summary.periodCounts[key] = (summary.periodCounts[key] || 0) + 1;
    } else if (Object.prototype.hasOwnProperty.call(data, 'donemYili')) {
      addIssue(report, collection, 'invalid_donemYili');
    } else if (collection !== 'kullanicilar' && collection !== 'kitapKutuphanesi' && collection !== 'kitapKutuphanesiKonulari') {
      addIssue(report, collection, 'missing_donemYili');
    }
  }
}

function validateOwnerAndPeriod(report, collection, record) {
  if (typeof record.uid !== 'string' || !record.uid) addIssue(report, collection, 'missing_or_invalid_uid');
  if (!Number.isInteger(record.donemYili)) return;
}

function validateClassReference(report, collection, record, classes, schools) {
  if (typeof record.sinifId !== 'string' || !record.sinifId) {
    addIssue(report, collection, 'missing_sinifId');
    return null;
  }
  const klass = classes.get(record.sinifId);
  if (!klass) {
    addIssue(report, collection, 'referenced_class_missing');
    return null;
  }
  if (klass.uid !== record.uid) addIssue(report, collection, 'class_owner_mismatch');
  if (!samePeriod(klass, record)) addIssue(report, collection, 'class_period_mismatch');
  if (klass.arsivlendi === true || klass.arsivDurumu === 'isleniyor') {
    addIssue(report, collection, 'class_archived_or_locked', 'warning');
  }
  if (klass.okulId) {
    const school = schools.get(klass.okulId);
    if (!school) addIssue(report, collection, 'referenced_school_missing');
    else {
      if (school.uid !== record.uid) addIssue(report, collection, 'school_owner_mismatch');
      if (!samePeriod(school, record)) addIssue(report, collection, 'school_period_mismatch');
      if (school.arsivlendi === true || school.arsivDurumu === 'isleniyor') {
        addIssue(report, collection, 'school_archived_or_locked', 'warning');
      }
    }
  }
  return klass;
}

function validateStudentReference(report, collection, record, students) {
  if (typeof record.ogrenciId !== 'string' || !record.ogrenciId) {
    addIssue(report, collection, 'missing_ogrenciId');
    return null;
  }
  const student = students.get(record.ogrenciId);
  if (!student) {
    addIssue(report, collection, 'referenced_student_missing');
    return null;
  }
  if (student.uid !== record.uid) addIssue(report, collection, 'student_owner_mismatch');
  if (student.sinifId !== record.sinifId) addIssue(report, collection, 'student_class_mismatch');
  if (!samePeriod(student, record)) addIssue(report, collection, 'student_period_mismatch');
  if (student.sinifTasiIslemi || student.kayitsizTasiIslemi) {
    addIssue(report, collection, 'student_transfer_pending', 'warning');
  }
  return student;
}

function validateOptionalLesson(report, collection, record, lessons) {
  if (record.dersId === undefined || record.dersId === null || record.dersId === '') return;
  if (typeof record.dersId !== 'string') {
    addIssue(report, collection, 'invalid_dersId');
    return;
  }
  const lesson = lessons.get(record.dersId);
  // The deployed rule intentionally allows historical records whose lesson was deleted.
  if (!lesson) return;
  if (lesson.uid !== record.uid) addIssue(report, collection, 'lesson_owner_mismatch');
  if (lesson.sinifId !== record.sinifId) addIssue(report, collection, 'lesson_class_mismatch');
  if (!samePeriod(lesson, record)) addIssue(report, collection, 'lesson_period_mismatch');
}

function validateLibraryRecords(report, libraryBooks, libraryTopics) {
  const bookKeys = ['ad', 'sayfaSayisi', 'uid', 'olusturulma'];
  for (const { data } of libraryBooks) {
    if (!exactKeys(data, bookKeys)) addIssue(report, 'kitapKutuphanesi', 'library_book_keys_mismatch');
    if (typeof data.uid !== 'string' || typeof data.ad !== 'string'
      || data.ad.length < 1 || data.ad.length > 160
      || !Number.isInteger(data.sayfaSayisi) || data.sayfaSayisi <= 0
      || typeof data.olusturulma !== 'string') {
      addIssue(report, 'kitapKutuphanesi', 'library_book_schema_invalid');
    }
  }

  const topicKeys = ['ad', 'baslangicSayfa', 'bitisSayfa', 'kazanımKodu', 'kaynak', 'kitapId', 'kitapAd', 'uid', 'olusturulma'];
  const booksById = new Map(libraryBooks.map(item => [item.id, item.data]));
  for (const { data } of libraryTopics) {
    if (!exactKeys(data, topicKeys)) addIssue(report, 'kitapKutuphanesiKonulari', 'library_topic_keys_mismatch');
    const book = booksById.get(data.kitapId);
    if (!book) addIssue(report, 'kitapKutuphanesiKonulari', 'library_topic_book_missing');
    else if (book.uid !== data.uid) addIssue(report, 'kitapKutuphanesiKonulari', 'library_topic_book_owner_mismatch');
    if (typeof data.ad !== 'string' || data.ad.length < 1 || data.ad.length > 200
      || !Number.isInteger(data.baslangicSayfa) || data.baslangicSayfa <= 0
      || !Number.isInteger(data.bitisSayfa) || data.bitisSayfa < data.baslangicSayfa
      || typeof data.kazanımKodu !== 'string'
      || !['manuel', 'kazanım'].includes(data.kaynak)
      || typeof data.kitapId !== 'string'
      || typeof data.kitapAd !== 'string'
      || typeof data.uid !== 'string'
      || typeof data.olusturulma !== 'string'
      || (book && data.bitisSayfa > book.sayfaSayisi)) {
      addIssue(report, 'kitapKutuphanesiKonulari', 'library_topic_schema_invalid');
    }
  }
}

function validateData(report, docsByCollection) {
  const getMap = name => new Map((docsByCollection[name] || []).map(item => [item.id, item.data]));
  const schools = getMap('okullar');
  const classes = getMap('siniflar');
  const students = getMap('ogrenciler');
  const lessons = getMap('dersler');
  const books = getMap('kitaplar');
  const events = getMap('bireyselEtkinlikler');

  for (const { data } of docsByCollection.kullanicilar || []) {
    if (!['ogretmen', 'ogrenci'].includes(data.rol)) addIssue(report, 'kullanicilar', 'role_missing_or_invalid');
    if (data.hesapDurumu !== undefined && !['aktif', 'kapali'].includes(data.hesapDurumu)) {
      addIssue(report, 'kullanicilar', 'account_status_invalid');
    }
  }

  for (const { data } of docsByCollection.okullar || []) {
    validateOwnerAndPeriod(report, 'okullar', data);
  }

  for (const { data } of docsByCollection.siniflar || []) {
    validateOwnerAndPeriod(report, 'siniflar', data);
    if (data.okulId) {
      const school = schools.get(data.okulId);
      if (!school) addIssue(report, 'siniflar', 'referenced_school_missing');
      else {
        if (school.uid !== data.uid) addIssue(report, 'siniflar', 'school_owner_mismatch');
        if (!samePeriod(school, data)) addIssue(report, 'siniflar', 'school_period_mismatch');
      }
    }
  }

  for (const name of ['ogrenciler', 'dersler', 'dersNotlari', 'odevler', 'yoklamalar',
    'kitaplar', 'konular', 'bireyselEtkinlikler', 'bireyselDersOturumlari']) {
    for (const { data } of docsByCollection[name] || []) {
      validateOwnerAndPeriod(report, name, data);
      validateClassReference(report, name, data, classes, schools);
      if (['yoklamalar', 'kitaplar', 'konular', 'bireyselEtkinlikler', 'bireyselDersOturumlari'].includes(name)) {
        validateStudentReference(report, name, data, students);
      }
      if (['dersNotlari', 'odevler', 'yoklamalar'].includes(name)) {
        validateOptionalLesson(report, name, data, lessons);
      }
      if (name === 'odevler' && data.hedefOgrenciIds !== undefined && !Array.isArray(data.hedefOgrenciIds)) {
        addIssue(report, name, 'hedefOgrenciIds_not_array');
      }
      if (name === 'bireyselDersOturumlari') {
        const event = events.get(data.bireyselEtkinlikId);
        if (!event) addIssue(report, name, 'referenced_event_missing');
        else {
          if (event.uid !== data.uid) addIssue(report, name, 'event_owner_mismatch');
          if (event.ogrenciId !== data.ogrenciId) addIssue(report, name, 'event_student_mismatch');
          if (event.sinifId !== data.sinifId) addIssue(report, name, 'event_class_mismatch');
        }
      }
    }
  }

  for (const { data } of docsByCollection.ogrenciler || []) {
    const klass = typeof data.sinifId === 'string' ? classes.get(data.sinifId) : null;
    if (klass && (klass.uid !== data.uid || !samePeriod(klass, data))) {
      addIssue(report, 'ogrenciler', 'student_class_period_mismatch');
    }
  }

  for (const { data } of docsByCollection.konular || []) {
    const book = books.get(data.kitapId);
    if (!book) addIssue(report, 'konular', 'assigned_book_missing');
    else {
      if (book.uid !== data.uid) addIssue(report, 'konular', 'assigned_book_owner_mismatch');
      if (book.ogrenciId !== data.ogrenciId) addIssue(report, 'konular', 'assigned_book_student_mismatch');
      if (book.sinifId !== data.sinifId) addIssue(report, 'konular', 'assigned_book_class_mismatch');
      if (!samePeriod(book, data)) addIssue(report, 'konular', 'assigned_book_period_mismatch');
    }
  }

  validateLibraryRecords(
    report,
    docsByCollection.kitapKutuphanesi || [],
    docsByCollection.kitapKutuphanesiKonulari || [],
  );
}

async function main() {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const db = getFirestore();
  const docsByCollection = {};
  const report = {
    projectId: PROJECT_ID,
    generatedAt: new Date().toISOString(),
    mode: 'READ_ONLY',
    note: 'No Firestore documents were written, updated, or deleted. Output contains counts only.',
    collections: {},
  };

  for (const name of COLLECTIONS) {
    docsByCollection[name] = await readCollection(db, name);
    initializeSummary(report, name, docsByCollection[name]);
  }
  validateData(report, docsByCollection);
  report.totalDocumentsScanned = Object.values(report.collections)
    .reduce((sum, item) => sum + item.scanned, 0);
  report.totalErrors = Object.values(report.collections)
    .reduce((sum, item) => sum + Object.values(item.errors).reduce((a, b) => a + b, 0), 0);
  report.totalWarnings = Object.values(report.collections)
    .reduce((sum, item) => sum + Object.values(item.warnings).reduce((a, b) => a + b, 0), 0);

  console.log('READ-ONLY FIRESTORE RULES COMPATIBILITY AUDIT COMPLETED');
  console.log(JSON.stringify(report, null, 2));
  console.log('No Firestore documents were changed.');
}

if (require.main === module) {
  main().catch(error => {
    console.error('RULES COMPATIBILITY AUDIT FAILED:', error?.message || error);
    process.exitCode = 1;
  });
}

module.exports = { exactKeys, samePeriod, sumCounts: counts => Object.values(counts || {}).reduce((sum, value) => sum + Number(value || 0), 0) };
