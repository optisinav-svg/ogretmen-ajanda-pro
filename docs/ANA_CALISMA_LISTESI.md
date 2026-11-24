# ANA CALISMA LISTESI — OGRETMEN AJANDA PRO

Son guncelleme: 24.11.2026  
Calisma dali: `work/section11-integration-2026-11-24`

Bu belge, onceki bolum planlarini, Spark uyumluluk kararlarini, surum kontrol listesini ve 24.11.2026 kaynak kodu incelemesini tek takip noktasinda toplar. Durumlar kanit seviyesine gore yazilir. Bir ozelligin kodda bulunmasi, Emulator testinden gecmesi, canliya dagitilmasi ve gercek cihazda calismasi farkli seylerdir.

## 1. Degismez kararlar ve koruma sinirlari

- Firebase Spark ucretsiz plani korunacak; Blaze/odeme gerektiren plana gecilmeyecek.
- Mevcut Firebase projesi, Firestore verileri, calisan telefon uygulamasi ve imza kimligi korunacak.
- Takvimde kullanicinin calistigini dogruladigi ay ileri/geri, haftalara gore gunler, ders olan gunlerde mavi nokta, tarihe dokununca gun programi ve mevcut ders kartlari/eylemleri tamamlanmis kabul edilir. Bu ozellik yeniden tasarlanmayacak; yalnizca regresyon kontrolu yapilacak.
- Google Drive yedekleme ertelendi; bu calisma paketinin veya tablet APK'nin on kosulu degil.
- Push bildirimleri Spark'ta guvenli sunucu gonderimi gerektirdiginden bu surumde kapsam disi. Uygulama ici bildirimler korunacak.
- KVKK taslaginda veri sorumlusu adi-soyadi `.......` kalacak; magaza yayini oncesi kullanicidan dogrulanacak.
- Canli veri silme/tasima, toplu guncelleme, Firestore rules dagitimi, hesap/rol degisikligi veya APK build gibi riskli adimlar kendi onay kapisina tabidir. Kaynak kod calismasi bu islemler icin otomatik izin sayilmaz.
- Gercek ogrenci hesabi ve cihaz testleri 12. bolumde, guvenli test sinirlari belirlenerek yapilacak.
- Mevcut telefon uygulamasi tablet testleri ve imza eslesmesi dogrulanmadan guncellenmeyecek.

## 2. Durum etiketleri

- **KOD INCELEMESI GEREKLI:** Kodda veya belgede var; mevcut dalda gercek durum teyit edilmeli.
- **KAYNAKTA VAR / CANLI DEGIL:** Kaynak kodda hazir; canli projeye dagitildigi kanitlanmadi.
- **ENGELLI:** Baska bir teknik veya guvenlik sorunu cozulmeden ilerlenemez.
- **ERTELENDI:** Kullanici karariyla sonraki asamaya birakildi.
- **KULLANICI DOGRULADI:** Kullanici gercek kullanimda calistigini belirtti.
- **TEST 12. BOLUMDE:** Bilerek son test asamasina birakildi.
- **TAMAMLANDI (KANITLI):** Belirtilen kapsam icin yeterli kanit mevcut; daha genis canli/cihaz dogrulamasi anlamina gelmez.

## 3. Oncelikli is paketleri

### P0 — APK oncesi Spark ve guvenli istemci akislari (KAYNAK GECIDI KAPANDI)

24.11.2026 tarihinde dokuz ekranda Cloud Functions callable cagrilari bulundu; tam envanter `docs/SPARK_CALLABLE_AUDIT_2026-11-24.md` icine yazildi. Sonraki duzeltmelerden sonra 38 uygulama JS/JSX/TS/TSX dosyasinin tamami yeniden tarandi ve uygulama kaynaklarinda `httpsCallable(` cagrisi kalmadigi dogrulandi.

Spark istemci + Firestore Rules kaynak akislari:
- SHA-256 e-posta alias rezervasyonu ve dogrulanmis kayit/giris.
- Ogretmen profili e-posta dogrulanmadan olusturulmaz.
- Kendi profilinde ad/soyad ve dogrulanmis Auth e-postasi senkronizasyonu.
- Kendi hesabini kapatma/yeniden etkinlestirme ve ayni batch'teki audit kaydi.
- Normal sinif degisikligi ve kayitsiz sinifa tasima; kilitli, tekrar baslatilabilir batch akisi ve eski uygulama baglantisini tarihce icin koruyup yeni sinifta yeni kodla eslestirme.

Guvenli Spark karsiligi tamamlanmadigi icin acik uyarilarla gecici kapali:
- E-posta degisikligi.
- Rol duzeltme talebi/karari (bekleyen talepler owner ekraninda salt okunur).
- Ogrenci kalici silme.
- Okul kaldirma.
- Akademik donem aktarimi.
- Kapali hesap listeleme/imhasi.
- Cok koleksiyonlu yillik donem temizligi.

**Kaynak gecidi icin yapilanlar:**
1. Callable adlari, parametreleri ve veri etkileri envanterlendi.
2. Guvenli profil/alias/hesap akislari Spark istemciye tasindi.
3. Yetki veya atomiklik riski olan islemler istemciye tasinmadi; acik uyariyla devre disi birakildi. Ogrenci tasima icin ayri, resumable Spark akis yazildi.
4. Tarihsel e-posta alias kayitlari hash yapisiyla korundu.
5. Tum uygulama kaynaklarinda callable taramasi sifir sonuc verdi.
6. Canli Rules dagitimi, veri migrasyonu, silme veya Auth degisikligi yapilmadi.

**Durum:** Spark kaynak gecidi tamamlandi: uygulama ekranlarinda callable kalmadi, ogrenci sinif/kayitsiz tasima Spark'a tasindi, diger riskli akislara acik uyari kondu. Bu kaynak degisikliklerinin Emulator/unit/bundle testleri 12. bolumde yapilacak. Canli Rules dagitimi ve APK icin ayri onay gerektiginden APK'ya henuz gecilmeyecek.

### P1 — Donem, arsiv ve veri saklama

- 2026/2027 secili donem modeli; sezon 1 Haziran'da baslar ve sonraki yil 30 Haziran'da biter. Haziran cakismasi secilen `donemYili` ile cozulur.
- Eski donem 30 Haziran'a kadar duzenlenebilir; 1 Temmuz'dan itibaren salt okunur arsiv olur.
- Yalnizca son uc sezon tutulur; 2026 kayitlari Temmuz 2028'de, 2027 kayitlari Temmuz 2029'da vb. ilgili yil kuralina gore ele alinacak.
- Yillik temizleme allowlist'i yalnizca `dersNotlari`, `dersler`, `yoklamalar`, `odevler`, `kitaplar`, `konular` koleksiyonlaridir. `ogrenciler`, `siniflar`, `okullar`, `kullanicilar`, ogretmen-ogrenci baglantilari, eslestirme talepleri/kodlari, bildirimler, bireysel etkinlikler ve ortak kitap kutuphanesi silinmez.
- Gunluk zamanlanmis silme yoktur. Hedeflenen yillik islem Temmuz'da uygulama sahibi onizleme ve acik onayiyla baslatilacak; ancak Spark istemci cok-batch + kilit akisi henuz yazilmadigi icin temizleme ekrani kapali kalacak. 2028 Temmuzundan once tamamlanip test edilmeli.
- Allowlist'teki tehlikeli genisletme 24.11.2026'da alti koleksiyona daraltildi ve test beklentisi duzeltildi. Bu degisiklik icin test henuz calistirilmadi; canli rules dagitimi ve veri silme yapilmadi.
- Veri karisimi riski: `utils/donem.js` icindeki `kayitDonemYili`, `donemYili` ve tarih alanlari yoksa bugunun donemini varsayabiliyor; Haziran tarihleri de secili donem olmadan belirsiz. Bu davranis degistirilmeden once mevcut ekran etkisi ve eksik kayitlar salt okunur incelenmeli; eksik donemli kayitlar otomatik olarak secili doneme dahil edilmemeli.
- Salt okunur inceleme icin `functions/scripts/audit-missing-periods.js` eklendi. Dokuz donemli koleksiyonu tarar; acik donem, eksik/gecersiz alan, Haziran belirsizligi ve tarih araligina gore olasi donemi sayar. Tam belge ID/ogrenci adi/e-posta yazdirmaz ve Firestore'a hicbir sey yazmaz. Henuz calistirilmadi.
- `migrate-missing-periods-2026.js` hedef koleksiyonlardaki tum eksik `donemYili` alanlarini 2026 yapar; tarihten donem cikarsamaz. Yazma modu artik `--apply --confirm-period=2026` ve SHA-256 dogrulanmis tam yedek gerektirir. Dry-run sonucundaki her eksik kaydin 2026'ya ait oldugu teyit edilmeden calistirilmayacak.

- Eksik `donemYili` kayitlari icin onceki dry-run sayilari tarihsel bilgidir; canli veriye tekrar dokunmadan once salt okunur yeni envanter ve fark raporu gerekir. Onceki yedek/manifest korunur.

### P2 — Okul, sinif, ogrenci ve bagli kayit yasam dongusu

- Okul > sinif > ogrenci sahiplik iliskileri ve donem tutarliligi incelenecek.
- Kayitli ogrencisi olan sinif silinemez.
- Ogrenci silme davranisi: ogrenciyi okulun kayitsiz ogrenciler sinifina tasima; yoklama, odev, kitap ve ders gecmisini saklama.
- Kayitsiz ogrenci kaydi silinirse ilgili bagli verinin kapsam ve geri donus kurali dogrulanmali.
- Normal sinif degisikligi ve kayitsiz sinifa tasima `services/sparkStudentClassMove.js` ile Spark istemci akisina tasindi; tasima kilidi, 400'luk batch, sinif gecmisi ve eski baglantiyi koruyup yeni kodla yeniden eslestirme kullanilir. Testleri 12. bolumde. Ogrenci kalici silme ve okul kaldirma halen acik uyariyla kapali.
- Ogretmen silme/hesap kapatma, ogretmene bagli kayitlari sahipsiz birakmayacak sekilde ele alinmali.
- Bu maddeler kod ve gercek veri uzerinde ayri ayri dogrulanmadi: KOD INCELEMESI GEREKLI.

### P3 — Hesap, profil ve e-posta yasam dongusu

- Ayni e-posta ile ikinci bir profil olusturulmamali; mevcut hesap/profil kurtarma veya devam akisi olmali.
- Sifre degistirme korunacak; ad-soyad degistirme desteklenecek.
- Ayni gorunen ad serbest; yanlis rol icin guvenli duzeltme talep/onay sureci Spark'ta henuz guvenli degil ve gecici kapali; owner talepleri salt okunur gorur.
- E-posta alias rezervasyonu ve eski alias'in tekrar kullanilmamasi kritik butunluk kosuludur.
- Hesap kapatma/yeniden etkinlestirme kendi profil + ayni batch audit kaydi olarak Spark istemci akisi seklinde kaynakta uygulandi; Rules testleri 12. bolumde.
- Kaynak kod akislari ve Auth/Firestore canli hesap eslesmesi ayri dogrulanmali. KOD INCELEMESI GEREKLI.

### P4 — Uygulama sahibi ve yetkilendirme

- Uygulama sahibi hesabi `cografyaciriza@gmail.com`; ad Riza Gokce, brans Cografya, donem 2026/2027. Firestore profilindeki kullanici tarafindan duzeltilmis degerler izinsiz degistirilmeyecek.
- Yetki `uygulamaSahibi == true` custom claim ile verilir; Firestore rol alanini elle degistirmek bunun yerine gecmez.
- `functions/scripts/set-application-owner-claim.js` guvenli dry-run/apply araci olarak eklendi. OWNER_UID ve OWNER_EMAIL eslesmesini, dogrulanmis e-postayi, etkin ogretmen profilini ve baska hesapta owner claim bulunmadigini kontrol eder; yalnizca Auth custom claim yazar, Firestore profilini degistirmez. Eski iki-profil varsayan `configure-existing-accounts.js` devre disi birakildi.
- Istatistik paneli ogretmen sayisi/branslari ve ogrenci sayisi/ogretmen-brans iliskisini gereksiz kisisel bilgi gostermeden sunmali.
- Istatistik panelinin aggregate okumasi dogrudan Firestore'dan; kapali hesap listeleme/imhasi ve donem temizligi guvenli Admin Auth/cok-batch akisi olmadigindan gecici kapali.
- Durum: SCRIPT HAZIR; canli Auth claim henuz atanmadı ve dogrulanmadi. Scriptin --apply adimi kullanici onayi olmadan calistirilmayacak.

### P5 — Ogrenci hesabi, eslestirme, izinler ve bildirimler

- Ogrenci hesabi gercek ogrenci kaydiyla eslestirilecek; kullanici sahte ogrenci verisi istemiyor.
- Tek kullanimlik, 12 saatlik kod; e-posta/ad-soyad eslesmesi; ogretmen onayi; baglanti basina izinler ve "Hepsi" karari korunacak.
- Ogrenci yalnizca kendisine atanmis odev icin tamamlama bildirimi olusturabilir; ogretmen son karar merciidir.
- Yeni odev uygulama ici bildirimi, okundu durumu ve hedef kaldirilinca bildirim iptali incelenecek.
- Push bildirimleri Spark kisiti nedeniyle kapsam disi.
- Ortaokul ogrenci hesap akisinin hukuki surec netlesene kadar kapali kalmasi release checklist'te yer aliyor; mevcut kaynak bayraklariyla celiski varsa acikliga kavusturulacak.
- `ACCOUNT_LINKING_ENABLED=true`; `services/sparkStudentAccounts.js` dogrudan Firestore transaction/batch kullanir: 16 karakter kriptografik rastgele kod, SHA-256 belge kimligi, 12 saat sure, tek kullanim, dogrulanmis e-posta/ad-soyad eslesmesi, ogretmen onayi ve allowlist izinleri. Ogrenci uygulama ici bildirimleri de dogrudan Firestore kullanir; push yok. Mevcut kaynakta bu akislara callable cagrisi yok. Son Rules degisiklikleriyle birlikte Emulator regresyonu ve gercek hesap testi 12. bolumde yapilacak.

### P6 — Ders, odev, yoklama, kitap ve rapor

- Ders konusu kaydedildikten sonra duzenlenebilir: `DersNotuEkrani.js` içinde kullanıcıya ait not için düzenleme düğmesi, `konuGuncelle` ve `updateDoc` akışı kaynakta mevcut. Yetki ve dönem kontrolü uygulanıyor; gerçek cihaz/regresyon doğrulaması 12. bölümde.
- Odev, yoklama, kitap atama ve ogrenci ilerleme akislari korunmali.
- Ortak kitap kutuphanesi ve ogrenci bazinda bagimsiz ilerleme; kitap > konu basligi > sayfa araligi modeli korunmali.
- Sinif gelisim raporu PDF'i kaynakta eklenmis olarak belgelenmis; icerik ve cihaz cikti testi 12. bolumde.
- Ozel ders, etut ve soru cozumu takvim etkinlikleri/PDF yansimasi kullanici tarafindan APK sonrasi kontrol edilecek.
- Takvim yeniden tasarlanmayacak; kullanici tarafindan dogrulanan davranislar korunacak.
- Durum: KOD INCELEMESI GEREKLI; cihaz testleri 12. bolumde.

### P7 — KVKK ve yayin oncesi bilgilendirme

- Aydinlatma metni ve acik riza birbirinden ayrilacak; acik riza yalnizca gerekli isleme icin.
- Bildirim izni ayri, istege bagli ve geri alinabilir olacak.
- Metin surumu, zaman damgasi, kapsam ve geri cekme kaydi incelenecek.
- Veri sorumlusu alani su an `.......`; magaza yayini oncesi kullanicidan dogrulanacak ve hukuki inceleme yapilacak.
- Taslak/ekranin kodda bulunmasi hukuki uygunluk onayi degildir.
- Durum: TASLAK VAR; son metin ve hukuki inceleme yayin oncesi.

### P8 — Yedekleme ve geri donus

- Mevcut 2.321 belge read-only yedek, manifest ve hash kaydi onceki calismada alinmistir; bu yedek korunacak.
- Drive yedekleme ertelendi.
- Gercek veri uzerinde tasima/silme/temizleme oncesinde yedek okunabilirligi, kapsam ve geri donus proseduru ayrica dogrulanacak.
- Auth, Firestore rules, indexes ve diger Firebase yapilandirmalarinin yedek kapsaminda olup olmadigi ayrica belirlenecek.
- Durum: KISMEN VAR; yeni bir yedekleme projesi simdilik acilmayacak.

### P9 — Entegrasyon ve kod butunlugu (11. bolum)

- Section 10 tabanli yeni dal kullaniliyor; eski PR #29 dalinin guncel tabana gore geride oldugu ve dogrudan birlestirilmeyecegi not edildi.
- `App.js` icindeki literal `\\n` JSX metin sorunu duzeltildi.
- 21 import dosya yolu ve 21 Stack route adi icin statik kontrol yapildi; bu test paketi calistirilmis degildir.
- Regresyon koruma testi eklendi ancak calistirilmadi; testler 12. bolumde.
- Takvim dosyasi/rotasi degistirilmedi.
- 38 uygulama JS/JSX/TS/TSX dosyasinda callable cagrisi kalmadi; `functions/index.js` bos export edecek sekilde kapatildi; riskli Spark karsiligi olmayan ozellikler acik uyariyla devre disi birakildi.
- SHA-256 alias, profil alanlari, hesap kapatma/yeniden etkinlestirme, ogrenci sinif/kayitsiz tasima ve retention takvimi/6 koleksiyon allowlist'i kaynakta guncellendi; owner claim icin guvenli script hazirlandi ama calistirilmadi.
- Student move akisi eklendi ancak Rules/Emulator/gercek hesap testi 12. bolumde. Yillik retention temizligi icin Spark istemci batch/lock/onizleme akisinin kodu henuz yok; UI kapali.
- Durum: KISMEN TAMAMLANDI; okul kaldirma, ogrenci kalici silme, rol duzeltme, e-posta degisikligi, donem aktarimi ve kapali hesap imhasi guvenli sekilde cozulmeden veya acikca ertelenmeden 11. bolum kapanmaz.

### P10 — Test, APK, tablet ve telefon surumu (12. bolum)

Bu asama tum P0 engelleri ve kaynak duzeltmeleri kapandiktan sonra baslar:
1. Statik kontroller, birim/Emulator testleri ve gerekli indeks testleri.
2. Ogretmen temel akis regresyonu.
3. Tablet icin EAS preview APK; build kaydi ve indirilebilir artifact dogrulamasi.
4. Kullanici tarafindan tablette ogretmen girisi ve temel ekranlar.
5. Kullanicinin gercek sinifindaki ogrenci kaydiyla, onceden belirlenmis guvenli sinirlarda ogrenci hesabi testi.
6. Odev goruntuleme/tamamlama bildirimi, izinler, PDF ve ilgili akislari kontrol.
7. Silme testi yalnizca guvenli test kaydi, yedek ve acik onayla.
8. Tablet testleri basarili olduktan sonra mevcut telefon APK imza parmak iziyle EAS imzasi karsilastirilir.
9. Eslesme dogrulanirsa telefon guncellemesi hazirlanir; dogrulanmazsa kurulu uygulamanin uzerine yukleme yapilmaz.

Durum: TEST 12. BOLUMDE; su an baslatilmayacak.

## 4. Is sirasi ve tamamlanma kapilari

1. **Envanter kapisi:** 12 bolumun kod, karar, belge ve canli yapilandirma kanitlari ayristirilir. Bu belge ilk birlestirilmis taslaktir; her madde kaynak kod ve mevcut kararlarla eslestirilerek kesinlestirilecek.
2. **Spark callable kapisi:** P0'daki her callable tek tek incelenir; guvenli Spark uygulamasi veya acik/guvenli devre disi birakma karari verilir.
3. **Veri butunlugu kapisi:** Donem, arsiv, ogrenci tasima/silme, hesap/alias ve uygulama sahibi yetkisi bagimli is paketleri halinde tamamlanir.
4. **Ozellik entegrasyon kapisi:** Ders/odev/kitap/ogrenci izinleri ve uygulama ici bildirimler birbirleriyle uyumlu hale getirilir; calisan takvim degistirilmez.
5. **11. bolum kapisi:** Entegrasyon incelemesi ve statik kod korumalari tamamlanir; calistirilmayan testler 12. bolume aktarilir.
6. **12. bolum kapisi:** Testler, kontrollu canli rules onayi, tablet APK, gercek cihaz testleri ve en son telefon guncellemesi.

## 5. Bu asamada yapilmayacaklar

- Canli Firestore rules dagitimi veya veri migrasyonu/silme.
- Ogrenci/ogretmen gercek hesaplarinda test veya hesap/claim degisikligi.
- APK build, tablet kurulum veya telefon guncellemesi.
- Blaze'e gecis, Drive yedekleme, sunucu push bildirimleri.
- Calisan takvimin yeniden tasarlanmasi.
- Eski PR #29'un dogrudan birlestirilmesi.

Bu ana liste bir takip belgesidir; canli sistemde islem yapma izni degildir. Her riskli canli adim kendi asamasinda kullaniciya acikca sunulup ayri onay alinacaktir.


## 6. 24.11.2026 birlestirilmis kaynak durumu

### Spark ve callable kapisi
- Ilk taramada dokuz ekranda callable cagrisi bulundu; tam fonksiyon/risk envanteri `docs/SPARK_CALLABLE_AUDIT_2026-11-24.md` icinde.
- Sonraki taramada 38 uygulama JS/JSX/TS/TSX dosyasinin tamaminda `httpsCallable(` cagrisi kalmadigi dogrulandi.
- SHA-256 alias rezervasyonu, dogrulanmis ogretmen/ogrenci kaydi ve giris, profil ad/soyad ve dogrulanmis e-posta senkronizasyonu, hesap kapatma/yeniden etkinlestirme Spark istemci + Firestore Rules kaynak akislari olarak yazildi.
- Guvenli Spark karsiligi henuz tamamlanmayan e-posta degisikligi, rol duzeltme, ogrenci tasima/silme, okul kaldirma, donem aktarimi, kapali hesap imhasi ve yillik donem temizligi acik uyarilarla gecici kapali. Bu islevler silinmedi; guvenli yeniden tasarim bekliyor.
- Canli Firestore Rules dagitilmadi; canli Auth hesabi, Firestore verisi veya alias kaydi degistirilmedi.

### Donem saklama politikasi
- Kaynakta bulunan `2029 / yil - 3` takvimi, kullanici kararina uygun olarak `Temmuz 2028 -> 2026`, `Temmuz 2029 -> 2027` ve sonraki yillarda `Temmuz -> yil - 2` olacak sekilde duzeltildi.
- `functions/retentionPolicy.js`, `firestore.rules`, `IstatistikPaneliEkrani.js` ve retention test beklentileri guncellendi.
- Bu son degisiklikler icin Emulator/unit testleri calistirilmadi; release checklist'te ilgili test kapisi yeniden acik.

### Uygulama sahibi claim hazirligi
- `functions/scripts/set-application-owner-claim.js` guvenli dry-run/apply araci olarak eklendi. Acik OWNER_UID/OWNER_EMAIL eslesmesi, dogrulanmis Auth e-postasi, etkin ogretmen profili ve baska hesapta owner claim bulunmamasi kontrol edilir.
- Script yalnizca Auth custom claim yazar; Firestore rol/profil veya ogrenci verisini degistirmez. `--apply` ve acik onay metni gerektirir.
- Eski iki-profil varsayan ve Firestore rol alanlarini degistirebilen `configure-existing-accounts.js` devre disi birakildi.
- Canli owner claim henuz atanmadi; script calistirilmadi ve bu adim icin ayri acik onay gerekir.

### Guvenlik ve test siniri
- Test, Android bundle, APK veya cihaz dogrulamasi bu asamada yapilmadi; hepsi 12. bolumde.
- Takvim dosyasi degistirilmedi.
- Bu ana liste canli sisteme islem yapma izni degildir. Rules dagitimi, Auth claim atamasi, veri tasima/silme ve APK adimlari kendi asamasinda ayri onay gerektirir.
