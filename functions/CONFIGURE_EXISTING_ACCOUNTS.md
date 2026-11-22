# Mevcut iki hesabın öğretmen ve uygulama sahibi olarak güvenli tanımlanması

Bu işlem yalnızca mevcut iki `kullanicilar` profilini ve seçilen Firebase Authentication hesabının özel claim bilgisini etkiler. Öğrenci kayıtları, okullar, sınıflar ve diğer Firestore belgeleri değiştirilmez.

## Ön koşullar

- Önceden alınmış ve doğrulanmış Firestore yedeğini koruyun.
- Komutu uygulama projesinin kök klasöründen çalıştırın.
- Google hesabınızda hedef Firebase projesine Firebase Authentication kullanıcılarını okuma ve özel claim güncelleme; Firestore profillerini okuma/yazma yetkisi bulunmalıdır.
- Kimlik, parola, token veya servis hesabı anahtarını sohbet içinde paylaşmayın.

## 1. Önce yalnızca deneme

PowerShell'de:

```powershell
gcloud auth application-default login
$env:GOOGLE_CLOUD_PROJECT="ogretmen-takip"
node .\functions\scripts\configure-existing-accounts.js
```

Script, Firestore'daki iki profilin Firebase Authentication hesaplarıyla eşleştiğini doğrular. Tam UID ve e-posta adreslerini göstermez; iki hesabı profil adı ve maskelenmiş e-posta ile listeler. Kendi hesabınızı seçin.

Bu komut **DRY-RUN** modundadır; hiçbir veri yazmaz.

## 2. Sonuç doğruysa uygulama

Aynı komutu yalnızca deneme çıktısını kontrol ettikten sonra `--apply` ile çalıştırın:

```powershell
node .\functions\scripts\configure-existing-accounts.js --apply
```

Script iki profilde rol alanı yoksa `rol: "ogretmen"` yazar. Mevcut rollerden biri öğrenci veya beklenmeyen bir değer ise, profil sayısı iki değilse ya da Auth eşleşmesi bulunamazsa işlem durur. Seçtiğiniz hesaba sunucu tarafından `uygulamaSahibi: true` custom claim'i eklenir. Var olan diğer custom claim'ler korunur.

Firestore ve Firebase Authentication tek bir ortak transaction desteklemediğinden, nadir bir ağ hatasında profil rolü yazılıp custom claim adımı başarısız kalabilir. Script tekrar çalıştırılabilir; öğretmen rolü güncellemesi idempotent'tir.

## 3. Sonrasında

- Seçilen hesapta uygulamadan çıkış yapıp yeniden giriş yapın; yeni kimlik token'ı alınmalıdır.
- İstatistik Paneli düğmesi yalnızca uygulama sahibi hesabında görünmelidir.
- Sunucu callable işlevi de claim'i yeniden kontrol eder; ekrandaki düğmeyi gizlemek tek başına güvenlik kontrolü değildir.
- Bu işlem Firestore güvenlik kurallarını dağıtmaz ve canlı kuralları değiştirmez.
