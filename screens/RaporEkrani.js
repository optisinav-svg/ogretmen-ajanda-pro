import React,{useState,useEffect}from'react';
import {View,Text,TouchableOpacity,StyleSheet,ScrollView,ActivityIndicator,Modal}from'react-native';
import {collection,getDocs,query,where}from'firebase/firestore';
import {auth,db}from'../firebaseConfig';

const statusText=d=>d==='yapildi'?'✅ Yaptı':d==='yapilmadi'?'❌ Yapmadı':d==='gec'?'⏰ Geç getirdi':'📋 Bekliyor';

export default function RaporEkrani(){
 const [siniflar,setSiniflar]=useState([]),[seciliSinif,setSeciliSinif]=useState(null),[notlar,setNotlar]=useState([]),[yoklamalar,setYoklamalar]=useState([]),[odevler,setOdevler]=useState([]),[ogrenciler,setOgrenciler]=useState([]),[konular,setKonular]=useState([]),[yukleniyor,setYukleniyor]=useState(false),[sekme,setSekme]=useState('notlar'),[detay,setDetay]=useState(null);
 const uid=auth.currentUser?.uid;

 useEffect(()=>{(async()=>{
   try{
     const s=await getDocs(query(collection(db,'siniflar'),where('uid','==',uid)));
     setSiniflar(s.docs.map(d=>({id:d.id,...d.data()})));
   }catch(e){}
 })()},[uid]);

 const sinifSec=async sinif=>{
   setSeciliSinif(sinif);setYukleniyor(true);
   try{
     const cols=['dersNotlari','yoklamalar','odevler','ogrenciler','konular'];
     const r=await Promise.all(cols.map(c=>getDocs(query(collection(db,c),where('sinifId','==',sinif.id),where('uid','==',uid)))));
     setNotlar(r[0].docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>new Date(b.olusturulma||b.tarih)-new Date(a.olusturulma||a.tarih)));
     setYoklamalar(r[1].docs.map(x=>({id:x.id,...x.data()})));
     setOdevler(r[2].docs.map(x=>({id:x.id,...x.data()})));
     setOgrenciler(r[3].docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(a.adSoyad||'').localeCompare(b.adSoyad||'')));
     setKonular(r[4].docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>new Date(b.olusturulma||b.tarih)-new Date(a.olusturulma||a.tarih)));
   }catch(e){}
   setYukleniyor(false);
 };

 const yoklamaOzeti=()=>{
   const o={};
   yoklamalar.forEach(y=>{
     const id=y.ogrenciId||y.ogrenciAd;
     if(!o[id])o[id]={geldi:0,gecikti:0,gelmedi:0};
     o[id][y.durum]=(o[id][y.durum]||0)+1;
   });
   return o;
 };

 const studentAttendance=id=>
   yoklamalar.filter(y=>y.ogrenciId===id||(!y.ogrenciId&&y.ogrenciAd===detay?.adSoyad))
   .sort((a,b)=>(b.tarih||'').localeCompare(a.tarih||''));

 const studentHomework=id=>{
   return odevler.filter(o=>{
     const hedefler=o.hedefOgrenciIds||[];
     // Sınıfa verilen ödev herkesin kişisel geçmişinde görünür.
     if(o.hedef==='sinif' || o.hedef==='tumSinif' || o.tumSinif===true) return true;
     return hedefler.includes(id);
   });
 };

 const tarihEslesiyor=(a,b)=>{
   if(!a||!b) return false;
   return String(a).slice(0,10)===String(b).slice(0,10);
 };

 const studentTopics=id=>{
   const ogrenci=ogrenciler.find(o=>o.id===id);
   const ozelKonular=konular.filter(k=>k.ogrenciId===id).map(k=>({...k,dersteYok:false,yoklamaDurumu:null}));
   const sinifKonular=notlar.map(n=>{
     let y=yoklamalar.find(v=>v.ogrenciId===id&&n.oturumId&&v.oturumId===n.oturumId);
     if(!y) y=yoklamalar.find(v=>v.ogrenciId===id&&n.dersId&&v.dersId===n.dersId&&String(v.tarih||'').slice(0,10)===String(n.tarih||'').slice(0,10));
     if(!y) y=yoklamalar.find(v=>v.ogrenciId===id&&!n.dersId&&String(v.tarih||'').slice(0,10)===String(n.tarih||'').slice(0,10));
     return {id:'not-'+n.id,ad:n.not||'İşlenen konu',kitapAd:n.kitapAd||'',tarih:n.tarih,tarihGosterim:n.tarihGosterim,olusturulma:n.olusturulma,dersId:n.dersId,oturumId:n.oturumId,baslangicSaat:n.baslangicSaat,bitisSaat:n.bitisSaat,dersteYok:y?.durum==='gelmedi',yoklamaDurumu:y?.durum||null,ogrenciAd:ogrenci?.adSoyad||''};
   });
   return [...ozelKonular,...sinifKonular].sort((a,b)=>new Date(b.olusturulma||b.tarih)-new Date(a.olusturulma||a.tarih));
 };

 const tarih=k=>k.tarihGosterim||k.tarih||'';

 return <View style={styles.kapsayici}>
  <Text style={styles.baslik}>Sınıf Seçin:</Text>
  <ScrollView horizontal style={styles.sinifListesi} showsHorizontalScrollIndicator={false}>
   {siniflar.map(s=><TouchableOpacity key={s.id} style={[styles.sinifButon,seciliSinif?.id===s.id&&styles.sinifAktif]} onPress={()=>sinifSec(s)}>
    <Text style={[styles.sinifMetni,seciliSinif?.id===s.id&&styles.sinifMetniAktif]}>{s.ad}</Text><Text style={[styles.chipOkul,seciliSinif?.id===s.id&&styles.chipOkulAktif]}>{s.okulAd||''}</Text>
   </TouchableOpacity>)}
  </ScrollView>

  {seciliSinif&&<View style={styles.sekmeler}>
   {[['notlar','📖 Notlar'],['yoklama','✅ Yoklama'],['odevler','📋 Ödevler'],['ogrenciler','👤 Öğrenciler']].map(([k,t])=>
    <TouchableOpacity key={k} style={[styles.sekme,sekme===k&&styles.sekmeAktif]} onPress={()=>setSekme(k)}>
     <Text style={[styles.sekmeMetni,sekme===k&&styles.sekmeMetniAktif]}>{t}</Text>
    </TouchableOpacity>)}
  </View>}

  {yukleniyor?<ActivityIndicator style={{marginTop:32}} size="large" color="#2E7D32"/>:
  <ScrollView style={styles.icerik}>
   {!seciliSinif&&<Text style={styles.bos}>Rapor görmek için sınıf seçin.</Text>}

   {seciliSinif&&sekme==='notlar'&&<>
    <Text style={styles.bolumBaslik}>Toplam {notlar.length} ders notu</Text>
    {notlar.map(n=><View key={n.id} style={styles.satir}>
     <Text style={styles.satirTarih}>{n.tarihGosterim}</Text>
     <Text style={styles.satirIcerik}>{n.not}</Text>
    </View>)}
   </>}

   {seciliSinif&&sekme==='yoklama'&&<>
    <Text style={styles.bolumBaslik}>Öğrenciye dokunarak ayrıntılı geçmişi görün</Text>
    {ogrenciler.map(o=>{
     const z=yoklamaOzeti()[o.id]||{geldi:0,gecikti:0,gelmedi:0};
     return <TouchableOpacity key={o.id} style={styles.yoklamaKart} onPress={()=>setDetay(o)}>
      <Text style={styles.ogrenciAd}>{o.adSoyad} ›</Text>
      <View style={styles.yoklamaSatir}>
       {[['Geldi',z.geldi,'#E8F5E9'],['Gecikti',z.gecikti,'#FFF8E1'],['Gelmedi',z.gelmedi,'#FFEBEE']].map(([t,n,b])=>
        <View key={t} style={[styles.yoklamaKutu,{backgroundColor:b}]}>
         <Text style={styles.yoklamaSayi}>{n||0}</Text><Text style={styles.yoklamaMetni}>{t}</Text>
        </View>)}
      </View>
     </TouchableOpacity>
    })}
   </>}

   {seciliSinif&&sekme==='odevler'&&<>
    <Text style={styles.bolumBaslik}>Toplam {odevler.length} ödev</Text>
    {odevler.map(o=><View key={o.id} style={styles.odevSatir}>
     <Text style={styles.odevMetni}>{o.aciklama}</Text>
     <Text style={styles.odevTarih}>Teslim: {o.teslimTarihi}</Text>
    </View>)}
   </>}

   {seciliSinif&&sekme==='ogrenciler'&&<>
    <Text style={styles.bolumBaslik}>Öğrenciye dokunarak kişisel geçmişi açın</Text>
    {ogrenciler.map(o=><TouchableOpacity key={o.id} style={styles.studentCard} onPress={()=>setDetay(o)}>
     <Text style={styles.ogrenciAd}>{o.adSoyad}</Text>
     <Text style={styles.detailHint}>Yoklama · İşlenen Konular · Ödevler ›</Text>
    </TouchableOpacity>)}
   </>}
  </ScrollView>}

  <Modal visible={!!detay} animationType="slide">
   <View style={styles.detailWrap}>
    <View style={styles.detailHeader}>
     <Text style={styles.detailTitle}>{detay?.adSoyad}</Text>
     <TouchableOpacity onPress={()=>setDetay(null)}><Text style={styles.close}>✕</Text></TouchableOpacity>
    </View>

    <ScrollView style={styles.detailScroll}>
     <Text style={styles.detailSection}>📊 Yoklama Geçmişi</Text>
     {studentAttendance(detay?.id).length?
      studentAttendance(detay?.id).map(y=><View key={y.id} style={styles.detailRow}>
       <Text>{y.tarihGosterim||y.tarih}</Text>
       <Text style={{fontWeight:'bold',color:y.durum==='geldi'?'#2E7D32':y.durum==='gecikti'?'#F57F17':'#C62828'}}>
        {y.durum==='geldi'?'✅ Geldi':y.durum==='gecikti'?'⏰ Gecikti':'❌ Gelmedi'}
       </Text>
      </View>):<Text style={styles.emptySmall}>Kayıt yok.</Text>}

     <Text style={styles.detailSection}>📚 İşlenen Konular</Text>
     {studentTopics(detay?.id).length?
      studentTopics(detay?.id).map(k=><View key={k.id} style={[styles.topicRow,k.dersteYok&&styles.topicAbsent]}>
       <Text style={styles.topicAd}>{k.ad}</Text>
       {k.kitapAd?<Text style={styles.small}>{k.kitapAd}</Text>:null}
       {k.dersId&&k.baslangicSaat?<Text style={styles.small}>{k.baslangicSaat}–{k.bitisSaat}</Text>:null}
       {tarih(k)?<Text style={styles.small}>{tarih(k)}</Text>:null}
       {k.dersteYok?<Text style={styles.absentText}>⚠ Bu konu işlenirken öğrenci derste yoktu.</Text>:k.yoklamaDurumu==='geldi'?<Text style={styles.presentText}>✅ Öğrenci dersteydi.</Text>:k.yoklamaDurumu==='gecikti'?<Text style={styles.lateText}>⏰ Öğrenci derse geç geldi.</Text>:<Text style={styles.small}>Yoklama bilgisi bulunamadı.</Text>}
      </View>):<Text style={styles.emptySmall}>Bu sınıf için henüz işlenen konu kaydı yok.</Text>}

     <Text style={styles.detailSection}>📋 Ödev Geçmişi</Text>
     {studentHomework(detay?.id).length?
      studentHomework(detay?.id).map(o=><View key={o.id} style={styles.detailRow}>
       <View style={{flex:1}}>
        <Text style={{fontWeight:'600'}}>{o.aciklama}</Text>
        <Text style={styles.small}>Teslim: {o.teslimTarihi}</Text>
       </View>
       <View style={{alignItems:'flex-end'}}><Text>{statusText((o.ogrenciDurumlari||{})[detay?.id]||o.durum)}</Text>{(o.durumGecmisi?.[detay?.id]||[]).map((e,i)=><Text key={i} style={styles.small}>{e.tarihGosterim||''} · {statusText(e.durum)}</Text>)}</View>
      </View>):<Text style={styles.emptySmall}>Ödev kaydı yok.</Text>}
    </ScrollView>
   </View>
  </Modal>
 </View>
}

const styles=StyleSheet.create({
 kapsayici:{flex:1,backgroundColor:'#F1F8E9'},
 baslik:{fontSize:14,fontWeight:'600',color:'#2E7D32',paddingHorizontal:16,paddingTop:12,paddingBottom:6},
 sinifListesi:{paddingHorizontal:12,paddingBottom:8,maxHeight:60},
 sinifButon:{borderWidth:1,borderColor:'#C8E6C9',borderRadius:20,paddingHorizontal:16,paddingVertical:8,marginRight:8,backgroundColor:'#fff'},
 sinifAktif:{backgroundColor:'#2E7D32',borderColor:'#2E7D32'},
 sinifMetni:{fontSize:13,color:'#333'},chipOkul:{fontSize:9,color:'#888',marginTop:2},chipOkulAktif:{color:'#C8E6C9'},sinifMetniAktif:{color:'#fff',fontWeight:'bold'},
 sekmeler:{flexDirection:'row',backgroundColor:'#fff',padding:5},
 sekme:{flex:1,paddingVertical:9,alignItems:'center',borderRadius:8},
 sekmeAktif:{backgroundColor:'#E8F5E9'},
 sekmeMetni:{fontSize:10,color:'#777'},sekmeMetniAktif:{color:'#2E7D32',fontWeight:'bold'},
 icerik:{flex:1,padding:12},bos:{color:'#aaa',textAlign:'center',padding:32},
 bolumBaslik:{fontSize:13,fontWeight:'bold',color:'#2E7D32',marginBottom:10},
 satir:{backgroundColor:'#fff',borderRadius:10,padding:12,marginBottom:8,borderLeftWidth:3,borderLeftColor:'#2E7D32'},
 satirTarih:{fontSize:11,color:'#aaa',marginBottom:4},satirIcerik:{fontSize:14,color:'#333'},
 yoklamaKart:{backgroundColor:'#fff',borderRadius:10,padding:12,marginBottom:8},
 ogrenciAd:{fontSize:15,fontWeight:'bold',color:'#1B5E20',marginBottom:8},
 yoklamaSatir:{flexDirection:'row',gap:8},yoklamaKutu:{flex:1,borderRadius:8,padding:8,alignItems:'center'},
 yoklamaSayi:{fontSize:18,fontWeight:'bold',color:'#1B5E20'},yoklamaMetni:{fontSize:10,color:'#666'},
 odevSatir:{backgroundColor:'#fff',borderRadius:10,padding:12,marginBottom:8},
 odevMetni:{fontSize:14,color:'#333',fontWeight:'600'},odevTarih:{fontSize:11,color:'#888',marginTop:4},
 studentCard:{backgroundColor:'#fff',borderRadius:10,padding:14,marginBottom:8},
 detailHint:{fontSize:12,color:'#777'},detailWrap:{flex:1,backgroundColor:'#F1F8E9'},
 detailHeader:{backgroundColor:'#2E7D32',padding:18,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 detailTitle:{color:'#fff',fontSize:20,fontWeight:'bold',flex:1},close:{color:'#fff',fontSize:25},
 detailScroll:{padding:14},detailSection:{fontSize:16,fontWeight:'bold',color:'#1B5E20',marginTop:10,marginBottom:8},
 detailRow:{backgroundColor:'#fff',padding:12,borderRadius:9,marginBottom:6,flexDirection:'row',justifyContent:'space-between',gap:10},
 topicRow:{backgroundColor:'#fff',padding:12,borderRadius:9,marginBottom:6},
 topicAbsent:{borderLeftWidth:4,borderLeftColor:'#E65100',backgroundColor:'#FFF3E0'},
 topicAd:{fontWeight:'600',color:'#333',marginBottom:3},
 absentText:{fontSize:12,color:'#BF360C',fontWeight:'600',marginTop:7},presentText:{fontSize:12,color:'#2E7D32',fontWeight:'600',marginTop:7},lateText:{fontSize:12,color:'#F57F17',fontWeight:'600',marginTop:7},
 emptySmall:{color:'#999',padding:10},small:{fontSize:11,color:'#888'}
});
