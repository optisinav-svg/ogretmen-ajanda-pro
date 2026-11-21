import React,{useState,useEffect}from'react';
import {View,Text,TextInput,TouchableOpacity,StyleSheet,ScrollView,Alert,Modal,ActivityIndicator,KeyboardAvoidingView,Platform}from'react-native';
import {collection,addDoc,getDocs,getDoc,doc,query,where,updateDoc,arrayUnion,deleteField}from'firebase/firestore';
import {auth,db}from'../firebaseConfig';
import {donemYiliBugun,donemUygun,donemDuzenlemeyeAcik}from'../utils/donem';
export default function OgrenciEkrani({route,navigation}){
 const {sinif}=route.params||{};
 const [ogrenciler,setOgrenciler]=useState([]),[siniflar,setSiniflar]=useState([]),[yukleniyor,setYukleniyor]=useState(true);
 const [modalAcik,setModalAcik]=useState(false),[tasimaModal,setTasimaModal]=useState(false),[duzenlenen,setDuzenlenen]=useState(null),[tasimaci,setTasimaci]=useState(null);
 const [ad,setAd]=useState(''),[soyad,setSoyad]=useState(''),[telefon,setTelefon]=useState(''),[eposta,setEposta]=useState('');
 const uid=auth.currentUser?.uid;const donemYili=Number(route.params?.donemYili||donemYiliBugun());
 useEffect(()=>{ogrencileriYukle();siniflariYukle()},[sinif?.id,donemYili]);
 const ogrencileriYukle=async()=>{setYukleniyor(true);try{const q=query(collection(db,'ogrenciler'),where('sinifId','==',sinif.id),where('uid','==',uid));const snap=await getDocs(q);setOgrenciler(snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>donemUygun(x,donemYili)).sort((a,b)=>(a.olusturulma||'').localeCompare(b.olusturulma||'')))}catch(e){Alert.alert('Hata','Öğrenciler yüklenemedi.')}setYukleniyor(false)};
 const siniflariYukle=async()=>{try{const q=query(collection(db,'siniflar'),where('uid','==',uid));const s=await getDocs(q);setSiniflar(s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>donemUygun(x,donemYili)&&!x.ozelTur&&!x.arsivlendi).filter(x=>x.id!==sinif.id))}catch(e){}};
 const formAc=(o=null)=>{setDuzenlenen(o);setAd(o?.ad||'');setSoyad(o?.soyad||'');setTelefon(o?.telefon||'');setEposta(o?.eposta||'');setModalAcik(true)};
 const formKapat=()=>{setModalAcik(false);setDuzenlenen(null);setAd('');setSoyad('');setTelefon('');setEposta('')};
 const ogrenciKaydet=async()=>{if(!donemDuzenlemeyeAcik(donemYili))return Alert.alert('Geçmiş dönem','Dönem sona erdiği için öğrenci kayıtları yalnızca görüntülenebilir.');if(!ad.trim()||!soyad.trim())return Alert.alert('Hata','Ad ve soyad zorunludur.');try{const data={ad:ad.trim(),soyad:soyad.trim(),adSoyad:`${ad.trim()} ${soyad.trim()}`,telefon:telefon.trim(),eposta:eposta.trim().toLocaleLowerCase('en-US')};if(duzenlenen)await updateDoc(doc(db,'ogrenciler',duzenlenen.id),data);else await addDoc(collection(db,'ogrenciler'),{...data,sinifId:sinif.id,sinifAd:sinif.ad,okulId:sinif.okulId,okulAd:sinif.okulAd,uid,donemYili,olusturulma:new Date().toISOString()});formKapat();ogrencileriYukle()}catch(e){Alert.alert('Hata','Öğrenci kaydedilemedi.')}};
 const ogrenciSil = o => {
  if (!donemDuzenlemeyeAcik(donemYili)) return Alert.alert('Geçmiş dönem', 'Dönem sona erdiği için öğrenci sınıfı değiştirilemez.');
  Alert.alert(
    'Öğrenciyi kayıtsızlara taşı',
    'Öğrenci kaydı ve geçmişi silinmeyecek. Öğrenci, aynı okul içindeki “Kayıtsız Öğrenciler” sınıfına taşınacak; eski yoklama, ödev, kitap ve konu kayıtları korunacak.',
    [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Kayıtsızlara taşı', style: 'destructive', onPress: async () => {
        try {
          const ogrenciRef = doc(db, 'ogrenciler', o.id);
          const ogrenciSnap = await getDoc(ogrenciRef);
          if (!ogrenciSnap.exists()) throw new Error('Öğrenci kaydı bulunamadı.');
          const guncel = ogrenciSnap.data();
          if (guncel.uid !== uid) throw new Error('Bu öğrenci kaydının sahibi doğrulanamadı.');

          const sinifSnap = await getDocs(query(collection(db, 'siniflar'), where('uid', '==', uid)));
          const kayitsizlar = sinifSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          let islem = guncel.kayitsizTasiIslemi;
          let hedef = null;

          if (islem) {
            if (islem.kaynakSinifId !== sinif.id || Number(islem.donemYili) !== donemYili) {
              throw new Error('Bu öğrenci için yarım kalmış başka bir taşıma işlemi var. Önce aynı işlemi tamamlayın.');
            }
            hedef = kayitsizlar.find(x => x.id === islem.hedefSinifId) || null;
          } else {
            if (guncel.sinifId !== sinif.id) {
              if (guncel.kayitsizMi) {
                Alert.alert('Bilgi', 'Öğrenci zaten kayıtsız öğrenci olarak kayıtlı.');
                return;
              }
              throw new Error('Öğrencinin sınıfı değişmiş. Listeyi yenileyip tekrar deneyin.');
            }
            if (guncel.sinifTasiIslemi) {
              throw new Error('Öğrenci için başka bir sınıf taşıma işlemi sürüyor. Önce onu tamamlayın.');
            }
            hedef = kayitsizlar.find(x => x.ozelTur === 'kayitsiz' && x.okulId === (sinif.okulId || '') && Number(x.donemYili) === donemYili) || null;
            if (!hedef) {
              const ref = await addDoc(collection(db, 'siniflar'), {
                ad: 'Kayıtsız Öğrenciler', kademe: '', ders: '',
                okulId: sinif.okulId || '', okulAd: sinif.okulAd || '',
                uid, donemYili, ozelTur: 'kayitsiz', olusturulma: new Date().toISOString(),
              });
              hedef = { id: ref.id, ad: 'Kayıtsız Öğrenciler', okulId: sinif.okulId || '', okulAd: sinif.okulAd || '', ozelTur: 'kayitsiz' };
            }
            islem = {
              kaynakSinifId: sinif.id,
              hedefSinifId: hedef.id,
              donemYili,
              tarih: new Date().toISOString(),
            };
            await updateDoc(ogrenciRef, { kayitsizTasiIslemi: islem });
          }

          if (!hedef) {
            const hedefSnap = await getDoc(doc(db, 'siniflar', islem.hedefSinifId));
            if (!hedefSnap.exists() || hedefSnap.get('uid') !== uid || hedefSnap.get('ozelTur') !== 'kayitsiz') {
              throw new Error('Hedef Kayıtsız Öğrenciler sınıfı doğrulanamadı. İşlem tekrar denenebilir.');
            }
            hedef = { id: hedefSnap.id, ...hedefSnap.data() };
          }

          const sonDurum = (await getDoc(ogrenciRef)).data();
          if (sonDurum.sinifId !== sinif.id && sonDurum.sinifId !== hedef.id) {
            throw new Error('Öğrenci başka bir sınıfa taşınmış. Listeyi yenileyin.');
          }
          await updateDoc(ogrenciRef, {
            sinifGecmisi: arrayUnion({
              sinifId: islem.kaynakSinifId,
              sinifAd: o.sinifAd || sinif.ad,
              okulId: o.okulId || sinif.okulId || '',
              okulAd: o.okulAd || sinif.okulAd || '',
              donemYili,
              tarih: islem.tarih,
              neden: 'kayitsizlara_tasima',
            }),
            sinifId: hedef.id,
            sinifAd: hedef.ad,
            okulId: hedef.okulId || '',
            okulAd: hedef.okulAd || '',
            kademe: '',
            brans: '',
            kayitsizMi: true,
            kayitsizTarihi: islem.tarih,
            kayitsizTasiIslemi: deleteField(),
          });
          await ogrencileriYukle();
          Alert.alert('Tamamlandı', 'Öğrenci kaydı korunarak Kayıtsız Öğrenciler sınıfına taşındı.');
        } catch (e) {
          Alert.alert('Hata', 'Öğrenci kayıtsızlara taşınamadı. Aynı işlem yeniden denenebilir. ' + (e?.message || ''));
        }
      }},
    ],
  );
 };
 const ogrenciTasi=async(o,yeniSinif)=>{
  if(!donemDuzenlemeyeAcik(donemYili))return Alert.alert('Geçmiş dönem','Dönem sona erdiği için öğrenci sınıfı değiştirilemez.');
  if(!o||!yeniSinif)return;
  try{
   const ogrenciRef=doc(db,'ogrenciler',o.id);
   const ogrenciSnap=await getDoc(ogrenciRef);
   if(!ogrenciSnap.exists())throw new Error('Öğrenci kaydı bulunamadı.');
   const guncel=ogrenciSnap.data();
   if(guncel.uid!==uid||guncel.sinifId!==sinif.id)throw new Error('Öğrencinin sınıf bilgisi değişmiş. Listeyi yenileyip tekrar deneyin.');
   if(guncel.kayitsizTasiIslemi)throw new Error('Öğrenci için kayıtsızlara taşıma işlemi sürüyor. Önce aynı işlemi tamamlayın.');
   let islem=guncel.sinifTasiIslemi;
   if(islem){
    if(islem.hedefSinifId!==yeniSinif.id||islem.kaynakSinifId!==sinif.id||Number(islem.donemYili)!==donemYili)
     throw new Error('Bu öğrenci için yarım kalmış başka bir sınıf taşıma işlemi var. Önce aynı hedef sınıfa taşıma işlemini tekrar deneyin.');
   }else{
    islem={kaynakSinifId:sinif.id,hedefSinifId:yeniSinif.id,donemYili,tarih:new Date().toISOString()};
    await updateDoc(ogrenciRef,{sinifTasiIslemi:islem});
   }
   const [bk,kn]=await Promise.all([
    getDocs(query(collection(db,'kitaplar'),where('ogrenciId','==',o.id),where('uid','==',uid))),
    getDocs(query(collection(db,'konular'),where('ogrenciId','==',o.id),where('uid','==',uid)))
   ]);
   for(const x of bk.docs){
    const d=x.data();
    if(donemUygun(d,donemYili))await updateDoc(x.ref,{sinifId:yeniSinif.id,sinifAd:yeniSinif.ad,okulId:yeniSinif.okulId||'',okulAd:yeniSinif.okulAd||'',kademe:yeniSinif.kademe||d.kademe||'',brans:yeniSinif.ders||d.brans||''});
   }
   for(const x of kn.docs){
    const d=x.data();
    if(donemUygun(d,donemYili))await updateDoc(x.ref,{sinifId:yeniSinif.id,sinifAd:yeniSinif.ad,okulId:yeniSinif.okulId||'',okulAd:yeniSinif.okulAd||'',kademe:yeniSinif.kademe||d.kademe||'',brans:yeniSinif.ders||d.brans||''});
   }
   await updateDoc(ogrenciRef,{
    sinifGecmisi:arrayUnion({sinifId:sinif.id,sinifAd:o.sinifAd||sinif.ad,okulId:o.okulId||sinif.okulId||'',okulAd:o.okulAd||sinif.okulAd||'',donemYili,tarih:islem.tarih,neden:'sinif_degisikligi'}),
    sinifId:yeniSinif.id,sinifAd:yeniSinif.ad,okulId:yeniSinif.okulId||'',okulAd:yeniSinif.okulAd||'',kademe:yeniSinif.kademe||'',brans:yeniSinif.ders||'',kayitsizMi:!!yeniSinif.ozelTur,
    sinifTasiIslemi:deleteField()
   });
   setTasimaci(null);setTasimaModal(false);
   await ogrencileriYukle();
   Alert.alert('Tamam','Öğrenci yeni sınıfa taşındı. Geçmiş dönem kitap ve konu kayıtları değiştirilmedi.');
  }catch(e){
   Alert.alert('Hata','Öğrenci taşınamadı. İşlem yarıda kaldıysa aynı hedef sınıfı yeniden seçerek güvenle devam edebilirsiniz. '+(e?.message||''));
  }
 };
 if(yukleniyor)return <ActivityIndicator style={{flex:1}} size="large" color="#2E7D32"/>;
 return <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS==='ios'?'padding':'height'}><View style={s.header}><Text style={s.title}>{sinif?.ad} - Öğrenciler</Text><Text style={s.school}>{sinif?.okulAd||'Okul belirtilmemiş'}{sinif?.kademe?` • ${sinif.kademe}. Sınıf`:''}{sinif?.ders?` • ${sinif.ders}`:''}</Text></View><ScrollView contentContainerStyle={{padding:12,paddingBottom:150}}>{!ogrenciler.length&&<Text style={s.empty}>Henüz öğrenci eklenmemiş.</Text>}{ogrenciler.map((o,i)=><View key={o.id} style={s.card}><TouchableOpacity style={s.main} onPress={()=>navigation.navigate('Rapor',{sinif,ogrenci:o,donemYili})}><View style={s.num}><Text style={s.numT}>{i+1}</Text></View><View style={{flex:1}}><Text style={s.name}>{o.adSoyad}</Text>{o.telefon?<Text style={s.phone}>📞 {o.telefon}</Text>:null}<Text style={s.reportHint}>Raporlar ›</Text></View><Text style={s.arrow}>›</Text></TouchableOpacity><View style={s.actions}><TouchableOpacity style={s.editBtn} onPress={()=>formAc(o)}><Text style={s.editT}>✏️ Düzenle</Text></TouchableOpacity><TouchableOpacity style={s.moveBtn} onPress={()=>{setTasimaci(o);setTasimaModal(true)}}><Text style={s.moveT}>↔️ Sınıf Değiştir</Text></TouchableOpacity>{!sinif?.ozelTur&&<TouchableOpacity style={s.delBtn} onPress={()=>ogrenciSil(o)}><Text style={s.delT}>📦 Kayıtsızlara Taşı</Text></TouchableOpacity>}</View></View>)}</ScrollView>{!sinif?.ozelTur&&!sinif?.arsivlendi&&<TouchableOpacity style={s.add} onPress={()=>formAc()}><Text style={s.addT}>+ Öğrenci Ekle</Text></TouchableOpacity>}
 <Modal visible={modalAcik} transparent animationType="slide"><View style={s.bg}><View style={s.form}><Text style={s.formTitle}>{duzenlenen?'Öğrenciyi Düzenle':'Öğrenci Ekle'}</Text><TextInput style={s.input} placeholder="Ad" value={ad} onChangeText={setAd} autoCapitalize="words"/><TextInput style={s.input} placeholder="Soyad" value={soyad} onChangeText={setSoyad} autoCapitalize="words"/><TextInput style={s.input} placeholder="Telefon (isteğe bağlı)" value={telefon} onChangeText={setTelefon} keyboardType="phone-pad"/><TextInput style={s.input} placeholder="Öğrenci e-posta adresi (hesap eşleştirme için)" value={eposta} onChangeText={setEposta} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}/><TouchableOpacity style={s.save} onPress={ogrenciKaydet}><Text style={s.saveT}>{duzenlenen?'Güncelle':'Kaydet'}</Text></TouchableOpacity><TouchableOpacity style={s.cancel} onPress={formKapat}><Text>İptal</Text></TouchableOpacity></View></View></Modal>
 <Modal visible={tasimaModal} transparent animationType="slide"><View style={s.bg}><View style={s.form}><Text style={s.formTitle}>Öğrenciyi Sınıfa Taşı</Text><Text style={s.modalSub}>{tasimaci?.adSoyad} için yeni sınıf seçin.</Text><ScrollView style={{maxHeight:360}}>{siniflar.map(x=><TouchableOpacity key={x.id} style={s.classRow} onPress={()=>ogrenciTasi(tasimaci,x)}><Text style={s.className}>{x.ad}</Text><Text style={s.modalSub}>{x.okulAd||'Okul belirtilmemiş'}{x.kademe?` • ${x.kademe}. Sınıf`:''}{x.ders?` • ${x.ders}`:''}</Text></TouchableOpacity>)}{!siniflar.length&&<Text style={s.empty}>Taşınabilecek başka sınıf yok.</Text>}</ScrollView><TouchableOpacity style={s.cancel} onPress={()=>setTasimaModal(false)}><Text>İptal</Text></TouchableOpacity></View></View></Modal></KeyboardAvoidingView>;
}
const s=StyleSheet.create({wrap:{flex:1,backgroundColor:'#F1F8E9'},header:{backgroundColor:'#2E7D32',padding:16},title:{color:'#fff',fontSize:18,fontWeight:'bold'},school:{color:'#C8E6C9',fontSize:12,marginTop:3},card:{backgroundColor:'#fff',borderRadius:12,padding:12,marginBottom:9,elevation:2},main:{flexDirection:'row',alignItems:'center'},num:{width:32,height:32,borderRadius:16,backgroundColor:'#E8F5E9',alignItems:'center',justifyContent:'center',marginRight:10},numT:{color:'#2E7D32',fontWeight:'bold'},name:{fontSize:15,fontWeight:'600',color:'#1B5E20'},phone:{fontSize:11,color:'#888',marginTop:2},reportHint:{fontSize:10,color:'#1565C0',marginTop:3},arrow:{fontSize:25,color:'#bbb'},actions:{flexDirection:'row',gap:6,marginTop:10},editBtn:{flex:1,backgroundColor:'#E3F2FD',padding:9,borderRadius:8,alignItems:'center'},editT:{color:'#1565C0',fontSize:11,fontWeight:'600'},moveBtn:{flex:1,backgroundColor:'#FFF8E1',padding:9,borderRadius:8,alignItems:'center'},moveT:{color:'#F57F17',fontSize:11,fontWeight:'600'},delBtn:{flex:.7,backgroundColor:'#FFEBEE',padding:9,borderRadius:8,alignItems:'center'},delT:{color:'#C62828',fontSize:11,fontWeight:'600'},empty:{textAlign:'center',color:'#999',padding:28},add:{position:'absolute',left:12,right:12,bottom:78,backgroundColor:'#2E7D32',borderRadius:12,padding:16,alignItems:'center'},addT:{color:'#fff',fontWeight:'bold'},bg:{flex:1,backgroundColor:'rgba(0,0,0,.5)',justifyContent:'center',padding:20},form:{backgroundColor:'#fff',borderRadius:18,padding:20,maxHeight:'88%'},formTitle:{fontSize:19,fontWeight:'bold',color:'#1B5E20',marginBottom:14},input:{borderWidth:1,borderColor:'#C8E6C9',borderRadius:10,padding:12,fontSize:16,marginBottom:10},save:{backgroundColor:'#2E7D32',padding:14,borderRadius:10,alignItems:'center',marginTop:5},saveT:{color:'#fff',fontWeight:'bold'},cancel:{padding:13,alignItems:'center'},modalSub:{fontSize:12,color:'#777',marginBottom:8},classRow:{backgroundColor:'#F9FBE7',borderRadius:10,padding:13,marginBottom:7,borderWidth:1,borderColor:'#E8F5E9'},className:{fontSize:15,fontWeight:'bold',color:'#1B5E20'}});