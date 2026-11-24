# Canlı Firestore ilişki sorunları için salt okunur ayrıntılı tanı

İlk audit-rules-compatibility.js denetimi yalnızca hata sayaçlarını verir. Bu ikinci betik, hataların aynı eksik sınıf/öğrenci referanslarında kümelenip kümelenmediğini ve mevcut ders programı kaydının hangi sınıfa bağlı olduğunu ayırt etmek için hazırlanmıştır.

## Çalıştırma

```powershell
node .\scripts\diagnose-rules-compatibility.js
```

Google Application Default Credentials gerekir. Betik yalnızca ogretmen-takip projesini okur.

## Üretilen tanı

- Bulunamayan sınıf ve öğrenci referanslarını, bu referansların hangi koleksiyonlarda tekrarlandığına göre gruplar.
- Her grupta yalnızca kayıt sayısı, farklı referans sayısı, farklı sahip hesabı sayısı, dönem yılları ve varsa kayıt tarih aralığını gösterir.
- Mevcut ders programı kaydının sınıfı ile ders notu/ödev/yoklama kaydının sınıfı uyuşmadığında; farklı ders, kayıt sınıfı ve ders sınıfı sayısını ve kayıt sınıfının hâlâ mevcut olup olmadığını sayar.
- Belge kimliği, sınıf/öğrenci kimliği, UID, ad, soyad, e-posta veya belge içeriği yazdırmaz.
- Firestore'a belge yazmaz, güncellemez veya silmez.

## Yorumlama

- Aynı eksik sınıf referansının birden fazla koleksiyonda görünmesi, tek bir eski sınıf kaydının silinmesi veya referansının kopmasıyla ilişkili olabilir; bu tek başına silme nedenini kanıtlamaz.
- Bir kayıt sınıfı hâlâ mevcutken bağlı ders başka sınıfı gösteriyorsa, ders programının sonradan başka sınıfa taşınmış/değişmiş olması olasılığı ayrıca incelenmelidir.
- Kayıt sınıfı bulunamıyorsa, ders-sınıf uyuşmazlığı aynı kök sorunun ikincil sonucu olabilir.
- Tarih aralığı yalnızca mevcut belgelerdeki tarih alanlarından çıkarılır; işlem geçmişi veya silme zamanı değildir.

Bu betik yalnızca tanı içindir. Otomatik veri düzeltmesi, taşıma, silme veya Rules dağıtımı yapmaz. Çıktı incelenmeden canlı veriye müdahale edilmemelidir.
