#!/usr/bin/env node
'use strict';

// Read-only account ownership audit. This script never writes to Auth or Firestore.
// Pass only the exact email addresses that need comparison; it does not enumerate all users.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const PROJECT_ID = 'ogretmen-takip';
const OWNERSHIP_FIELDS = Object.freeze([
  'uid',
  'ogretmenUid',
  'ogrenciUid',
  'ownerUid',
  'createdByUid',
]);
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
  'bireyselEtkinlikler',
  'bireyselDersOturumlari',
  'ogretmenOgrenciBaglantilari',
  'ogrenciKayitEslesmeleri',
  'ogrenciEslesmeTalepleri',
  'ogrenciEslesmeKodlari',
  'ogrenciOdevBildirimleri',
  'ogrenciYeniOdevBildirimleri',
]);

async function countByField(db, collectionName, field, uid) {
  try {
    const result = await db.collection(collectionName).where(field, '==', uid).count().get();
    return result.data().count;
  } catch (error) {
    // A missing collection/field should not stop the read-only audit.
    if (error && (error.code === 5 || error.code === 'not-found')) return 0;
    throw error;
  }
}

async function auditAccount(auth, db, email) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error && (error.code === 'auth/user-not-found' || error.code === 'user-not-found')) {
      return { email, authUserFound: false };
    }
    throw error;
  }

  const profileSnap = await db.collection('kullanicilar').doc(user.uid).get();
  const collectionCounts = {};
  let totalOwnershipReferences = 0;

  for (const collectionName of COLLECTIONS) {
    const fields = {};
    for (const field of OWNERSHIP_FIELDS) {
      const count = await countByField(db, collectionName, field, user.uid);
      if (count > 0) {
        fields[field] = count;
        totalOwnershipReferences += count;
      }
    }
    if (Object.keys(fields).length > 0) collectionCounts[collectionName] = fields;
  }

  return {
    email: user.email,
    uid: user.uid,
    authUserFound: true,
    emailVerified: user.emailVerified,
    disabled: user.disabled,
    authCreatedAt: user.metadata.creationTime || null,
    lastSignInAt: user.metadata.lastSignInTime || null,
    firestoreProfileExists: profileSnap.exists,
    firestoreProfile: profileSnap.exists ? {
      rol: profileSnap.get('rol') || null,
      hesapDurumu: profileSnap.get('hesapDurumu') || null,
      adSoyadVar: Boolean(profileSnap.get('adSoyad') || profileSnap.get('ad') || profileSnap.get('soyad')),
      bransVar: Boolean(profileSnap.get('brans')),
      donemYili: profileSnap.get('donemYili') || null,
    } : null,
    collectionCounts,
    totalOwnershipReferences,
  };
}

async function main() {
  const emails = process.argv.slice(2).map(value => value.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) {
    throw new Error('En az bir e-posta parametresi verin. Örnek: node .\\scripts\\audit-account-ownership.js hesap1@example.com hesap2@example.com');
  }
  if (new Set(emails).size !== emails.length) {
    throw new Error('Aynı e-posta adresi birden fazla kez verildi.');
  }

  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const auth = getAuth();
  const db = getFirestore();

  const report = {
    projectId: PROJECT_ID,
    generatedAt: new Date().toISOString(),
    mode: 'READ_ONLY',
    note: 'Bu rapor Auth veya Firestore verisini değiştirmez. Koleksiyon sayıları sahiplik alanlarına göre referans sayılarıdır; aynı belge birden fazla alanda sayılabilir.',
    accounts: [],
  };

  for (const email of emails) {
    report.accounts.push(await auditAccount(auth, db, email));
  }

  console.log('READ-ONLY ACCOUNT OWNERSHIP AUDIT COMPLETED');
  console.log(JSON.stringify(report, null, 2));
  console.log('No Auth users or Firestore documents were changed.');
}

main().catch(error => {
  console.error('ACCOUNT AUDIT FAILED:', error && error.message ? error.message : error);
  process.exitCode = 1;
});
