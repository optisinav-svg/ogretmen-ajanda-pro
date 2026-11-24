#!/usr/bin/env node
'use strict';

// Read-only, privacy-preserving diagnostics for the Rules compatibility audit.
// Reports aggregate relationship patterns only. It never prints document IDs,
// names, emails, or document contents and never writes/deletes Firestore data.

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldPath } = require('firebase-admin/firestore');

const PROJECT_ID = 'ogretmen-takip';
const PAGE_SIZE = 400;
const COLLECTIONS = [
  'okullar', 'siniflar', 'ogrenciler', 'dersler', 'dersNotlari',
  'odevler', 'yoklamalar', 'kitaplar', 'konular',
];

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

function recordDate(data) {
  const candidates = [data.tarih, data.olusturulma, data.kayitTarihi];
  for (const value of candidates) {
    if (typeof value !== 'string' || !value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function addDateRange(target, value) {
  if (!value) return;
  if (!target.firstDate || value < target.firstDate) target.firstDate = value;
  if (!target.lastDate || value > target.lastDate) target.lastDate = value;
}

function groupMissingReferences(docsByCollection, targetCollection, referenceField, sourceCollections) {
  const targetIds = new Set((docsByCollection[targetCollection] || []).map(item => item.id));
  const byReference = new Map();

  for (const collectionName of sourceCollections) {
    for (const item of docsByCollection[collectionName] || []) {
      const reference = item.data[referenceField];
      if (typeof reference !== 'string' || !reference || targetIds.has(reference)) continue;
      if (!byReference.has(reference)) {
        byReference.set(reference, {
          collections: new Set(), records: 0, owners: new Set(),
          periods: new Set(), firstDate: null, lastDate: null,
        });
      }
      const group = byReference.get(reference);
      group.collections.add(collectionName);
      group.records += 1;
      if (typeof item.data.uid === 'string' && item.data.uid) group.owners.add(item.data.uid);
      if (Number.isInteger(item.data.donemYili)) group.periods.add(item.data.donemYili);
      addDateRange(group, recordDate(item.data));
    }
  }

  const signatures = new Map();
  for (const group of byReference.values()) {
    const collections = [...group.collections].sort();
    const signature = collections.join('|');
    if (!signatures.has(signature)) {
      signatures.set(signature, {
        collections,
        distinctMissingReferences: 0,
        records: 0,
        ownerCount: 0,
        periodYears: new Set(),
        _owners: new Set(),
        firstDate: null,
        lastDate: null,
      });
    }
    const aggregate = signatures.get(signature);
    aggregate.distinctMissingReferences += 1;
    aggregate.records += group.records;
    for (const owner of group.owners) aggregate._owners.add(owner);
    for (const year of group.periods) aggregate.periodYears.add(year);
    addDateRange(aggregate, group.firstDate);
    addDateRange(aggregate, group.lastDate);
  }

  const groups = [...signatures.values()].map(group => ({
    collections: group.collections,
    distinctMissingReferences: group.distinctMissingReferences,
    records: group.records,
    ownerCount: group._owners.size,
    periodYears: [...group.periodYears].sort((a, b) => a - b),
    dateRange: group.firstDate ? { first: group.firstDate, last: group.lastDate } : null,
  })).sort((a, b) => a.collections.join(',').localeCompare(b.collections.join(',')));

  return {
    totalRecords: groups.reduce((sum, item) => sum + item.records, 0),
    distinctMissingReferences: groups.reduce((sum, item) => sum + item.distinctMissingReferences, 0),
    groups,
  };
}

function summarizeLessonClassMismatches(docsByCollection) {
  const lessons = new Map((docsByCollection.dersler || []).map(item => [item.id, item.data]));
  const classes = new Map((docsByCollection.siniflar || []).map(item => [item.id, item.data]));
  const byCollection = {};
  const lessonIds = new Set();
  const recordClassIds = new Set();
  const lessonClassIds = new Set();
  const mismatchPairs = new Set();
  const owners = new Set();
  const periods = new Set();
  const missingRecordClass = new Set();
  const existingRecordClass = new Set();
  const missingLessonClass = new Set();
  const dateRange = { firstDate: null, lastDate: null };
  let totalRecords = 0;
  let ownerMismatchRecords = 0;
  let periodMismatchRecords = 0;

  for (const collectionName of ['dersNotlari', 'odevler', 'yoklamalar']) {
    for (const item of docsByCollection[collectionName] || []) {
      const data = item.data;
      if (typeof data.dersId !== 'string' || !data.dersId) continue;
      const lesson = lessons.get(data.dersId);
      // A deleted timetable entry is intentionally tolerated by current Rules.
      if (!lesson || lesson.sinifId === data.sinifId) continue;

      totalRecords += 1;
      byCollection[collectionName] = (byCollection[collectionName] || 0) + 1;
      lessonIds.add(data.dersId);
      if (typeof data.sinifId === 'string' && data.sinifId) recordClassIds.add(data.sinifId);
      if (typeof lesson.sinifId === 'string' && lesson.sinifId) lessonClassIds.add(lesson.sinifId);
      mismatchPairs.add(String(data.sinifId || '<missing>') + '=>' + String(lesson.sinifId || '<missing>'));
      if (typeof data.uid === 'string' && data.uid) owners.add(data.uid);
      if (Number.isInteger(data.donemYili)) periods.add(data.donemYili);
      if (classes.has(data.sinifId)) existingRecordClass.add(data.sinifId);
      else if (data.sinifId) missingRecordClass.add(data.sinifId);
      if (!classes.has(lesson.sinifId) && lesson.sinifId) missingLessonClass.add(lesson.sinifId);
      if (lesson.uid !== data.uid) ownerMismatchRecords += 1;
      if (lesson.donemYili !== data.donemYili) periodMismatchRecords += 1;
      addDateRange(dateRange, recordDate(data));
    }
  }

  return {
    totalRecords,
    byCollection,
    distinctLessonReferences: lessonIds.size,
    distinctRecordClassReferences: recordClassIds.size,
    distinctLessonClassReferences: lessonClassIds.size,
    distinctMismatchPairs: mismatchPairs.size,
    recordsWhoseReferencedClassStillExists: [...existingRecordClass].length,
    recordsWhoseReferencedClassIsMissing: [...missingRecordClass].length,
    distinctMissingLessonClassReferences: missingLessonClass.size,
    ownerMismatchRecords,
    periodMismatchRecords,
    distinctOwners: owners.size,
    periodYears: [...periods].sort((a, b) => a - b),
    dateRange: dateRange.firstDate ? { first: dateRange.firstDate, last: dateRange.lastDate } : null,
  };
}

async function main() {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const db = getFirestore();
  const docsByCollection = {};
  for (const name of COLLECTIONS) docsByCollection[name] = await readCollection(db, name);

  const report = {
    projectId: PROJECT_ID,
    generatedAt: new Date().toISOString(),
    mode: 'READ_ONLY',
    privacy: 'Aggregate counts only; no document IDs, names, emails, or field values are output.',
    totalDocumentsScanned: Object.values(docsByCollection).reduce((sum, docs) => sum + docs.length, 0),
    missingClassReferences: groupMissingReferences(
      docsByCollection, 'siniflar', 'sinifId',
      ['ogrenciler', 'dersler', 'dersNotlari', 'odevler', 'yoklamalar', 'kitaplar', 'konular'],
    ),
    missingStudentReferences: groupMissingReferences(
      docsByCollection, 'ogrenciler', 'ogrenciId',
      ['yoklamalar', 'kitaplar', 'konular'],
    ),
    existingLessonWrongClassReferences: summarizeLessonClassMismatches(docsByCollection),
  };

  console.log('READ-ONLY FIRESTORE RELATIONSHIP DIAGNOSTICS COMPLETED');
  console.log(JSON.stringify(report, null, 2));
  console.log('No Firestore documents were changed.');
}

if (require.main === module) {
  main().catch(error => {
    console.error('FIRESTORE RELATIONSHIP DIAGNOSTICS FAILED:', error?.message || error);
    process.exitCode = 1;
  });
}

module.exports = { groupMissingReferences, summarizeLessonClassMismatches };
