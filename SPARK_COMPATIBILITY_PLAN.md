# Firebase Spark uyumluluk ve mevcut durum plani

Son guncelleme: 24.11.2026  
Calisma dali: `work/section11-integration-2026-11-24`

Bu belge Spark uyumluluguna iliskin guncel kararlari ve kaynak durumunu kaydeder. Ana is listesi `docs/ANA_CALISMA_LISTESI.md` dosyasidir.

## 1. Degismez kararlar

- Firebase Spark ucretsiz plani korunacak; Blaze/odeme gerektiren plana gecilmeyecek.
- Cloud Functions dagitimi, baska backend'e tasima veya sunucu push bu surumun parcasi degildir.
- Mevcut Firebase projesi, Firestore verileri, calisan telefon uygulamasi ve imza kimligi korunacak.
- Google Drive yedekleme ertelendi.
- KVKK taslaginda veri sorumlusu adi-soyadi `.......` kalacak.
- Canli Firestore Rules dagitimi, Auth custom claim atamasi, veri silme/tasima ve APK islemleri ayri acik onay gerektirir.
- Testler 12. bolumde yapilacak; bu dalda yeni degisiklikler icin test calistirilmadi.

## 2. Spark siniri

Spark'ta Cloud Functions ve zamanlanmis isler calistirilmayacagindan:
- Callable/trigger/scheduler cagiran uygulama ekrani birakilmayacak.
- Expo/FCM gizli anahtari APK'ya konulmayacak; push gonderimi yok, uygulama ici bildirim var.
- Donem temizligi arka planda veya otomatik calismayacak.
- Yetki, atomiklik veya veri butunlugu saglanamayan yikici islemler istemciye tasinmayacak; acik uyariyla gecici kapali kalacak.

## 3. Kaynak kodda bulunan Spark akislari

| Islev | Kaynak uygulama | Durum |
|---|---|---|
| Ogretmen profili | Dogrulanmis e-posta sonrasi kendi UID'si altinda Firestore profil olusturma | Kaynakta var; Rules/device testi 12. bolumde |
| E-posta alias gecmisi | SHA-256 belge kimligi; kullanici yalnizca kendi dogrulanmis e-posta alias kaydini olusturur/gunceller | Kaynakta var; Rules testi 12. bolumde |
| Hesap kapatma/yeniden etkinlestirme | Kendi profil belgesi ve audit kaydi ayni batch/transaction akisinda | Kaynakta var; canli test 12. bolumde |
| Profil adi/soyadi | Kendi profilinde dogrudan Firestore guncellemesi | Kaynakta var |
| Ogrenci eslestirme | 16 karakter kriptografik kod, SHA-256 belge kimligi, 12 saat, tek kullanim, dogrulanmis e-posta/ad eslesmesi, ogretmen onayi | Kaynakta var; Emulator/gercek hesap testi 12. bolumde |
| Ogrenci izinleri | Aktif baglanti ve allowlist izinleri; varsayilan kapali | Kaynakta var; guvenlik testi 12. bolumde |
| Odev bildirimleri | Ogrenci tamamlama ve yeni odev bildirimleri dogrudan Firestore transaction/batch | Kaynakta var; test 12. bolumde |
| Haziran donem hatirlatmasi | Ogretmen ve ogrenci ekranlarinda 5 gunde bir yerel hatirlatma; ogrencide yeni donem baglantisi yoksa eslestirme kodu yonlendirmesi | Kaynakta var; cihaz testi 12. bolumde |
| Ogrenci sinif degisikligi | `services/sparkStudentClassMove.js`: resumable kilit, kitap/konu batch tasima, sinif gecmisi, eski baglantiyi koruma ve yeni kodla yeniden eslestirme | Kaynakta var; test 12. bolumde |
| Kayitsiz ogrenciye tasima | Ayni okul/donem Kayıtsız Öğrenciler sinifi; ogrenci ve gecmis kayitlar silinmez | Kaynakta var; test 12. bolumde |
| Uygulama sahibi istatistikleri | Custom claim kontrolu; aggregate Firestore okumasi, ogrenci kimligi gostermeden sayim | Kaynakta var; owner claim henuz atanmadı |
| Ders konusu duzenleme | Kendi ders notu icin duzenle/updateDoc akisi | Kaynakta var; regresyon testi 12. bolumde |

## 4. Gecici olarak kapali Spark akislari

Asagidaki islevler kaynaktan kaldirilmis degildir; guvenli Spark karsiligi tamamlanana kadar kullaniciya acik uyari gostererek kapali tutulur:
- Profil e-posta degisikligi (yeni adres alias gecmisi icin guvenli on kontrol yok).
- Rol duzeltme talebi/karari (owner ekraninda bekleyen talepler salt okunur).
- Ogrenci kalici silme.
- Okul kaldirma ve bagli kayitlarin toplu silinmesi.
- Akademik donem aktarimi.
- Kapali hesaplari topluca listeleme/imhasi.
- Yillik donem temizliginin Spark istemci onizleme/onay/batch akisi.

Normal sinif degisikligi ve kayitsiz sinifa tasima bu listede degildir; bunlar kaynakta Spark istemci akisina tasindi. Yeni akislara iliskin testler henuz calistirilmadi.

## 5. Yillik arsiv ve saklama karari

- 2026 donemi Temmuz 2028'e kadar korunur.
- Temmuz 2028'de hedef donem 2026; Temmuz 2029'da 2027; sonraki yillarda Temmuz ayinda hedef `yil - 2`.
- Temizlik allowlist'i **yalnizca** su alti koleksiyondur:
  - `dersNotlari`
  - `dersler`
  - `yoklamalar`
  - `odevler`
  - `kitaplar`
  - `konular`
- `ogrenciler`, `siniflar`, `okullar`, `kullanicilar`, ogretmen-ogrenci baglantilari, eslestirme talepleri/kodlari, bildirimler, bireysel etkinlikler ve ortak kitap kutuphanesi bu yillik temizligin disindadir.
- Gunluk zamanlayici yoktur. Temizlik Spark'ta guvenli istemci batch + kilit + onizleme + acik onay akisi tamamlanana kadar kapali kalir.
- `functions/section7DataLifecycle.js` icindeki Admin callable kodu Spark'ta calismaz ve bu dalda dagitilmayacaktir. `functions/retentionPolicy.js` allowlist'i alti koleksiyona daraltildi; test beklentisi duzeltildi, ancak test calistirilmadi.
- Salt okunur 15-koleksiyon donem envanteri icin `functions/scripts/audit-missing-periods.js` eklendi; Haziran cakismasini otomatik siniflandirmak yerine belirsiz olarak raporlar, kisi verisi yazdirmaz ve Firestore'a yazmaz. Henuz calistirilmadi.
- Eksik `donemYili` migrasyon scripti 2026 hedeflidir; yazma modu `--apply --confirm-period=2026 --confirm-all-missing-are-2026` ve SHA-256 dogrulanmis tam yedek ister. Script tarihten hedef donemi cikarmadan tum eksik alanlari 2026 yapar; dry-run sonucundaki her kaydin 2026 oldugu teyit edilmeden calistirilmayacak.
- `utils/donem.js` halen donem/tarih alanlari eksik kayitlar icin bugunun donemini varsayabilen fallback iceriyor. Haziran cakismasi nedeniyle bu fallback'in etkisi salt okunur envanterle degerlendirilmeden degistirilmeyecek; donem karisimi riski ana listede acik tutuluyor.
- Bu dalda canli veri silme veya donem temizligi yapilmadi.

## 6. Uygulama kaynaklarinda callable durumu

- 24.11.2026 taramasinda uygulamanin 38 JS/JSX/TS/TSX dosyasi incelendi; uygulama ekranlarinda `httpsCallable(` cagrisi kalmadi.
- `firebaseConfig.js` artik Firebase Functions istemci baslatmasi yapmiyor.
- Legacy Functions kaynak dosyalari depoda bulunabilir; `functions/index.js` bilerek bos export eder ve `firebase.json` Functions deploy hedefi icermez. Bu dalda hicbir Cloud Function dagitima acik degildir.
- Riskli islemler ya dogrudan Spark kurallariyla guvenli hale getirildi (ogrenci tasima gibi) ya da acik uyariyla kapatildi.
- Eski iki-profil varsayan `functions/scripts/configure-existing-accounts.js` devre disi birakildi.
- `functions/scripts/set-application-owner-claim.js` guvenli dry-run/apply araci olarak hazir; Auth claim henuz atanmadı. Script Firestore profilini degistirmez ve `--apply` + acik onay gerektirir.

## 7. Canli durum ve sonraki kapilar

- Canli Firestore Rules dagitilmadi; canli projedeki mevcut Rules ile kaynak dosyadaki yeni Rules ayni kabul edilmemelidir.
- Owner custom claim atanmadi.
- Canli Firestore verisi, Auth hesaplari veya e-posta alias kayitlari degistirilmedi.
- Android bundle, Emulator/unit/regresyon testi, APK veya cihaz testi bu dal degisiklikleri icin calistirilmadi.
- Sonraki sira: kalan kaynak entegrasyon isleri; sonra 12. bolumde testler; kullanicinin acik `DEPLOY` onayi; tablet preview APK; tablet testleri; en son imza dogrulamasi sonrasi telefon guncellemesi.
