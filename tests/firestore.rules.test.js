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
    await setDoc(doc(db, 'kullanicilar', 'student-4'), { kullaniciAdi: 'Öğrenci 4', rol: 'ogrenci' });
    await setDoc(doc(db, 'ogretmenOgrenciBaglantilari', 'teacher-a__student-2__class-a'), {
      ogretmenUid: 'teacher-a', ogrenciUid: 'student-2', ogrenciKayitId: 'student-a',
      sinifId: 'class-a', donemYili: 2026, durum: 'active',
      izinler: { dersProgrami: true, dersNotlari: false, konular: true, yoklama: true, odevler: true, kitaplar: true },
    });
    await setDoc(doc(db, 'ogretmenOgrenciBaglantilari', 'teacher-a__student-3__class-a'), {
      ogretmenUid: 'teacher-a', ogrenciUid: 'student-3', ogrenciKayitId: 'student-a',
      sinifId: 'class-a', donemYili: 2026, durum: 'revoked',
      izinler: { dersProgrami: true, dersNotlari: true, konular: true, yoklama: true, odevler: true, kitaplar: true },
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


test('Öğretmen kendi profilini Spark üzerinde oluşturabilir ancak uygulama sahibi yetkisi veremez', async () => {
  const db = testEnv.authenticatedContext('teacher-new', {
    email: 'teacher-new@example.com',
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
    token: { uygulamaSahibi: true },
  }).firestore();
  await assertFails(getDoc(doc(db, 'okullar', 'school-a')));
});

test('Rol alanı olmayan hesap öğretmen yetkisi alamaz', async () => {
  const db = testEnv.authenticatedContext('teacher-legacy').firestore();
  await assertFails(getDoc(doc(db, 'okullar', 'school-legacy')));
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


test('Öğrenci yalnızca kendisine atanmış ödev için tamamlandı bildirimi oluşturabilir', async () => {
  const db = testEnv.authenticatedContext('student-1').firestore();
  await assertSucceeds(getDoc(doc(db, 'ogrenciOdevBildirimleri', 'notification-a')));
  const linkId = 'teacher-a__student-1__class-a';
  const ownId = ['student-1', linkId, 'homework-a'].join('__');
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
});

test('Spark öğrenci eşleştirmesi doğrulanmış e-posta, tek kullanımlık kod ve öğretmen onayı gerektirir', async () => {
  const teacherDb = testEnv.authenticatedContext('teacher-a').firestore();
  const code = 'ABCDEF0123456789';
  const codeRef = doc(teacherDb, 'ogrenciEslesmeKodlari', code);
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
    ders: 'Coğrafya',
    kullanildi: false,
    olusturulma: serverTimestamp(),
    sonaErme: new Date(Date.now() + 12 * 60 * 60 * 1000),
  }));

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
    kodId: code,
    durum: 'bekliyor',
    olusturulma: serverTimestamp(),
  });
  submit.update(doc(studentDb, 'ogrenciEslesmeKodlari', code), {
    kullanildi: true,
    kullanilma: serverTimestamp(),
    talepId: requestRef.id,
  });
  await assertSucceeds(submit.commit());

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
  approve.update(requestRef, {
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
