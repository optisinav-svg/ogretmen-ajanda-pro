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

### P0 — APK oncesi Spark ve guvenli istemci akislari (ENGELLEYICI)

24.11.2026 kaynak taramasinda dokuz ekranda Cloud Functions callable cagrilari goruldu. Spark plani belgesinde bu cagrilarin tamamen kaldirildigi yazan onceki ifade artik guncel degildir. Her cagri tek tek adlandirilip kullanim yeri, guvenlik gereksinimi ve veri etkisiyle siniflandirilmalidir.

Etkilenen ekranlar:
- `GirisEkrani.js`: e-posta alias kontrol/rezervasyon, kapali hesap yeniden etkinlestirme, profil e-posta senkronizasyonu.
- `KayitEkrani.js`: e-posta kayit kontrolu ve alias rezervasyonu.
- `OgrenciKayitEkrani.js`: ogrenci e-posta kontrolu ve alias rezervasyonu.
- `ProfilEkrani.js`: ad-soyad, e-posta degisikligi, rol duzeltme talebi, hesap kapatma.
- `RolDuzeltmeTalepleriEkrani.js`: rol duzeltme karari.
- `OgrenciEkrani.js` ve `OkulSinifEkrani.js`: ogrenci tasima / kalici silme.
- `DonemAktarimEkrani.js`: akademik donem aktarimi.
- `IstatistikPaneliEkrani.js`: kapali hesaplari listeleme/silme ve donem temizligi onizleme/onay.

Yapilacaklar:
1. Her callable'in tam fonksiyon adini, parametrelerini, donusunu ve ilgili Firestore belgelerini cikart.
2. Islevleri risklerine gore ayir: salt okuma, kullaniciya ait profil islemi, benzersiz e-posta/alias butunlugu, yetkili rol islemi, bagli kayit tasima/silme, donem bazli toplu silme.
3. Her islev icin Spark'ta Firestore Rules ile guvenli uygulanabilir mi karar ver. Atomiklik veya guvenilir yetki kontrolu saglanamiyorsa istemciye tasima; guvenli sekilde devre disi birak veya alternatif is akisina cevir.
4. E-posta alias gecmisinin tekrar kullanilmasini engelleyen butunlugu koru.
5. Ogrenci tasima/silme ve donem aktarimi islemlerinde yarim yazim/veri kaybi riskini ortadan kaldir.
6. Uygulama sahibi yetkisi istemciden atanamaz; custom claim ve guvenilir yonetim yolu korunur.
7. Kullaniciya kapatilan ozelliklerde anlasilir aciklama goster.
8. Callable kalmadigi veya bilincli olarak devre disi birakildigi kaynak taramasi ve testlerle kanitlanmadan APK asamasina gecme.

**Mevcut durum:** ENGELLI. Callable taramasi yapildi; ayrintili fonksiyon bazli tasarim ve duzeltmeler tamamlanmadi. Canli Functions varligi hakkinda kaynak koddan sonuc cikarilmayacak.

### P1 — Donem, arsiv ve veri saklama

- 2026/2027 secili donem modeli; sezon 1 Haziran'da baslar ve sonraki yil 30 Haziran'da biter. Haziran cakismasi secilen `donemYili` ile cozulur.
- Eski donem 30 Haziran'a kadar duzenlenebilir; 1 Temmuz'dan itibaren salt okunur arsiv olur.
- Yalnizca son uc sezon tutulur; 2026 kayitlari Temmuz 2028'de, 2027 kayitlari Temmuz 2029'da vb. ilgili yil kuralina gore ele alinacak.
- Silme kapsamindaki koleksiyonlar ve bagli belge iliskileri mevcut kararlara gore tek tek dogrulanacak; okul/sinif/ogrenci/kullanici profili gibi ana kayitlar yanlislikla silinmeyecek.
- Gunluk zamanlanmis silme yoktur. Spark nedeniyle yillik islem, Temmuz'da uygulama sahibi tarafindan onizleme ve acik onayla baslatilacak.
- Mevcut kaynak kodda donem temizligi ve kurallari icin Emulator testleri oldugu belirtiliyor; canli rules dagitimi yapilmadi. Bu nedenle durum: KAYNAKTA VAR / CANLI DEGIL.
- Eksik `donemYili` kayitlari icin onceki dry-run sayilari tarihsel bilgidir; canli veriye tekrar dokunmadan once salt okunur yeni envanter ve fark raporu gerekir. Onceki yedek/manifest korunur.

### P2 — Okul, sinif, ogrenci ve bagli kayit yasam dongusu

- Okul > sinif > ogrenci sahiplik iliskileri ve donem tutarliligi incelenecek.
- Kayitli ogrencisi olan sinif silinemez.
- Ogrenci silme davranisi: ogrenciyi okulun kayitsiz ogrenciler sinifina tasima; yoklama, odev, kitap ve ders gecmisini saklama.
- Kayitsiz ogrenci kaydi silinirse ilgili bagli verinin kapsam ve geri donus kurali dogrulanmali.
- Ogrenci tasima/silme islemleri callable engelindeki en riskli akislardandir; guvenli Spark tasarimi olmadan acik tutulmayacak.
- Ogretmen silme/hesap kapatma, ogretmene bagli kayitlari sahipsiz birakmayacak sekilde ele alinmali.
- Bu maddeler kod ve gercek veri uzerinde ayri ayri dogrulanmadi: KOD INCELEMESI GEREKLI.

### P3 — Hesap, profil ve e-posta yasam dongusu

- Ayni e-posta ile ikinci bir profil olusturulmamali; mevcut hesap/profil kurtarma veya devam akisi olmali.
- Sifre degistirme korunacak; ad-soyad degistirme desteklenecek.
- Ayni gorunen ad serbest; yanlis rol icin guvenli duzeltme talep/onay sureci.
- E-posta alias rezervasyonu ve eski alias'in tekrar kullanilmamasi kritik butunluk kosuludur.
- Hesap kapatma/yeniden etkinlestirme akislari, Spark callable engeli kapsaminda incelenecek.
- Kaynak kod akislari ve Auth/Firestore canli hesap eslesmesi ayri dogrulanmali. KOD INCELEMESI GEREKLI.

### P4 — Uygulama sahibi ve yetkilendirme

- Uygulama sahibi hesabi `cografyaciriza@gmail.com`; ad Riza Gokce, brans Cografya, donem 2026/2027. Firestore profilindeki kullanici tarafindan duzeltilmis degerler izinsiz degistirilmeyecek.
- Yetki `uygulamaSahibi == true` custom claim ile verilir; Firestore rol alanini elle degistirmek bunun yerine gecmez.
- Claim'in gercek Auth UID'sine atanmasi ve uygulamada dogru yenilenmesi salt okunur/guvenli yontemle dogrulanacak. Claim atama adimi ayrica onay gerektirir.
- Istatistik paneli ogretmen sayisi/branslari ve ogrenci sayisi/ogretmen-brans iliskisini gereksiz kisisel bilgi gostermeden sunmali.
- Callable kullanan istatistik/yonetim akislarinin Spark alternatifi ayri incelenecek.
- Durum: KOD INCELEMESI GEREKLI; canli claim atamasi dogrulanmis sayilmaz.

### P5 — Ogrenci hesabi, eslestirme, izinler ve bildirimler

- Ogrenci hesabi gercek ogrenci kaydiyla eslestirilecek; kullanici sahte ogrenci verisi istemiyor.
- Tek kullanimlik, 12 saatlik kod; e-posta/ad-soyad eslesmesi; ogretmen onayi; baglanti basina izinler ve "Hepsi" karari korunacak.
- Ogrenci yalnizca kendisine atanmis odev icin tamamlama bildirimi olusturabilir; ogretmen son karar merciidir.
- Yeni odev uygulama ici bildirimi, okundu durumu ve hedef kaldirilinca bildirim iptali incelenecek.
- Push bildirimleri Spark kisiti nedeniyle kapsam disi.
- Ortaokul ogrenci hesap akisinin hukuki surec netlesene kadar kapali kalmasi release checklist'te yer aliyor; mevcut kaynak bayraklariyla celiski varsa acikliga kavusturulacak.
- Onceki belgelerde kod/kurallar/Emulator testlerinin uygulandigi belirtilmis olsa da tam callable envanteriyle celiski var. Durum: KAYNAKTA VAR / ENTEGRASYON ENGELI; gercek hesap testi 12. bolumde.

### P6 — Ders, odev, yoklama, kitap ve rapor

- Ders konusu kaydedildikten sonra duzenlenebilir olmali; bu davranis kaynak kodda ve gercek cihazda dogrulanmali.
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
- Dokuz ekranda callable cagrilari kaldigi icin entegrasyon tamamlanmis degildir.
- Durum: KISMEN TAMAMLANDI; P0 kapanmadan 11. bolum tamamlanmis sayilmaz.

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


## 6. 24.11.2026 callable envanter sonucu

Dokuz uygulama ekranindaki `httpsCallable` kullanimlari tam dosya agaci taramasiyla dogrulandi ve tam callable adlari `docs/SPARK_CALLABLE_AUDIT_2026-11-24.md` belgesine yazildi. Bu belge her cagrinin amacini, guvenlik riskini ve Spark icin ilk kararini icerir.

- E-posta alias kontrol/rezervasyon akisi, eski alias'lari yeniden kullanima acmayacak guvenli bir model olmadan degistirilmeyecek.
- Profil ad/soyad ve profil e-posta senkronizasyonu, kendi UID'siyle sinirli Firestore Rules yazimlariyla Spark'a tasinabilecek adaylardir.
- Hesap kapatma/yeniden etkinlestirme ve rol duzeltme talebi, sahiplik/claim kosullariyla ayrica tasarlanacak.
- Ogrenci sinif tasima ve donem aktarimi, transaction/kurallar ve devam ettirilebilirlik guvencesi olmadan acilmayacak.
- Ogrenci kalici silme, kararlastirilan kayitsiz ogrenci akisina gore uygulama panelinden kapali tutulacak.
- Kapali hesap imhasi Admin Auth yetkisi gerektirir; istemciye tasinmayacak.
- Donem temizligi ilk gercek silme tarihinden (Temmuz 2028) once guvenli yeniden tasarim/prova gerektirir; bu denetim dagitim veya silme izni degildir.
- `functions/accountLinks.js` callable'lari `functions/index.js` tarafindan export edilmiyor; mevcut Spark ogrenci baglama servisi dogrudan Firestore kullaniyor.
- Istatistik ekraninin temel sayimlari dogrudan Firestore sorgulariyla yapiliyor; kapali hesap ve donem temizligi islemleri hala callable'a bagli.

**Durum:** Callable envanteri tamamlandi; kod degisiklikleri ve guvenli Spark karsiliklari henuz tamamlanmadi. P0 engeli devam ediyor. Testler calistirilmadi; canli Firebase veya kullanici verisi degistirilmedi.


### 24.11.2026 ilk kod duzeltmesi

`ProfilEkrani.js` ad/soyad kaydetme akisi callable'dan cikarildi; kendi UID'sine ait profil belgesine `ad` ve `soyad` alanlari, mevcut Firestore Rules kisitlari altinda dogrudan yaziliyor. Eski callable export'u kurulu telefon uygulamasinin geriye donuk uyumlulugunu korumak icin silinmedi. Kaynak degisikligi yapildi; test ve cihaz dogrulamasi 12. bolume birakildi. P0 callable engeli diger akislardan dolayi devam ediyor.

- Giris sonrasi dogrulanmis Auth e-postasini kendi Firestore profiline yansitma da callable'dan cikarildi. Bunun icin kaynak Firestore Rules, e-posta alanini yalnizca dogrulanmis Auth token e-postasina esit olacak sekilde guncellemeye izin veriyor. Canli rules dagitimi ve test yapilmadi.


### 24.11.2026 Spark kaynak ilerlemesi

- Firebase Security Rules SHA-256 hashing yetenegi dogrulandi; mevcut hash tabanli alias belge kimligi korunabiliyor. Alias sistemi icin e-posta acik metinli yeni koleksiyon veya eski alias hashlerini toplu donusturme gerekmiyor.
- `services/sparkEmailAliases.js` ve buna uygun Firestore Rules kaynak duzenlemesi eklendi. Ogretmen/ogrenci kayit ve giris ekranlari alias callable bagimliligindan cikarildi. Ogretmen profili e-posta dogrulanmadan olusturulmuyor.
- Profil ad/soyad ve giris sonrasi dogrulanmis e-posta senkronizasyonu callable'dan cikarildi.
- Hesap kapatma/yeniden etkinlestirme, kendi UID profili ve ayni batch'teki audit kaydi ile Spark istemci akisina tasindi; Rules, uygulama sahibi istisnasini ve imha kilidi/saklama tarihi kontrollerini kaynakta uygular.
- Profil e-posta degisikligi guvenli alias on kontrolu tamamlanana kadar gecici olarak kapatildi.
- Kalan callable ekranlari ve riskleri `docs/SPARK_CALLABLE_AUDIT_2026-11-24.md` belgesinde guncellendi.
- **P0 hala acik:** rol duzeltme, ogrenci tasima/silme, okul kaldirma, donem aktarimi, kapali hesap imhasi ve donem temizligi akislarinin Spark karsiligi/guvenli devre disi karari tamamlanmadi.
- Yeni kaynak degisiklikleri icin testler calistirilmadi; canli rules dagitilmadi; canli Firestore/Auth verisi degistirilmedi.

### Ayrica tespit edilen donem temizligi tarih celiskisi

Kullanici karari: Temmuz 2028'de 2026 donemini sil; Temmuz 2029'da 2027 donemini sil; sonraki yillarda her Temmuz, iki yil onceki donemi ele al. Mevcut kaynak `functions/retentionPolicy.js`, `firestore.rules` ve `IstatistikPaneliEkrani.js` ise ilk temizligi Temmuz 2029 / hedef yil = yil - 3 olarak tanimliyor. Bu kaynak-karar uyumsuzlugu P1 veri saklama paketinde duzeltilmeli; su an degistirilmedi ve hicbir silme islemi yapilmadi.


### 24.11.2026 callable engeli kaynak durumu

38 uygulama JS/JSX/TS/TSX dosyasinin tam taramasinda `httpsCallable(` cagrisi kalmadigi dogrulandi. Alias, kayit/giris, profil temel alanlari ve hesap kapatma/yeniden etkinlestirme Spark Rules akislari kaynakta yazildi. Guvenli Spark karsiligi tamamlanmayan e-posta degisikligi, rol duzeltme, ogrenci tasima/silme, okul kaldirma, donem aktarimi, kapali hesap imhasi ve yillik donem temizligi kullaniciya acik mesajla devre disi birakildi. Bu ozellikler kaybolmadi; P0/P1 altinda guvenli yeniden tasarim icin bekliyor. Kaynak testleri henuz calistirilmadi ve canli rules dagitilmadi.
