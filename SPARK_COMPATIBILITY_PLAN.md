# Firebase Spark uyumluluk planı — 22.11.2026

## Değişmez kararlar

- Firebase Spark ücretsiz planında kalınacak.
- Blaze/ücretli plan kullanılmayacak.
- Cloudflare Workers veya başka bir backend'e taşıma yapılmayacak.
- Mevcut Firebase projesi, Firestore verileri, öğretmen uygulaması ve imza kimliği korunacak.
- Google Drive yedekleme ertelendi.
- KVKK taslağında veri sorumlusu ad-soyadı ....... kalacak.
- Gerçek öğrenci verisiyle test veya veri silme, yedek ve geri dönüş kontrolü olmadan yapılmayacak.

## Spark sınırı

Firebase Spark'ta Cloud Functions dağıtımı ve dolayısıyla şu sunucu işlevleri canlıya alınamaz:
- Auth kullanıcı oluşturma tetikleyicisi / profil oluşturma callable'ı
- Öğretmen-öğrenci eşleştirme callable'ları
- Ödev tamamlama callable bildirimi
- Push token callable'ları
- Firestore tetikleyicileriyle yeni ödev bildirimi
- Uygulama sahibi istatistik callable'ı
- Zamanlanmış dönem temizliği

Kaynak depoda Functions kodunun bulunması, canlı Firebase'de çalıştığı anlamına gelmez. Canlı Functions envanteri boş bulunmuştur. Bu nedenle APK'nın kullanıcı akışlarında Cloud Functions çağrısı bırakılmamalıdır.

## Spark karşılıkları — kaynak kodda yapılanlar

| Özellik | Spark uygulaması | Durum |
|---|---|---|
| Öğretmen profili | Kayıt ekranı, kendi UID'si altında Firestore profili oluşturur. Rol ve uygulama sahibi yetkisi sonradan değiştirilemez. | Kaynak kodda uygulandı |
| Öğrenci hesabı | E-posta doğrulaması korunur. Öğretmenin 16 karakterlik rastgele kodu SHA-256 belge kimliğiyle saklanır; 12 saat geçerli ve tek kullanımlıdır. | Kaynak kodda uygulandı |
| Öğrenci kimliği | Kod, kayıtlı e-posta ve ad-soyad eşleşmesi kontrol edilir. E-posta karşılaştırması için öğrenci kaydında normalize edilmiş ek alan tutulur. | Kaynak kodda uygulandı |
| Öğretmen onayı | Öğretmen talebi onaylar/reddeder; onayda bağlantı ve kayıt indeksi aynı Firestore transaction içinde oluşturulur. İzinler allowlist ile sınırlıdır. | Kaynak kodda uygulandı |
| Öğrenci erişimi | Yalnızca aktif bağlantı ve öğretmenin verdiği izinler kadar veri görünür. Öğrenci başka öğretmenin verisini okuyamaz. | Kurallar ve testler güncellendi |
| Ödev tamamlandı bildirimi | Öğrenci yalnızca kendisine atanmış ödev için ayrı Firestore bildirimi oluşturur. | Kaynak kodda uygulandı |
| Yeni ödev bildirimi | Öğretmen ödev oluşturduğunda veya yeni öğrenci hedeflediğinde uygulama içi bildirim yazılır; hedef kaldırılırsa mevcut bildirim iptal edilir. | Kaynak kodda uygulandı |
| Telefon push bildirimi | Spark'ta güvenli sunucu gönderimi yoktur. Expo/FCM gizli anahtarı APK'ya konulmaz. Öğrenci ekranı uygulama içi bildirimleri kullanır. | Push devre dışı; uygulama içi bildirim var |
| Uygulama sahibi istatistikleri | Custom claim kontrolüyle öğretmen, öğrenci, bağlantı ve bekleyen talep sayıları Firestore'dan hesaplanır; öğrenci kimliği ekranda gösterilmez. | Kaynak kodda uygulandı |
| Dönem temizliği | Uygulama sahibi Temmuz ayında altı koleksiyonu önizler; açık onayla yalnızca iki yıl önceki dönemi 400 kayıtlık batch'lerle siler ve yıllık kilit yazar. Firestore rules Temmuz dışı okumayı/silmeyi reddeder. | Kaynak kodda uygulandı; Firestore Emulator CI 45056266102 başarılı |

## Yıllık arşiv ve silme kararı

- 2026 kayıtları Temmuz 2028'e kadar korunur.
- Temmuz 2028'de yalnızca `donemYili == 2026` olan kayıtlar silinir.
- Temmuz 2029'da yalnızca 2027; Temmuz 2030'da yalnızca 2028 silinir.
- Silme kapsamı yalnızca `dersler`, `dersNotlari`, `yoklamalar`, `odevler`, `kitaplar`, `konular` koleksiyonlarıdır.
- Okul, sınıf, öğrenci, kullanıcı profili, ortak kitap kütüphanesi, öğretmen-öğrenci bağlantısı ve Firebase Auth hesabı silinmez.
- Eski dönemler görüntülenebilir/arşiv olarak kalır; düzenlenmez.
- `utils/donem.js` mevcut çalışma mantığı korunur.
- Spark'ta zamanlayıcı yoktur; Temmuz ayında uygulama sahibi paneli açıp önizleme ve açık onayla temizliği başlatır. Yıllık kilit ikinci çalıştırmayı engeller. Bu dalda hiçbir veri silinmemiştir.

## Canlıya alma güvenliği

- Firestore kuralları kaynak kodda Spark kayıt/eşleştirme ve bildirim işlemlerine göre yeniden yazıldı.
- Canlı Firestore kuralları henüz dağıtılmadı. Canlı projedeki mevcut geniş kurallar, yeni sıkı kuralların yerine geçmiyor.
- `ACCOUNT_LINKING_ENABLED` kaynak kodda açıldı; APK hazırlama betiği önce sıkı Firestore rules dağıtımını ve Android bundle doğrulamasını çalıştırır, sonra APK derlemesini başlatır. Betik canlı kurallar için ayrıca açık `DEPLOY` onayı ister.
- Yeni APK, kurallar dağıtılmadan kullanılmamalıdır.
- Bu dalda canlı veri silme, canlı dönem temizliği veya Firestore veri taşıması yapılmadı.

## Sıradaki teknik doğrulama sırası

1. [x] Firestore Emulator testleri: öğretmen profil kaydı, doğrulanmış öğrenci kod talebi, tek kullanımlılık, öğretmen onayı, izinler, bildirimler, başka öğretmene erişim engeli.
2. [x] Functions politika testleri ve Android JS bundle/export; `npm ci` doğrulandı.
3. [x] Sınıf gelişim raporu PDF'i eklendi; özel ders/etüt/soru çözümü kullanıcı cihazında APK sonrası test edilecek.
4. [ ] Kullanıcının açık DEPLOY onayıyla sıkı Firestore rules canlıya dağıtılacak.
5. [ ] EAS preview APK üretilecek.
6. [ ] Kullanıcı APK'yı tablette test eder; öğretmen telefonu ve mevcut imza kimliği korunur.

## Açık teknik sınırlar

- Push bildirimi Spark'ta sunucu tarafı güvenli biçimde gönderilemez; uygulama içi bildirim kullanılacaktır.
- Arka plan zamanlayıcısı yoktur; dönem temizliği uygulama sahibi tarafından Temmuz'da başlatılır.
- Gerçek öğrenci verisiyle test yapılmaz; APK sonrası kullanıcı kendi test hesabıyla tablette test eder.


## 24.11.2026 — Section 11 static source audit correction

A static scan of the current application screens found that the statement above that callable dependencies had been removed is not yet true for the complete UI. The following screens still invoke Cloud Functions callables:

- \`GirisEkrani.js\`, \`KayitEkrani.js\`, \`OgrenciKayitEkrani.js\`: email alias reservation/checking, account reactivation and email/profile synchronization.
- \`ProfilEkrani.js\`, \`RolDuzeltmeTalepleriEkrani.js\`: profile updates, email changes, account closure and role correction.
- \`OgrenciEkrani.js\`, \`OkulSinifEkrani.js\`: student move and permanent deletion.
- \`DonemAktarimEkrani.js\`: academic-period transfer.
- \`IstatistikPaneliEkrani.js\`: closed-account listing/erasure and annual data-retention preview/confirmation.

These callables are present in the repository's Functions source, but source exports do not prove that they are deployed or available on the Spark project. A number of these operations are security- or data-destructive. They must not be replaced with unrestricted client writes or treated as working on Spark.

Before a tablet APK or real-account test, each flow must either receive a Firestore-Rules-enforced Spark implementation or be safely disabled with a clear user-facing explanation. Email alias history must remain protected against reuse; student moves/deletions and period transfer/retention must not allow partial writes or data loss. No live deployment or data mutation was performed as part of this audit.


## 24.11.2026 — Guncel Spark callable durumu

Onceki statik tarama sonrasinda iki dusuk riskli alan daha Spark istemci akisina tasindi: profil ad/soyad kaydi ve dogrulanmis Auth e-postasinin kendi profile yazilmasi. Sonraki incelemede Firebase Security Rules SHA-256 hashing destegi dogrulandigi icin mevcut SHA-256 e-posta alias belge yapisi korunarak `services/sparkEmailAliases.js` eklendi; Rules yalnizca kullanicinin kendi dogrulanmis e-posta hash'ini okuyup olusturmasina/guncellemesine izin veriyor. Ogretmen profili e-posta dogrulanmadan olusturulmuyor; ogrenci alias rezervasyonu da dogrulama sonrasi yapiliyor.

Hesap kapatma ve yeniden etkinlestirme de kendi profil belgesi + ayni batch'teki audit kaydi ile istemciye tasindi. E-posta degisikligi, yeni adresin alias uygunlugunu Spark'ta guvenli on kontrol etme akisi tamamlanana kadar gecici olarak kapatildi.

Buna ragmen callable bagimliliklari tum uygulamadan kalkmadi. Kalan ekranlar: Profil (rol talebi), RolDuzeltmeTalepleri (karar), OgrenciEkrani (sinif/kayitsiz tasima ve silme), OkulSinifEkrani (okul kaldirma sirasinda kayitsiz ogrenci verilerini silme), DonemAktarimEkrani (buyuk aktarim), IstatistikPaneli (kapali hesap listeleme/imha ve donem temizligi). Bu islemler guvenli rules/transaction tasarimi veya acik guvenli devre disi birakma karari olmadan APK'ya hazir sayilmaz.

Yeni degisiklikler icin Emulator/unit testleri calistirilmadi; canlı Firestore rules dagitilmadi; canlı veri ve Auth hesaplari degistirilmedi. Bu nedenle bu belge bir dagitim onayi degildir.


## 24.11.2026 — Callable kapisi guncel sonucu

Depodaki 38 uygulama JS/JSX/TS/TSX dosyasi tarandi; uygulama kaynaklarinda artik `httpsCallable(` cagrisi yok. E-posta alias SHA-256 rezervasyonu, dogrulanmis kayit/giris, profil ad-soyad/e-posta senkronizasyonu ve hesap kapatma/yeniden etkinlestirme Spark istemci + Firestore Rules akislari olarak kaynakta uygulandi.

Cloud Functions'a bagli kalmis riskli ekranlarin guvenli Spark karsiligi tamamlanmadigi icin bu ozellikler acik uyarilarla devre disi birakildi: e-posta degisikligi, rol duzeltme talep/karari, ogrenci sinif/kayitsiz tasima ve kalici silme, okul kaldirma, akademik donem aktarimi, kapali hesap listeleme/imhasi ve yillik cok koleksiyonlu donem temizligi. Bu nedenle "uygulama callable bagimliligi kalmadi" dogrudur; ancak "tum ozellikler Spark'a tasindi" dogru degildir.

Testler henuz calistirilmadi. Canli Firestore Rules dagitilmadi. Canli veri/Auth hesabi degistirilmedi. Bu belge APK veya canli dagitim onayi degildir.


## 24.11.2026 — Saklama tarihi kod uyumu

Kaynak kodda bulunan eski `2029 / yıl - 3` temizleme kuralı, kullanıcının kararı olan `Temmuz 2028 -> 2026; Temmuz 2029 -> 2027; devamında Temmuz ayında yıl - 2` kuralına göre güncellendi:
- `functions/retentionPolicy.js`
- `firestore.rules`
- `screens/IstatistikPaneliEkrani.js`
- `functions/test/retentionPolicy.test.js` beklenen tarihleri

Bu güncellemeden sonra Emulator testleri çalıştırılmadı. Dönem temizleme arayüzü Spark'ta güvenli çok-batch istemci akışı tamamlanana kadar kapalıdır. Canlı rules dağıtımı veya veri silme yapılmadı.
