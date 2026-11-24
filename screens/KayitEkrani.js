import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, runTransaction } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { deleteUser } from 'firebase/auth';
import { auth, db, functions } from '../firebaseConfig';

const buYil = new Date().getFullYear();
const SEZONLAR = [
  `${buYil - 1}/${buYil}`,
  `${buYil}/${buYil + 1}`,
  `${buYil + 1}/${buYil + 2}`,
  `${buYil + 2}/${buYil + 3}`,
];

const BRANSLAR = [
  'Türkçe', 'Matematik', 'Fen Bilimleri', 'Sosyal Bilgiler',
  'İngilizce', 'Tarih', 'Coğrafya', 'Fizik', 'Kimya', 'Biyoloji',
  'Edebiyat', 'Felsefe', 'Din Kültürü', 'Müzik', 'Görsel Sanatlar',
  'Beden Eğitimi', 'Bilişim Teknolojileri', 'Diğer'
];

export default function KayitEkrani({ navigation, route }) {
  const [adim, setAdim] = useState(1);
  const [sezon, setSezon] = useState('');
  const [brans, setBrans] = useState('');
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [eposta, setEposta] = useState(route?.params?.eposta || auth.currentUser?.email || '');
  const [sifre, setSifre] = useState('');
  const [sifreTekrar, setSifreTekrar] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const devamEt = route?.params?.devamEt === true;

  const kayitOl = async () => {
    const mevcutHesaplaDevam = devamEt && !!auth.currentUser;
    if (!eposta || (!mevcutHesaplaDevam && (!sifre || !sifreTekrar))) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
      return;
    }
    if (!mevcutHesaplaDevam && sifre !== sifreTekrar) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }
    if (!mevcutHesaplaDevam && sifre.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır.');
      return;
    }
    setYukleniyor(true);
    try {
      const normalizedEmail = eposta.trim().toLowerCase();
      await httpsCallable(functions, 'epostaKaydiKontrolEt')({ email: normalizedEmail });
      let user = auth.currentUser;
      let createdNewUser = false;
      if (user && (user.email || '').toLowerCase() !== normalizedEmail) {
        throw new Error('Önce açık olan hesaptan çıkış yapın, ardından yeni öğretmen hesabını oluşturun.');
      }
      if (!user) {
        const sonuc = await createUserWithEmailAndPassword(auth, normalizedEmail, sifre);
        user = sonuc.user;
        createdNewUser = true;
      }
      try { await httpsCallable(functions, 'epostaAliasiniRezerveEt')({}); } catch (aliasError) {
        if (createdNewUser) await deleteUser(user).catch(() => {});
        throw aliasError;
      }
      await updateProfile(user, { displayName: kullaniciAdi.trim() });
      const emailVerificationPending = !user.emailVerified;
      if (emailVerificationPending) await sendEmailVerification(user);
      const profileRef = doc(db, 'kullanicilar', user.uid);
      await runTransaction(db, async transaction => {
        const existing = await transaction.get(profileRef);
        if (existing.exists()) throw new Error('Bu hesap için kullanıcı profili zaten oluşturulmuş. Giriş ekranına dönün.');
        transaction.set(profileRef, {
          kullaniciAdi: kullaniciAdi.trim(),
          brans,
          sezon,
          rol: 'ogretmen',
          eposta: normalizedEmail,
          olusturulmaTarihi: new Date().toISOString(),
        });
      });
      if (emailVerificationPending) Alert.alert('E-posta doğrulaması', 'E-posta adresinize doğrulama bağlantısı gönderdik. Eski e-posta adreslerinin korunması için gelen kutunuzdan doğrulama yapın.');
      navigation.replace('AnaSayfa');
    } catch (hata) {
      let mesaj = 'Kayıt oluşturulamadı.';
      if (hata.code === 'auth/email-already-in-use') mesaj = 'Bu e-posta zaten kayıtlı. Giriş ekranından giriş yapın.';
      else if (hata.code === 'auth/invalid-email') mesaj = 'Geçersiz e-posta adresi.';
      else if (hata.code === 'functions/already-exists') mesaj = 'Bu hesap için kullanıcı profili zaten mevcut. Giriş ekranına dönün.';
      else if (hata.message) mesaj = hata.message;
      Alert.alert('Kayıt Hatası', mesaj);
    } finally {
      setYukleniyor(false);
    }
  };

  const sonrakiAdim = () => {
    if (adim === 1 && !sezon) { Alert.alert('Hata', 'Lütfen bir eğitim sezonu seçin.'); return; }
    if (adim === 2 && !brans) { Alert.alert('Hata', 'Lütfen branşınızı seçin.'); return; }
    if (adim === 3 && !kullaniciAdi) { Alert.alert('Hata', 'Lütfen kullanıcı adı girin.'); return; }
    setAdim(adim + 1);
  };

  return (
    <KeyboardAvoidingView
      style={styles.kapsayici}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.icerik}>
        <View style={styles.baslik}>
          <Text style={styles.emoji}>📚</Text>
          <Text style={styles.baslikMetni}>Kayıt Ol</Text>
          <Text style={styles.altBaslik}>Adım {adim} / 4</Text>
          <View style={styles.adimlar}>
            {[1,2,3,4].map(i => (
              <View key={i} style={[styles.adimNokta, adim >= i && styles.adimAktif]} />
            ))}
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.soru}>Hesap Türü</Text>
          <View style={styles.rolSatir}>
            <View style={[styles.rolSecim, styles.rolAktif]}>
              <Text style={styles.rolMetinAktif}>👨‍🏫 Öğretmen</Text>
              <Text style={styles.rolAlt}>Seçili hesap türü</Text>
            </View>
            <TouchableOpacity style={[styles.rolSecim, styles.rolKapali]} onPress={() => navigation.navigate('OgrenciKayit')}>
              <Text style={styles.rolMetinKapali}>🎓 Öğrenci</Text>
              <Text style={styles.rolAlt}>Öğrenci kaydına geç</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.rolBilgi}>Öğrenci hesabı için öğrenci seçeneğine geçin. E-posta doğrulaması ve öğretmen onayı öğrenci hesabı akışında korunur.</Text>
          {adim === 1 && (
            <>
              <Text style={styles.soru}>Eğitim-öğretim sezonunu seçin:</Text>
              {SEZONLAR.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.secimButon, sezon === s && styles.secimAktif]}
                  onPress={() => setSezon(s)}
                >
                  <Text style={[styles.secimMetni, sezon === s && styles.secimMetniAktif]}>
                    {s} Eğitim-Öğretim Yılı
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {adim === 2 && (
            <>
              <Text style={styles.soru}>Branşınızı seçin:</Text>
              <View style={styles.bransGrid}>
                {BRANSLAR.map(b => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.bransButon, brans === b && styles.secimAktif]}
                    onPress={() => setBrans(b)}
                  >
                    <Text style={[styles.bransMetni, brans === b && styles.secimMetniAktif]}>
                      {b}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {adim === 3 && (
            <>
              <Text style={styles.soru}>Kullanıcı adınız nedir?</Text>
              <TextInput
                style={styles.girdi}
                placeholder="Adınız Soyadınız"
                value={kullaniciAdi}
                onChangeText={setKullaniciAdi}
                autoCapitalize="words"
              />
            </>
          )}

          {adim === 4 && (
            <>
              <Text style={styles.soru}>Hesap bilgilerinizi girin:</Text>
              <Text style={styles.etiket}>E-posta</Text>
              <TextInput
                style={styles.girdi}
                placeholder="ornek@mail.com"
                value={eposta}
                onChangeText={setEposta}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.etiket}>Şifre</Text>
              <TextInput
                style={styles.girdi}
                placeholder="En az 6 karakter"
                value={sifre}
                onChangeText={setSifre}
                secureTextEntry
              />
              <Text style={styles.etiket}>Şifre Tekrar</Text>
              <TextInput
                style={styles.girdi}
                placeholder="Şifrenizi tekrar girin"
                value={sifreTekrar}
                onChangeText={setSifreTekrar}
                secureTextEntry
              />
            </>
          )}

          {adim < 4 ? (
            <TouchableOpacity style={styles.buton} onPress={sonrakiAdim}>
              <Text style={styles.butonMetni}>İleri →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.buton, yukleniyor && styles.butonDevre]}
              onPress={kayitOl}
              disabled={yukleniyor}
            >
              {yukleniyor ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.butonMetni}>Kayıt Ol ✓</Text>
              )}
            </TouchableOpacity>
          )}

          {adim > 1 && (
            <TouchableOpacity style={styles.geriLink} onPress={() => setAdim(adim - 1)}>
              <Text style={styles.geriMetni}>← Geri</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.girisLink} onPress={() => navigation.navigate('KVKKBilgilendirme')}>
            <Text style={styles.girisVurgu}>KVKK Aydınlatma Bilgisi</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.girisLink}
            onPress={() => navigation.navigate('Giris')}
          >
            <Text style={styles.girisMetni}>
              Zaten hesabınız var mı? <Text style={styles.girisVurgu}>Giriş Yapın</Text>
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kapsayici: { flex: 1, backgroundColor: '#F1F8E9' },
  icerik: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  baslik: { alignItems: 'center', marginBottom: 24 },
  emoji: { fontSize: 48, marginBottom: 8 },
  baslikMetni: { fontSize: 26, fontWeight: 'bold', color: '#1B5E20', marginBottom: 4 },
  altBaslik: { fontSize: 14, color: '#558B2F', marginBottom: 8 },
  adimlar: { flexDirection: 'row', gap: 8 },
  adimNokta: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#C8E6C9' },
  adimAktif: { backgroundColor: '#2E7D32' },
  form: { backgroundColor: '#fff', borderRadius: 16, padding: 24, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
  soru: { fontSize: 16, fontWeight: '600', color: '#1B5E20', marginBottom: 16 },
  rolSatir: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  rolSecim: { flex: 1, borderWidth: 1, borderRadius: 9, padding: 11, alignItems: 'center' },
  rolAktif: { backgroundColor: '#E8F5E9', borderColor: '#2E7D32' },
  rolKapali: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },
  rolMetinAktif: { color: '#1B5E20', fontWeight: 'bold', fontSize: 13 },
  rolMetinKapali: { color: '#9E9E9E', fontWeight: '600', fontSize: 13 },
  rolAlt: { color: '#9E9E9E', fontSize: 10, marginTop: 3 },
  rolBilgi: { color: '#777', fontSize: 11, marginBottom: 16 },
  secimButon: { borderWidth: 1, borderColor: '#C8E6C9', borderRadius: 10, padding: 14, marginBottom: 10 },
  secimAktif: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  secimMetni: { fontSize: 15, color: '#333', textAlign: 'center' },
  secimMetniAktif: { color: '#fff', fontWeight: 'bold' },
  bransGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bransButon: { borderWidth: 1, borderColor: '#C8E6C9', borderRadius: 8, padding: 10, marginBottom: 4 },
  bransMetni: { fontSize: 13, color: '#333' },
  etiket: { fontSize: 14, fontWeight: '600', color: '#2E7D32', marginBottom: 6, marginTop: 12 },
  girdi: { borderWidth: 1, borderColor: '#C8E6C9', borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: '#F9FBE7' },
  buton: { backgroundColor: '#2E7D32', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 24 },
  butonDevre: { backgroundColor: '#81C784' },
  butonMetni: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  geriLink: { marginTop: 12, alignItems: 'center' },
  geriMetni: { color: '#2E7D32', fontSize: 14 },
  girisLink: { marginTop: 16, alignItems: 'center' },
  girisMetni: { fontSize: 14, color: '#555' },
  girisVurgu: { color: '#2E7D32', fontWeight: 'bold' },
});
