import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function RolDuzeltmeTalepleriEkrani() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const yukle = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const snapshot = await getDocs(query(
        collection(db, 'rolDuzeltmeTalepleri'),
        where('durum', '==', 'bekliyor'),
      ));
      setItems(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    } catch (e) {
      setError(e?.message || 'Yetki veya bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#2E7D32"/><Text>Talep listesi yükleniyor…</Text></View>;
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 32 }}>
      <View style={s.notice}>
        <Text style={s.noticeTitle}>Rol kararları geçici olarak salt okunur</Text>
        <Text style={s.info}>Rol değişikliği; okul, sınıf, öğrenci kayıtları ve geçmiş öğretmen-öğrenci bağlantılarının güvenilir biçimde kontrol edilmesini gerektirir. Spark planında bu yetkili kontrol uygulama içinde henüz güvenli biçimde tamamlanmadı. Bu ekranda hiçbir rol değişikliği veya talep silme işlemi yapılmaz.</Text>
      </View>
      {!!error && <Text style={s.error}>{error}</Text>}
      {!items.length && <Text style={s.info}>Bekleyen rol düzeltme talebi bulunmuyor.</Text>}
      {items.map(item => (
        <View key={item.id} style={s.card}>
          <Text style={s.title}>Talep: {item.mevcutRol === 'ogretmen' ? 'Öğretmen' : 'Öğrenci'} → {item.hedefRol === 'ogretmen' ? 'Öğretmen' : 'Öğrenci'}</Text>
          <Text style={s.info}>Hesap UID: {item.uid}</Text>
          <Text style={s.info}>Gerekçe: {item.gerekce}</Text>
          <Text style={s.pending}>Karar bekliyor — mevcut rol ve kayıtlar korunuyor.</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F8E9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  notice: { backgroundColor: '#FFF8E1', borderRadius: 12, padding: 14, marginBottom: 14 },
  noticeTitle: { fontSize: 16, fontWeight: 'bold', color: '#6D4C41', marginBottom: 6 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 'bold', color: '#1B5E20', marginBottom: 8 },
  info: { fontSize: 13, color: '#455A64', lineHeight: 20, marginBottom: 5 },
  pending: { fontSize: 12, color: '#8D6E63', marginTop: 8, fontWeight: '600' },
  error: { color: '#B71C1C', marginBottom: 12 },
});
