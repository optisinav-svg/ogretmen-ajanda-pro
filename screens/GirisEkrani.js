import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';

import { auth } from '../firebaseConfig';

const EMAIL_KEY = '@ogretmenAjandaPro_hatirlananEposta';
const REMEMBER_KEY = '@ogretmenAjandaPro_beniHatirla';

export default function GirisEkrani({ navigation }) {
  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [sifreGorunur, setSifreGorunur] = useState(false);
  const [beniHatirla, setBeniHatirla] = useState(true);
  const [yukleniyor, setYukleniyor] = useState(false);

  useEffect(() => {
    const baslat = async () => {
      try {
        const hatirla = await AsyncStorage.getItem(REMEMBER_KEY);
        const kayitliEposta = await AsyncStorage.getItem(EMAIL_KEY);

        setBeniHatirla(hatirla !== 'false');

        if (hatirla !== 'false' && kayitliEposta) {
          setEposta(kayitliEposta);
        }
      } catch (e) {
        // Hafızadaki bilgiler okunamazsa giriş ekranı çalışmaya devam eder.
      }
    };

    baslat();
  }, []);

  const girisYap = async () => {
    const temizEposta = eposta.trim();

    if (!temizEposta || !sifre) {
      Alert.alert(
        'Hata',
        'Lütfen e-posta adresinizi ve şifrenizi girin.'
      );
      return;
    }

    setYukleniyor(true);

    try {
      await signInWithEmailAndPassword(auth, temizEposta, sifre);

      try {
        if (beniHatirla) {
          await AsyncStorage.multiSet([
            [REMEMBER_KEY, 'true'],
            [EMAIL_KEY, temizEposta],
          ]);
        } else {
          await AsyncStorage.multiSet([
            [REMEMBER_KEY, 'false'],
            [EMAIL_KEY, ''],
          ]);
        }
      } catch (e) {
        // Hafızaya yazma başarısız olsa bile kullanıcı giriş yapabilmeli.
      }

      navigation.replace('AnaSayfa');
    } catch (hata) {
      let mesaj = 'Giriş yapılamadı.';

      if (hata.code === 'auth/user-not-found') {
        mesaj = 'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.';
      } else if (
        hata.code === 'auth/wrong-password' ||
        hata.code === 'auth/invalid-credential'
      ) {
        mesaj = 'E-posta veya şifre hatalı.';
      } else if (hata.code === 'auth/invalid-email') {
        mesaj = 'Geçersiz e-posta adresi.';
      } else if (hata.code === 'auth/too-many-requests') {
        mesaj =
          'Çok fazla başarısız giriş denemesi yapıldı. Lütfen biraz sonra tekrar deneyin.';
      } else if (hata.code === 'auth/network-request-failed') {
        mesaj =
          'İnternet bağlantısı kurulamadı. Lütfen bağlantınızı kontrol edin.';
      }

      Alert.alert('Giriş Hatası', mesaj);
    } finally {
      setYukleniyor(false);
    }
  };

  const sifremiUnuttum = async () => {
    const temizEposta = eposta.trim();

    if (!temizEposta) {
      Alert.alert(
        'E-posta gerekli',
        'Önce şifre sıfırlama bağlantısının gönderileceği e-posta adresinizi yazın.'
      );
      return;
    }

    try {
      await sendPasswordResetEmail(auth, temizEposta);

      Alert.alert(
        'E-posta gönderildi',
        'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Gelen kutunuzu ve spam klasörünüzü kontrol edin.'
      );
    } catch (hata) {
      let mesaj = 'Şifre sıfırlama e-postası gönderilemedi.';

      if (hata.code === 'auth/user-not-found') {
        mesaj =
          'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.';
      } else if (hata.code === 'auth/invalid-email') {
        mesaj = 'Geçerli bir e-posta adresi yazın.';
      } else if (hata.code === 'auth/network-request-failed') {
        mesaj =
          'İnternet bağlantısı kurulamadı. Lütfen bağlantınızı kontrol edin.';
      }

      Alert.alert('Hata', mesaj);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.kapsayici}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.icerik}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.baslik}>
          <Text style={styles.emoji}>📚</Text>

          <Text style={styles.baslikMetni}>
            Öğretmen AjandaPro
          </Text>

          <Text style={styles.altBaslik}>
            Hesabınıza giriş yapın
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.etiket}>E-posta</Text>

          <TextInput
            style={styles.girdi}
            placeholder="ornek@mail.com"
            value={eposta}
            onChangeText={setEposta}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!yukleniyor}
          />

          <Text style={styles.etiket}>Şifre</Text>

          <View style={styles.sifreSatiri}>
            <TextInput
              style={styles.sifreGirdi}
              placeholder="Şifrenizi girin"
              value={sifre}
              onChangeText={setSifre}
              secureTextEntry={!sifreGorunur}
              editable={!yukleniyor}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.gosterButon}
              onPress={() =>
                setSifreGorunur(!sifreGorunur)
              }
              disabled={yukleniyor}
            >
              <Text style={styles.gosterMetni}>
                {sifreGorunur ? '🙈 Gizle' : '👁 Göster'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.hatirlaSatiri}
            onPress={() => setBeniHatirla(!beniHatirla)}
            disabled={yukleniyor}
          >
            <View
              style={[
                styles.kutu,
                beniHatirla && styles.kutuSecili,
              ]}
            >
              <Text style={styles.kutuIsaret}>
                {beniHatirla ? '✓' : ''}
              </Text>
            </View>

            <Text style={styles.hatirlaMetni}>
              E-posta adresimi hatırla
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.unuttumLink}
            onPress={sifremiUnuttum}
            disabled={yukleniyor}
          >
            <Text style={styles.unuttumMetni}>
              🔑 Şifremi unuttum
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.buton,
              yukleniyor && styles.butonDevre,
            ]}
            onPress={girisYap}
            disabled={yukleniyor}
          >
            {yukleniyor ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.butonMetni}>
                Giriş Yap
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kayitLink}
            onPress={() => navigation.navigate('Kayit')}
            disabled={yukleniyor}
          >
            <Text style={styles.kayitMetni}>
              Hesabınız yok mu?{' '}
              <Text style={styles.kayitVurgu}>
                Kayıt Olun
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kapsayici: {
    flex: 1,
    backgroundColor: '#F1F8E9',
  },

  icerik: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },

  baslik: {
    alignItems: 'center',
    marginBottom: 32,
  },

  emoji: {
    fontSize: 64,
    marginBottom: 12,
  },

  baslikMetni: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginBottom: 6,
  },

  altBaslik: {
    fontSize: 16,
    color: '#558B2F',
  },

  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },

  etiket: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 6,
    marginTop: 12,
  },

  girdi: {
    borderWidth: 1,
    borderColor: '#C8E6C9',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9FBE7',
  },

  sifreSatiri: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    borderRadius: 10,
    backgroundColor: '#F9FBE7',
  },

  sifreGirdi: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },

  gosterButon: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#C8E6C9',
  },

  gosterMetni: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
  },

  hatirlaSatiri: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },

  kutu: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: '#81C784',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  kutuSecili: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },

  kutuIsaret: {
    color: '#fff',
    fontWeight: 'bold',
  },

  hatirlaMetni: {
    fontSize: 14,
    color: '#555',
  },

  unuttumLink: {
    alignSelf: 'flex-start',
    marginTop: 14,
  },

  unuttumMetni: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },

  buton: {
    backgroundColor: '#2E7D32',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 22,
  },

  butonDevre: {
    backgroundColor: '#81C784',
  },

  butonMetni: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  kayitLink: {
    marginTop: 16,
    alignItems: 'center',
  },

  kayitMetni: {
    fontSize: 14,
    color: '#555',
  },

  kayitVurgu: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
});