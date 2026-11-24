# Canlı Firestore Rules ve tablet sürümü uyumluluk incelemesi

İnceleme tarihi: 24 Kasım 2026

Karşılaştırma kaynakları:
- Kullanıcının Firebase Console'dan paylaştığı mevcut canlı Rules metni.
- \`release/tablet-apk-2026-11-24\` dalındaki \`firestore.rules\` ve uygulama kaynak kodu.

Bu belge canlı Rules veya Firestore verisini değiştirmez.

## Doğrudan kullanım engelleri

| İşlem | Canlı Rules | Tablet dalı | Etki |
|---|---|---|---|
| Doğrulanmış e-posta alias'ı ayırma | \`epostaAliaslari\` için eşleşme yok; varsayılan ret | Yalnızca oturumdaki doğrulanmış e-postanın SHA-256 belgesi için get/create/update | Yeni giriş/kayıt akışında alias işlemi reddedilir; giriş ekranı oturumu kapatır |
| Profilde ad/soyad güncelleme | Profil update izin listesi \`kullaniciAdi\`, \`brans\`, \`sezon\` ile sınırlı | \`ad\` ve \`soyad\` alanları tür ve uzunluk kontrolüyle izinli | Profil ekranında ad/soyad kaydı başarısız olur |
| Doğrulanmış Auth e-postasını profile eşitleme | \`eposta\` değiştirilemez | Yalnızca doğrulanmış token e-postasıyla eşleşen güncelleme izinli | Eski profil e-postası Auth e-postasından farklıysa giriş akışı başarısız olabilir |
| Hesap kapatma/yeniden etkinleştirme denetimi | \`hesapYasamDongusuDenetimi\` için eşleşme yok | Aynı batch içinde profil değişimi ve denetim kaydı doğrulanıyor | Hesap yaşam döngüsü işlemleri canlı Rules ile başarısız olur |

## Öğrenci ve yönetim ekranları

| Koleksiyon/işlem | Canlı Rules | Tablet dalı | Etki |
|---|---|---|---|
| \`ogrenciOdevDurumBildirimleri\` | Eşleşme yok | Öğrenciye özel okuma ve okundu işaretleme; öğretmen tarafından doğrulanmış oluşturma | İlgili öğrenci bildirim ekranı canlı Rules ile çalışmaz |
| \`rolDuzeltmeTalepleri\` | Eşleşme yok | Kullanıcı/uygulama sahibi için salt okunur; create/update/delete kapalı | Yönetim ekranı açılırsa sorgu reddedilir; rol değiştirme zaten kapalı |
| \`ogrenciPushTokenlari\` | Okuma/yazma kapalı | Okuma/yazma kapalı | Push token özelliği kapalı kalır; uygulama içi bildirimle karıştırılmamalı |
| \`donemTemizlikKayitlari\` | Uygulama sahibine sınırlı denetim kaydı oluşturma | İstemci yazmaları kapalı | Temizlik kaydı yalnızca yerel Admin SDK betiğiyle yazılabilir; Admin SDK Rules'u aşar |

## Uyumluluk lehine doğrulanan noktalar

- Yeni kayıt ekranı öğretmen profilini yalnızca e-posta doğrulandıktan sonra oluşturuyor; yeni Rules bu doğrulamayı zorunlu kılıyor.
- Yeni Rules, \`hesapDurumu\` alanı bulunmayan eski profilleri \`aktif\` kabul ediyor. Böylece mevcut öğretmen hesaplarının yalnızca bu alan eksik diye kilitlenmesi önleniyor.
- Uygulama sahibi yetkisi Firestore profilindeki metin rolünden değil, Auth custom claim \`uygulamaSahibi == true\` üzerinden kontrol ediliyor.
- Öğrenci rolü, öğretmen-öğrenci bağlantısı ve izinleri yeni Rules ile sınırlandırılıyor. Öğrenci hesap bağlantısı uygulama ayarında kapalı olduğundan bu akış tabletin ilk öğretmen kullanım testinde etkinleştirilmeyecek.
- Yeni Rules için Emulator testleri CI iş akışında çalıştırılıyor; canlı projede deneme yapılmıyor.

## Ayrı indeks gereksinimi

Öğrenci ana sayfasındaki ödev sorgusu şu üç koşulu birlikte kullanır:
- \`uid == öğretmen UID\`
- \`sinifId == bağlantı sınıfı\`
- \`hedefOgrenciIds array-contains öğrenci kayıt ID\`

Tablet dalındaki \`firestore.indexes.json\` bu sorgu için tek bir \`odevler\` birleşik indeksi tanımlar. Canlı projede daha önce yapılan indeks listesi kontrolü boş sonuç vermiştir. Bu indeks, Rules dağıtımından bağımsız bir altyapı değişikliğidir ve ayrıca incelenip onaylanmalıdır.

## Dağıtım kararı

1. Mevcut canlı Rules ile yeni tablet sürümü birlikte kullanılmamalıdır.
2. Yeni Rules Emulator testleri ve uygulama işlem eşleştirmesi tamamlanmadan canlıya dağıtılmamalıdır.
3. Dönem temizliği için yerel Spark uyumlu Admin SDK betiği, Rules dağıtımından ayrı değerlendirilmelidir.
4. Rules ve birleşik indeks dağıtımı ayrı komutlar, ayrı onaylar ve dağıtım sonrası doğrulama ile yapılmalıdır.
5. Bu inceleme sırasında canlı Rules, indeksler, hesaplar ve Firestore belgeleri değiştirilmemiştir.
