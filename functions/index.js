// Firebase Spark uyumluluğu:
// Zamanlanmış Cloud Functions Spark planında dağıtılamadığı için dönem temizliği
// burada otomatik tetiklenmez. Dönem politikası functions/retentionPolicy.js
// içinde saf/test edilebilir yardımcılar olarak tutulur; uygulama içi, yetkili
// ve kullanıcı onaylı temizlik akışından çağrılmalıdır.

const profileRegistration = require('./profileRegistration');
exports.ogretmenProfiliOlustur = profileRegistration.ogretmenProfiliOlustur;

const accountLinks = require('./accountLinks');

exports.ogrenciEslesmeKoduOlustur = accountLinks.ogrenciEslesmeKoduOlustur;
exports.ogrenciEslesmeTalebiGonder = accountLinks.ogrenciEslesmeTalebiGonder;
exports.ogrenciEslesmeTalebiniOnayla = accountLinks.ogrenciEslesmeTalebiniOnayla;
exports.ogrenciEslesmeTalebiniReddet = accountLinks.ogrenciEslesmeTalebiniReddet;
exports.ogrenciBaglantisiniIptalEt = accountLinks.ogrenciBaglantisiniIptalEt;
exports.ogrenciBaglantiIzinleriniGuncelle = accountLinks.ogrenciBaglantiIzinleriniGuncelle;
exports.ogrenciOdevTamamlandiBildir = accountLinks.ogrenciOdevTamamlandiBildir;

const studentNotifications = require('./studentNotifications');
exports.ogrenciPushTokenKaydet = studentNotifications.ogrenciPushTokenKaydet;
exports.ogrenciPushTokenSil = studentNotifications.ogrenciPushTokenSil;
exports.odevOlusturulduOgrenciBildirimleri = studentNotifications.odevOlusturulduOgrenciBildirimleri;
exports.odeveOgrenciEklendiBildirimleri = studentNotifications.odeveOgrenciEklendiBildirimleri;
exports.odevSilindiOgrenciBildirimleri = studentNotifications.odevSilindiOgrenciBildirimleri;

const ownerStatistics = require('./ownerStatistics');
exports.getUygulamaSahibiIstatistikleri = ownerStatistics.getUygulamaSahibiIstatistikleri;
