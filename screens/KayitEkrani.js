import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

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

export default function KayitEkrani({ navigation }) {
  const [adim, setAdim] = useState(1);
  const [sezon, setSezon] = useState('');
  const [brans, setBrans] = useState('');
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [sifreTekrar, setSifreTekrar] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);

  const kayitOl = async () => {
    if (!eposta || !sifre || !sifreTekrar) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
      return;
    }
    if (sifre !== sifreTekrar) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }
    if (sifre.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır.');
      return;
    }
    setYukleniyor(true);
    try {
      const sonuc = await createUserWithEmailAndPassword(auth, eposta, sifre);
      await updateProfile(sonuc.user, { displayName: kullaniciAdi });
      await setDoc(doc(db, 'kullanicilar', sonuc.user.uid), {
        kullaniciAdi,
        brans,
        sezon,
        eposta,
        olusturulmaTarihi: new Date().toISOString(),
      });
    } catch (hata) {
      let mesaj = 'Kayıt oluşturulamadı.';
      if (hata.code === 'auth/email-already-in-use') mesaj = 'Bu e-posta zaten kayıtlı.';
      else if (hata.code === 'auth/invalid-email') mesaj = 'Geçersiz e-posta adresi.';
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
