# Öğretmen–öğrenci hesap ve bildirim modeli

Bu belge, uygulamanın mevcut kaynak kodundaki eşleştirme ve bildirim akışını açıklar. Section 10 dalında özellikler kod düzeyinde etkin olsa da PR henüz birleştirilmemiş ve Firebase'e dağıtılmamıştır. Gerçek öğrenci hesabı veya canlı eşleştirme oluşturulmamıştır.

## Roller ve kayıt

- Geçerli roller `ogretmen` ve `ogrenci` değerleridir.
- Kayıt başlangıç ekranı kullanıcıya öğretmen veya öğrenci hesabı seçtirir.
- Öğrenci hesabı yalnızca e-posta doğrulandıktan ve geçerli eşleştirme koduyla talep oluşturulduktan sonra `kullanicilar/{uid}` belgesinde `rol: 'ogrenci'` olarak tanımlanır.
- Profil oluşturma ve eşleştirme talebi, öğrenci istemcisinde tek Firestore transaction ile yazılır; Firestore kuralları e-posta doğrulamasını, kodun geçerliliğini, ad-soyad eşleşmesini ve talep ilişkisini birlikte denetler.
- Öğrenci talebi öğretmen tarafından onaylanana kadar öğretmen verilerine erişemez.
- İstemci kendi rolünü doğrudan değiştiremez. Rol düzeltme talepleri uygulama sahibi tarafından incelenir.

## Eşleştirme akışı

1. Öğretmen yalnızca kendi sahip olduğu öğrenci kaydı için kod oluşturur.
2. Öğrenci kaydı, sınıf ve akademik dönem sahipliği doğrulanır. Yalnızca 9, 10, 11, 12, TYT veya AYT sınıfları kabul edilir. 5–8. sınıf bağlantıları veli/vasi süreci netleşene kadar kapalıdır.
3. Ham kod 16 karakterlik kriptografik rastgele hexadecimal değerdir. Firestore'da yalnızca kodun SHA-256 özeti (64 hexadecimal karakter) belge kimliği olarak tutulur.
4. Kod 12 saat geçerlidir ve ilk geçerli öğrenci talebinde transaction içinde tek kullanımlık olarak tüketilir.
5. Öğrenci e-postası doğrulanmış olmalı; hesap e-postası ve ad-soyad öğretmenin öğrenci kaydıyla eşleşmelidir.
6. Öğretmen talebi onaylar veya reddeder. Onay transaction'ı bağlantı ve öğrenci-kayıt indeksini oluşturur; Firestore kuralları öğretmen sahipliğini ve benzersiz bağlantıyı doğrular.
7. Öğretmen altı izni birbirinden bağımsız seçer: ders programı, ders notları, konular, yoklama, ödevler ve kitaplar.
8. Bir öğrenci farklı öğretmenlerden ayrı bağlantılar alabilir. Her bağlantı yalnızca ilgili öğretmenin kendi öğrenci/sınıf kayıtlarına erişim sağlar.
9. Öğretmen bağlantıyı iptal edebilir veya izinleri güncelleyebilir. Öğrenci yalnızca etkin bağlantı ve açık izin kapsamındaki verileri okuyabilir.
10. Aynı öğretmen öğrenci kaydı zaten etkin bir öğrenci hesabına bağlıysa yeni kod oluşturulmaz.

## Gerçek uygulama yazma yolu

- Öğretmen kod oluşturma, öğrenci talep gönderme, öğretmen onayı/ret, izin güncelleme ve bağlantı iptali için uygulamanın kullandığı yol `services/sparkStudentAccounts.js` içindeki Firestore transaction'larıdır.
- Bu işlemlerin güvenlik sınırı `firestore.rules` dosyasındaki sahiplik, doğrulanmış e-posta, dönem, tek kullanımlık kod, bağlantı ve izin kontrolleridir.
- `functions/accountLinks.js` içindeki eski callable prototipleri uygulama giriş noktasından kaldırılmıştır; alternatif ve farklı belge şemalı bir yazma yolu olarak dağıtılmayacaktır.
- Öğretmen kodu oluşturma sırasında öğrenci adı, e-posta, sınıf ve öğretmen görünen adı gibi gerekli eşleştirme özetleri kod belgesine yazılır. Kurallar bu alanların biçimini ve öğrenci kaydıyla temel eşleşmelerini doğrular.
- Yeni bir bağlantı/indeks henüz yokken transaction'ın varlık kontrolü yapabilmesi için yalnızca kendi UID önekine uyan eksik belge kimlikleri için sınırlı `get` izni vardır. Başka öğretmenin önekine ait belgeler okunamaz.

## Bildirimler

- Öğretmen ödevi kaydettiğinde `OdevEkrani` içindeki `syncNewHomeworkNotifications` Spark uyumlu Firestore transaction/batch yazımıyla `ogrenciYeniOdevBildirimleri` belgelerini oluşturur veya hedef öğrenci çıkarıldığında iptal eder.
- Öğrenci bu bildirimleri kendi ana sayfasında uygulama içi olarak görür ve okundu durumunu günceller.
- Öğretmen ödevi sildiğinde `cancelHomeworkNotifications` ilgili öğrenci bildirimlerini `iptal` durumuna getirir.
- Öğrenci “Ödevi tamamladım” dediğinde `services/sparkStudentAccounts.js` içindeki `notifyHomeworkCompleted` yalnızca `ogrenciOdevBildirimleri` belgesini oluşturur.
- Tamamlandı bildirimi öğretmenin ödev durumunu, değerlendirmesini veya öğrenci geçmişini kendiliğinden değiştirmez. Öğretmen bildirimi öğrenci hesapları ekranında görür ve nihai kararı kendisi verir.
- Bu sürümde uygulama istemcisi Expo push token kaydetmez. Kullanıcı akışı uygulama içi bildirimlerle sınırlıdır; telefon push bildirimi etkin değildir.
- `functions/studentNotifications.js` içindeki eski push/tetikleyici prototipi `functions/index.js` üzerinden dışa aktarılmaz; yeni ödev bildiriminin ikinci kez yazılmasını ve push altyapısına yanlışlıkla bağımlı olunmasını önlemek için kullanılmaz.

## Koleksiyonlar

- `ogrenciEslesmeKodlari`: öğretmen/öğrenci kayıt kimliği, sınıf/dönem, eşleştirme özeti, kod kullanım ve sona erme bilgisi. Ham kod saklanmaz.
- `ogrenciEslesmeTalepleri`: öğrenci/öğretmen UID, öğrenci kayıt kimliği ve talep durumu.
- `ogretmenOgrenciBaglantilari`: öğretmen, öğrenci, öğrenci kayıt kimliği, sınıf, altı izin ve bağlantı durumu.
- `ogrenciKayitEslesmeleri`: öğretmen başına öğrenci kayıt kimliğinin tek aktif hesaba bağlanmasını sağlayan indeks.
- `ogrenciYeniOdevBildirimleri`: öğrenciye ait yeni ödev uygulama içi bildirimleri.
- `ogrenciOdevBildirimleri`: öğrencinin tamamlandı bildirimi; öğretmen değerlendirmesinden ayrıdır.
- `ogrenciPushTokenlari`: sunucu push altyapısı için ayrılmıştır; bu sürümün uygulama istemcisi token kaydı yapmaz.

## Uygulama ekranları

- `OgrenciHesaplariEkrani`: öğretmenin kendi öğrenci kaydı için kod üretmesi, gelen talepleri onaylaması/reddetmesi, izinleri yönetmesi, bağlantıyı iptal etmesi ve öğrenci tamamlandı bildirimlerini görmesi.
- `OgrenciKayitEkrani`: öğrencinin e-posta doğrulaması ve 16 karakterli kodla eşleştirme talebi.
- `OgrenciAnaSayfaEkrani`: etkin öğretmen bağlantılarını ve yalnızca izin verilen verileri salt okunur gösterir; öğrenci ödev için tamamlandı bildirimi gönderebilir.
- `firebaseConfig.js` içindeki `ACCOUNT_LINKING_ENABLED` bu kod dalında `true`; PR birleştirilmediği ve dağıtım yapılmadığı için canlı uygulama değişmez.

## Güvenlik ve dağıtım sınırları

- Firestore kuralları varsayılan olarak bilinmeyen koleksiyon ve yolları kapatır.
- Öğretmen verileri UID sahipliğiyle korunur; sınıf, öğrenci, okul, ders, kitap ve konu ilişkileri ayrıca doğrulanır.
- Öğrenci yalnızca kendi bağlantılarını ve izin verilmiş kayıtları okuyabilir.
- Yeni ödev bildirimleri öğretmen istemcisinden, Firestore kurallarıyla doğrulanan sahiplik/bağlantı kontrolleri üzerinden yazılır; tamamlandı bildirimi öğrenci tarafından yalnızca kendi etkin bağlantısı ve ödev hedefi için yazılabilir.
- Bu PR ile hiçbir Cloud Function veya Firestore kuralı canlıya dağıtılmaz. Gerçek öğrenci hesabı ve cihaz testi 11. bölümde kullanıcı onayıyla yapılır.

## İndeks uyarısı

`firestore.student-indexes.example.json` yalnızca yeni ödev sorgusu için örnek indeks içerir. Firebase projesindeki mevcut composite index'ler dışa aktarılmadan bu örnek dosya tam indeks manifesti olarak dağıtılmamalıdır.
