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

const emailAliases = require('./emailAliases');
exports.epostaAliasiniRezerveEt = emailAliases.epostaAliasiniRezerveEt;
exports.epostaAliasDegisikliginiKontrolEt = emailAliases.epostaAliasDegisikliginiKontrolEt;
exports.epostaKaydiKontrolEt = emailAliases.epostaKaydiKontrolEt;
// Identity Platform blocking triggers remain opt-in; the current Spark project does not enable them.
if (process.env.ENABLE_IDENTITY_PLATFORM_BLOCKING_TRIGGERS === 'true') {
  exports.epostaAliasKaydiOncesiKontrol = emailAliases.epostaAliasKaydiOncesiKontrol;
  exports.epostaAliasGirisKontrol = emailAliases.epostaAliasGirisKontrol;
}

const academicPeriodTransfer = require('./academicPeriodTransfer');
exports.ogretmenDonemAktariminiBaslat = academicPeriodTransfer.ogretmenDonemAktariminiBaslat;

const accountRetention = require('./accountRetention');
exports.uygulamaSahibiKapaliHesaplariListele = accountRetention.uygulamaSahibiKapaliHesaplariListele;
exports.uygulamaSahibiKapaliHesapImhasiniOnizle = accountRetention.uygulamaSahibiKapaliHesapImhasiniOnizle;
exports.uygulamaSahibiKapaliHesabiImhaEt = accountRetention.uygulamaSahibiKapaliHesabiImhaEt;
