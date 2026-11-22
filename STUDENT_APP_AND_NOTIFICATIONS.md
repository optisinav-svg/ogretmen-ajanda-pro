# Öğrenci uygulaması ve öğretmen-öğrenci bağlantısı — Grup 4

## Güvenli etkinleştirme sırası

Öğrenci bağlantısı uygulama tarafında bilerek kapalı tutulur:

- `firebaseConfig.js`: `ACCOUNT_LINKING_ENABLED = false`
- Grup 4 dalı canlı Firestore kurallarını veya Cloud Functions'ı dağıtmaz.
- Özellik, Grup 5/6 son denetiminden sonra şu sırayla etkinleştirilir:
  1. Cloud Functions dağıtılır.
  2. Firestore güvenlik kuralları dağıtılır.
  3. Canlıda öğretmen/öğrenci callable işlevleri ve güvenlik testleri doğrulanır.
  4. Uygulama yapılandırmasında `ACCOUNT_LINKING_ENABLED` açılır.
  5. Öğretmen ve öğrenci APK akışı test edilir.

## Hesap eşleştirme akışı

1. Öğretmen, kendi sınıfındaki lise öğrencisi kaydına öğrencinin hesapta kullanacağı e-posta adresini ekler.
2. Öğretmen 12 saat geçerli, tek kullanımlık eşleştirme kodu oluşturur.
3. Öğrenci uygulamada hesap açar ve e-posta adresini doğrular.
4. Öğrenci kodu girer. Sunucu; e-posta, ad-soyad, öğretmen, öğrenci kaydı, sınıf ve akademik dönem eşleşmesini doğrular.
5. Öğretmen talebi görür; paylaşım izinlerini kendisi seçerek onaylar veya reddeder.
6. Öğrenci birden fazla öğretmen/sınıf bağlantısını aynı hesapta görebilir. Bir öğrenci kaydı aynı öğretmende ikinci bir hesaba bağlanamaz.
7. Öğretmen bağlantıyı iptal edebilir veya izinleri değiştirebilir. İzin değişikliği ve iptal sunucu üzerinden yapılır.

Paylaşım izinleri varsayılan olarak kapalıdır: ders programı, ders notları, konular, yoklama, ödevler, kitaplar/ilerleme. Öğrenci yalnızca izin verilen verileri okuyabilir; öğretmenin kayıtlarını değiştiremez.

Ortaokul hesap eşleştirmesi veli/vasi süreci netleşene kadar kapalıdır.

## Ödev bildirimi

- Yeni ödev oluşturulduğunda ve mevcut ödeve yeni öğrenci eklendiğinde sunucu tetikleyicisi çalışır.
- Yalnızca etkin bağlantısı ve `odevler` paylaşım izni bulunan, hedef öğrenci kaydıyla aynı öğretmen/sınıf/dönem eşleşmesine sahip öğrenciler bildirim alır.
- Sunucu `ogrenciYeniOdevBildirimleri` koleksiyonuna uygulama içi bildirim yazar.
- Öğrenci bu bildirimi uygulamada görebilir ve yalnızca okundu olarak işaretleyebilir.
- Öğrenci telefonunda bildirim iznini kendisi açarsa Expo Push belirteci sunucuya kaydedilir ve yeni ödevlerde telefon bildirimi gönderilir.
- Öğretmen ödev hedefinden öğrenciyi çıkarırsa ilgili uygulama içi bildirim iptal durumuna alınır.
- Öğretmen bağlantıyı iptal ettiğinde sonraki ödev bildirimleri gönderilmez.

Push belirteçleri `ogrenciPushTokenlari` koleksiyonunda yalnızca Admin SDK tarafından yönetilir. İstemci bu koleksiyonu okuyamaz veya yazamaz. Push mesajında öğrenci adı/e-posta gibi kişisel bilgiler bulunmaz.

## APK öncesi gerekli Expo kurulumu

Android gerçek cihaz push teslimatı için EAS projesinde Firebase Cloud Messaging V1 servis hesabı kimlik bilgileri tanımlanmalıdır. Bu işlem EAS proje sahibi tarafından yapılır; servis hesabı anahtarı sohbet veya GitHub deposuna konulmamalıdır.

1. Expo/EAS projesinde Android FCM V1 kimlik bilgilerini tanımlayın.
2. Grup 5'te yeni APK oluşturun.
3. Gerçek Android telefonda öğrenci hesabı açın, e-postayı doğrulayın ve öğretmen koduyla eşleştirin.
4. Öğretmen talebi onaylayıp yalnızca gerekli izinleri açsın.
5. Öğrenci uygulamasında **Telefon bildirimlerini aç** düğmesine basıp Android izin penceresini onaylasın.
6. Öğretmen öğrenciye yeni ödev oluştursun; uygulama içi bildirim ve telefon bildirimi ayrı ayrı doğrulansın.
7. Öğretmen bağlantıyı iptal etsin; sonraki yeni ödevin bildirim göndermediği doğrulansın.

EAS/FCM kimlik bilgileri ve gerçek cihaz/APK teslimat testi tamamlanmadan push bildirimi canlıda çalışıyor olarak kabul edilmez.

## Grup 4 kapsamındaki testler

- Callable token doğrulama ve kullanıcıya özgü token kimliği testleri
- Ödev bildirim kimliği ve hedef öğrenci testleri
- Push mesajında öğrenci kimliğinin paylaşılmadığı kontrolü
- Firestore Emulator: öğrenci yalnızca kendi bildirimini okuyabilir
- Firestore Emulator: öğrenci yalnızca okundu alanını değiştirebilir
- Firestore Emulator: push token koleksiyonu istemciye kapalı
