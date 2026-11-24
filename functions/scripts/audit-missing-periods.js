#!/usr/bin/env node
'use strict';

// Read-only inventory for period consistency. This script never writes to Firestore.
// It reports missing/invalid donemYili fields and only infers dates outside June.
// June is deliberately ambiguous because the selected period controls the overlap.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldPath } = require('firebase-admin/firestore');

const PROJECT_ID = 'ogretmen-takip';
const TARGET_PERIOD = 2026;
const PAGE_SIZE = 400;
const SAMPLE_LIMIT = 12;
const COLLECTIONS = Object.freeze([
  'okullar',
  'siniflar',
  'ogrenciler',
  'dersler',
  'dersNotlari',
  'odevler',
  'yoklamalar',
  'kitaplar',
  'konular',
]);

function asDate(value) {
  if (value && typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  if (value === null || value === undefined || value === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function istanbulDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function inferFromDate(data) {
  const candidates = [
    ['tarih', data.tarih],
    ['baslangicTarih', data.baslangicTarih],
    ['teslimTarihi', data.teslimTarihi],
    ['olusturulma', data.olusturulma],
  ];
  const selected = candidates.find(([, value]) => value !== undefined && value !== null && value !== '');
  if (!selected) return { status: 'no-date' };

  const [dateField, rawValue] = selected;
  const date = asDate(rawValue);
  if (!date) return { status: 'invalid-date', dateField };

  const parts = istanbulDateParts(date);
  const isoDate = [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');

  // June belongs to an overlap window; the selected donemYili is authoritative.
  if (parts.month === 6) {
    return { status: 'ambiguous-june', dateField, date: isoDate };
  }

  const inferredPeriod = parts.month >= 7 ? parts.year : parts.year - 1;
  return {
    status: inferredPeriod === TARGET_PERIOD ? 'inferred-target' : 'other-period',
    dateField,
    date: isoDate,
    inferredPeriod,
  };
}

async function scanCollection(db, collectionName) {
  const collectionRef = db.collection(collectionName);
  let cursor = null;
  const summary = {
    scanned: 0,
    explicitPeriods: {},
    missing: 0,
    invalidExisting: 0,
    inferredTarget: 0,
    ambiguousJune: 0,
    otherPeriod: 0,
    noDate: 0,
    invalidDate: 0,
    samples: {
      missing: [],
      invalidExisting: [],
      ambiguousJune: [],
      otherPeriod: [],
      noDate: [],
      invalidDate: [],
    },
  };

  while (true) {
    let query = collectionRef.orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;

    for (const document of page.docs) {
      const data = document.data();
      summary.scanned += 1;

      if (Object.prototype.hasOwnProperty.call(data, 'donemYili')) {
        if (typeof data.donemYili === 'number' && Number.isInteger(data.donemYili)) {
          const key = String(data.donemYili);
          summary.explicitPeriods[key] = (summary.explicitPeriods[key] || 0) + 1;
        } else {
          summary.invalidExisting += 1;
          if (summary.samples.invalidExisting.length < SAMPLE_LIMIT) {
            summary.samples.invalidExisting.push({
              idSuffix: document.id.slice(-6),
              valueType: data.donemYili === null ? 'null' : typeof data.donemYili,
            });
          }
        }
        continue;
      }

      summary.missing += 1;
      const inferred = inferFromDate(data);
      if (inferred.status === 'inferred-target') summary.inferredTarget += 1;
      else if (inferred.status === 'ambiguous-june') summary.ambiguousJune += 1;
      else if (inferred.status === 'other-period') summary.otherPeriod += 1;
      else if (inferred.status === 'invalid-date') summary.invalidDate += 1;
      else summary.noDate += 1;

      if (inferred.status !== 'inferred-target' && summary.samples[inferred.status.replaceAll('-', '')]?.length < SAMPLE_LIMIT) {
        const key = inferred.status === 'ambiguous-june' ? 'ambiguousJune'
          : inferred.status === 'other-period' ? 'otherPeriod'
          : inferred.status === 'invalid-date' ? 'invalidDate'
          : inferred.status === 'no-date' ? 'noDate' : null;
        if (key && summary.samples[key].length < SAMPLE_LIMIT) {
          summary.samples[key].push({
            idSuffix: document.id.slice(-6),
            dateField: inferred.dateField || null,
            date: inferred.date || null,
            inferredPeriod: inferred.inferredPeriod || null,
          });
        }
      }
      if (inferred.status === 'inferred-target' && summary.samples.missing.length < SAMPLE_LIMIT) {
        summary.samples.missing.push({
          idSuffix: document.id.slice(-6),
          dateField: inferred.dateField,
          date: inferred.date,
          inferredPeriod: inferred.inferredPeriod,
        });
      }
    }

    cursor = page.docs[page.docs.length - 1];
    if (page.size < PAGE_SIZE) break;
  }
  return summary;
}

async function main() {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const db = getFirestore();
  const report = {
    projectId: PROJECT_ID,
    generatedAt: new Date().toISOString(),
    mode: 'READ_ONLY',
    targetPeriodForReview: TARGET_PERIOD,
    note: 'June dates are ambiguous and are never assigned automatically. No Firestore writes are performed.',
    collections: {},
  };

  for (const name of COLLECTIONS) {
    report.collections[name] = await scanCollection(db, name);
  }

  console.log('READ-ONLY PERIOD AUDIT COMPLETED');
  console.log(JSON.stringify(report, null, 2));
  console.log('No Firestore documents were changed.');
}

main().catch(error => {
  console.error('PERIOD AUDIT FAILED:', error && error.message ? error.message : error);
  process.exitCode = 1;
});
