# KVKK Aydınlatma Metni — ÇALIŞMA TASLAĞI

> **DURUM: TASLAK — YAYINLANAMAZ.** Bu metin geliştirme ve ekran akışını hazırlamak içindir. Veri sorumlusu bilgileri, gerçek veri akışları, hizmet sağlayıcılar, saklama süreleri ve hukuki sebepler doğrulanmadan uygulamada nihai metin olarak kullanılmamalıdır. Mağaza yayını öncesinde KVKK konusunda uzman hukukçu tarafından incelenmelidir.

## 1. Veri sorumlusu

**Veri sorumlusu:** .......  
**İletişim adresi:** .......  
**İletişim e-posta adresi:** .......  
**Diğer başvuru kanalı:** .......

## 2. İşlenen kişisel veri kategorileri

Uygulamanın kullanılan özelliklerine göre aşağıdaki veriler işlenebilir:

- Hesap ve kimlik bilgileri: ad-soyad, kullanıcı adı, e-posta adresi, hesap rolü.
- Eğitim ve ilişki bilgileri: okul, sınıf, eğitim-öğretim dönemi, öğretmen-öğrenci bağlantısı.
- Eğitim faaliyetleri: ders programı, ders notları, konu ve kitap ilerlemesi, ödevler, yoklama, takvim etkinlikleri ve raporlar.
- İşlem ve güvenlik kayıtları: hesap oluşturma, oturum ve yetkilendirme kayıtları, eşleştirme talepleri ve izin değişiklikleri.
- Bildirim bilgileri: kullanıcının bildirim tercihi ve bildirim teslimi için gereken cihaz/push belirteci.

Gerçekte toplanmayan veri kategorileri nihai metinden çıkarılmalıdır. Uygulamanın her sürümünde etkin olmayan özellikler için veri işleniyormuş gibi beyanda bulunulmamalıdır.

## 3. İşleme amaçları

Veriler; kullanıcı hesabının oluşturulması ve güvenliğinin sağlanması, öğretmenlerin okul/sınıf/öğrenci ve eğitim faaliyetlerini yönetmesi, öğretmen tarafından izin verilen bilgilerin bağlı öğrenci hesabına gösterilmesi, ödev ve uygulama bildirimlerinin iletilmesi, raporların oluşturulması, teknik sorunların giderilmesi ve hukuki yükümlülüklerin yerine getirilmesi amaçlarıyla işlenebilir.

## 4. Hukuki sebepler

Her veri kategorisi ve amaç için uygulanacak KVKK m.5 ve gerekiyorsa m.6 hukuki sebebi, gerçek veri akışı ve hizmet ilişkisinin niteliğine göre veri sorumlusu tarafından belirlenmelidir. Bu alan hukukçu incelemesiyle tamamlanmalıdır; açık rıza, diğer hukuki sebeplerin yerine genel ve zorunlu bir onay olarak kullanılmamalıdır.

## 5. Verilerin aktarılması ve yurt dışına aktarım

Uygulamanın çalışması için kullanılan kimlik doğrulama, veritabanı, sunucu, bildirim ve uygulama dağıtım hizmetlerinin gerçek sağlayıcıları, veri işleyen rolleri, veri merkezleri ve erişim kapsamları envanterlenmelidir. Firebase/Google ve Expo gibi hizmetlerin hangi verileri hangi ülkelerde işlediği doğrulanmadan kesin aktarım beyanı verilmemelidir. Yurt dışına aktarım varsa KVKK m.9 kapsamında geçerli aktarım mekanizması belirlenmeli ve gerekli işlemler tamamlanmalıdır.

**Doğrulanacak hizmet sağlayıcılar ve aktarım mekanizması:** .......

## 6. Saklama süreleri

Hesap, eğitim kayıtları, güvenlik kayıtları ve bildirim verileri için ayrı saklama süreleri belirlenmelidir. Uygulamadaki dönemsel saklama/temizleme işlevi tek başına tüm veri kategorileri için saklama politikasının tamamlandığı anlamına gelmez. Süre sonunda silme, yok etme veya anonimleştirme yöntemi ve yedeklerdeki saklama süresi ayrıca açıklanmalıdır.

**Kategori bazında saklama süreleri ve yedek politikası:** .......

## 7. İlgili kişi hakları ve başvuru

İlgili kişiler, KVKK m.11 kapsamındaki haklarına ilişkin taleplerini veri sorumlusuna aşağıdaki doğrulanmış iletişim kanalı üzerinden iletebilir:

**Başvuru kanalı:** .......

Başvurular, KVKK ve ilgili mevzuatta öngörülen usul ve süreler çerçevesinde değerlendirilir. Başvuru kimlik doğrulama ve yanıt süreci uygulamada ayrıca işletilmelidir.

## 8. Aydınlatma ve tercihler

Aydınlatma metninin kullanıcıya hesap oluşturmadan önce erişilebilir biçimde sunulması ve metin sürümü ile gösterim/kabul kaydının tutulması planlanmaktadır. Aydınlatma metninin okunması, tek başına açık rıza anlamına gelmez. Açık rıza gereken ayrı bir işlem belirlenirse, bu işlem için ayrı, belirli, bilgilendirmeye dayalı ve özgür iradeyle verilen bir tercih alınmalıdır.

Uygulama/telefon bildirimi izni ayrı ve isteğe bağlı olmalı; cihaz ayarlarından geri alınabilmelidir.

---

## Yayın öncesi zorunlu doğrulamalar

- [ ] Veri sorumlusu adı-soyadı veya kurum unvanı ve iletişim bilgileri gerçek bilgilerle dolduruldu.
- [ ] Uygulamanın topladığı tüm alanlar ve Firebase/Expo servislerine giden veriler teknik olarak envanterlendi.
- [ ] Veri işleyenler, alt işleyenler, erişim ülkeleri ve yurt dışına aktarım mekanizması doğrulandı.
- [ ] Her amaç/veri kategorisi için hukuki sebep ve saklama süresi belirlendi.
- [ ] Öğrenci hesaplarında çocukların/velilerin durumu ve gerekiyorsa veli bilgilendirme/onay süreci değerlendirildi.
- [ ] İlgili kişi başvurusu, düzeltme, silme, hesap kapatma ve veri dışa aktarma süreçleri uygulamada test edildi.
- [ ] Metin uzman hukukçu tarafından incelendi ve uygulamadaki gerçek akışla eşleştirildi.

**Not:** Bu taslak, hukuki görüş veya KVKK'ya uyum garantisi değildir.
