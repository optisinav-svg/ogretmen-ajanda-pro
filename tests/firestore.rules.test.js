const fs = require('node:fs');
const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
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
  deleteDoc,
  writeBatch,
  serverTimestamp,
  deleteField,
} = require('firebase/firestore');

// These tests run only against the local Firestore Emulator.
// The project ID is intentionally a demo ID, never the production Firebase project.
// Test dependencies are installed in an isolated temporary folder in CI.
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
      rol: 'ogretmen',
    });

    await setDoc(doc(db, 'kullanicilar', 'teacher-legacy'), {
      kullaniciAdi: 'Rolü tanımsız hesap',
    });

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
    await setDoc(doc(db, 'okullar', 'school-legacy'), {
      uid: 'teacher-legacy',
      ad: 'Rolü tanımsız hesabın okulu',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'okullar', 'school-old'), {
      uid: 'teacher-a',
      ad: 'Eski dönem okulu',
      donemYili: 2025,
    });
    await setDoc(doc(db, 'siniflar', 'class-a'), {
      uid: 'teacher-a',
      okulId: 'school-a',
      ad: '9-A',
      kademe: '9',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'siniflar', 'class-b'), {
      uid: 'teacher-b',
      okulId: 'school-b',
      ad: '9-B',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'siniflar', 'class-c'), {
      uid: 'teacher-a',
      okulId: 'school-a',
      ad: '9-C',
      kademe: '9',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'ogrenciler', 'student-a'), {
      uid: 'teacher-a',
      sinifId: 'class-a',
      ad: 'Test',
      soyad: 'Öğrencisi',
      eposta: 'student-new@example.com',
      epostaEslesme: 'student-new@example.com',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'ogrenciler', 'student-b'), {
      uid: 'teacher-b',
      sinifId: 'class-b',
      adSoyad: 'Başka Öğretmenin Öğrencisi',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'dersler', 'lesson-a'), {
      uid: 'teacher-a',
      sinifId: 'class-a',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'dersler', 'lesson-b'), {
      uid: 'teacher-b',
      sinifId: 'class-b',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'dersNotlari', 'note-a'), {
      uid: 'teacher-a',
      sinifId: 'class-a',
      not: 'Test konusu',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'kullanicilar', 'student-2'), { kullaniciAdi: 'Öğrenci 2', rol: 'ogrenci' });
    await setDoc(doc(db, 'kullanicilar', 'student-3'), { kullaniciAdi: 'Öğrenci 3', rol: 'ogrenci' });
    await setDoc(doc(db, 'kullanicilar', 'student-4'), { kullaniciAdi: 'Öğrenci 4', rol: 'ogrenci' });
    await setDoc(doc(db, 'ogretmenOgrenciBaglantilari', 'teacher-a__student-2__class-a'), {
      ogretmenUid: 'teacher-a', ogrenciUid: 'student-2', ogrenciKayitId: 'student-a',
      sinifId: 'class-a', donemYili: 2026, durum: 'active',
      izinler: { dersProgrami: true, dersNotlari: false, konular: true, yoklama: true, odevler: true, kitaplar: true },
    });
    await setDoc(doc(db, 'ogretmenOgrenciBaglantilari', 'teacher-a__student-3__class-a'), {
      talepId: 'old-relink-request',
      uid: 'teacher-a',
      ogretmenUid: 'teacher-a',
      ogretmenHesapAdi: 'Öğretmen A',
      ogrenciAd: 'Test Öğrencisi',
      sinifAd: '9-A',
      okulAd: 'A Okulu',
      donemYili: 2026,
      kademe: '9',
      ders: 'Coğrafya',
      ogrenciUid: 'student-3',
      ogrenciKayitId: 'student-a',
      ogrenciHesapAdi: 'Öğrenci 3',
      ogrenciEposta: 'student3@example.com',
      sinifId: 'class-a',
      izinler: { dersProgrami: true, dersNotlari: true, konular: true, yoklama: true, odevler: true, kitaplar: true },
      durum: 'revoked',
      olusturulma: new Date('2026-10-01T10:00:00.000Z'),
      iptalTarihi: new Date('2026-10-02T10:00:00.000Z'),
    });
    await setDoc(doc(db, 'ogrenciKayitEslesmeleri', 'teacher-a__student-a'), {
      uid: 'teacher-a',
      donemYili: 2026,
      ogretmenUid: 'teacher-a',
      ogrenciKayitId: 'student-a',
      ogrenciUid: 'student-3',
      sinifId: 'class-a',
      baglantiId: 'teacher-a__student-3__class-a',
      durum: 'revoked',
      iptalTarihi: new Date('2026-10-02T10:00:00.000Z'),
      guncellenme: new Date('2026-10-02T10:00:00.000Z'),
    });
    await setDoc(doc(db, 'ogretmenOgrenciBaglantilari', 'teacher-a__student-4__class-a'), {
      ogretmenUid: 'teacher-a', ogrenciUid: 'student-4', ogrenciKayitId: 'deleted-student',
      sinifId: 'class-a', donemYili: 2026, durum: 'active',
      izinler: { dersProgrami: true, dersNotlari: true, konular: true, yoklama: true, odevler: true, kitaplar: true },
    });
    await setDoc(doc(db, 'ogretmenOgrenciBaglantilari', 'teacher-a__student-1__class-a'), {
      ogretmenUid: 'teacher-a',
      ogrenciUid: 'student-1',
      ogrenciKayitId: 'student-a',
      sinifId: 'class-a',
      donemYili: 2026,
      durum: 'active',
      izinler: {
        dersProgrami: true,
        dersNotlari: true,
        konular: true,
        yoklama: true,
        odevler: true,
        kitaplar: true,
      },
    });
    await setDoc(doc(db, 'bireyselEtkinlikler', 'event-a'), {
      uid: 'teacher-a', ogrenciId: 'student-a', sinifId: 'class-a', tur: 'Özel Ders', donemYili: 2026,
    });
    await setDoc(doc(db, 'bireyselDersOturumlari', 'event-a_2026-11-20'), {
      uid: 'teacher-a', bireyselEtkinlikId: 'event-a', ogrenciId: 'student-a',
      sinifId: 'class-a', donemYili: 2026, tarih: '2026-11-20', konular: ['Test konusu'],
    });
    await setDoc(doc(db, 'kitaplar', 'book-a'), {
      uid: 'teacher-a', sinifId: 'class-a', ogrenciId: 'student-a',
      ad: 'Coğrafya kitabı', sayfaSayisi: 200, donemYili: 2026,
    });
    await setDoc(doc(db, 'konular', 'topic-a'), {
      uid: 'teacher-a', sinifId: 'class-a', ogrenciId: 'student-a',
      kitapId: 'book-a', ad: 'Harita bilgisi', baslangicSayfa: 1, bitisSayfa: 20, donemYili: 2026,
    });
    await setDoc(doc(db, 'bireyselEtkinlikler', 'event-b'), {
      uid: 'teacher-b', ogrenciId: 'student-b', sinifId: 'class-b', tur: 'Etüt', donemYili: 2026,
    });
    await setDoc(doc(db, 'dersNotlari', 'note-b'), {
      uid: 'teacher-b',
      sinifId: 'class-b',
      not: 'Başka öğretmenin notu',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'ogrenciOdevBildirimleri', 'notification-a'), {
      uid: 'teacher-a',
      ogretmenUid: 'teacher-a',
      ogrenciUid: 'student-1',
      ogrenciKayitId: 'student-a',
      baglantiId: 'teacher-a__student-1__class-a',
      odevId: 'homework-a',
      donemYili: 2026,
      durum: 'tamamlandi_bildirildi',
    });
    await setDoc(doc(db, 'ogrenciYeniOdevBildirimleri', 'new-homework-notification-a'), {
      ogrenciUid: 'student-1',
      ogretmenUid: 'teacher-a',
      baglantiId: 'teacher-a__student-1__class-a',
      ogrenciKayitId: 'student-a',
      sinifId: 'class-a',
      donemYili: 2026,
      odevId: 'homework-a',
      baslik: 'Yeni ödeviniz var',
      aciklama: 'Harita bilgisi',
      teslimTarihi: '2026-11-30',
      durum: 'aktif',
      okundu: false,
    });
    await setDoc(doc(db, 'odevler', 'homework-a'), {
      uid: 'teacher-a',
      sinifId: 'class-a',
      hedefOgrenciIds: ['student-a'],
      aciklama: 'Öğrenciye verilen ödev',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'odevler', 'homework-other'), {
      uid: 'teacher-a',
      sinifId: 'class-a',
      hedefOgrenciIds: ['student-b'],
      aciklama: 'Başka öğrenciye verilen ödev',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'yoklamalar', 'attendance-a'), {
      uid: 'teacher-a',
      sinifId: 'class-a',
      ogrenciId: 'student-a',
      durum: 'geldi',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'yoklamalar', 'attendance-other'), {
      uid: 'teacher-a',
      sinifId: 'class-a',
      ogrenciId: 'student-b',
      durum: 'gelmedi',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'dersNotlari', 'note-historical'), {
      uid: 'teacher-a',
      sinifId: 'class-a',
      dersId: 'deleted-lesson',
      not: 'Silinen gelecek dersin tarihsel notu',
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

test('Öğretmen başka öğretmenin sınıfına öğrenci ekleyemez', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(addDoc(collection(db, 'ogrenciler'), {
    uid: 'teacher-a',
    sinifId: 'class-b',
    adSoyad: 'Yetkisiz öğrenci',
    donemYili: 2026,
  }));
});

test('Yoklama yalnızca aynı öğretmenin sınıfındaki öğrenci için yazılabilir', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(addDoc(collection(db, 'yoklamalar'), {
    uid: 'teacher-a',
    sinifId: 'class-a',
    ogrenciId: 'student-b',
    durum: 'geldi',
    donemYili: 2026,
  }));
});

test('Kitap yalnızca öğretmenin kendi sınıfındaki öğrenciye atanabilir', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(addDoc(collection(db, 'kitaplar'), {
    uid: 'teacher-a',
    sinifId: 'class-b',
    ogrenciId: 'student-b',
    ad: 'Yetkisiz kitap',
    donemYili: 2026,
  }));
});

test('Kitap ve konu aynı batch içinde güvenli biçimde oluşturulabilir', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  const batch = writeBatch(db);
  const bookRef = doc(collection(db, 'kitaplar'));
  const topicRef = doc(collection(db, 'konular'));

  batch.set(bookRef, {
    uid: 'teacher-a',
    sinifId: 'class-a',
    ogrenciId: 'student-a',
    ad: 'Test kitabı',
    sayfaSayisi: 100,
    donemYili: 2026,
  });
  batch.set(topicRef, {
    uid: 'teacher-a',
    sinifId: 'class-a',
    ogrenciId: 'student-a',
    kitapId: bookRef.id,
    ad: 'Test konusu',
    baslangicSayfa: 1,
    bitisSayfa: 10,
    donemYili: 2026,
  });

  await assertSucceeds(batch.commit());
});

test('Öğretmen kendi kitap kütüphanesine geçerli kitap ve konu ekleyebilir', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  const bookRef = doc(collection(db, 'kitapKutuphanesi'));
  await assertSucceeds(setDoc(bookRef, {
    uid: 'teacher-a',
    ad: 'Coğrafya Kaynak Kitabı',
    sayfaSayisi: 240,
    olusturulma: new Date().toISOString(),
  }));

  const topicRef = doc(collection(db, 'kitapKutuphanesiKonulari'));
  await assertSucceeds(setDoc(topicRef, {
    uid: 'teacher-a',
    kitapId: bookRef.id,
    kitapAd: 'Coğrafya Kaynak Kitabı',
    ad: 'Harita Bilgisi',
    baslangicSayfa: 1,
    bitisSayfa: 20,
    kazanımKodu: '',
    kaynak: 'manuel',
    olusturulma: new Date().toISOString(),
  }));
});

test('Kitap kütüphanesi sayfa sınırını ve konu aralığını Firestore kuralları doğrular', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  const invalidBookRef = doc(collection(db, 'kitapKutuphanesi'));
  await assertFails(setDoc(invalidBookRef, {
    uid: 'teacher-a',
    ad: 'Geçersiz kitap',
    sayfaSayisi: 0,
    olusturulma: new Date().toISOString(),
  }));

  const bookRef = doc(collection(db, 'kitapKutuphanesi'));
  await assertSucceeds(setDoc(bookRef, {
    uid: 'teacher-a',
    ad: 'Geçerli kitap',
    sayfaSayisi: 100,
    olusturulma: new Date().toISOString(),
  }));
  const invalidTopicRef = doc(collection(db, 'kitapKutuphanesiKonulari'));
  await assertFails(setDoc(invalidTopicRef, {
    uid: 'teacher-a',
    kitapId: bookRef.id,
    kitapAd: 'Geçerli kitap',
    ad: 'Sayfa sınırını aşan konu',
    baslangicSayfa: 90,
    bitisSayfa: 101,
    kazanımKodu: '',
    kaynak: 'manuel',
    olusturulma: new Date().toISOString(),
  }));
});

test('Kitap kütüphanesi konusu başka öğretmenin kitabına taşınamaz', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'kitapKutuphanesi', 'library-book-b'), {
      uid: 'teacher-b',
      ad: 'B öğretmeninin kitabı',
      sayfaSayisi: 100,
      olusturulma: new Date().toISOString(),
    });
  });
  const ownBook = doc(collection(db, 'kitapKutuphanesi'));
  await assertSucceeds(setDoc(ownBook, {
    uid: 'teacher-a',
    ad: 'A öğretmeninin kitabı',
    sayfaSayisi: 100,
    olusturulma: new Date().toISOString(),
  }));
  const topicRef = doc(collection(db, 'kitapKutuphanesiKonulari'));
  await assertSucceeds(setDoc(topicRef, {
    uid: 'teacher-a',
    kitapId: ownBook.id,
    kitapAd: 'A öğretmeninin kitabı',
    ad: 'Başlangıç konusu',
    baslangicSayfa: 1,
    bitisSayfa: 10,
    kazanımKodu: '',
    kaynak: 'manuel',
    olusturulma: new Date().toISOString(),
  }));
  await assertFails(updateDoc(topicRef, { kitapId: 'library-book-b', kitapAd: 'B öğretmeninin kitabı' }));
});

test('Öğretmen başka öğretmenin kitap kütüphanesi kitabına konu ekleyemez', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'kitapKutuphanesi', 'library-book-b'), {
      uid: 'teacher-b',
      ad: 'B öğretmeninin kitabı',
      sayfaSayisi: 100,
      olusturulma: new Date().toISOString(),
    });
  });

  await assertFails(addDoc(collection(db, 'kitapKutuphanesiKonulari'), {
    uid: 'teacher-a',
    kitapId: 'library-book-b',
    kitapAd: 'B öğretmeninin kitabı',
    ad: 'Yetkisiz konu',
    baslangicSayfa: 1,
    bitisSayfa: 5,
    kazanımKodu: '',
    kaynak: 'manuel',
    olusturulma: new Date().toISOString(),
  }));
});

test('Not başka öğretmenin ders programına bağlanamaz', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(addDoc(collection(db, 'dersNotlari'), {
    uid: 'teacher-a',
    sinifId: 'class-a',
    dersId: 'lesson-b',
    not: 'Başka öğretmenin dersi',
    donemYili: 2026,
  }));
});

test('Silinmiş ders programına bağlı tarihsel not düzenlenebilir', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertSucceeds(updateDoc(doc(db, 'dersNotlari', 'note-historical'), {
    not: 'Tarihsel not düzenlendi',
  }));
});


test('Öğretmen kendi ders konusunu sonradan düzenleyebilir; öğrenci yalnızca okuyabilir', async () => {
  const teacherDb = testEnv.authenticatedContext('teacher-a').firestore();
  const studentDb = testEnv.authenticatedContext('student-1').firestore();

  await assertSucceeds(updateDoc(doc(teacherDb, 'dersNotlari', 'note-a'), {
    not: 'Sonradan düzenlenen konu',
  }));
  await assertFails(updateDoc(doc(studentDb, 'dersNotlari', 'note-a'), {
    not: 'Öğrenci tarafından değiştirilmemeli',
  }));

  const saved = await getDoc(doc(teacherDb, 'dersNotlari', 'note-a'));
  assert.equal(saved.get('not'), 'Sonradan düzenlenen konu');
});


test('Öğretmen kendi profilini Spark üzerinde oluşturabilir ancak uygulama sahibi yetkisi veremez', async () => {
  const db = testEnv.authenticatedContext('teacher-new', {
    email: 'teacher-new@example.com',
    email_verified: true,
  }).firestore();
  await assertSucceeds(setDoc(doc(db, 'kullanicilar', 'teacher-new'), {
    kullaniciAdi: 'Yeni Öğretmen',
    brans: 'Coğrafya',
    sezon: '2026/2027',
    eposta: 'teacher-new@example.com',
    rol: 'ogretmen',
    olusturulmaTarihi: new Date().toISOString(),
  }));
  await assertFails(updateDoc(doc(db, 'kullanicilar', 'teacher-new'), {
    uygulamaSahibi: true,
  }));
});

test('Öğretmen profilindeki izinli alanlar geçerli değerlerle güncellenebilir', async () => {
  const db = testEnv.authenticatedContext('teacher-profile-update').firestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'kullanicilar', 'teacher-profile-update'), {
      kullaniciAdi: 'Öğretmen Eski',
      brans: 'Coğrafya',
      sezon: '2026/2027',
      eposta: 'teacher-profile-update@example.com',
      rol: 'ogretmen',
    });
  });
  await assertSucceeds(updateDoc(doc(db, 'kullanicilar', 'teacher-profile-update'), {
    kullaniciAdi: 'Öğretmen Yeni',
    brans: 'Tarih',
    sezon: '2027/2028',
  }));
});

test('Öğretmen profili güncellemesi boş, uzun veya hatalı tipte alanları reddeder', async () => {
  const db = testEnv.authenticatedContext('teacher-profile-invalid').firestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'kullanicilar', 'teacher-profile-invalid'), {
      kullaniciAdi: 'Öğretmen',
      brans: 'Coğrafya',
      sezon: '2026/2027',
      eposta: 'teacher-profile-invalid@example.com',
      rol: 'ogretmen',
    });
  });
  const ref = doc(db, 'kullanicilar', 'teacher-profile-invalid');
  await assertFails(updateDoc(ref, { kullaniciAdi: 'A' }));
  await assertFails(updateDoc(ref, { kullaniciAdi: 'x'.repeat(81) }));
  await assertFails(updateDoc(ref, { kullaniciAdi: 123 }));
  await assertFails(updateDoc(ref, { brans: '' }));
  await assertFails(updateDoc(ref, { brans: 'x'.repeat(81) }));
  await assertFails(updateDoc(ref, { brans: 123 }));
  await assertFails(updateDoc(ref, { sezon: '2026-2027' }));
  await assertFails(updateDoc(ref, { sezon: 2026 }));
});

test('Öğrenci kendi profilinde branş ve sezon alanlarını değiştiremez', async () => {
  const db = testEnv.authenticatedContext('student-profile-update').firestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'kullanicilar', 'student-profile-update'), {
      kullaniciAdi: 'Öğrenci',
      eposta: 'student-profile-update@example.com',
      rol: 'ogrenci',
    });
  });
  const ref = doc(db, 'kullanicilar', 'student-profile-update');
  await assertSucceeds(updateDoc(ref, { kullaniciAdi: 'Öğrenci Yeni' }));
  await assertFails(updateDoc(ref, { brans: 'Coğrafya' }));
  await assertFails(updateDoc(ref, { sezon: '2026/2027' }));
});

test('Öğretmen profili oluşturma kuralları branş ve sezon biçimini doğrular', async () => {
  const db = testEnv.authenticatedContext('teacher-invalid-create', {
    email: 'teacher-invalid-create@example.com',
    email_verified: true,
  }).firestore();
  const ref = doc(db, 'kullanicilar', 'teacher-invalid-create');
  const base = {
    kullaniciAdi: 'Yeni Öğretmen',
    brans: 'Coğrafya',
    sezon: '2026/2027',
    eposta: 'teacher-invalid-create@example.com',
    rol: 'ogretmen',
    olusturulmaTarihi: new Date().toISOString(),
  };
  await assertFails(setDoc(ref, { ...base, brans: 'x'.repeat(51) }));
  await assertFails(setDoc(ref, { ...base, brans: 123 }));
  await assertFails(setDoc(ref, { ...base, sezon: '2026-2027' }));
  await assertFails(setDoc(ref, { ...base, sezon: 2026 }));
  await assertSucceeds(setDoc(ref, base));
});

test('Öğrenci profili öğretmene ait branş ve sezon alanlarını içeremez', async () => {
  const db = testEnv.authenticatedContext('student-profile-fields', {
    email: 'student-profile-fields@example.com',
    email_verified: true,
  }).firestore();
  await assertFails(setDoc(doc(db, 'kullanicilar', 'student-profile-fields'), {
    kullaniciAdi: 'Öğrenci Hesabı',
    eposta: 'student-profile-fields@example.com',
    rol: 'ogrenci',
    brans: 'Coğrafya',
    sezon: '2026/2027',
    ilkEslesmeTalepId: 'missing-request',
  }));
});

test('Öğrenci profili geçerli, doğrulanmış eşleştirme talebi olmadan oluşturulamaz', async () => {
  const db = testEnv.authenticatedContext('student-new', {
    email: 'student-new@example.com',
    email_verified: true,
  }).firestore();
  await assertFails(setDoc(doc(db, 'kullanicilar', 'student-new'), {
    kullaniciAdi: 'Yeni Öğrenci',
    eposta: 'student-new@example.com',
    rol: 'ogrenci',
    ilkEslesmeTalepId: 'missing-request',
    olusturulmaTarihi: new Date().toISOString(),
  }));
});

test('Kullanıcı oluşturduğu rolü öğretmen veya öğrenci olarak değiştiremez', async () => {
  const db = testEnv.authenticatedContext('teacher-b').firestore();
  await assertFails(updateDoc(doc(db, 'kullanicilar', 'teacher-b'), {
    rol: 'ogrenci',
  }));
});

test('Uygulama sahibi özel claim tek başına öğretmen yetkisi vermez', async () => {
  const db = testEnv.authenticatedContext('student-1', {
    uygulamaSahibi: true,
  }).firestore();
  await assertFails(getDoc(doc(db, 'okullar', 'school-a')));
});

test('Uygulama sahibi claim yalnızca toplu hesap ve bağlantı istatistiklerini okuyabilir', async () => {
  const ownerDb = testEnv.authenticatedContext('owner-account', {
    uygulamaSahibi: true,
  }).firestore();
  await assertSucceeds(getDocs(query(
    collection(ownerDb, 'kullanicilar'),
    where('rol', '==', 'ogretmen'),
  )));
  await assertSucceeds(getDocs(collection(ownerDb, 'ogretmenOgrenciBaglantilari')));
  await assertSucceeds(getDocs(collection(ownerDb, 'ogrenciEslesmeTalepleri')));
  await assertFails(getDoc(doc(ownerDb, 'ogrenciler', 'student-a')));
});

test('Uygulama sahibi Temmuz 2028 gelmeden dönem kayıtlarını okuyamaz veya silemez', async () => {
  const ownerDb = testEnv.authenticatedContext('owner-account', {
    uygulamaSahibi: true,
  }).firestore();
  await assertFails(getDoc(doc(ownerDb, 'dersler', 'lesson-a')));
  await assertFails(deleteDoc(doc(ownerDb, 'dersler', 'lesson-a')));
  await assertFails(setDoc(doc(ownerDb, 'donemTemizlikKayitlari', '2026'), {
    cleanupId: '2026',
    currentYear: 2026,
    targetYear: 2024,
    completedBy: 'owner-account',
    completedAt: serverTimestamp(),
    counts: { dersler: 0, dersNotlari: 0, yoklamalar: 0, odevler: 0, kitaplar: 0, konular: 0 },
    totalDeleted: 0,
    policyVersion: 1,
  }));
});

test('Uygulama sahibi claim olmadan kullanıcı ve bağlantı koleksiyonları toplu okunamaz', async () => {
  const teacherDb = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(getDocs(collection(teacherDb, 'kullanicilar')));
  await assertFails(getDocs(collection(teacherDb, 'ogretmenOgrenciBaglantilari')));
  await assertFails(getDocs(collection(teacherDb, 'ogrenciEslesmeTalepleri')));
});

test('Rol alanı olmayan hesap öğretmen yetkisi alamaz', async () => {
  const db = testEnv.authenticatedContext('teacher-legacy').firestore();
  await assertFails(getDoc(doc(db, 'okullar', 'school-legacy')));
});


test('Öğretmen eşleştirme talebini bağlantı oluşturmadan reddedebilir', async () => {
  const requestId = 'pending-rejection-test';

  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'ogrenciEslesmeTalepleri', requestId), {
      uid: 'teacher-a',
      ogretmenUid: 'teacher-a',
      ogrenciUid: 'student-1',
      ogrenciKayitId: 'student-a',
      sinifId: 'class-a',
      donemYili: 2026,
      durum: 'bekliyor',
    });
  });

  const teacherDb = testEnv.authenticatedContext('teacher-a').firestore();
  await assertSucceeds(updateDoc(doc(teacherDb, 'ogrenciEslesmeTalepleri', requestId), {
    durum: 'reddedildi',
    yanitTarihi: serverTimestamp(),
  }));
});

test('Sınıf taşıma işaretli öğrencinin kitap ve konu kayıtları hedef sınıfa güvenli biçimde aktarılabilir', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  const studentRef = doc(db, 'ogrenciler', 'student-a');
  const bookRef = doc(db, 'kitaplar', 'book-a');
  const topicRef = doc(db, 'konular', 'topic-a');

  await assertFails(updateDoc(bookRef, { sinifId: 'class-c' }));

  await assertSucceeds(updateDoc(studentRef, {
    sinifTasiIslemi: {
      kaynakSinifId: 'class-a',
      hedefSinifId: 'class-c',
      donemYili: 2026,
      tarih: '2026-11-22T12:00:00.000Z',
    },
  }));
  await assertFails(updateDoc(bookRef, { sinifId: 'class-b' }));
  await assertSucceeds(updateDoc(bookRef, { sinifId: 'class-c' }));
  await assertSucceeds(updateDoc(topicRef, { sinifId: 'class-c' }));
  await assertSucceeds(updateDoc(studentRef, {
    sinifId: 'class-c',
    sinifTasiIslemi: deleteField(),
  }));

  await testEnv.withSecurityRulesDisabled(async context => {
    const adminDb = context.firestore();
    await updateDoc(doc(adminDb, 'ogrenciler', 'student-a'), {
      sinifId: 'class-a',
      sinifTasiIslemi: deleteField(),
    });
    await updateDoc(doc(adminDb, 'kitaplar', 'book-a'), { sinifId: 'class-a' });
    await updateDoc(doc(adminDb, 'konular', 'topic-a'), { sinifId: 'class-a' });
  });
});

test('Öğrenci yalnızca eşleştirildiği kendi öğrenci kaydını okuyabilir', async () => {
  const db = testEnv.authenticatedContext('student-1').firestore();
  await assertSucceeds(getDoc(doc(db, 'ogrenciler', 'student-a')));
  await assertFails(getDoc(doc(db, 'ogrenciler', 'student-b')));
});

test('Öğrenci yalnızca izin verilen öğretmenin ders notlarını okuyabilir', async () => {
  const db = testEnv.authenticatedContext('student-1').firestore();
  await assertSucceeds(getDoc(doc(db, 'dersNotlari', 'note-a')));
  await assertFails(getDoc(doc(db, 'dersNotlari', 'note-b')));
});

test('Öğrenci yalnızca kendisine atanmış ödevi okuyabilir', async () => {
  const db = testEnv.authenticatedContext('student-1').firestore();
  await assertSucceeds(getDoc(doc(db, 'odevler', 'homework-a')));
  await assertFails(getDoc(doc(db, 'odevler', 'homework-other')));
});

test('Öğrenci yalnızca kendi yoklama kaydını okuyabilir', async () => {
  const db = testEnv.authenticatedContext('student-1').firestore();
  await assertSucceeds(getDoc(doc(db, 'yoklamalar', 'attendance-a')));
  await assertFails(getDoc(doc(db, 'yoklamalar', 'attendance-other')));
});

test('Öğrenci öğretmen-öğrenci bağlantısını veya paylaşım izinlerini değiştiremez', async () => {
  const db = testEnv.authenticatedContext('student-1').firestore();
  await assertFails(updateDoc(doc(db, 'ogretmenOgrenciBaglantilari', 'teacher-a__student-1__class-a'), {
    durum: 'revoked',
  }));
  await assertFails(updateDoc(doc(db, 'ogretmenOgrenciBaglantilari', 'teacher-a__student-1__class-a'), {
    izinler: { dersProgrami: true, dersNotlari: true, konular: true, yoklama: true, odevler: true, kitaplar: true },
  }));
});


test('Kapalı paylaşım izni ilgili öğrenci verisini engeller', async () => {
  const db = testEnv.authenticatedContext('student-2').firestore();
  await assertFails(getDoc(doc(db, 'dersNotlari', 'note-a')));
});

test('İptal edilmiş öğretmen bağlantısı öğrenci erişimini anında engeller', async () => {
  const db = testEnv.authenticatedContext('student-3').firestore();
  await assertFails(getDoc(doc(db, 'dersNotlari', 'note-a')));
});

test('Öğrenci eşleştirme indeksi istemciye kapalıdır', async () => {
  const db = testEnv.authenticatedContext('student-1').firestore();
  await assertFails(getDoc(doc(db, 'ogrenciKayitEslesmeleri', 'teacher-a__student-a')));
});


test('Bireysel etkinlik yalnızca öğretmenin kendi sınıfındaki öğrenci için oluşturulabilir', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertSucceeds(addDoc(collection(db, 'bireyselEtkinlikler'), {
    uid: 'teacher-a', ogrenciId: 'student-a', sinifId: 'class-a',
    tur: 'Özel Ders', donemYili: 2026,
  }));
  await assertFails(addDoc(collection(db, 'bireyselEtkinlikler'), {
    uid: 'teacher-a', ogrenciId: 'student-b', sinifId: 'class-b',
    tur: 'Özel Ders', donemYili: 2026,
  }));
});

test('Öğretmen bireysel etkinliği başka öğretmenin öğrencisine taşıyamaz', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(updateDoc(doc(db, 'bireyselEtkinlikler', 'event-a'), {
    ogrenciId: 'student-b',
    sinifId: 'class-b',
  }));
});

test('Öğretmen bireysel ders oturumunu başka öğrencinin etkinliğine taşıyamaz', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(updateDoc(doc(db, 'bireyselDersOturumlari', 'event-a_2026-11-20'), {
    bireyselEtkinlikId: 'event-b',
    ogrenciId: 'student-b',
    sinifId: 'class-b',
  }));
});

test('Bireysel ders oturumu yalnızca öğretmenin kendi etkinliğine bağlanabilir', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertSucceeds(addDoc(collection(db, 'bireyselDersOturumlari'), {
    uid: 'teacher-a', bireyselEtkinlikId: 'event-a',
    ogrenciId: 'student-a', sinifId: 'class-a', donemYili: 2026,
  }));
  await assertFails(addDoc(collection(db, 'bireyselDersOturumlari'), {
    uid: 'teacher-a', bireyselEtkinlikId: 'event-b',
    ogrenciId: 'student-a', sinifId: 'class-a', donemYili: 2026,
  }));
});


test('Öğretmen öğrenci kaydını silmişse etkin bağlantı öğrenci erişimi sağlamaz', async () => {
  const db = testEnv.authenticatedContext('student-4').firestore();
  await assertFails(getDoc(doc(db, 'dersNotlari', 'note-a')));
});


test('İptal edilen öğrenci bağlantısı aynı hesap için yeni öğretmen onayıyla yeniden etkinleştirilebilir', async () => {
  const teacherDb = testEnv.authenticatedContext('teacher-a').firestore();
  const requestId = 'relink-request-student-3';
  const linkId = 'teacher-a__student-3__class-a';
  const indexId = 'teacher-a__student-a';
  const requestRef = doc(teacherDb, 'ogrenciEslesmeTalepleri', requestId);
  const linkRef = doc(teacherDb, 'ogretmenOgrenciBaglantilari', linkId);
  const indexRef = doc(teacherDb, 'ogrenciKayitEslesmeleri', indexId);

  // Önce, yeni ve onaylanmış bir talep olmadan yeniden etkinleştirme reddedilmeli.
  await assertFails(updateDoc(linkRef, {
    durum: 'active',
    iptalTarihi: null,
    olusturulma: serverTimestamp(),
  }));

  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'ogrenciEslesmeTalepleri', requestId), {
      uid: 'teacher-a',
      ogretmenUid: 'teacher-a',
      ogrenciUid: 'student-3',
      ogrenciKayitId: 'student-a',
      sinifId: 'class-a',
      donemYili: 2026,
      ogrenciHesapAdi: 'Öğrenci 3',
      durum: 'bekliyor',
    });
  });

  const permissions = {
    dersProgrami: true, dersNotlari: true, konular: true,
    yoklama: true, odevler: true, kitaplar: true,
  };
  const batch = writeBatch(teacherDb);
  batch.update(linkRef, {
    talepId: requestId,
    ogretmenHesapAdi: 'Öğretmen A',
    ogrenciAd: 'Test Öğrencisi',
    sinifAd: '9-A',
    okulAd: 'A Okulu',
    kademe: '9',
    ders: 'Coğrafya',
    ogrenciHesapAdi: 'Öğrenci 3',
    ogrenciEposta: 'student3@example.com',
    izinler: permissions,
    durum: 'active',
    olusturulma: serverTimestamp(),
    iptalTarihi: null,
  });
  batch.update(indexRef, {
    ogrenciUid: 'student-3',
    sinifId: 'class-a',
    donemYili: 2026,
    baglantiId: linkId,
    durum: 'active',
    iptalTarihi: null,
    guncellenme: serverTimestamp(),
  });
  batch.update(requestRef, {
    durum: 'onaylandi',
    baglantiId: linkId,
    yanitTarihi: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());

  const [linkSnap, indexSnap, requestSnap] = await Promise.all([
    getDoc(linkRef), getDoc(indexRef), getDoc(requestRef),
  ]);
  assert.equal(linkSnap.data().durum, 'active');
  assert.equal(indexSnap.data().durum, 'active');
  assert.equal(requestSnap.data().durum, 'onaylandi');

  // Sonraki eşleştirme testleri aynı öğrenci kaydı indeksini kullanır.
  // Testler birbirini etkilemesin diye başlangıçtaki iptal durumunu geri yükle.
  await testEnv.withSecurityRulesDisabled(async context => {
    const adminDb = context.firestore();
    await updateDoc(doc(adminDb, 'ogretmenOgrenciBaglantilari', linkId), {
      durum: 'revoked',
      iptalTarihi: new Date('2026-10-02T10:00:00.000Z'),
    });
    await updateDoc(doc(adminDb, 'ogrenciKayitEslesmeleri', indexId), {
      durum: 'revoked',
      iptalTarihi: new Date('2026-10-02T10:00:00.000Z'),
    });
  });
});

test('Öğrenci yalnızca kendisine atanmış ödev için tamamlandı bildirimi oluşturabilir', async () => {
  const db = testEnv.authenticatedContext('student-1').firestore();
  await assertSucceeds(getDoc(doc(db, 'ogrenciOdevBildirimleri', 'notification-a')));
  const linkId = 'teacher-a__student-1__class-a';
  const ownId = ['student-1', linkId, 'homework-a'].join('__');
  await assertFails(setDoc(doc(db, 'ogrenciOdevBildirimleri', 'missing-class-id'), {
    uid: 'teacher-a',
    ogretmenUid: 'teacher-a',
    ogrenciUid: 'student-1',
    ogrenciKayitId: 'student-a',
    baglantiId: linkId,
    odevId: 'homework-a',
    donemYili: 2026,
    durum: 'tamamlandi_bildirildi',
  }));
  await assertSucceeds(setDoc(doc(db, 'ogrenciOdevBildirimleri', ownId), {
    uid: 'teacher-a',
    ogretmenUid: 'teacher-a',
    ogrenciUid: 'student-1',
    ogrenciKayitId: 'student-a',
    sinifId: 'class-a',
    baglantiId: linkId,
    odevId: 'homework-a',
    donemYili: 2026,
    durum: 'tamamlandi_bildirildi',
  }));
  await assertFails(setDoc(doc(db, 'ogrenciOdevBildirimleri', 'forbidden-notification'), {
    uid: 'teacher-a',
    ogretmenUid: 'teacher-a',
    ogrenciUid: 'student-1',
    ogrenciKayitId: 'student-a',
    sinifId: 'class-a',
    baglantiId: linkId,
    odevId: 'homework-other',
    donemYili: 2026,
    durum: 'tamamlandi_bildirildi',
  }));
});

test('Öğretmen öğrenci ödev bildirimini okuyabilir ancak istemciden değiştiremez', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertSucceeds(getDoc(doc(db, 'ogrenciOdevBildirimleri', 'notification-a')));
  await assertFails(updateDoc(doc(db, 'ogrenciOdevBildirimleri', 'notification-a'), {
    durum: 'incelendi',
  }));
});


test('Öğrenci paneli kendi bağlantı özetini ve izinli ders programını sorgulayabilir', async () => {
  const db = testEnv.authenticatedContext('student-1').firestore();
  await assertSucceeds(getDocs(query(
    collection(db, 'ogretmenOgrenciBaglantilari'),
    where('ogrenciUid', '==', 'student-1'),
  )));
  await assertSucceeds(getDoc(doc(db, 'siniflar', 'class-a')));
  await assertSucceeds(getDocs(query(
    collection(db, 'dersler'),
    where('uid', '==', 'teacher-a'),
    where('sinifId', '==', 'class-a'),
  )));
  await assertSucceeds(getDocs(query(
    collection(db, 'bireyselEtkinlikler'),
    where('uid', '==', 'teacher-a'),
    where('sinifId', '==', 'class-a'),
    where('ogrenciId', '==', 'student-a'),
  )));
  await assertSucceeds(getDocs(query(
    collection(db, 'bireyselDersOturumlari'),
    where('uid', '==', 'teacher-a'),
    where('sinifId', '==', 'class-a'),
    where('ogrenciId', '==', 'student-a'),
  )));
});

test('Sınıfı değişen öğrenci geçmiş sınıfındaki kendi yoklama kayıtlarını görmeye devam eder', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'kullanicilar', 'student-history-user'), {
      kullaniciAdi: 'Geçmiş sınıf öğrencisi',
      rol: 'ogrenci',
    });
    await setDoc(doc(adminDb, 'ogrenciler', 'student-history-record'), {
      uid: 'teacher-a',
      sinifId: 'class-c',
      sinifGecmisiIds: ['class-a'],
      donemYili: 2026,
      adSoyad: 'Geçmiş sınıf öğrencisi',
    });
    await setDoc(doc(adminDb, 'ogretmenOgrenciBaglantilari', 'teacher-a__student-history-user__class-a'), {
      uid: 'teacher-a',
      ogretmenUid: 'teacher-a',
      ogrenciUid: 'student-history-user',
      ogrenciKayitId: 'student-history-record',
      sinifId: 'class-a',
      donemYili: 2026,
      durum: 'active',
      izinler: {
        dersProgrami: true, dersNotlari: true, konular: true,
        yoklama: true, odevler: true, kitaplar: true,
      },
    });
    await setDoc(doc(adminDb, 'yoklamalar', 'attendance-history-student'), {
      uid: 'teacher-a',
      sinifId: 'class-a',
      ogrenciId: 'student-history-record',
      durum: 'geldi',
      donemYili: 2026,
    });
  });

  const studentDb = testEnv.authenticatedContext('student-history-user').firestore();
  const history = await assertSucceeds(getDocs(query(
    collection(studentDb, 'yoklamalar'),
    where('uid', '==', 'teacher-a'),
    where('sinifId', '==', 'class-a'),
    where('ogrenciId', '==', 'student-history-record'),
  )));
  assert.equal(history.size, 1);
});

test('Öğrenci paneli kendi ders notlarını ve yoklamalarını sınıf/öğrenci filtresiyle listeleyebilir', async () => {
  const db = testEnv.authenticatedContext('student-1').firestore();
  await assertSucceeds(getDocs(query(
    collection(db, 'dersNotlari'),
    where('uid', '==', 'teacher-a'),
    where('sinifId', '==', 'class-a'),
  )));
  await assertSucceeds(getDocs(query(
    collection(db, 'yoklamalar'),
    where('uid', '==', 'teacher-a'),
    where('sinifId', '==', 'class-a'),
    where('ogrenciId', '==', 'student-a'),
  )));
});

test('Öğrenci paneli kendi kitap ve konu kayıtlarını listeleyebilir', async () => {
  const db = testEnv.authenticatedContext('student-1').firestore();
  await assertSucceeds(getDocs(query(
    collection(db, 'kitaplar'),
    where('uid', '==', 'teacher-a'),
    where('sinifId', '==', 'class-a'),
    where('ogrenciId', '==', 'student-a'),
  )));
  await assertSucceeds(getDocs(query(
    collection(db, 'konular'),
    where('uid', '==', 'teacher-a'),
    where('sinifId', '==', 'class-a'),
    where('ogrenciId', '==', 'student-a'),
  )));
});

test('Öğrenci paneli yalnızca kendi ödevlerini ve bildirimlerini sorgulayabilir', async () => {
  const db = testEnv.authenticatedContext('student-1').firestore();
  await assertSucceeds(getDocs(query(
    collection(db, 'odevler'),
    where('uid', '==', 'teacher-a'),
    where('sinifId', '==', 'class-a'),
    where('hedefOgrenciIds', 'array-contains', 'student-a'),
  )));
  await assertSucceeds(getDocs(query(
    collection(db, 'ogrenciOdevBildirimleri'),
    where('ogrenciUid', '==', 'student-1'),
  )));
});


test('Firestore açık olan mevcut dönem kayıtlarına yazmayı kabul eder', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertSucceeds(addDoc(collection(db, 'okullar'), {
    uid: 'teacher-a', ad: 'Yeni dönem okulu', donemYili: 2026,
  }));
});

test('Firestore eski, gelecekteki veya dönem alanı eksik kayıt oluşturulmasını engeller', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(addDoc(collection(db, 'okullar'), {
    uid: 'teacher-a', ad: 'Eski dönem', donemYili: 2025,
  }));
  await assertFails(addDoc(collection(db, 'okullar'), {
    uid: 'teacher-a', ad: 'Gelecek dönem', donemYili: 2027,
  }));
  await assertFails(addDoc(collection(db, 'okullar'), {
    uid: 'teacher-a', ad: 'Dönem alanı yok',
  }));
});

test('Sınıf ve bağlı kayıtlar farklı akademik dönemlere bağlanamaz', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(addDoc(collection(db, 'dersler'), {
    uid: 'teacher-a',
    sinifId: 'class-a',
    donemYili: 2025,
  }));
  await assertFails(addDoc(collection(db, 'siniflar'), {
    uid: 'teacher-a',
    okulId: 'school-old',
    ad: 'Dönem uyuşmazlığı',
    donemYili: 2026,
  }));
});

test('Öğrenci, sınıf ve öğrenciye atanan kitap aynı akademik dönemde olmalıdır', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'ogrenciler', 'student-old-period'), {
      uid: 'teacher-a',
      sinifId: 'class-a',
      adSoyad: 'Eski dönem öğrencisi',
      donemYili: 2025,
    });
  });
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(addDoc(collection(db, 'kitaplar'), {
    uid: 'teacher-a',
    sinifId: 'class-a',
    ogrenciId: 'student-old-period',
    ad: 'Dönemi uyuşmayan kitap',
    donemYili: 2026,
  }));
});

test('Okul veya sınıf arşivleme kilidi sırasında yeni öğrenci kaydı açılamaz', async () => {
  const teacherDb = testEnv.authenticatedContext('teacher-a').firestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'okullar', 'school-a'), { arsivDurumu: 'isleniyor' });
  });
  await assertFails(addDoc(collection(teacherDb, 'ogrenciler'), {
    uid: 'teacher-a', sinifId: 'class-a', donemYili: 2026,
    ad: 'Yeni', soyad: 'Öğrenci',
  }));
  await testEnv.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'okullar', 'school-a'), { arsivDurumu: deleteField() });
    await updateDoc(doc(context.firestore(), 'siniflar', 'class-a'), { arsivDurumu: 'isleniyor' });
  });
  await assertFails(addDoc(collection(teacherDb, 'ogrenciler'), {
    uid: 'teacher-a', sinifId: 'class-a', donemYili: 2026,
    ad: 'Yeni', soyad: 'Öğrenci',
  }));
  await testEnv.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'siniflar', 'class-a'), { arsivDurumu: deleteField() });
  });
});

test('Firestore eski dönem kayıtlarının düzenlenmesini ve silinmesini engeller', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertSucceeds(getDoc(doc(db, 'okullar', 'school-old')));
  await assertFails(updateDoc(doc(db, 'okullar', 'school-old'), { ad: 'Eski dönem düzenlendi' }));
  await assertFails(deleteDoc(doc(db, 'okullar', 'school-old')));
});


test('Öğretmen yalnızca bağlantı kurulmuş ve ödev izni açık öğrenciye uygulama içi yeni ödev bildirimi yazabilir', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  const linkId = 'teacher-a__student-1__class-a';
  const notificationId = ['homework-a', 'student-1', linkId].join('__');
  await assertSucceeds(setDoc(doc(db, 'ogrenciYeniOdevBildirimleri', notificationId), {
    uid: 'teacher-a',
    ogretmenUid: 'teacher-a',
    ogrenciUid: 'student-1',
    ogrenciKayitId: 'student-a',
    sinifId: 'class-a',
    baglantiId: linkId,
    odevId: 'homework-a',
    donemYili: 2026,
    baslik: 'Yeni ödeviniz var',
    aciklama: 'Harita bilgisi',
    teslimTarihi: '2026-11-30',
    durum: 'aktif',
    okundu: false,
  }));
  await assertFails(setDoc(doc(db, 'ogrenciYeniOdevBildirimleri', 'wrong-student-notice'), {
    uid: 'teacher-a',
    ogretmenUid: 'teacher-a',
    ogrenciUid: 'student-2',
    ogrenciKayitId: 'student-a',
    sinifId: 'class-a',
    baglantiId: linkId,
    odevId: 'homework-a',
    donemYili: 2026,
    durum: 'aktif',
    okundu: false,
  }));
  await testEnv.withSecurityRulesDisabled(async context => {
    await deleteDoc(doc(context.firestore(), 'ogrenciYeniOdevBildirimleri', notificationId));
  });
});

test('Spark öğrenci eşleştirmesi doğrulanmış e-posta, tek kullanımlık kod ve öğretmen onayı gerektirir', async () => {
  const teacherDb = testEnv.authenticatedContext('teacher-a').firestore();
  const otherTeacherDb = testEnv.authenticatedContext('teacher-b').firestore();
  await assertSucceeds(getDoc(doc(teacherDb, 'ogretmenOgrenciBaglantilari', 'teacher-a__missing-student__class-a')));
  await assertSucceeds(getDoc(doc(teacherDb, 'ogrenciKayitEslesmeleri', 'teacher-a__missing-student')));
  await assertFails(getDoc(doc(otherTeacherDb, 'ogretmenOgrenciBaglantilari', 'teacher-a__missing-student__class-a')));
  await assertFails(getDoc(doc(otherTeacherDb, 'ogrenciKayitEslesmeleri', 'teacher-a__missing-student')));
  const code = 'ABCDEF0123456789';
  const codeId = '1c1181e7f8dece465e066361d49886efa49b372e3e029fcdf21b9621e4021366';
  const codeRef = doc(teacherDb, 'ogrenciEslesmeKodlari', codeId);
  await assertSucceeds(setDoc(codeRef, {
    uid: 'teacher-a',
    ogretmenUid: 'teacher-a',
    ogretmenHesapAdi: 'Öğretmen A',
    ogrenciKayitId: 'student-a',
    ogrenciAdSoyad: 'Test Öğrencisi',
    eposta: 'student-new@example.com',
    sinifId: 'class-a',
    sinifAd: '9-A',
    okulAd: 'A Okulu',
    donemYili: 2026,
    kademe: '9',
    ders: '',
    kullanildi: false,
    olusturulma: serverTimestamp(),
    sonaErme: new Date(Date.now() + 12 * 60 * 60 * 1000),
  }));
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'ogrenciKayitEslesmeleri', 'teacher-a__student-a'), {
      ogretmenUid: 'teacher-a', ogrenciKayitId: 'student-a', durum: 'active',
    });
  });
  await assertFails(setDoc(doc(teacherDb, 'ogrenciEslesmeKodlari', 'A'.repeat(64)), {
    uid: 'teacher-a', ogretmenUid: 'teacher-a', ogretmenHesapAdi: 'Öğretmen A',
    ogrenciKayitId: 'student-a', ogrenciAdSoyad: 'Test Öğrencisi',
    eposta: 'student-new@example.com', sinifId: 'class-a', sinifAd: '9-A',
    okulAd: 'A Okulu', donemYili: 2026, kademe: '9', ders: '',
    kullanildi: false, olusturulma: serverTimestamp(),
    sonaErme: new Date(Date.now() + 12 * 60 * 60 * 1000),
  }));
  await testEnv.withSecurityRulesDisabled(async context => {
    await deleteDoc(doc(context.firestore(), 'ogrenciKayitEslesmeleri', 'teacher-a__student-a'));
  });

  const unrelatedStudentDb = testEnv.authenticatedContext('unrelated-student', {
    email: 'someone-else@example.com',
    email_verified: true,
  }).firestore();
  await assertFails(getDoc(doc(unrelatedStudentDb, 'ogrenciEslesmeKodlari', codeId)));
  await assertSucceeds(getDoc(doc(unrelatedStudentDb, 'ogrenciEslesmeKodlari', 'A'.repeat(64))));

  const studentDb = testEnv.authenticatedContext('student-new', {
    email: 'student-new@example.com',
    email_verified: true,
  }).firestore();
  const profileRef = doc(studentDb, 'kullanicilar', 'student-new');
  const requestRef = doc(collection(studentDb, 'ogrenciEslesmeTalepleri'));
  const submit = writeBatch(studentDb);
  submit.set(profileRef, {
    rol: 'ogrenci',
    eposta: 'student-new@example.com',
    kullaniciAdi: 'Test Öğrencisi',
    ilkEslesmeTalepId: requestRef.id,
    olusturulmaTarihi: new Date().toISOString(),
  });
  submit.set(requestRef, {
    uid: 'teacher-a',
    ogretmenUid: 'teacher-a',
    ogrenciUid: 'student-new',
    ogrenciKayitId: 'student-a',
    sinifId: 'class-a',
    sinifAd: '9-A',
    okulAd: 'A Okulu',
    donemYili: 2026,
    kademe: '9',
    ders: 'Coğrafya',
    ogretmenHesapAdi: 'Öğretmen A',
    ogrenciAdSoyad: 'Test Öğrencisi',
    ogrenciHesapAdi: 'Test Öğrencisi',
    ogrenciEposta: 'student-new@example.com',
    kodId: codeId,
    durum: 'bekliyor',
    olusturulma: serverTimestamp(),
  });
  submit.update(doc(studentDb, 'ogrenciEslesmeKodlari', codeId), {
    kullanildi: true,
    kullanilma: serverTimestamp(),
    talepId: requestRef.id,
  });
  await assertSucceeds(submit.commit());
  await assertSucceeds(getDoc(doc(studentDb, 'ogrenciOdevBildirimleri', 'student-new__teacher-a__student-new__class-a__homework-a')));
  await assertSucceeds(getDoc(doc(teacherDb, 'ogrenciYeniOdevBildirimleri', 'homework-a__student-new__teacher-a__student-new__class-a')));
  await assertFails(getDoc(doc(otherTeacherDb, 'ogrenciYeniOdevBildirimleri', 'homework-a__student-new__teacher-a__student-new__class-a')));

  const approve = writeBatch(teacherDb);
  const linkId = ['teacher-a', 'student-new', 'class-a'].join('__');
  const indexId = ['teacher-a', 'student-a'].join('__');
  const permissions = {
    dersProgrami: true, dersNotlari: false, konular: false,
    yoklama: false, odevler: true, kitaplar: false,
  };
  approve.set(doc(teacherDb, 'ogretmenOgrenciBaglantilari', linkId), {
    talepId: requestRef.id,
    uid: 'teacher-a',
    ogretmenUid: 'teacher-a',
    ogretmenHesapAdi: 'Öğretmen A',
    ogrenciAd: 'Test Öğrencisi',
    sinifAd: '9-A',
    okulAd: 'A Okulu',
    donemYili: 2026,
    kademe: '9',
    ders: 'Coğrafya',
    ogrenciUid: 'student-new',
    ogrenciKayitId: 'student-a',
    ogrenciHesapAdi: 'Test Öğrencisi',
    ogrenciEposta: 'student-new@example.com',
    sinifId: 'class-a',
    izinler: permissions,
    durum: 'active',
    olusturulma: serverTimestamp(),
    iptalTarihi: null,
  });
  approve.set(doc(teacherDb, 'ogrenciKayitEslesmeleri', indexId), {
    uid: 'teacher-a',
    donemYili: 2026,
    ogretmenUid: 'teacher-a',
    ogrenciKayitId: 'student-a',
    ogrenciUid: 'student-new',
    sinifId: 'class-a',
    baglantiId: linkId,
    durum: 'active',
    guncellenme: serverTimestamp(),
  });
  approve.update(doc(teacherDb, 'ogrenciEslesmeTalepleri', requestRef.id), {
    durum: 'onaylandi',
    baglantiId: linkId,
    yanitTarihi: serverTimestamp(),
  });
  await assertSucceeds(approve.commit());
  await assertSucceeds(getDoc(doc(studentDb, 'ogretmenOgrenciBaglantilari', linkId)));
});

test('Öğrenci yalnızca kendi yeni ödev bildirimlerini okuyabilir', async () => {
  const studentDb = testEnv.authenticatedContext('student-1').firestore();
  const ownQuery = query(collection(studentDb, 'ogrenciYeniOdevBildirimleri'), where('ogrenciUid', '==', 'student-1'));
  const own = await assertSucceeds(getDocs(ownQuery));
  assert.equal(own.size, 1);

  const otherDb = testEnv.authenticatedContext('student-2').firestore();
  await assertFails(getDoc(doc(otherDb, 'ogrenciYeniOdevBildirimleri', 'new-homework-notification-a')));
});

test('Öğrenci yeni ödev bildirimini yalnızca okundu olarak işaretleyebilir', async () => {
  const db = testEnv.authenticatedContext('student-1').firestore();
  await assertSucceeds(updateDoc(doc(db, 'ogrenciYeniOdevBildirimleri', 'new-homework-notification-a'), {
    okundu: true,
    okunduTarihi: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(db, 'ogrenciYeniOdevBildirimleri', 'new-homework-notification-a'), {
    durum: 'iptal',
  }));
  await assertFails(updateDoc(doc(db, 'ogrenciYeniOdevBildirimleri', 'new-homework-notification-a'), {
    aciklama: 'Başka bir içerik',
  }));
});

test('Push token koleksiyonu istemci tarafından okunamaz veya yazılamaz', async () => {
  const studentDb = testEnv.authenticatedContext('student-1').firestore();
  await assertFails(getDoc(doc(studentDb, 'ogrenciPushTokenlari', 'token-a')));
  await assertFails(setDoc(doc(studentDb, 'ogrenciPushTokenlari', 'token-a'), {
    ogrenciUid: 'student-1',
    token: 'ExponentPushToken[abc_123]',
    aktif: true,
  }));
  const teacherDb = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(getDocs(collection(teacherDb, 'ogrenciPushTokenlari')));
});

test('Aynı öğrenci ve ders oturumu için belirleyici yoklama kimliği tek kayıt tutar', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  const oturumId = 'lesson-a_2026-11-23';
  const attendanceId = ['teacher-a', oturumId, 'student-a'].join('__');
  const ref = doc(db, 'yoklamalar', attendanceId);
  const base = {
    uid: 'teacher-a',
    sinifId: 'class-a',
    ogrenciId: 'student-a',
    dersId: 'lesson-a',
    oturumId,
    donemYili: 2026,
    tarih: '2026-11-23',
    durum: 'geldi',
  };
  await assertSucceeds(setDoc(ref, base));
  await assertSucceeds(setDoc(ref, { ...base, durum: 'gecikti' }));
  const records = await assertSucceeds(getDocs(query(
    collection(db, 'yoklamalar'),
    where('uid', '==', 'teacher-a'),
    where('sinifId', '==', 'class-a'),
    where('oturumId', '==', oturumId),
  )));
  assert.equal(records.size, 1);
  assert.equal(records.docs[0].data().durum, 'gecikti');
});

test('Kitap kütüphanesinden sınıfa verilen ödev öğrenci bazlı konu eşleştirmelerini saklayabilir', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  const ref = doc(db, 'odevler', 'class-shared-topic-homework');
  await assertSucceeds(setDoc(ref, {
    uid: 'teacher-a',
    sinifId: 'class-a',
    dersId: 'lesson-a',
    donemYili: 2026,
    hedef: 'sinif',
    hedefOgrenciIds: ['student-a'],
    aciklama: 'Coğrafya Kaynak Kitabı - Harita Bilgisi',
    kitapId: 'library-book-a',
    kitapKutuphanesiId: 'library-book-a',
    kitapKutuphanesiKonuId: 'library-topic-a',
    konuAd: 'Harita Bilgisi',
    konuEslestirmeleri: { 'student-a': 'assigned-topic-student-a' },
    baslangicSayfa: 1,
    bitisSayfa: 20,
    ogrenciDurumlari: { 'student-a': 'bekliyor' },
  }));
  await assertSucceeds(updateDoc(ref, {
    ogrenciDurumlari: { 'student-a': 'yapildi' },
  }));
  const saved = await assertSucceeds(getDoc(ref));
  assert.equal(saved.data().konuEslestirmeleri['student-a'], 'assigned-topic-student-a');
  assert.equal(saved.data().ogrenciDurumlari['student-a'], 'yapildi');
});



test('users may update their own display first and last name without changing role or email', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertSucceeds(updateDoc(doc(db, 'kullanicilar', 'teacher-a'), {
    ad: 'Ahmet', soyad: 'Yılmaz', kullaniciAdi: 'Ahmet Yılmaz',
  }));
  await assertFails(updateDoc(doc(db, 'kullanicilar', 'teacher-a'), { rol: 'ogrenci' }));
  await assertFails(updateDoc(doc(db, 'kullanicilar', 'teacher-a'), { eposta: 'new@example.com' }));
});

test('closed teacher account loses teacher data access while own profile remains readable', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'kullanicilar', 'teacher-a'), { hesapDurumu: 'kapali' });
  });
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertSucceeds(getDoc(doc(db, 'kullanicilar', 'teacher-a')));
  await assertFails(getDoc(doc(db, 'okullar', 'school-a')));
});


test('email alias registry is inaccessible to client accounts', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(getDoc(doc(db, 'epostaAliaslari', 'opaque-alias-id')));
  await assertFails(setDoc(doc(db, 'epostaAliaslari', 'opaque-alias-id'), { ownerUid: 'teacher-a' }));
});


test('closed-account deletion locks are server-only', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(getDoc(doc(db, 'hesapImhaKayitlari', 'closed-account')));
  await assertFails(setDoc(doc(db, 'hesapImhaKayitlari', 'closed-account'), { status: 'completed' }));
});

test('Öğretmen ödev durumunu güncellerken yalnızca bağlı öğrenciye güvenli bildirim oluşturabilir', async () => {
  // Önceki "kapalı hesap" testi ortak öğretmen fixture'ını kapatır.
  // Bu test kendi aktif öğretmen önkoşulunu açıkça kurar.
  await testEnv.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'kullanicilar', 'teacher-a'), {
      hesapDurumu: 'aktif',
    });
  });
  const teacherDb = testEnv.authenticatedContext('teacher-a').firestore();
  const notificationId = 'homework-a__student-1__1790000000000';
  const notificationRef = doc(teacherDb, 'ogrenciOdevDurumBildirimleri', notificationId);

  await assertSucceeds(updateDoc(doc(teacherDb, 'odevler', 'homework-a'), {
    ogrenciDurumlari: { 'student-a': 'yapildi' },
    durumGecmisi: { 'student-a': [{ durum: 'yapildi', tarih: '2026-11-24T06:00:00.000Z' }] },
    durum: 'yapildi',
  }));
  await assertSucceeds(setDoc(notificationRef, {
    uid: 'teacher-a',
    ogretmenUid: 'teacher-a',
    ogrenciUid: 'student-1',
    ogrenciKayitId: 'student-a',
    baglantiId: 'teacher-a__student-1__class-a',
    odevId: 'homework-a',
    sinifId: 'class-a',
    donemYili: 2026,
    odevAciklama: 'Öğrenciye verilen ödev',
    oncekiDurum: 'bekliyor',
    yeniDurum: 'yapildi',
    bildirimAnahtari: '1790000000000',
    bildirimTarihi: '2026-09-21T00:00:00.000Z',
    okundu: false,
  }));

  const studentDb = testEnv.authenticatedContext('student-1').firestore();
  await assertSucceeds(getDoc(doc(studentDb, 'ogrenciOdevDurumBildirimleri', notificationId)));
  await assertSucceeds(updateDoc(doc(studentDb, 'ogrenciOdevDurumBildirimleri', notificationId), {
    okundu: true,
    okunduTarihi: serverTimestamp(),
  }));
  const otherStudentDb = testEnv.authenticatedContext('student-2').firestore();
  await assertFails(getDoc(doc(otherStudentDb, 'ogrenciOdevDurumBildirimleri', notificationId)));
  await assertFails(updateDoc(doc(studentDb, 'ogrenciOdevDurumBildirimleri', notificationId), {
    yeniDurum: 'yapilmadi',
  }));
});

