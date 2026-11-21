const fs = require('node:fs');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  addDoc,
} = require('firebase/firestore');

const PROJECT_ID = 'demo-ogretmen-ajanda-rules';
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'kullanicilar', 'teacher-a'), {
      kullaniciAdi: 'Öğretmen A',
      brans: 'Coğrafya',
    }); // Eski profil: rol alanı yok.

    await setDoc(doc(db, 'kullanicilar', 'teacher-b'), {
      kullaniciAdi: 'Öğretmen B',
      rol: 'ogretmen',
    });

    await setDoc(doc(db, 'kullanicilar', 'student-1'), {
      kullaniciAdi: 'Öğrenci 1',
      rol: 'ogrenci',
    });

    await setDoc(doc(db, 'okullar', 'school-a'), {
      uid: 'teacher-a',
      ad: 'A Okulu',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'okullar', 'school-b'), {
      uid: 'teacher-b',
      ad: 'B Okulu',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'siniflar', 'class-a'), {
      uid: 'teacher-a',
      okulId: 'school-a',
      ad: '9-A',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'ogrenciler', 'student-a'), {
      uid: 'teacher-a',
      sinifId: 'class-a',
      adSoyad: 'Test Öğrencisi',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'dersNotlari', 'note-a'), {
      uid: 'teacher-a',
      sinifId: 'class-a',
      not: 'Test konusu',
      donemYili: 2026,
    });
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

test('Öğretmen kendi okul kayıtlarını sorgulayabilir', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  const q = query(collection(db, 'okullar'), where('uid', '==', 'teacher-a'));
  await assertSucceeds(getDocs(q));
});

test('Öğretmen başka öğretmenin belgesini okuyamaz', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(getDoc(doc(db, 'okullar', 'school-b')));
});

test('Öğretmen başka UID adına kayıt oluşturamaz', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(addDoc(collection(db, 'okullar'), {
    uid: 'teacher-b',
    ad: 'Sahte okul',
    donemYili: 2026,
  }));
});

test('Öğretmen mevcut kaydın UID değerini değiştiremez', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(updateDoc(doc(db, 'okullar', 'school-a'), {
    uid: 'teacher-b',
  }));
});

test('Öğretmen başka öğretmenin okuluna sınıf ekleyemez', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(addDoc(collection(db, 'siniflar'), {
    uid: 'teacher-a',
    okulId: 'school-b',
    ad: '9-B',
    donemYili: 2026,
  }));
});

test('Öğretmen kendi okuluna sınıf ekleyebilir', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertSucceeds(addDoc(collection(db, 'siniflar'), {
    uid: 'teacher-a',
    okulId: 'school-a',
    ad: '9-C',
    donemYili: 2026,
  }));
});

test('Öğrenci rolü öğretmen koleksiyonlarına erişemez', async () => {
  const db = testEnv.authenticatedContext('student-1').firestore();
  await assertFails(getDocs(query(
    collection(db, 'okullar'),
    where('uid', '==', 'student-1'),
  )));
});

test('Kullanıcı başka bir kullanıcının profilini okuyamaz', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(getDoc(doc(db, 'kullanicilar', 'teacher-b')));
});

test('Tanımlanmamış koleksiyonlara erişim reddedilir', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(getDoc(doc(db, 'bilinmeyenKoleksiyon', 'x')));
});
