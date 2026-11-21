import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, Modal, ActivityIndicator,
} from 'react-native';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions, ACCOUNT_LINKING_ENABLED } from '../firebaseConfig';
import { donemYiliBugun, donemUygun } from '../utils/donem';

const IZINLER = [
  ['dersProgrami', 'Ders programı'],
  ['dersNotlari', 'Ders notları'],
  ['konular', 'Konular'],
  ['yoklama', 'Yoklama'],
  ['odevler', 'Ödevler'],
  ['kitaplar', 'Kitaplar ve ilerleme'],
];
const BOS_IZIN = Object.fromEntries(IZINLER.map(([key]) => [key, false]));

export default function OgrenciHesaplariEkrani({ navigation, route }) {
  const uid = auth.currentUser?.uid;
  const donemYili = Number(route?.params?.donemYili || donemYiliBugun());
  const [ogrenciler, setOgrenciler] = useState([]);
  const [donemOgrencileri, setDonemOgrencileri] = useState([]);
  const [talepler, setTalepler] = useState([]);
  const [baglantilar, setBaglantilar] = useState([]);
  const [odevBildirimleri, setOdevBildirimleri] = useState([]);
  const [odevler, setOdevler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islem, setIslem] = useState(false);
  const [izinModal, setIzinModal] = useState(false);
  const [hedef, setHedef] = useState(null);
  const [izinler, setIzinler] = useState(BOS_IZIN);
  const [kodModal, setKodModal] = useState(false);
  const [kodBilgi, setKodBilgi] = useState(null);

  const yukle = async () => {
    if (!uid || !ACCOUNT_LINKING_ENABLED) { setYukleniyor(false); return; }
    setYukleniyor(true);
    try {
      const profil = await getDoc(doc(db, 'kullanicilar', uid));
      if (!profil.exists() || (profil.data().rol && profil.data().rol !== 'ogretmen')) {
        Alert.alert('Erişim yok', 'Bu ekran yalnızca öğretmen hesapları içindir.');
        navigation.goBack();
        return;
      }
      const [os, ts, bs, ns, hs] = await Promise.all([
        getDocs(query(collection(db, 'ogrenciler'), where('uid', '==', uid))),
        getDocs(query(collection(db, 'ogrenciEslesmeTalepleri'), where('ogretmenUid', '==', uid))),
        getDocs(query(collection(db, 'ogretmenOgrenciBaglantilari'), where('ogretmenUid', '==', uid))),
        getDocs(query(collection(db, 'ogrenciOdevBildirimleri'), where('ogretmenUid', '==', uid))),
        getDocs(query(collection(db, 'odevler'), where('uid', '==', uid))),
      ]);
      const all = os.docs.map(x => ({ id: x.id, ...x.data() }));
      setOgrenciler(all);
      setDonemOgrencileri(all.filter(x => donemUygun(x, donemYili) && !x.kayitsizMi));
      setTalepler(ts.docs.map(x => ({ id: x.id, ...x.data() })).filter(x => x.durum === 'bekliyor'));
      setBaglantilar(bs.docs.map(x => ({ id: x.id, ...x.data() })).filter(x => x.durum === 'active'));
      setOdevBildirimleri(ns.docs.map(x => ({ id: x.id, ...x.data() })).sort((a, b) => (b.bildirimTarihi?.toMillis?.() || 0) - (a.bildirimTarihi?.toMillis?.() || 0)));
      setOdevler(hs.docs.map(x => ({ id: x.id, ...x.data() })));
    } catch (e) {
      Alert.alert('Hata', 'Öğrenci hesap bilgileri yüklenemedi. ' + (e?.message || ''));
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => { yukle(); }, [uid, donemYili]);

  const ogrenciBul = id => ogrenciler.find(x => x.id === id);
  const kodOlustur = async ogrenci => {
    if (!String(ogrenci.eposta || '').trim()) {
      Alert.alert('E-posta eksik', 'Öğrenci kaydını düzenleyip öğrencinin kullanacağı e-posta adresini ekleyin. Eşleştirme için doğrulanmış e-posta ve kayıtlı ad-soyadın ikisi de eşleşmelidir.');
      return;
    }
    setIslem(true);
    try {
      const sonuc = await httpsCallable(functions, 'ogrenciEslesmeKoduOlustur')({ ogrenciKayitId: ogrenci.id });
      setKodBilgi({ kod: sonuc.data.kod, sonaErme: sonuc.data.sonaErme, ogrenci: ogrenci.adSoyad || ogrenci.ad || 'Öğrenci' });
      setKodModal(true);
    } catch (e) {
      Alert.alert('Kod oluşturulamadı', e?.message || 'Öğrenci hesabı eşleştirme kodu oluşturulamadı.');
    } finally {
      setIslem(false);
    }
  };

  const izinModalAc = (tur, kayit) => {
    setHedef({ tur, kayit });
    setIzinler({ ...BOS_IZIN, ...(tur === 'baglanti' ? kayit.izinler || {} : {}) });
    setIzinModal(true);
  };

  const izinKaydet = async () => {
    if (!hedef) return;
    setIslem(true);
    try {
      if (hedef.tur === 'talep') {
        await httpsCallable(functions, 'ogrenciEslesmeTalebiniOnayla')({
          talepId: hedef.kayit.id,
          izinler,
        });
        Alert.alert('Bağlantı kuruldu', 'Öğrenci hesabı onaylandı. Yalnızca seçtiğiniz izinler geçerlidir.');
      } else {
        await httpsCallable(functions, 'ogrenciBaglantiIzinleriniGuncelle')({
          baglantiId: hedef.kayit.id,
          izinler,
        });
        Alert.alert('İzinler güncellendi', 'Öğrencinin erişim izinleri yenilendi.');
      }
      setIzinModal(false);
      setHedef(null);
      await yukle();
    } catch (e) {
      Alert.alert('İşlem tamamlanamadı', e?.message || 'Paylaşım izinleri kaydedilemedi.');
    } finally {
      setIslem(false);
    }
  };

  const talepReddet = talep => Alert.alert(
    'Eşleştirme talebini reddet',
    'Bu öğrenci hesabının eşleştirme talebi reddedilecek. Öğrenci verilerinize erişemeyecek.',
    [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Reddet', style: 'destructive', onPress: async () => {
        setIslem(true);
        try {
          await httpsCallable(functions, 'ogrenciEslesmeTalebiniReddet')({ talepId: talep.id });
          await yukle();
        } catch (e) { Alert.alert('Hata', e?.message || 'Talep reddedilemedi.'); }
        finally { setIslem(false); }
      } },
    ],
  );

  const baglantiIptal = baglanti => {
    const ogrenci = ogrenciBul(baglanti.ogrenciKayitId);
    Alert.alert(
      'Öğrenci bağlantısını iptal et',
      `${ogrenci?.adSoyad || 'Öğrenci'} hesabının bu öğretmene ait paylaşılan verilere erişimi kesilecek.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Bağlantıyı iptal et', style: 'destructive', onPress: async () => {
          setIslem(true);
          try {
            await httpsCallable(functions, 'ogrenciBaglantisiniIptalEt')({ baglantiId: baglanti.id });
            await yukle();
          } catch (e) { Alert.alert('Hata', e?.message || 'Bağlantı iptal edilemedi.'); }
          finally { setIslem(false); }
        } },
      ],
    );
  };

  if (!ACCOUNT_LINKING_ENABLED) return (
    <View style={[s.wrap, { justifyContent: 'center', padding: 24 }]}>
      <View style={s.info}>
        <Text style={s.infoTitle}>Öğrenci hesap bağlantısı henüz etkin değil</Text>
        <Text style={s.infoText}>Kod üretme ve öğrenci eşleştirme altyapısı hazırlandı; ancak Firestore güvenlik kuralları ve Cloud Functions canlı Firebase'e henüz dağıtılmadı. Güvenlik doğrulaması ve dağıtım onayı tamamlanmadan bu özellik açılmayacak.</Text>
      </View>
      <TouchableOpacity style={s.primary} onPress={() => navigation.goBack()}><Text style={s.primaryText}>Geri dön</Text></TouchableOpacity>
    </View>
  );
  if (yukleniyor) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#2E7D32"/>;

  return (
    <View style={s.wrap}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        <View style={s.info}>
          <Text style={s.infoTitle}>Öğrenci hesapları</Text>
          <Text style={s.infoText}>Öğrenci kaydınızı seçerek 12 saat geçerli tek kullanımlık kod oluşturun. Kod tek başına veri erişimi sağlamaz; öğrenci talebini siz onaylayıp izinleri belirleyene kadar hiçbir veri paylaşılmaz.</Text>
          <Text style={s.infoText}>Ortaokul öğrencileri için hesap eşleştirmesi veli/vasi süreci netleşene kadar kapalıdır.</Text>
        </View>

        <View style={s.section}>
          <Text style={s.heading}>Kod oluştur · {donemYili}/{donemYili + 1}</Text>
          {donemOgrencileri.map(o => (
            <View key={o.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{o.adSoyad || o.ad || 'İsimsiz öğrenci'}</Text>
                <Text style={s.sub}>{o.sinifAd || 'Sınıf belirtilmemiş'}</Text>
                <Text style={s.sub}>{o.eposta || "E-posta eklenmemiş"}</Text>
              </View>
              <TouchableOpacity style={s.smallButton} disabled={islem} onPress={() => kodOlustur(o)}>
                <Text style={s.smallButtonText}>Kod üret</Text>
              </TouchableOpacity>
            </View>
          ))}
          {!donemOgrencileri.length && <Text style={s.empty}>Bu dönemde eşleştirilebilecek öğrenci kaydı bulunmuyor.</Text>}
        </View>

        <View style={s.section}>
          <Text style={s.heading}>Onay bekleyen talepler ({talepler.length})</Text>
          {talepler.map(t => {
            const o = ogrenciBul(t.ogrenciKayitId);
            return (
              <View key={t.id} style={s.card}>
                <Text style={s.name}>{o?.adSoyad || 'Öğrenci kaydı'} · {o?.sinifAd || ''}</Text>
                <Text style={s.sub}>Hesap: {t.ogrenciHesapAdi || 'Ad bilgisi yok'}</Text>
                <Text style={s.sub}>E-posta: {t.ogrenciEposta || 'E-posta bilgisi yok'}</Text>
                <Text style={s.sub}>Eşleşecek kayıt: {t.ogrenciKayitId}</Text>
                <View style={s.actions}>
                  <TouchableOpacity style={s.approve} disabled={islem} onPress={() => izinModalAc('talep', t)}>
                    <Text style={s.approveText}>İzinleri seç ve onayla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.reject} disabled={islem} onPress={() => talepReddet(t)}>
                    <Text style={s.rejectText}>Reddet</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          {!talepler.length && <Text style={s.empty}>Onay bekleyen öğrenci talebi yok.</Text>}
        </View>

        <View style={s.section}>
          <Text style={s.heading}>Etkin öğrenci bağlantıları ({baglantilar.length})</Text>
          {baglantilar.map(b => {
            const o = ogrenciBul(b.ogrenciKayitId);
            const izinAdlari = IZINLER.filter(([key]) => b.izinler?.[key]).map(([, label]) => label);
            return (
              <View key={b.id} style={s.card}>
                <Text style={s.name}>{o?.adSoyad || 'Öğrenci kaydı'} · {o?.sinifAd || ''}</Text>
                <Text style={s.sub}>Hesap: {b.ogrenciHesapAdi || 'Öğrenci hesabı'}</Text>
                <Text style={s.sub}>E-posta: {b.ogrenciEposta || 'E-posta bilgisi yok'}</Text>
                <Text style={s.sub}>Açık izinler: {izinAdlari.length ? izinAdlari.join(', ') : 'Hiçbiri'}</Text>
                <View style={s.actions}>
                  <TouchableOpacity style={s.approve} disabled={islem} onPress={() => izinModalAc('baglanti', b)}>
                    <Text style={s.approveText}>İzinleri düzenle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.reject} disabled={islem} onPress={() => baglantiIptal(b)}>
                    <Text style={s.rejectText}>Bağlantıyı iptal et</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          {!baglantilar.length && <Text style={s.empty}>Henüz onaylanmış öğrenci bağlantısı yok.</Text>}
        </View>

        <View style={s.section}>
          <Text style={s.heading}>Öğrenci ödev bildirimleri ({odevBildirimleri.length})</Text>
          {odevBildirimleri.map(b => {
            const o = ogrenciBul(b.ogrenciKayitId);
            const homework = odevler.find(x => x.id === b.odevId);
            const date = b.bildirimTarihi?.toDate?.();
            return (
              <View key={b.id} style={s.card}>
                <Text style={s.name}>{o?.adSoyad || b.ogrenciHesapAdi || 'Öğrenci'} · {homework?.aciklama || b.odevAciklama || 'Ödev kaydı bulunamadı'}</Text>
                <Text style={s.sub}>Öğrenci bu ödevi tamamlandı olarak bildirdi{date ? ' · ' + date.toLocaleString('tr-TR') : ''}{b.teslimTarihi ? ' · Teslim: ' + b.teslimTarihi : ''}.</Text>
                <Text style={s.sub}>Bu bildirim öğretmen değerlendirmesini değiştirmez; ödev durumu sizin kontrolünüzdedir.</Text>
              </View>
            );
          })}
          {!odevBildirimleri.length && <Text style={s.empty}>Henüz öğrenci tarafından gönderilmiş ödev bildirimi yok.</Text>}
        </View>

        <TouchableOpacity style={s.refresh} disabled={islem} onPress={yukle}>
          <Text style={s.refreshText}>Listeyi yenile</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={kodModal} transparent animationType="fade" onRequestClose={() => setKodModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Eşleştirme kodu</Text>
            <Text style={s.sub}>{kodBilgi?.ogrenci}</Text>
            <Text selectable style={s.code}>{kodBilgi?.kod}</Text>
            <Text style={s.infoText}>Bu kod 12 saat geçerlidir ve yalnızca bir öğrenci hesabı tarafından bir kez kullanılabilir. Kodu öğrenciyle güvenli biçimde paylaşın.</Text>
            <Text style={s.sub}>Son kullanım: {kodBilgi?.sonaErme ? new Date(kodBilgi.sonaErme).toLocaleString('tr-TR') : ''}</Text>
            <TouchableOpacity style={s.primary} onPress={() => setKodModal(false)}><Text style={s.primaryText}>Tamam</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={izinModal} transparent animationType="slide" onRequestClose={() => setIzinModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Paylaşım izinleri</Text>
            <Text style={s.infoText}>Yalnızca işaretlediğiniz veriler bu öğrenci hesabına açılır. Bütün izinler başlangıçta kapalıdır.</Text>
            {IZINLER.map(([key, label]) => (
              <TouchableOpacity key={key} style={s.permissionRow} onPress={() => setIzinler(p => ({ ...p, [key]: !p[key] }))}>
                <View style={[s.check, izinler[key] && s.checked]}><Text style={s.checkText}>{izinler[key] ? '✓' : ''}</Text></View>
                <Text style={s.permissionText}>{label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.primary} disabled={islem} onPress={izinKaydet}>
              {islem ? <ActivityIndicator color="#fff"/> : <Text style={s.primaryText}>{hedef?.tur === 'talep' ? 'Onayla ve bağlantıyı kur' : 'İzinleri kaydet'}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancel} onPress={() => setIzinModal(false)}><Text>Vazgeç</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {islem && <View style={s.busy}><ActivityIndicator size="large" color="#2E7D32"/></View>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#F1F8E9' },
  info: { backgroundColor: '#E8F5E9', padding: 14, borderRadius: 12, marginBottom: 12 },
  infoTitle: { color: '#1B5E20', fontWeight: 'bold', fontSize: 16, marginBottom: 6 },
  infoText: { color: '#455A64', fontSize: 12, lineHeight: 18, marginTop: 3 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  heading: { fontSize: 15, fontWeight: 'bold', color: '#1B5E20', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderColor: '#E8F5E9' },
  name: { color: '#1B5E20', fontSize: 14, fontWeight: 'bold' },
  sub: { color: '#607D8B', fontSize: 11, marginTop: 3 },
  smallButton: { backgroundColor: '#2E7D32', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  smallButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  card: { backgroundColor: '#F9FBE7', borderRadius: 10, padding: 11, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 7, marginTop: 10 },
  approve: { flex: 1, backgroundColor: '#E8F5E9', padding: 9, borderRadius: 8, alignItems: 'center' },
  approveText: { color: '#1B5E20', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },
  reject: { backgroundColor: '#FFEBEE', padding: 9, borderRadius: 8, alignItems: 'center' },
  rejectText: { color: '#C62828', fontSize: 11, fontWeight: 'bold' },
  empty: { color: '#90A4AE', fontSize: 12, textAlign: 'center', padding: 14 },
  refresh: { padding: 13, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center' },
  refreshText: { color: '#2E7D32', fontWeight: 'bold' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'center', padding: 18 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 18, maxHeight: '90%' },
  modalTitle: { color: '#1B5E20', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  code: { color: '#1B5E20', fontSize: 23, fontWeight: 'bold', textAlign: 'center', letterSpacing: 2, padding: 16, backgroundColor: '#E8F5E9', borderRadius: 10, marginVertical: 10 },
  primary: { backgroundColor: '#2E7D32', padding: 13, borderRadius: 9, alignItems: 'center', marginTop: 14 },
  primaryText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
  permissionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#ECEFF1' },
  check: { width: 22, height: 22, borderWidth: 1, borderColor: '#81C784', borderRadius: 5, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  checkText: { color: '#fff', fontWeight: 'bold' },
  permissionText: { color: '#263238', fontSize: 13 },
  cancel: { padding: 12, alignItems: 'center' },
  busy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,.25)', alignItems: 'center', justifyContent: 'center' },
});
