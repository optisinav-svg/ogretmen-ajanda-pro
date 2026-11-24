# Spark Callable Envanteri ve Risk Degerlendirmesi

Tarih: 24.11.2026  
Dal: `work/section11-integration-2026-11-24`

## Kapsam ve yontem

- Mevcut dalin tum Git agaci tarandi: 62 JavaScript/JSX/TS/TSX dosyasi; uygulama kodu tarafinda 30'a yakin kaynak dosyasi incelendi.
- Uygulama dosyalarinda `httpsCallable` kullanimlari tarandi. Bulunan kullanimlar dokuz ekranda toplaniyor.
- `functions/index.js` ile istemcide cagrilan isimler eslestirildi.
- `functions/accountLinks.js` icindeki callable tanimlari `functions/index.js` tarafindan export edilmiyor. Ogrenci baglama ekrani `services/sparkStudentAccounts.js` uzerinden dogrudan Firestore islemleri kullaniyor; bu dosyada `httpsCallable` bulunmadi. Bu, Spark uyarlamasinin bir bolumunun kaynakta yapildigina dair olumlu bulgudur.
- `functions/ownerStatistics.js` icindeki `getUygulamaSahibiIstatistikleri` callable export edilmis; ancak istatistik ekrani temel sayimlari dogrudan Firestore sorgulariyla yapiyor. Callable icin uygulama ekrani cagrisi bulunamadi.
- Bu tarama canli Firebase projesindeki Functions dagitim durumunu gostermez. Kaynak export'u canli endpoint'in mevcut oldugunu kanitlamaz.

## Bulunan istemci callable envanteri

| Ekran | Callable | Islev | Ilk risk degerlendirmesi |
|---|---|---|---|
| GirisEkrani | `epostaAliasiniRezerveEt` | Giris sonrasi dogrulanmis e-postanin alias kaydini ayirtma/rezervasyon | Alias gecmisi ve benzersizlik; rules + veri modeli tasarimi gerekli |
| GirisEkrani | `hesabiYenidenEtkinlestir` | Kapatilmis hesabi saklama/imha kilidi kontroluyle acma | Kendi hesap kaydi icin rules ile aday; kilit ve sure kosullari dogrulanmali |
| GirisEkrani | `epostaDegisikliginiProfileYansit` | Auth e-postasini profil belgesine yazma | Kendi profilinde alan sinirli yazimla aday |
| KayitEkrani | `epostaKaydiKontrolEt` | Kayit oncesi e-posta alias gecmisini kontrol | Auth oncesi gizlilik ve yetkilendirme sorunu; mevcut haliyle istemciye tasinmamali |
| KayitEkrani | `epostaAliasiniRezerveEt` | Yeni ogretmen hesabinin e-posta alias kaydi | Kayit sonrasi sahiplik kurali ve eski alias tekrar kullanimi birlikte tasarlanmali |
| OgrenciKayitEkrani | `epostaKaydiKontrolEt` | Ogrenci kaydi oncesi alias kontrolu | Ayni alias guvenlik sorunu |
| OgrenciKayitEkrani | `epostaAliasiniRezerveEt` | Ogrenci hesabinin alias kaydi | Ayni alias guvenlik sorunu |
| ProfilEkrani | `profilAdSoyadGuncelle` | Kendi ad/soyad profil alanlarini guncelleme | Alan allowlist'i ve dogrulama ile istemciye tasinabilir aday |
| ProfilEkrani | `epostaAliasDegisikliginiKontrolEt` | Yeni e-posta alias'inin kullanilabilirligini kontrol | Alias gecmisi ve e-posta gizliligi; mevcut haliyle tasinmamali |
| ProfilEkrani | `epostaAliasiniRezerveEt` | Yeni e-posta alias kaydi | Auth e-posta degisikligiyle atomik degil; guvenli asamali akis gerekli |
| ProfilEkrani | `rolDuzeltmeTalebiOlustur` | Kullanici kendi rol duzeltme talebini acar | Yalnizca kendi UID'siyle talep olusturma rules ile aday |
| ProfilEkrani | `hesapKapatmaTalebiOlustur` | Hesap kapatma ve saklama suresi kaydi | Kendi hesap kaydinda kapatma kosullari, uygulama sahibi istisnasi ve kilit kurallari gerekli |
| RolDuzeltmeTalepleriEkrani | `rolDuzeltmeTalebiniKararaBagla` | Uygulama sahibi rol talebini onaylar/reddeder | Custom claim + veri sahipligi kontrolleri; basit istemci yazimi olarak acilmamali |
| OgrenciEkrani | `ogretmenOgrenciKaydiniTasi` | Ogrenciyi baska sinifa tasima | Coklu belge/aktif baglanti/index tutarliligi; transaction ve rules tasarimi gerekli |
| OgrenciEkrani | `ogretmenOgrenciKaydiniKaliciSil` | Ogrenci ve iliskili kayitlari kalici silme | Yikici, cok koleksiyonlu islem; Spark'ta istemciye tasinmamali. Kararlastirilan kayitsiz ogrenci akisina gore guvenli alternatif kullanilmali |
| OkulSinifEkrani | `ogretmenOgrenciKaydiniKaliciSil` | Sinif/okul ekranindan ogrenci kalici silme | Ayni yikici islem; guvenli alternatif veya kapatma |
| DonemAktarimEkrani | `ogretmenDonemAktariminiBaslat` | Okul/sinif/ogrenci/kitap/konu ve baglanti verilerini yeni doneme kopyalama | Buyuk, cok asamali veri kopyasi; idempotent/resume edilebilir plan ve test olmadan acilmamali |
| IstatistikPaneliEkrani | `uygulamaSahibiKapaliHesaplariListele` | Kapali hesaplari listeleme | Owner claim, alan sinirli okuma ve PII minimizasyonu; rules ile aday |
| IstatistikPaneliEkrani | `uygulamaSahibiDonemTemizliginiOnizle` | Silinecek donem verilerini sayma | Salt-okunur owner sorgusu; rules/indeks ve Temmuz kosulu gerekli |
| IstatistikPaneliEkrani | `uygulamaSahibiDonemTemizliginiOnayla` | Yillik, cok batch'li donem temizligi | Yikici cok batch; kilit/tekrar calisma korumasi ve geri donus olmadan istemciye tasinmamali |
| IstatistikPaneliEkrani | `uygulamaSahibiKapaliHesapImhasiniOnizle` | Kapali hesabin Firestore/Auth imha onizlemesi | Admin Auth verisi gerektirir; Spark istemcisinde esdeger yetki yok |
| IstatistikPaneliEkrani | `uygulamaSahibiKapaliHesabiImhaEt` | Kapali hesabi ve iliskili verileri imha etme | Admin Auth + coklu koleksiyon silme; istemciden guvenli karsiligi yok, kapali kalmali |

## Kodda gorulen onemli farklar

1. `functions/index.js` su anda yukaridaki cagrilarin callable export'larini iceriyor. Bu, yalnizca kaynak kod durumudur; Spark projesinde canli Functions endpoint'i oldugunu gostermez.
2. `functions/index.js` icinde e-posta alias callable'lari ve hesap yasam dongusu callable'lari export ediliyor. Identity Platform blocking trigger'lari ise yalnizca `ENABLE_IDENTITY_PLATFORM_BLOCKING_TRIGGERS=true` ortam degiskeniyle export ediliyor; varsayilan olarak kapali.
3. `functions/accountLinks.js` callable tanimlari index tarafindan export edilmiyor. Uygulamadaki Spark ogrenci baglama servisi dogrudan Firestore kullaniyor. Bu bolumdeki eski Functions kodu, canli akis olarak kabul edilmemeli.
4. `functions/ownerStatistics.js` icindeki istatistik callable'i export edilmis fakat ekrandaki sayimlar dogrudan Firestore'dan geliyor. Kullanilmayan callable'nin kaldirilmasi veya korunmasi karari, sonraki kod temizligi sirasinda verilecek; su an silinmedi.
5. Istatistik ekraninin ana sayimlari dogrudan Firestore sorgulariyla yapiyor; kapali hesap listesi ve imhasi ile donem temizligi ise hala callable cagrilarina bagli.
6. `functions/accountRetention.js` kapali hesap imhasinda Firebase Admin Auth kullanir. Bu yetkiyi istemciye vermek guvenli degildir.
7. Ogrenci kalici silme ve donem temizleme kodlari coklu belge/batch silme islemleri yapar. Sadece callable'i client Firestore yazimiyla degistirmek veri kaybi riski olusturur.

## Islem kararlari

### Dogrudan Spark istemci uygulamasina aday
- Kendi profilinde ad/soyad guncelleme.
- Auth e-posta degisikligi tamamlandiktan sonra kendi profil e-posta alanini guncelleme.
- Kendi hesabinin kapatma/yeniden etkinlestirme durum alanlari (rules kosullari ve uygulama sahibi istisnasi tamamlanmadan degil).
- Kendi UID'siyle rol duzeltme talebi olusturma.
- Uygulama sahibi tarafindan rol talebi karari (yalnizca custom claim ve veri sahipligi kontrolleri Firestore rules tarafinda yeterli sekilde uygulanabiliyorsa).

### Ayrica tasarlanmasi gereken; simdilik engelli
- E-posta alias kaydi, kontrolu ve degisikligi. Mevcut eski alias kayitlarini tekrar kullanima acmayacak guvenli model bulunmadan kayit akisi degistirilmeyecek.
- Ogrenci sinif tasima. Transaction, baglanti ve indeks tutarliligi guvence altina alinmali.
- Donem aktarimi. Buyuk aktarim icin idempotent adimlar, devam ettirme ve tekrar calistirma guvencesi gerekli.

### Spark surumunde guvenli karsiligi olmadigi icin kapali tutulacak
- Ogrencinin iliskili verileriyle kalici silinmesi. Kararlastirilan kayitsiz ogrenci sinifina tasima akisina gore islem yapilacak.
- Kapali hesabin Firebase Auth kullanicisini ve bagli verilerini uygulama sahibi panelinden imha etme. Admin yetkili guvenli ayri surec tanimlanana kadar panelden kaldirilacak/kapali tutulacak.
- Yillik donem temizligi: ilk gercek silme tarihi gelmeden (Temmuz 2028) yeniden tasarim ve prova yapilacak. Simdilik silme callable'i canli islem icin kullanilmayacak; bu dokumandaki degerlendirme dagitim izni degildir.

## Sonraki uygulama sirasi

1. E-posta alias veri modeli ve Auth kayit akisinin guvenli tasarimini tamamla; bu karar verilmeden alias callable'larini kaldirma.
2. Profil ad/soyad ve profil e-posta senkronizasyonunu kendi profil kurallariyla Spark istemcisine tasi.
3. Hesap kapatma/yeniden etkinlestirme ve rol talebi akisini Firestore rules ile sinirla.
4. Rol talebi karari icin custom claim ve sahiplik kontrollerini kanitla.
5. Ogrenci tasima icin transaction/rules tasarimini yap; kalici silmeyi kayitsiz ogrenci karariyla kapat.
6. Donem aktarimini guvenli ve devam ettirilebilir tasarlanana kadar kapali tut.
7. Kapali hesap imhasi ve donem temizligini APK oncesi zorunlu ozellik olarak sunma; guvenli yol belirlenene kadar kapali tut.
8. Her kaynak degisikliginden sonra statik kontrol ve ilgili Emulator testlerini 12. bolum test kapisinda calistir. Bu asamada testler calistirilmadi.

## Degisiklik guvenligi

Bu denetimde uygulama kodu, Firestore verisi, Auth kullanicilari, canli rules veya Firebase yapilandirmasi degistirilmedi. Yalnizca GitHub dalindaki bu dokumantasyon eklenecektir.


## Firestore Rules ile capraz kontrol (24.11.2026)

Kaynak kurallari ilgili bolumleri ayrica incelendi:

- `kullanicilar/{uid}`: kullanici kendi belgesini okuyabilir ve `ad`, `soyad`, `kullaniciAdi`, ogretmen icin `brans`/`sezon` alanlarini guncelleyebilir. `rol` ve `eposta` alanlarini kendi kendine degistiremez. Bu nedenle `profilAdSoyadGuncelle` callable'i, mevcut rules dogrulamasi korunarak istemci yazimina cevrilebilecek en net adaydir.
- `epostaAliaslari/{aliasId}`: okuma ve yazma tamamen kapali; yorumda yalnizca Admin SDK/Identity Platform yonetimi belirtilmis. Alias akisi, veri modeli ve kurallar birlikte yeniden tasarlanmadan istemciye tasinamaz.
- `rolDuzeltmeTalepleri/{requestId}`: get/list kullaniciya ve uygulama sahibine acik; create/update/delete tamamen kapali. Talep olusturma ve owner karari icin kurallarda yeni, dar kapsamli kosullar gerekir.
- `hesapYasamDongusuDenetimi/{auditId}`: yazma tamamen kapali. Hesap kapatma/yeniden acma akisinda denetim kaydi korunacaksa bu kayit guvenli bir istemci protokoluyle tasarlanmalidir; aksi halde ilgili panel islemi kapali kalir.
- `donemTemizlikKayitlari/{cleanupId}`: okuma uygulama sahibine acik; create/update/delete kapali. Mevcut lease/kilit mantigi Admin SDK callable'a dayanir; Spark istemcisine dogrudan batch silme olarak cevrilemez.
- `updatesOwnUserProfile` yardimcisi `ad` ve `soyad` degisikliklerine zaten izin verir; `eposta` alanini ayni yolla degistirmeye izin vermez.
- Ogrenci baglama, talep, baglanti ve uygulama ici bildirim koleksiyonlarinda ise Spark istemci kurallari zaten tanimlidir. Bu, ogrenci baglama akisinin neden ayri callable taramasindan farkli oldugunu aciklar.

Bu nedenle ilk uygulanacak kod degisikligi icin profil ad/soyad callable'inin kaldirilmasi en dusuk riskli adaydir. Alias, rol, hesap yasam dongusu, tasima ve toplu silme akislari icin once rules tasarimi ve guvenlik testi gerekir. Bu incelemede `firestore.rules` degistirilmedi ve canliya dagitilmadi.


## Ilk dusuk riskli Spark kod duzeltmesi

- `screens/ProfilEkrani.js` icindeki ad/soyad kaydetme islemi artik `profilAdSoyadGuncelle` callable'ini cagirmiyor.
- Kendi UID'sine ait `kullanicilar/{uid}` belgesine yalnizca `ad` ve `soyad` alanlari `updateDoc` ile yaziliyor.
- Ad/soyad NFKC normalizasyonu, bosluk sadeleştirme ve bos alan kontrolu istemci tarafinda eklendi. Firestore Rules zaten yalnizca kendi profilindeki bu alan degisikliklerine izin veriyor.
- Firebase Auth `displayName` esitlemesi ayrica yapiliyor; bu esitleme basarisiz olursa Firestore'a kaydedilmis profil bilgisinin basarili oldugu kullaniciya bildiriliyor.
- `functions/index.js` icindeki eski callable export'u simdilik kaldirilmadi; eski kurulu telefon uygulamasiyla geriye donuk uyumluluk riski olusturmamak icin korunuyor. Yeni kaynak ekran bu callable'a bagimli degil.
- Kod degisikligi GitHub dalina yazildi. Test, bundle ve cihaz kontrolu henuz yapilmadi; bunlar 12. bolum kapisinda.
