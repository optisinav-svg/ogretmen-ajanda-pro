import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import {
  collection, doc, getDoc, getDocs, query, where, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db, ACCOUNT_LINKING_ENABLED } from '../firebaseConfig';
import { notifyHomeworkCompleted } from '../services/sparkStudentAccounts';
import { donemUygun, donemYiliBugun } from '../utils/donem';
import { donemHatirlatmaGosterilebilir, donemHatirlatmaKaydet } from '../utils/donemHatirlatici';

const PERMISSIONS = [
  ['dersProgrami', 'Ders programı'],
  ['dersNotlari', 'Ders notları'],
  ['konular', 'Konular'],
  ['yoklama', 'Yoklama'],
  ['odevler', 'Ödevler'],
  ['kitaplar', 'Kitaplar'],
];

const dateLabel = value => {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value?.toDate) return value.toDate().toLocaleDateString('tr-TR');
  return '';
};
const recordTitle = (item, keys, fallback) => {
  for (const key of keys) if (item?.[key]) return String(item[key]);
  return fallback;
};
const sortNewest = items => [...items].sort((a,b) =>
  String(b.tarih || b.olusturulma || b.bildirimTarihi || '').localeCompare(String(a.tarih || a.olusturulma || a.bildirimTarihi || ''))
);

export default function OgrenciAnaSayfaEkrani({ navigation }) {
  const uid = auth.currentUser?.uid;
  const [profil, setProfil] = useState(null);
  const [baglantilar, setBaglantilar] = useState([]);
  const [talepler, setTalepler] = useState([]);
  const [bildirimler, setBildirimler] = useState([]);
  const [yeniOdevBildirimleri, setYeniOdevBildirimleri] = useState([]);
  const [odevDurumBildirimleri, setOdevDurumBildirimleri] = useState([]);
  const [gruplar, setGruplar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const scrollRef = useRef(null);
  const odevBolumY = useRef({});

  const yukle = useCallback(async (sessiz = false) => {
    if (!uid || !ACCOUNT_LINKING_ENABLED) { setYukleniyor(false); return; }
    if (sessiz) setYenileniyor(true); else setYukleniyor(true);
    try {
      const [profileSnap, linkSnap, requestSnap, notificationSnap, newHomeworkSnap, statusNotificationSnap] = await Promise.all([
        getDoc(doc(db, 'kullanicilar', uid)),
        getDocs(query(collection(db, 'ogretmenOgrenciBaglantilari'), where('ogrenciUid', '==', uid))),
        getDocs(query(collection(db, 'ogrenciEslesmeTalepleri'), where('ogrenciUid', '==', uid))),
        getDocs(query(collection(db, 'ogrenciOdevBildirimleri'), where('ogrenciUid', '==', uid))),
        getDocs(query(collection(db, 'ogrenciYeniOdevBildirimleri'), where('ogrenciUid', '==', uid))),
        getDocs(query(collection(db, 'ogrenciOdevDurumBildirimleri'), where('ogrenciUid', '==', uid))),
      ]);
      if (!profileSnap.exists() || profileSnap.get('rol') !== 'ogrenci') {
        Alert.alert('Öğrenci hesabı doğrulanamadı', 'Bu oturum öğrenci hesabı olarak tanımlı değil.');
        await signOut(auth);
        navigation.replace('Giris');
        return;
      }
      setProfil(profileSnap.data());
      const links = linkSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBaglantilar(links);
      setTalepler(sortNewest(requestSnap.docs.map(d => ({ id: d.id, ...d.data() }))));
      setBildirimler(sortNewest(notificationSnap.docs.map(d => ({ id: d.id, ...d.data() }))));
      setYeniOdevBildirimleri(sortNewest(newHomeworkSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(item => item.durum !== 'iptal'))
        .slice(0, 50));
      setOdevDurumBildirimleri(sortNewest(statusNotificationSnap.docs.map(d => ({ id: d.id, ...d.data() }))).slice(0, 50));

      const dataGroups = await Promise.all(links.map(async link => {
        const active = link.durum === 'active';
        const period = Number.isInteger(link.donemYili) ? link.donemYili : donemYiliBugun();
        const permissions = link.izinler || {};
        const result = { link, period, permissions, active, sinif: null, ogrenci: null,
          dersler: [], notlar: [], yoklamalar: [], odevler: [], kitaplar: [], konular: [], etkinlikler: [], oturumlar: [] };
        if (!active) return result;

        const tasks = [];
        const keys = [];
        const addQuery = (key, collectionName, filters) => {
          keys.push(key);
          tasks.push(getDocs(query(collection(db, collectionName), ...filters.map(([field, value]) => where(field, '==', value)))));
        };
        const base = [['uid', link.ogretmenUid], ['sinifId', link.sinifId]];
        if (permissions.dersProgrami) {
          tasks.push(getDoc(doc(db, 'siniflar', link.sinifId))); keys.push('sinif');
          tasks.push(getDoc(doc(db, 'ogrenciler', link.ogrenciKayitId))); keys.push('ogrenci');
          addQuery('dersler', 'dersler', base);
          addQuery('etkinlikler', 'bireyselEtkinlikler', [...base, ['ogrenciId', link.ogrenciKayitId]]);
          addQuery('oturumlar', 'bireyselDersOturumlari', [...base, ['ogrenciId', link.ogrenciKayitId]]);
        }
        if (permissions.dersNotlari) addQuery('notlar', 'dersNotlari', base);
        if (permissions.yoklama) addQuery('yoklamalar', 'yoklamalar', [...base, ['ogrenciId', link.ogrenciKayitId]]);
        if (permissions.odevler) {
          keys.push('odevler');
          tasks.push(getDocs(query(collection(db, 'odevler'), where('uid', '==', link.ogretmenUid), where('sinifId', '==', link.sinifId), where('hedefOgrenciIds', 'array-contains', link.ogrenciKayitId))));
        }
        if (permissions.kitaplar) addQuery('kitaplar', 'kitaplar', [...base, ['ogrenciId', link.ogrenciKayitId]]);
        if (permissions.konular) addQuery('konular', 'konular', [...base, ['ogrenciId', link.ogrenciKayitId]]);
        const values = await Promise.all(tasks);
        values.forEach((snap, index) => {
          const key = keys[index];
          if (key === 'sinif' || key === 'ogrenci') result[key] = snap.exists() ? { id: snap.id, ...snap.data() } : null;
          else result[key] = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => donemUygun(x, period));
        });
        for (const key of ['dersler','notlar','yoklamalar','odevler','kitaplar','konular','etkinlikler','oturumlar']) {
          result[key] = sortNewest(result[key]);
        }
        return result;
      }));
      setGruplar(dataGroups);

      const bugun = new Date();
      const mevcutDonemYili = donemYiliBugun();
      const oncekiDonemBaglantisiVar = links.some(link =>
        link.durum === 'active' && Number(link.donemYili) === mevcutDonemYili - 1
      );
      const yeniDonemBaglantisiVar = links.some(link =>
        link.durum === 'active' && Number(link.donemYili) === mevcutDonemYili
      );
      if (bugun.getMonth() === 5 && bugun.getDate() <= 30
        && oncekiDonemBaglantisiVar && !yeniDonemBaglantisiVar
        && await donemHatirlatmaGosterilebilir(uid, 'ogrenci', mevcutDonemYili)) {
        await donemHatirlatmaKaydet(uid, 'ogrenci', mevcutDonemYili);
        Alert.alert(
          'Yeni eğitim öğretim dönemi başladı',
          'Yeni döneme ait derslerinizi ve ödevlerinizi görebilmek için öğretmeninizden yeni dönem eşleştirme kodu isteyin. Eski dönem kayıtlarınız görüntülenmeye devam eder.',
          [
            { text: 'Daha sonra', style: 'cancel' },
            { text: 'Kod gir', onPress: () => navigation.navigate('OgrenciKayit', { devamEt: true }) },
          ],
        );
      }
    } catch (e) {
      Alert.alert('Veriler yüklenemedi', e?.message || 'İnternet bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      setYukleniyor(false);
      setYenileniyor(false);
    }
  }, [uid, navigation]);

  useEffect(() => { yukle(); }, [yukle]);

  const bildirimOkundu = async item => {
    if (!item || item.okundu) return;
    try {
      await updateDoc(doc(db, 'ogrenciYeniOdevBildirimleri', item.id), {
        okundu: true,
        okunduTarihi: serverTimestamp(),
      });
      setYeniOdevBildirimleri(previous => previous.map(x => x.id === item.id ? { ...x, okundu: true } : x));
    } catch (e) {
      Alert.alert('Bildirim güncellenemedi', e?.message || 'Bildirim okundu olarak işaretlenemedi.');
    }
  };

  const bildirimAc = async item => {
    await bildirimOkundu(item);
    const y = odevBolumY.current[item.baglantiId];
    if (Number.isFinite(y)) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
    } else {
      Alert.alert('Ödev görünmüyor', 'Bu ödev artık etkin bağlantınızda görünmüyor veya öğretmeninizin ödev paylaşım izni kapatılmış.');
    }
  };

  const durumBildiriminiOkunduYap = async item => {
    if (!item || item.okundu) return;
    try {
      await updateDoc(doc(db, 'ogrenciOdevDurumBildirimleri', item.id), {
        okundu: true,
        okunduTarihi: serverTimestamp(),
      });
      setOdevDurumBildirimleri(previous => previous.map(x => x.id === item.id ? { ...x, okundu: true } : x));
    } catch (e) {
      Alert.alert('Bildirim güncellenemedi', e?.message || 'Bildirim okundu olarak işaretlenemedi.');
    }
  };

  const durumBildiriminiAc = async item => {
    await durumBildiriminiOkunduYap(item);
    const y = odevBolumY.current[item.baglantiId];
    if (Number.isFinite(y)) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
    } else {
      Alert.alert('Ödev görünmüyor', 'Bu ödev artık etkin bağlantınızda görünmüyor veya öğretmeninizin ödev paylaşım izni kapatılmış.');
    }
  };

  const tamamlandiBildir = async (link, homework) => {
    try {
      await notifyHomeworkCompleted(link, homework);
      Alert.alert('Bildirim gönderildi', 'Ödevi tamamladığınızı öğretmeninize bildirdiniz. Son değerlendirme öğretmeninize aittir.');
      await yukle(true);
    } catch (e) {
      Alert.alert('Bildirim gönderilemedi', e?.message || 'Lütfen tekrar deneyin.');
    }
  };

  const cikis = () => Alert.alert('Çıkış yap', 'Hesabınızdan çıkış yapmak istiyor musunuz?', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Çıkış yap', style: 'destructive', onPress: async () => {
      await signOut(auth);
      navigation.replace('Giris');
    }},
  ]);

  if (yukleniyor) return <View style={s.center}><ActivityIndicator size="large" color="#2E7D32"/><Text style={s.muted}>Öğrenci bilgileriniz yükleniyor…</Text></View>;

  const aktifSayisi = baglantilar.filter(x => x.durum === 'active').length;
  return (
    <View style={s.root}>
      <ScrollView ref={scrollRef} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={() => yukle(true)} colors={['#2E7D32']}/>}>
        <View style={s.header}>
          <View style={{flex:1}}>
            <Text style={s.eyebrow}>ÖĞRENCİ AJANDASI</Text>
            <Text style={s.welcome}>Merhaba, {profil?.kullaniciAdi || auth.currentUser?.displayName || 'Öğrenci'} 👋</Text>
            <Text style={s.sub}>{aktifSayisi} etkin öğretmen bağlantısı</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profil')} style={s.logout}><Text style={s.logoutText}>Profil</Text></TouchableOpacity><TouchableOpacity onPress={cikis} style={s.logout}><Text style={s.logoutText}>Çıkış</Text></TouchableOpacity>
        </View>

        <View style={s.actionCard}>
          <Text style={s.cardTitle}>Uygulama içi bildirimler</Text>
          <Text style={s.muted}>Yeni ödevler ve ödev tamamlanma bildirimleriniz burada görünür. Bu sürümde telefona anlık push bildirimi gönderilmez.</Text>
        </View>

        <View style={s.actionCard}>
          <Text style={s.cardTitle}>Öğretmen bağlantısı ekle</Text>
          <Text style={s.muted}>Yeni bir öğretmenden aldığınız 16 karakterli kodu ekleyerek eşleştirme isteği gönderin.</Text>
          <TouchableOpacity style={s.primary} onPress={() => navigation.navigate('OgrenciKayit', { devamEt: true })}><Text style={s.primaryText}>Kod gir / yeni kod ekle</Text></TouchableOpacity>
        </View>

        {!!talepler.length && <View style={s.card}>
          <Text style={s.sectionTitle}>Eşleştirme isteklerim</Text>
          {talepler.map(item => (
            <View key={item.id} style={s.item}>
              <Text style={s.itemTitle}>{item.ogretmenHesapAdi || 'Öğretmen'} · {item.sinifAd || 'Sınıf'}</Text>
              <Text style={s.meta}>{item.durum === 'bekliyor' ? 'Öğretmen onayı bekleniyor' : item.durum === 'onaylandi' ? 'Onaylandı' : 'Reddedildi'}{item.olusturulma ? ' · ' + dateLabel(item.olusturulma) : ''}</Text>
            </View>
          ))}
        </View>}

        {gruplar.map(group => {
          const l = group.link;
          const p = group.permissions;
          return <View key={l.id} style={s.card}>
            <Text style={s.sectionTitle}>{l.ogretmenHesapAdi || 'Öğretmen'}</Text>
            <Text style={s.className}>{l.sinifAd || group.sinif?.ad || 'Sınıf bilgisi'} {l.kademe ? '· ' + l.kademe : ''}</Text>
            <Text style={s.meta}>{l.ders || group.sinif?.ders || ''}{l.donemYili ? ' · ' + l.donemYili + '/' + (l.donemYili + 1) : ''}</Text>
            {!group.active && <Text style={s.revoked}>Bu öğretmen bağlantısı artık etkin değil.</Text>}
            {group.active && <>
              <View style={s.permissions}>{PERMISSIONS.map(([key,label]) => <View key={key} style={[s.permission,p[key] ? s.permissionOn : s.permissionOff]}><Text style={s.permissionText}>{label}: {p[key] ? 'Açık' : 'Kapalı'}</Text></View>)}</View>

              {p.dersProgrami && <Section title="📅 Ders programı" items={group.dersler} empty="Paylaşılan ders programı yok." render={x => <Text style={s.itemText}>{x.gun || ''} · {x.baslangicSaat || ''}–{x.bitisSaat || ''} · {x.ders || x.sinifAd || 'Ders'}</Text>}/>}
              {p.dersProgrami && group.etkinlikler.length > 0 && <Section title="👤 Bireysel ders / etüt" items={group.etkinlikler} render={x => <Text style={s.itemText}>{x.tur || 'Etkinlik'} · {dateLabel(x.baslangicTarih)} · {x.baslangicSaat || ''}–{x.bitisSaat || ''}</Text>}/>}
              {p.dersProgrami && group.oturumlar.length > 0 && <Section title="🗒️ Bireysel ders notları" items={group.oturumlar} render={x => <Text style={s.itemText}>{dateLabel(x.tarih)} · {(x.konular || []).join(', ') || x.yoklamaDurumu || 'Ders oturumu'}</Text>}/>}
              {p.dersNotlari && <Section title="📚 İşlenen konular" items={group.notlar} empty="Paylaşılan ders notu yok." render={x => <Text style={s.itemText}>{dateLabel(x.tarih)} · {x.not || 'Ders notu'}</Text>}/>}
              {p.yoklama && <Section title="✅ Yoklama geçmişim" items={group.yoklamalar} empty="Yoklama kaydı yok." render={x => <Text style={s.itemText}>{dateLabel(x.tarih)} · {x.durum || 'Durum belirtilmemiş'}</Text>}/>}
              {p.odevler && <Section onLayout={event => { odevBolumY.current[l.id] = event.nativeEvent.layout.y; }} title="📋 Ödevlerim" items={group.odevler} empty="Paylaşılan ödev yok." render={x => {
                const status = x.ogrenciDurumlari?.[l.ogrenciKayitId] || x.durum || 'bekliyor';
                const alreadyNotified = bildirimler.some(n => n.baglantiId === l.id && n.odevId === x.id && n.durum === 'tamamlandi_bildirildi');
                return <View style={s.homework}>
                  <Text style={s.itemTitle}>{x.aciklama || x.baslik || 'Ödev'}</Text>
                  <Text style={s.meta}>Teslim: {dateLabel(x.teslimTarihi) || 'Belirtilmemiş'} · Öğretmen durumu: {status}</Text>
                  {alreadyNotified ? <Text style={s.sent}>✓ Tamamlandı bildirimi gönderildi</Text> : <TouchableOpacity style={s.smallButton} onPress={() => tamamlandiBildir(l,x)}><Text style={s.smallButtonText}>Ödevi tamamladım</Text></TouchableOpacity>}
                </View>;
              }}/>}
              {p.kitaplar && <Section title="📖 Kitaplarım" items={group.kitaplar} empty="Atanmış kitap yok." render={x => <Text style={s.itemText}>{x.ad || x.kitapAd || 'Kitap'} · {x.sayfaSayisi || '?'} sayfa</Text>}/>}
              {p.konular && <Section title="🧭 Kitap konularım" items={group.konular} empty="Paylaşılan kitap konusu yok." render={x => <Text style={s.itemText}>{x.ad || 'Konu'} · Sayfa {x.baslangicSayfa || '?'}–{x.bitisSayfa || '?'}</Text>}/>}
            </>}
          </View>;
        })}

        {!gruplar.length && <View style={s.card}><Text style={s.sectionTitle}>Henüz öğretmen bağlantınız yok</Text><Text style={s.muted}>Öğretmeninizden eşleştirme kodu isteyin. Kod girildikten sonra öğretmeninizin onayı beklenir.</Text></View>}
        {!!yeniOdevBildirimleri.length && <View style={s.card}>
          <Text style={s.sectionTitle}>Yeni ödev bildirimleri ({yeniOdevBildirimleri.filter(x => !x.okundu).length} okunmamış)</Text>
          {yeniOdevBildirimleri.map(item => (
            <TouchableOpacity key={item.id} style={s.item} onPress={() => bildirimAc(item)}>
              <Text style={[s.itemTitle, !item.okundu && s.unread]}>{item.baslik || 'Yeni ödeviniz var'}</Text>
              <Text style={s.itemText}>{item.aciklama || 'Öğretmeniniz yeni bir ödev verdi.'}</Text>
              <Text style={s.meta}>Teslim: {dateLabel(item.teslimTarihi) || 'Belirtilmemiş'} · {item.okundu ? 'Okundu' : 'Okundu olarak işaretlemek için dokunun'}</Text>
            </TouchableOpacity>
          ))}
        </View>}
        {!!odevDurumBildirimleri.length && <View style={s.card}>
          <Text style={s.sectionTitle}>Ödev durum bildirimleri ({odevDurumBildirimleri.filter(x => !x.okundu).length} okunmamış)</Text>
          {odevDurumBildirimleri.map(item => (
            <TouchableOpacity key={item.id} style={s.item} onPress={() => durumBildiriminiAc(item)}>
              <Text style={[s.itemTitle, !item.okundu && s.unread]}>{item.odevAciklama || 'Ödev'} · Durum güncellendi</Text>
              <Text style={s.itemText}>Öğretmeniniz ödev durumunuzu “{({yapildi:'Yaptı',yapilmadi:'Yapmadı',gec:'Geç getirdi'})[item.yeniDurum] || item.yeniDurum}” olarak değiştirdi.</Text>
              <Text style={s.meta}>{item.okundu ? 'Okundu' : 'Ödeve gitmek için dokunun'}</Text>
            </TouchableOpacity>
          ))}
        </View>}
        {!!bildirimler.length && <View style={s.card}><Text style={s.sectionTitle}>Ödev bildirimlerim</Text>{bildirimler.map(x => <Text key={x.id} style={s.meta}>✓ {x.odevAciklama || 'Ödev'} · {x.durum === 'tamamlandi_bildirildi' ? 'Tamamlandı bildirimi gönderildi' : x.durum}</Text>)}</View>}
        <TouchableOpacity style={s.refresh} onPress={() => yukle(true)}><Text style={s.refreshText}>↻ Yenile</Text></TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Section({ title, items, empty, render, onLayout }) {
  return <View style={s.section} onLayout={onLayout}>
    <Text style={s.subTitle}>{title} ({items.length})</Text>
    {!items.length && <Text style={s.meta}>{empty || 'Kayıt yok.'}</Text>}
    {items.slice(0, 12).map(item => <View key={item.id} style={s.item}>{render(item)}</View>)}
    {items.length > 12 && <Text style={s.meta}>İlk 12 kayıt gösteriliyor.</Text>}
  </View>;
}

const s = StyleSheet.create({
  root:{flex:1,backgroundColor:'#F1F8E9'},content:{padding:14,paddingBottom:40},
  center:{flex:1,alignItems:'center',justifyContent:'center',padding:24,backgroundColor:'#F1F8E9'},
  header:{backgroundColor:'#1B5E20',borderRadius:16,padding:18,marginBottom:12,flexDirection:'row',alignItems:'center'},
  eyebrow:{color:'#C8E6C9',fontSize:11,fontWeight:'700',letterSpacing:1},
  welcome:{color:'#fff',fontSize:21,fontWeight:'bold',marginTop:5},sub:{color:'#E8F5E9',fontSize:13,marginTop:5},
  logout:{padding:9,borderWidth:1,borderColor:'#A5D6A7',borderRadius:8},logoutText:{color:'#fff',fontWeight:'700'},
  card:{backgroundColor:'#fff',borderRadius:14,padding:15,marginBottom:12,elevation:2},
  actionCard:{backgroundColor:'#E8F5E9',borderRadius:14,padding:15,marginBottom:12,borderWidth:1,borderColor:'#C8E6C9'},
  cardTitle:{fontSize:16,fontWeight:'bold',color:'#1B5E20',marginBottom:6},
  sectionTitle:{fontSize:17,fontWeight:'bold',color:'#1B5E20',marginBottom:5},
  className:{fontSize:15,fontWeight:'700',color:'#37474F',marginTop:4},
  meta:{fontSize:12,color:'#68776A',marginTop:4,lineHeight:17},
  muted:{fontSize:13,color:'#657565',lineHeight:19},
  permissions:{flexDirection:'row',flexWrap:'wrap',marginTop:10,marginBottom:5},
  permission:{paddingHorizontal:8,paddingVertical:5,borderRadius:20,marginRight:5,marginBottom:5},
  permissionOn:{backgroundColor:'#E8F5E9'},permissionOff:{backgroundColor:'#ECEFF1'},
  permissionText:{fontSize:10,color:'#37474F',fontWeight:'600'},
  section:{marginTop:12,paddingTop:10,borderTopWidth:1,borderTopColor:'#EDF1ED'},
  subTitle:{fontSize:14,fontWeight:'700',color:'#2E7D32',marginBottom:5},
  item:{paddingVertical:7,borderBottomWidth:1,borderBottomColor:'#F1F3F1'},
  itemTitle:{fontSize:13,fontWeight:'700',color:'#37474F'},
  itemText:{fontSize:13,color:'#455A64',lineHeight:19},
  homework:{width:'100%'},primary:{backgroundColor:'#2E7D32',padding:12,borderRadius:9,alignItems:'center',marginTop:12},
  primaryText:{color:'#fff',fontWeight:'700'},secondary:{backgroundColor:'#fff',borderWidth:1,borderColor:'#81C784',padding:11,borderRadius:9,alignItems:'center',marginTop:10},secondaryText:{color:'#1B5E20',fontWeight:'700'},unread:{color:'#1B5E20'},smallButton:{alignSelf:'flex-start',backgroundColor:'#E8F5E9',padding:8,borderRadius:7,marginTop:8},
  smallButtonText:{color:'#1B5E20',fontWeight:'700',fontSize:12},sent:{color:'#2E7D32',fontSize:12,fontWeight:'700',marginTop:7},
  revoked:{color:'#B71C1C',fontWeight:'700',marginTop:10},refresh:{alignItems:'center',padding:14},refreshText:{color:'#2E7D32',fontWeight:'700'},
  title:{fontSize:21,fontWeight:'bold',color:'#1B5E20',textAlign:'center',marginBottom:10},
});
