import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';

const number = value => Number(value || 0).toLocaleString('tr-TR');

export default function IstatistikPaneliEkrani({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await httpsCallable(functions, 'getUygulamaSahibiIstatistikleri')();
      setData(result.data);
    } catch (e) {
      setError(e?.code === 'functions/permission-denied'
        ? 'Bu ekran için uygulama sahibi yetkisi doğrulanamadı.'
        : (e?.message || 'İstatistikler yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const goHome = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('AnaSayfa');
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#2E7D32"/><Text style={s.muted}>İstatistikler hazırlanıyor…</Text></View>;
  }

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={['#2E7D32']}/>}
      >
        <View style={s.intro}>
          <Text style={s.title}>Uygulama Genel Görünümü</Text>
          <Text style={s.subtitle}>Hesap ve öğretmen-öğrenci bağlantılarının toplu durumu. Öğrenci kişisel bilgileri bu ekranda gösterilmez.</Text>
        </View>

        {!!error && <View style={s.error}><Text style={s.errorText}>{error}</Text><TouchableOpacity onPress={() => load()}><Text style={s.retry}>Tekrar dene</Text></TouchableOpacity></View>}

        {!!data && <>
          <View style={s.metrics}>
            <Metric label="Öğretmen hesabı" value={data.teacherAccountCount}/>
            <Metric label="Öğrenci hesabı" value={data.studentAccountCount}/>
            <Metric label="Aktif bağlantı" value={data.activeLinkCount}/>
            <Metric label="Bağlı öğrenci hesabı" value={data.uniqueLinkedStudentAccountCount}/>
            <Metric label="Bekleyen talep" value={data.pendingRequestCount}/>
            <Metric label="İptal edilmiş bağlantı" value={data.revokedLinkCount}/>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Branş dağılımı</Text>
            {!data.branches?.length && <Text style={s.empty}>Henüz rolü tanımlanmış öğretmen hesabı bulunmuyor.</Text>}
            {(data.branches || []).map(item => (
              <View key={item.branch} style={s.row}>
                <View style={s.rowMain}>
                  <Text style={s.rowTitle}>{item.branch}</Text>
                  <Text style={s.rowSub}>{number(item.teacherCount)} öğretmen</Text>
                </View>
                <Text style={s.rowValue}>{number(item.linkedStudentAccounts)} bağlı öğrenci</Text>
              </View>
            ))}
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Öğretmen bağlantı özeti</Text>
            {!data.teachers?.length && <Text style={s.empty}>Henüz rolü tanımlanmış öğretmen hesabı bulunmuyor.</Text>}
            {(data.teachers || []).map((item, index) => (
              <View key={item.displayName + item.branch + index} style={s.teacher}>
                <Text style={s.rowTitle}>{item.displayName}</Text>
                <Text style={s.rowSub}>{item.branch}</Text>
                <View style={s.teacherStats}>
                  <Text style={s.pill}>{number(item.linkedStudentAccounts)} öğrenci hesabı</Text>
                  <Text style={s.pill}>{number(item.activeLinkCount)} aktif bağlantı</Text>
                  <Text style={s.pill}>{number(item.pendingRequestCount)} bekleyen talep</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={s.updated}>Son oluşturulma: {data.generatedAt ? new Date(data.generatedAt).toLocaleString('tr-TR') : '—'}</Text>
        </>}
        <TouchableOpacity style={s.homeButton} onPress={goHome}><Text style={s.homeButtonText}>⌂  Ana Sayfa</Text></TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }) {
  return <View style={s.metric}><Text style={s.metricValue}>{number(value)}</Text><Text style={s.metricLabel}>{label}</Text></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F8E9' },
  content: { padding: 14, paddingBottom: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F8E9' },
  muted: { color: '#607D8B', marginTop: 10, fontSize: 13 },
  intro: { backgroundColor: '#2E7D32', borderRadius: 14, padding: 16, marginBottom: 12 },
  title: { color: '#fff', fontSize: 19, fontWeight: 'bold' },
  subtitle: { color: '#E8F5E9', fontSize: 12, lineHeight: 18, marginTop: 6 },
  error: { backgroundColor: '#FFEBEE', borderRadius: 10, padding: 14, marginBottom: 12 },
  errorText: { color: '#B71C1C', fontSize: 13 },
  retry: { color: '#1B5E20', fontWeight: 'bold', marginTop: 10 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 12 },
  metric: { width: '31.5%', minHeight: 86, backgroundColor: '#fff', borderRadius: 11, padding: 10, justifyContent: 'center', elevation: 1 },
  metricValue: { color: '#1B5E20', fontSize: 22, fontWeight: 'bold' },
  metricLabel: { color: '#607D8B', fontSize: 10, marginTop: 4 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  sectionTitle: { color: '#1B5E20', fontWeight: 'bold', fontSize: 15, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#ECEFF1' },
  rowMain: { flex: 1 },
  rowTitle: { color: '#263238', fontSize: 13, fontWeight: 'bold' },
  rowSub: { color: '#78909C', fontSize: 11, marginTop: 3 },
  rowValue: { color: '#1B5E20', fontSize: 11, fontWeight: 'bold' },
  empty: { color: '#78909C', fontSize: 12, paddingVertical: 10 },
  teacher: { paddingVertical: 11, borderBottomWidth: 1, borderColor: '#ECEFF1' },
  teacherStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pill: { color: '#33691E', backgroundColor: '#F1F8E9', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 7, fontSize: 10 },
  updated: { color: '#90A4AE', fontSize: 10, textAlign: 'right', marginBottom: 12 },
  homeButton: { backgroundColor: '#2E7D32', padding: 14, borderRadius: 11, alignItems: 'center' },
  homeButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
