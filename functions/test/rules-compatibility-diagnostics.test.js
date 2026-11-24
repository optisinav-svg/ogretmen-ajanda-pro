'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  groupMissingReferences,
  summarizeLessonClassMismatches,
} = require('../scripts/diagnose-rules-compatibility');

test('missing-reference groups aggregate by source collections without exposing identifiers', () => {
  const report = groupMissingReferences({
    siniflar: [{ id: 'class-existing', data: {} }],
    dersNotlari: [
      { id: 'n1', data: { sinifId: 'missing-a', uid: 'teacher-a', donemYili: 2026, tarih: '2026-09-01' } },
      { id: 'n2', data: { sinifId: 'missing-b', uid: 'teacher-b', donemYili: 2026, tarih: '2026-09-03' } },
    ],
    yoklamalar: [
      { id: 'y1', data: { sinifId: 'missing-a', uid: 'teacher-a', donemYili: 2026, tarih: '2026-09-02' } },
    ],
  }, 'siniflar', 'sinifId', ['dersNotlari', 'yoklamalar']);

  assert.equal(report.totalRecords, 3);
  assert.equal(report.distinctMissingReferences, 2);
  assert.equal(report.groups.length, 2);
  const shared = report.groups.find(item => item.collections.length === 2);
  assert.equal(shared.records, 2);
  assert.equal(shared.distinctMissingReferences, 1);
  assert.equal(shared.ownerCount, 1);
  assert.deepEqual(shared.periodYears, [2026]);
  assert.deepEqual(shared.dateRange, { first: '2026-09-01', last: '2026-09-02' });

  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes('missing-a'), false);
  assert.equal(serialized.includes('teacher-a'), false);
});

test('lesson mismatch summary distinguishes existing and missing record classes', () => {
  const report = summarizeLessonClassMismatches({
    siniflar: [
      { id: 'class-a', data: {} },
      { id: 'class-b', data: {} },
    ],
    dersler: [
      { id: 'lesson-a', data: { sinifId: 'class-b', uid: 'teacher-a', donemYili: 2026 } },
    ],
    dersNotlari: [
      { id: 'n1', data: { dersId: 'lesson-a', sinifId: 'class-a', uid: 'teacher-a', donemYili: 2026, tarih: '2026-09-01' } },
    ],
    odevler: [
      { id: 'o1', data: { dersId: 'lesson-a', sinifId: 'missing-class', uid: 'teacher-a', donemYili: 2026, tarih: '2026-09-02' } },
    ],
    yoklamalar: [
      { id: 'y1', data: { dersId: 'lesson-a', sinifId: 'class-a', uid: 'teacher-a', donemYili: 2026, tarih: '2026-09-03' } },
    ],
  });

  assert.equal(report.totalRecords, 3);
  assert.deepEqual(report.byCollection, { dersNotlari: 1, odevler: 1, yoklamalar: 1 });
  assert.equal(report.distinctLessonReferences, 1);
  assert.equal(report.distinctMismatchPairs, 2);
  assert.equal(report.recordsWhoseReferencedClassStillExists, 2);
  assert.equal(report.recordsWhoseReferencedClassIsMissing, 1);
  assert.equal(report.ownerMismatchRecords, 0);
  assert.equal(report.periodMismatchRecords, 0);
  assert.deepEqual(report.dateRange, { first: '2026-09-01', last: '2026-09-03' });

  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes('lesson-a'), false);
  assert.equal(serialized.includes('class-a'), false);
});
