const fs = require('node:fs');
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
  writeBatch,
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
    await setDoc(doc(db, 'siniflar', 'class-b'), {
      uid: 'teacher-b',
      okulId: 'school-b',
      ad: '9-B',
      donemYili: 2026,
    });
    await setDoc(doc(db, 'ogrenciler', 'student-a'), {
      uid: 'teacher-a',
      sinifId: 'class-a',
      adSoyad: 'Test Öğrencisi',
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
    await setDoc(doc(db, 'ogretmenOgrenciBaglantilari', 'teacher-a__student-2__class-a'), {
      ogretmenUid: 'teacher-a', ogrenciUid: 'student-2', ogrenciKayitId: 'student-a',
      sinifId: 'class-a', durum: 'active',
      izinler: { dersProgrami: true, dersNotlari: false, konular: true, yoklama: true, odevler: true, kitaplar: true },
    });
    await setDoc(doc(db, 'ogretmenOgrenciBaglantilari', 'teacher-a__student-3__class-a'), {
      ogretmenUid: 'teacher-a', ogrenciUid: 'student-3', ogrenciKayitId: 'student-a',
      sinifId: 'class-a', durum: 'revoked',
      izinler: { dersProgrami: true, dersNotlari: true, konular: true, yoklama: true, odevler: true, kitaplar: true },
    });
    await setDoc(doc(db, 'ogretmenOgrenciBaglantilari', 'teacher-a__student-1__class-a'), {
      ogretmenUid: 'teacher-a',
      ogrenciUid: 'student-1',
      ogrenciKayitId: 'student-a',
      sinifId: 'class-a',
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
    await setDoc(doc(db, 'bireyselEtkinlikler', 'event-b'), {
      uid: 'teacher-b', ogrenciId: 'student-b', sinifId: 'class-b', tur: 'Etüt', donemYili: 2026,
    });
    await setDoc(doc(db, 'dersNotlari', 'note-b'), {
      uid: 'teacher-b',
      sinifId: 'class-b',
      not: 'Başka öğretmenin notu',
      donemYili: 2026,
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

test('Öğretmen başka öğretmenin kitap kütüphanesi kitabına konu ekleyemez', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'kitapKutuphanesi', 'library-book-b'), {
      uid: 'teacher-b',
      ad: 'B öğretmeninin kitabı',
    });
  });

  await assertFails(addDoc(collection(db, 'kitapKutuphanesiKonulari'), {
    uid: 'teacher-a',
    kitapId: 'library-book-b',
    ad: 'Yetkisiz konu',
    baslangicSayfa: 1,
    bitisSayfa: 5,
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


test('Yeni kullanıcı kendi öğretmen profilini oluşturabilir', async () => {
  const db = testEnv.authenticatedContext('teacher-new').firestore();
  await assertSucceeds(setDoc(doc(db, 'kullanicilar', 'teacher-new'), {
    kullaniciAdi: 'Yeni Öğretmen',
    rol: 'ogretmen',
  }));
});

test('Öğrenci rolü istemci tarafından atanamaz; yalnızca güvenilir sunucu oluşturabilir', async () => {
  const db = testEnv.authenticatedContext('student-new').firestore();
  await assertFails(setDoc(doc(db, 'kullanicilar', 'student-new'), {
    kullaniciAdi: 'Yeni Öğrenci',
    rol: 'ogrenci',
  }));
});

test('Kullanıcı oluşturduğu rolü öğretmen veya öğrenci olarak değiştiremez', async () => {
  const db = testEnv.authenticatedContext('teacher-b').firestore();
  await assertFails(updateDoc(doc(db, 'kullanicilar', 'teacher-b'), {
    rol: 'ogrenci',
  }));
});

test('Eski rol alanı olmayan öğretmen profili mevcut kayıtlarını kullanmaya devam eder', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertSucceeds(getDoc(doc(db, 'okullar', 'school-a')));
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

test('İstemci öğretmen-öğrenci bağlantısı oluşturamaz veya izin değiştiremez', async () => {
  const db = testEnv.authenticatedContext('teacher-a').firestore();
  await assertFails(updateDoc(doc(db, 'ogretmenOgrenciBaglantilari', 'teacher-a__student-1__class-a'), {
    durum: 'revoked',
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
