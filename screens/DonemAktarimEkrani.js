import React,{useEffect,useMemo,useState}from'react';
import{View,Text,TouchableOpacity,ScrollView,StyleSheet,Alert,ActivityIndicator}from'react-native';
import{collection,getDocs,query,where}from'firebase/firestore';
import{httpsCallable}from'firebase/functions';
import{auth,db,functions}from'../firebaseConfig';
import{donemYiliBugun,donemUygun,donemDuzenlemeyeAcik}from'../utils/donem';

const KADEMELER=['1','2','3','4','5','6','7','8','9','10','11','12','TYT','AYT'];
const nextGrade=value=>{const v=String(value||'').toUpperCase();if(['12','TYT','AYT'].includes(v))return'TYT';const n=Number(v);return Number.isInteger(n)&&n>=1&&n<12?String(n+1):'9';};

export default function DonemAktarimEkrani({route}){
 const targetYear=Number(route?.params?.donemYili||donemYiliBugun());
 const sourceYear=targetYear-1;
 const uid=auth.currentUser?.uid;
 const[schools,setSchools]=useState([]);
 const[classes,setClasses]=useState([]);
 const[students,setStudents]=useState([]);
 const[books,setBooks]=useState([]);
 const[selected,setSelected]=useState({});
 const[selectedClasses,setSelectedClasses]=useState([]);
 const[selectedBooks,setSelectedBooks]=useState({});
 const[grades,setGrades]=useState({});
 const[loading,setLoading]=useState(true);
 const[sending,setSending]=useState(false);
 const[done,setDone]=useState(null);

 useEffect(()=>{load()},[uid,sourceYear]);
 const load=async()=>{
  if(!uid)return;
  setLoading(true);
  try{
   const [a,b,c,d]=await Promise.all([
    getDocs(query(collection(db,'okullar'),where('uid','==',uid))),
    getDocs(query(collection(db,'siniflar'),where('uid','==',uid))),
    getDocs(query(collection(db,'ogrenciler'),where('uid','==',uid))),
    getDocs(query(collection(db,'kitaplar'),where('uid','==',uid))),
   ]);
   const ss=a.docs.map(d=>({id:d.id,...d.data()})).filter(x=>donemUygun(x,sourceYear)&&!x.arsivlendi&&x.arsivDurumu!=='isleniyor');
   const cs=b.docs.map(d=>({id:d.id,...d.data()})).filter(x=>donemUygun(x,sourceYear)&&!x.arsivlendi&&x.arsivDurumu!=='isleniyor'&&!x.ozelTur);
   const os=c.docs.map(d=>({id:d.id,...d.data()})).filter(x=>donemUygun(x,sourceYear));
   const bs=d.docs.map(x=>({id:x.id,...x.data()})).filter(x=>donemUygun(x,sourceYear));
   setSchools(ss);setClasses(cs);setStudents(os);setBooks(bs);
   const initial={};const initialGrades={};
   for(const cls of cs){initialGrades[cls.id]=nextGrade(cls.kademe);}
   setSelected(initial);setSelectedClasses([]);setSelectedBooks({});setGrades(initialGrades);
  }catch(e){Alert.alert('Yükleme hatası','Kaynak dönem kayıtları yüklenemedi. '+(e?.message||''))}
  finally{setLoading(false)}
 };
 const schoolMap=useMemo(()=>new Map(schools.map(x=>[x.id,x])),[schools]);
 const selectedCount=Object.values(selected).reduce((n,ids)=>n+ids.length,0);
 const selectedBookCount=Object.values(selectedBooks).reduce((n,ids)=>n+ids.length,0);
 const toggleStudent=(classId,studentId)=>{
  const removing=(selected[classId]||[]).includes(studentId);
  setSelected(prev=>{const current=prev[classId]||[];const next=removing?current.filter(x=>x!==studentId):[...current,studentId];return {...prev,[classId]:next};});
  if(!removing)setSelectedClasses(prev=>prev.includes(classId)?prev:[...prev,classId]);
  if(removing)setSelectedBooks(prev=>({...prev,[classId]:(prev[classId]||[]).filter(bookId=>books.find(b=>b.id===bookId)?.ogrenciId!==studentId)}));
 };
 const toggleBook=(classId,bookId)=>setSelectedBooks(prev=>{const current=prev[classId]||[];return {...prev,[classId]:current.includes(bookId)?current.filter(x=>x!==bookId):[...current,bookId]};});
 const toggleClass=cls=>{
  const active=selectedClasses.includes(cls.id);
  setSelectedClasses(prev=>active?prev.filter(x=>x!==cls.id):[...prev,cls.id]);
  if(active){setSelected(prev=>({...prev,[cls.id]:[]}));setSelectedBooks(prev=>({...prev,[cls.id]:[]}));}
 };
 const toggleAll=(cls,list)=>{
  const current=selected[cls.id]||[];
  const clear=current.length===list.length&&selectedClasses.includes(cls.id);
  setSelectedClasses(prev=>clear?prev.filter(x=>x!==cls.id):(prev.includes(cls.id)?prev:[...prev,cls.id]));
  setSelected(prev=>({...prev,[cls.id]:clear?[]:list.map(x=>x.id)}));
  if(clear)setSelectedBooks(prev=>({...prev,[cls.id]:[]}));
 };
 const start=async()=>{
  const chosen=classes.filter(x=>selectedClasses.includes(x.id));
  if(!chosen.length)return Alert.alert('Seçim gerekli','Aktarılacak en az bir sınıf seçin.');
  if(selectedCount>500)return Alert.alert('Seçim sınırı','Tek aktarımda en fazla 500 öğrenci seçilebilir.');
  if(!donemDuzenlemeyeAcik(targetYear))return Alert.alert('Hedef dönem kapalı',`${targetYear}/${targetYear+1} dönemi henüz başlamadı veya düzenlemeye kapalı. Aktarım hedef dönemin 1 Haziran–30 Haziran düzenleme aralığında yapılabilir.`);
  const schoolCount=new Set(chosen.map(x=>x.okulId).filter(Boolean)).size;
  Alert.alert('Dönem aktarımını başlat',`${sourceYear}/${sourceYear+1} döneminden ${targetYear}/${targetYear+1} dönemine ${schoolCount} okul, ${chosen.length} sınıf, ${selectedCount} öğrenci ve ${selectedBookCount} kitap ataması aktarılacak. Eski dönem kayıtları değiştirilmeyecek. Öğrencilerin eski yoklama, ödev ve ders geçmişi kopyalanmayacak. Yalnızca seçtiğiniz öğrenci kitapları ve konu sayfa aralıkları aktarılacak; yeni dönem ilerlemesi sıfırdan başlayacak. Öğretmenin ortak kitap kütüphanesi zaten dönemden bağımsızdır. Aynı seçimle tekrar deneme mükerrer kayıt oluşturmaz; daha sonra farklı seçim yapılırsa yeni kayıtlar eklenir, önceden aktarılan kayıtlar otomatik silinmez. Devam edilsin mi?`,[
   {text:'Vazgeç',style:'cancel'},
   {text:'Aktarımı başlat',onPress:async()=>{
    setSending(true);setDone(null);
    try{
     const call=httpsCallable(functions,'ogretmenDonemAktariminiBaslat');
     const result=await call({sourceYear,targetYear,classes:chosen.map(cls=>({sourceClassId:cls.id,targetGrade:grades[cls.id]||nextGrade(cls.kademe),studentIds:selected[cls.id],bookIds:selectedBooks[cls.id]||[]}))});
     setDone(result.data);
     Alert.alert('Aktarım tamamlandı',`${result.data.okulSayisi} okul, ${result.data.sinifSayisi} sınıf, ${result.data.ogrenciSayisi} öğrenci, ${result.data.kitapSayisi} kitap, ${result.data.konuSayisi} konu ve ${result.data.baglantiSayisi||0} öğrenci hesap bağlantısı yeni döneme aktarıldı.`);
    }catch(e){Alert.alert('Aktarım tamamlanamadı',e?.message||'İşlem sırasında hata oluştu. Tamamlanan kayıtlar korunur; aynı seçimlerle tekrar denendiğinde aktarım kimlikleri yinelenen kayıt oluşturmaz.')}
    finally{setSending(false)}
   }}
  ]);
 };
 if(loading)return <ActivityIndicator style={{flex:1}} size="large" color="#2E7D32"/>;
 const targetOpen=donemDuzenlemeyeAcik(targetYear);
 return <View style={s.root}>
  <View style={s.header}>
   <Text style={s.title}>Yeni Döneme Aktarım</Text>
   <Text style={s.sub}>{sourceYear}/{sourceYear+1} → {targetYear}/{targetYear+1}</Text>
   <Text style={s.info}>Okul ve sınıflar seçtiğiniz öğrencilerle birlikte yeni dönemde kopyalanır. Öğrencilerin kitapları ve konu sayfa aralıkları da aktarılır. Eski dönem kayıtları değiştirilmez.</Text>
  </View>
  <ScrollView contentContainerStyle={{padding:14,paddingBottom:130}}>
   {!targetOpen&&<View style={s.notice}><Text style={s.noticeText}>Aktarım, hedef dönemin düzenlemeye açıldığı 1 Haziran tarihinde etkinleşir. Şu anda seçimleri inceleyebilirsiniz.</Text></View>}
   {!classes.length&&<Text style={s.empty}>Kaynak {sourceYear}/{sourceYear+1} döneminde aktarılabilecek sınıf bulunamadı.</Text>}
   {classes.map(cls=>{
    const school=schoolMap.get(cls.okulId);
    const list=students.filter(x=>x.sinifId===cls.id);
    const chosen=selected[cls.id]||[];
    const classChosen=selectedClasses.includes(cls.id);
    const fixed=['12','TYT','AYT'].includes(String(cls.kademe||'').toUpperCase());
    const selectedBookIds=selectedBooks[cls.id]||[];
    return <View key={cls.id} style={s.card}>
     <Text style={s.school}>{school?.ad||cls.okulAd||'Okul bilgisi yok'}</Text>
     <TouchableOpacity style={s.classSelect} onPress={()=>toggleClass(cls)}><View style={[s.check,classChosen&&s.checkOn]}>{classChosen&&<Text style={s.checkMark}>✓</Text>}</View><Text style={s.className}>{cls.ad} • {cls.kademe||'Kademe yok'} • {cls.ders||'Ders yok'}</Text></TouchableOpacity>
     {classChosen&&<><View style={s.row}>
      <Text style={s.label}>Yeni dönem kademesi: {fixed?'TYT (sabit)':''}</Text>
      {!fixed&&<ScrollView horizontal showsHorizontalScrollIndicator={false}>{KADEMELER.filter(x=>!['TYT','AYT'].includes(x)).map(g=><TouchableOpacity key={g} style={[s.grade,(grades[cls.id]||nextGrade(cls.kademe))===g&&s.gradeOn]} onPress={()=>setGrades(p=>({...p,[cls.id]:g}))}><Text style={[s.gradeText,(grades[cls.id]||nextGrade(cls.kademe))===g&&s.gradeTextOn]}>{g}</Text></TouchableOpacity>)}</ScrollView>}
     </View>
     {fixed&&<Text style={s.fixed}>12. sınıf, TYT ve AYT kaynak grupları TYT olarak aktarılır.</Text>}
     <View style={s.row}>
      <Text style={s.label}>Öğrenciler ({chosen.length}/{list.length})</Text>
      <TouchableOpacity onPress={()=>toggleAll(cls,list)}><Text style={s.selectAll}>{selectedClasses.includes(cls.id)&&chosen.length===list.length?'Seçimi kaldır':'Tümünü seç'}</Text></TouchableOpacity>
     </View>
     {list.map(st=>{const assignedBooks=books.filter(b=>b.ogrenciId===st.id&&b.sinifId===cls.id);return <View key={st.id} style={s.studentBlock}>
      <TouchableOpacity style={s.student} onPress={()=>toggleStudent(cls.id,st.id)}>
       <View style={[s.check,chosen.includes(st.id)&&s.checkOn]}>{chosen.includes(st.id)&&<Text style={s.checkMark}>✓</Text>}</View>
       <Text style={s.studentName}>{st.adSoyad||[st.ad,st.soyad].filter(Boolean).join(' ')}</Text>
      </TouchableOpacity>
      {chosen.includes(st.id)&&assignedBooks.map(book=><TouchableOpacity key={book.id} style={s.bookRow} onPress={()=>toggleBook(cls.id,book.id)}>
       <View style={[s.bookCheck,selectedBookIds.includes(book.id)&&s.checkOn]}>{selectedBookIds.includes(book.id)&&<Text style={s.checkMark}>✓</Text>}</View>
       <Text style={s.bookText}>📘 {book.ad||'Kitap'} ({book.sayfaSayisi||'?'} sayfa)</Text>
      </TouchableOpacity>)}
      {chosen.includes(st.id)&&!assignedBooks.length&&<Text style={s.emptySmall}>Bu öğrencinin kaynak dönemde atanmış kitabı yok.</Text>}
     </View>})}
     {!list.length&&<Text style={s.emptySmall}>Bu sınıfta aktarılabilir öğrenci yok. Sınıf boş olarak aktarılabilir.</Text>}
     </>}
    </View>
   })}
   {done&&<View style={s.done}><Text style={s.doneTitle}>Son aktarım tamamlandı</Text><Text style={s.doneText}>{done.okulSayisi} okul • {done.sinifSayisi} sınıf • {done.ogrenciSayisi} öğrenci • {done.kitapSayisi} kitap • {done.konuSayisi} konu</Text></View>}
  </ScrollView>
  <View style={s.footer}>
   <Text style={s.counter}>{selectedClasses.length} sınıf • {selectedCount} öğrenci • {selectedBookCount} kitap seçildi</Text>
   <TouchableOpacity style={[s.button,(!targetOpen||!selectedClasses.length||sending)&&s.buttonOff]} disabled={!targetOpen||!selectedClasses.length||sending} onPress={start}>
    {sending?<ActivityIndicator color="#fff"/>:<Text style={s.buttonText}>Seçilenleri yeni döneme aktar</Text>}
   </TouchableOpacity>
  </View>
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#F1F8E9'},header:{backgroundColor:'#2E7D32',padding:17},title:{fontSize:20,fontWeight:'bold',color:'#fff'},sub:{fontSize:15,color:'#E8F5E9',marginTop:4,fontWeight:'700'},info:{fontSize:12,color:'#E8F5E9',lineHeight:18,marginTop:8},
 card:{backgroundColor:'#fff',borderRadius:13,padding:14,marginBottom:12,elevation:2},school:{fontSize:12,color:'#558B2F',fontWeight:'700'},classSelect:{flexDirection:'row',alignItems:'center'},className:{fontSize:16,color:'#1B5E20',fontWeight:'bold',marginTop:3,marginBottom:10,flex:1},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:9,marginBottom:6},label:{fontSize:13,color:'#455A64',fontWeight:'700'},grade:{paddingVertical:7,paddingHorizontal:11,borderWidth:1,borderColor:'#C8E6C9',borderRadius:8,marginRight:6},gradeOn:{backgroundColor:'#2E7D32',borderColor:'#2E7D32'},gradeText:{color:'#2E7D32',fontWeight:'700'},gradeTextOn:{color:'#fff'},fixed:{fontSize:11,color:'#EF6C00',marginBottom:8},studentBlock:{borderTopWidth:1,borderTopColor:'#F1F5F0'},student:{flexDirection:'row',alignItems:'center',paddingVertical:9},bookRow:{flexDirection:'row',alignItems:'center',paddingVertical:6,paddingLeft:30},bookCheck:{width:17,height:17,borderRadius:4,borderWidth:1,borderColor:'#90A4AE',marginRight:8,alignItems:'center',justifyContent:'center'},bookText:{fontSize:12,color:'#546E7A'},check:{width:20,height:20,borderRadius:5,borderWidth:1,borderColor:'#90A4AE',marginRight:10,alignItems:'center',justifyContent:'center'},checkOn:{backgroundColor:'#2E7D32',borderColor:'#2E7D32'},checkMark:{color:'#fff',fontWeight:'bold'},studentName:{fontSize:14,color:'#263238'},selectAll:{color:'#1565C0',fontSize:12,fontWeight:'700'},empty:{color:'#78909C',textAlign:'center',padding:24},emptySmall:{color:'#90A4AE',fontSize:12,paddingVertical:8},notice:{backgroundColor:'#FFF8E1',borderRadius:10,padding:12,marginBottom:12},noticeText:{color:'#795548',fontSize:12,lineHeight:18},done:{backgroundColor:'#E8F5E9',borderRadius:10,padding:12},doneTitle:{color:'#1B5E20',fontWeight:'bold'},doneText:{color:'#33691E',fontSize:12,marginTop:4},footer:{position:'absolute',left:0,right:0,bottom:0,backgroundColor:'#fff',padding:13,borderTopWidth:1,borderTopColor:'#E0E0E0'},counter:{textAlign:'center',fontSize:12,color:'#546E7A',marginBottom:8},button:{backgroundColor:'#2E7D32',borderRadius:10,padding:15,alignItems:'center'},buttonOff:{backgroundColor:'#A5BFA6'},buttonText:{color:'#fff',fontWeight:'bold'}
});
