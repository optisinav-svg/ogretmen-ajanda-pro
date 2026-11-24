# Canlı veriler için salt okunur Rules uyumluluk denetimi

Yeni Rules Emulator testleri, tanımlı test belgeleriyle kuralların beklenen davranışını doğrular. Bu ek betik ise mevcut Firestore belgelerinin yapısını ve birbirleriyle ilişkilerini salt okunur olarak inceler. Böylece Rules dağıtımından önce eski/eksik veri yapıları belirlenebilir.

## Çalıştırma

Depo kökünden:

```powershell
Set-Location .\functions
node .\scripts\audit-rules-compatibility.js
```

Google Application Default Credentials gerekir. Betik yalnızca `ogretmen-takip` projesini okur.

## Kapsam

- Kullanıcı rolü ve hesap durumu.
- Okul-sınıf-öğrenci sahipliği ve dönem eşleşmeleri.
- Ders, ders notu, ödev, yoklama, kitap ve konu kayıtlarının sınıf/öğrenci/ders ilişkileri.
- Bireysel etkinlik ve oturum bağlantıları.
- Kitap kütüphanesi belgelerinin yeni Rules içindeki kesin alan listesi ve tip koşulları.

Öğrenci hesap eşleştirme akışı uygulama ayarında kapalı olduğundan bu denetim, eşleştirme taleplerinin ve öğrenci bildirimlerinin tüm iş kurallarını doğrulamaz.

## Çıktı ve yorumlama

- Çıktı yalnızca koleksiyon başına belge sayıları, dönem dağılımları ve hata/uyarı sayaçları içerir.
- Öğrenci adı, e-posta, belge kimliği veya belge içeriği yazdırılmaz.
- Hata sayıları, yeni Rules altında ilgili yazma/güncelleme işleminin reddedilebileceğini gösterir.
- Tarihsel sınıfında kalmış yoklama ve bireysel ders oturumu gibi kayıtlar uyarı olarak sayılır; bunların okunabilmesi ile güncellenebilmesi farklıdır.
- Arşivlenmiş sınıf/okul uyarıları, mevcut kayıtların okunmasını değil, yeni kayıt veya güncelleme işlemlerini etkileyebilir.

Bu betik canlı Rules dağıtmaz, indeks oluşturmaz ve Firestore'a hiçbir belge yazmaz, güncellemez veya silmez. Çıktı incelenmeden canlı Rules dağıtımı yapılmamalıdır.
