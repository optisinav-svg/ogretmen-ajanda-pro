# Öğretmen–öğrenci hesap ve erişim modeli

Bu belge Grup 4'te kararlaştırılan hesap güvenliği ve eşleştirme altyapısını açıklar. Bu kodlar kaynak depoda hazırlanmıştır; Firebase projesine dağıtılmamıştır. Öğrenci hesapları uygulama arayüzünde açılmayacaktır; dağıtım ve ayrı öğrenci ekranları sonraki aşamada hazırlanıp test edilmeden gerçek kullanıcılar eşleştirilmeyecektir.

## Roller ve geriye dönük uyumluluk

- Geçerli roller `ogretmen` ve `ogrenci` değerleridir.
- Yeni öğretmen kaydı profilinde `rol: 'ogretmen'` yazar.
- Eski `kullanicilar/{uid}` belgelerinde rol alanı bulunmuyorsa güvenli geçiş için mevcut kullanıcı öğretmen kabul edilir.
- `eskiOgretmenRolunuTanimla` callable'ı yalnızca rolü bulunmayan eski hesabı `ogretmen` olarak işaretler. Öğrenci rolünü öğretmene çeviremez.
- İstemci kendi rolünü oluşturamaz/değiştiremez. Öğrenci profili yalnızca eşleştirme talebi gönderilirken güvenilir Cloud Function tarafından oluşturulur.
- Profil silme istemciye kapalıdır.

## Eşleştirme akışı

1. Öğretmen kendi sahip olduğu öğrenci kaydı için kod ister.
2. Sunucu öğrenci ve sınıf sahipliğini doğrular. Yalnızca 9, 10, 11, 12, TYT veya AYT sınıfları kabul edilir. Ortaokul (5–8) ve sınıf seviyesi doğrulanamayan kayıtlar, veli/vasi süreci netleşene kadar kapalıdır.
3. Kod 16 karakterlik kriptografik rastgele değerdir. Firestore'da yalnızca SHA-256 özeti tutulur; ham kod öğretmene bir kez döndürülür.
4. Kod 12 saat geçerlidir ve ilk başarılı öğrenci talebinde transaction içinde tek kullanımlık olarak tüketilir.
5. Öğrenci talebi gönderdiğinde öğrenci profili sunucu tarafından `ogrenci` rolüyle oluşturulur. Talep onaylanana kadar öğrenci verilerine erişim verilmez.
6. Öğretmen talebi onaylar veya reddeder. Onay sırasında öğretmen sahipliği, öğrenci kaydı, sınıf ve öğrenci hesabı tekrar doğrulanır.
7. Öğretmen altı paylaşım iznini birbirinden bağımsız seçer: ders programı, ders notları, konular, yoklama, ödevler ve kitaplar.
8. Bir öğrenci farklı öğretmenlerden ayrı bağlantılar alabilir. Her bağlantı yalnızca ilgili öğretmenin kendi öğrenci/sınıf kayıtlarına erişim sağlar.
9. Öğretmen bağlantıyı iptal edebilir veya izinleri güncelleyebilir. Firestore kuralları her okuma sırasında bağlantının etkin ve ilgili iznin açık olmasını denetler.
10. Öğrencinin ödev tamamlandı bildirimi `ogrenciOdevBildirimleri` koleksiyonuna ayrı yazılır; öğretmenin ödev değerlendirmesi veya öğrenci durum geçmişi değiştirilmez.

## Sunucu uçları

- `eskiOgretmenRolunuTanimla`
- `ogrenciEslesmeKoduOlustur`
- `ogrenciEslesmeTalebiGonder`
- `ogrenciEslesmeTalebiniOnayla`
- `ogrenciEslesmeTalebiniReddet`
- `ogrenciBaglantisiniIptalEt`
- `ogrenciBaglantiIzinleriniGuncelle`
- `ogrenciOdevTamamlandiBildir`

## Koleksiyonlar

- `ogrenciEslesmeKodlari`: kod özeti, öğretmen UID, öğrenci kayıt kimliği, sınıf, kullanım ve sona erme bilgisi. İstemci erişimi tamamen kapalıdır.
- `ogrenciEslesmeTalepleri`: öğrenci/öğretmen UID, eşlenecek öğrenci kaydı ve talep durumu. İstemciler yalnızca kendi taraf oldukları talepleri okuyabilir; yazma sunucuya aittir.
- `ogretmenOgrenciBaglantilari`: öğretmen, öğrenci, öğrenci kayıt kimliği, sınıf, altı izin ve bağlantı durumu. İstemciler yalnızca kendi bağlantı özetlerini okuyabilir; yazma sunucuya aittir.
- `ogrenciOdevBildirimleri`: öğrencinin tamamlandı bildirimi; öğretmen değerlendirmesinden ayrıdır. İstemci yazması kapalıdır.

## Güvenlik ve dağıtım sınırları

- `firestore.rules` varsayılan olarak bilinmeyen koleksiyon ve yolları kapatır.
- Öğretmen verileri `uid` sahipliğiyle korunur; sınıf, öğrenci, okul, ders, kitap ve konu ilişkileri ayrıca doğrulanır.
- Öğrenci yalnızca kendi eşleştirilmiş öğrenci kaydını, kendi sınıfını ve izin verilmiş kayıtları okuyabilir.
- Bağlantı, izin ve talep yazmaları yalnızca doğrulanmış callable Function uçlarından yapılır.
- Hiçbir kural veya Function bu commit ile canlı Firebase'e dağıtılmaz.
- Dağıtım öncesinde Firestore Emulator testlerinin başarılı olması, mevcut öğretmen verileriyle uyumluluğun doğrulanması ve Firebase dağıtım onayı gerekir.
