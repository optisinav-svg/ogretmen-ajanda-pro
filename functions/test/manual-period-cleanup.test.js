'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  getEligibleCleanupTarget,
  validateBackupManifest,
  validateDeleteConfirmation,
  sumCounts,
} = require('../scripts/manual-period-cleanup');

const COLLECTIONS = [
  'dersNotlari', 'dersler', 'yoklamalar', 'odevler', 'kitaplar', 'konular',
];

function manifest(createdAt = '2028-07-10T09:00:00.000Z') {
  return {
    projectId: 'ogretmen-takip',
    createdAt,
    archive: 'firestore-backup.jsonl.gz',
    readOnly: true,
    totalDocuments: 12,
    archiveSha256: 'a'.repeat(64),
    collections: Object.fromEntries(COLLECTIONS.map(name => [name, 2])),
  };
}

test('retention cleanup is unavailable before July 2028', () => {
  assert.equal(getEligibleCleanupTarget(new Date('2028-06-30T20:59:00.000Z')), null);
  assert.equal(getEligibleCleanupTarget(new Date('2027-07-15T12:00:00.000Z')), null);
});

test('July 2028 cleanup targets only the 2026 period', () => {
  assert.deepEqual(
    getEligibleCleanupTarget(new Date('2028-07-01T00:00:00.000Z')),
    { currentYear: 2028, month: 7, targetYear: 2026 },
  );
});

test('each July after the first cleanup advances by exactly one period', () => {
  assert.equal(getEligibleCleanupTarget(new Date('2029-07-15T12:00:00.000Z')).targetYear, 2027);
  assert.equal(getEligibleCleanupTarget(new Date('2030-07-15T12:00:00.000Z')).targetYear, 2028);
});

test('backup must be recent, read-only, for the expected project, and hash-addressed', () => {
  const now = new Date('2028-07-10T10:00:00.000Z');
  assert.equal(validateBackupManifest(manifest(), now), true);
  assert.throws(() => validateBackupManifest(manifest('2028-07-08T09:00:00.000Z'), now), /son 24 saat/);
  assert.throws(() => validateBackupManifest({ ...manifest(), projectId: 'other-project' }, now), /ogretmen-takip/);
  assert.throws(() => validateBackupManifest({ ...manifest(), readOnly: false }, now), /salt okunur/);
  assert.throws(() => validateBackupManifest({ ...manifest(), archiveSha256: 'bad' }, now), /SHA-256/);
});

test('backup may omit a truly empty retention collection', () => {
  const value = manifest();
  delete value.collections.konular;
  assert.equal(validateBackupManifest(value, new Date('2028-07-10T10:00:00.000Z')), true);
});

test('delete confirmation must match target, total, owner and exact backup hash', () => {
  const argv = [
    '--delete',
    '--owner-uid=owner-uid',
    '--confirm-target=ogretmen-takip:2026',
    '--confirm-total=12',
    '--confirm-backup-sha256=' + 'a'.repeat(64),
  ];
  assert.equal(validateDeleteConfirmation({
    argv, ownerUid: 'owner-uid', targetYear: 2026, total: 12, backupSha256: 'a'.repeat(64),
  }), true);
  assert.throws(() => validateDeleteConfirmation({
    argv, ownerUid: 'owner-uid', targetYear: 2027, total: 12, backupSha256: 'a'.repeat(64),
  }), /Hedef dönem/);
  assert.throws(() => validateDeleteConfirmation({
    argv, ownerUid: 'owner-uid', targetYear: 2026, total: 13, backupSha256: 'a'.repeat(64),
  }), /Belge sayısı/);
  assert.throws(() => validateDeleteConfirmation({
    argv, ownerUid: 'owner-uid', targetYear: 2026, total: 12, backupSha256: 'b'.repeat(64),
  }), /SHA-256/);
  assert.throws(() => validateDeleteConfirmation({
    argv: ['--preview'], ownerUid: 'owner-uid', targetYear: 2026, total: 12, backupSha256: 'a'.repeat(64),
  }), /Silme modu/);
});

test('planned total is the sum of collection counts', () => {
  assert.equal(sumCounts({ dersNotlari: 2, dersler: 3, yoklamalar: 4, odevler: 1 }), 10);
});
