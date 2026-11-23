// Firebase Spark uyumluluğu:
// Zamanlanmış Cloud Functions Spark planında dağıtılamadığı için dönem temizliği
// burada otomatik tetiklenmez. Dönem politikası functions/retentionPolicy.js
// içinde saf/test edilebilir yardımcılarla doğrulanır; fiziksel silme yalnızca
// uygulama sahibi onaylı, sunucu kilitli callable üzerinden yürütülür.

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

const section7DataLifecycle = require('./section7DataLifecycle');
exports.ogretmenOgrenciKaydiniKaliciSil = section7DataLifecycle.ogretmenOgrenciKaydiniKaliciSil;
exports.uygulamaSahibiDonemTemizliginiOnizle = section7DataLifecycle.uygulamaSahibiDonemTemizliginiOnizle;
exports.uygulamaSahibiDonemTemizliginiOnayla = section7DataLifecycle.uygulamaSahibiDonemTemizliginiOnayla;

const studentClassMove = require('./studentClassMove');
exports.ogretmenOgrenciKaydiniTasi = studentClassMove.ogretmenOgrenciKaydiniTasi;

const studentNotifications = require('./studentNotifications');
exports.ogrenciPushTokenKaydet = studentNotifications.ogrenciPushTokenKaydet;
exports.ogrenciPushTokenSil = studentNotifications.ogrenciPushTokenSil;
exports.odevOlusturulduOgrenciBildirimleri = studentNotifications.odevOlusturulduOgrenciBildirimleri;
exports.odeveOgrenciEklendiBildirimleri = studentNotifications.odeveOgrenciEklendiBildirimleri;
exports.odevSilindiOgrenciBildirimleri = studentNotifications.odevSilindiOgrenciBildirimleri;

const ownerStatistics = require('./ownerStatistics');
exports.getUygulamaSahibiIstatistikleri = ownerStatistics.getUygulamaSahibiIstatistikleri;

const accountLifecycle = require('./accountLifecycle');
exports.profilAdSoyadGuncelle = accountLifecycle.profilAdSoyadGuncelle;
exports.epostaDegisikliginiProfileYansit = accountLifecycle.epostaDegisikliginiProfileYansit;
exports.hesapKapatmaTalebiOlustur = accountLifecycle.hesapKapatmaTalebiOlustur;
exports.hesabiYenidenEtkinlestir = accountLifecycle.hesabiYenidenEtkinlestir;
exports.rolDuzeltmeTalebiOlustur = accountLifecycle.rolDuzeltmeTalebiOlustur;
exports.rolDuzeltmeTalebiniKararaBagla = accountLifecycle.rolDuzeltmeTalebiniKararaBagla;
