# Bölüm 10 — Öğrenci bağlantıları ve bildirimler

## Onaylanmış çalışma modeli

- Öğretmen yalnızca kendi öğrenci kaydı için eşleştirme kodu oluşturur.
- Kod tek kullanımlık, 12 saat geçerli ve 16 karakterli büyük harfli hexadecimal metindir. Firestore'da kodun SHA-256 özeti saklanır.
- Öğrenci hesabı e-posta adresini doğrular; ad-soyad ve e-posta öğretmenin öğrenci kaydıyla eşleşmelidir.
- Eşleştirme talebi öğretmen onayına kadar hiçbir öğrenci verisi açmaz.
- Öğretmen altı ayrı izin belirler: ders programı, ders notları, konular, yoklama, ödevler, kitaplar.
- Öğrenci birden fazla öğretmene ayrı bağlantılarla bağlanabilir; her bağlantı yalnızca ilgili öğretmenin kendi kaydına erişir.
- Öğrenci ödev için yalnızca “tamamladım” bildirimi gönderir. Ödevin nihai durumu ve değerlendirmesi öğretmene aittir.
- Öğrenci yeni ödevleri uygulama içi bildirimler olarak görür. Bu sürümde cihaz push bildirimi/Expo token kaydı kullanıcı arayüzünde etkin değildir.
- 5–8. sınıf bağlantıları veli/vasi süreci netleşene kadar kapalıdır.

## Bölüm 10 denetim listesi

1. Kayıt ekranı ve öğrenci ana sayfası bağlantı akışını kontrol et.
2. Kodun tek kullanımlı, 12 saatlik ve hash-only saklandığını doğrula.
3. Öğrenci onayı öncesi veri erişiminin kapalı olduğunu Firestore Emulator testleriyle doğrula.
4. Öğretmen onay/ret, izin güncelleme ve bağlantı iptalini kontrol et.
5. Öğrencinin yalnızca izinli verileri okuduğunu doğrula.
6. Yeni ödev bildirimlerinin öğrenci ekranında, tamamlandı bildirimlerinin öğretmen ekranında görünmesini doğrula.
7. Bildirimin öğretmen değerlendirmesini veya ödev durumunu değiştirmediğini doğrula.
8. Cloud Functions ve Firestore kuralları için testleri çalıştır.
9. Canlı Firebase'e dağıtım yapma; gerçek öğrenci hesabı ve tablet testi 11. bölümde kullanıcı onayıyla yapılır.

## Güvenli sınırlar

- ACCOUNT_LINKING_ENABLED bu kod dalında açıktır; PR birleştirilmediği ve dağıtım yapılmadığı için canlı uygulama değişmez.
- Gerçek öğrenci hesabı, sahte öğrenci verisi veya canlı eşleştirme oluşturulmaz.
- Push token kaydı yapılmaz; uygulama içi bildirim akışı korunur.
- Hiçbir Cloud Functions, Firestore rules veya index canlıya dağıtılmaz.
