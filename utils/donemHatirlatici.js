import AsyncStorage from '@react-native-async-storage/async-storage';

export const DONEM_HATIRLATMA_GUN = 5;
const DONEM_HATIRLATMA_KEY = '@ogretmenAjandaPro_donemHatirlatma';

export const donemHatirlatmaAnahtari = (uid, rol, yil) =>
  `${DONEM_HATIRLATMA_KEY}_${rol}_${uid}_${Number(yil)}`;

export const donemHatirlatmaGerekli = (sonHatirlatma, bugun = new Date()) => {
  if (!sonHatirlatma) return true;
  const onceki = new Date(sonHatirlatma);
  if (Number.isNaN(onceki.getTime())) return true;
  return bugun.getTime() - onceki.getTime() >= DONEM_HATIRLATMA_GUN * 24 * 60 * 60 * 1000;
};

export const donemHatirlatmaGosterilebilir = async (uid, rol, yil, bugun = new Date()) => {
  if (!uid || !['ogretmen', 'ogrenci'].includes(rol)) return false;
  try {
    const key = donemHatirlatmaAnahtari(uid, rol, yil);
    const son = await AsyncStorage.getItem(key);
    return donemHatirlatmaGerekli(son, bugun);
  } catch (error) {
    return true;
  }
};

export const donemHatirlatmaKaydet = async (uid, rol, yil, bugun = new Date()) => {
  if (!uid || !['ogretmen', 'ogrenci'].includes(rol)) return;
  try {
    await AsyncStorage.setItem(donemHatirlatmaAnahtari(uid, rol, yil), bugun.toISOString());
  } catch (error) {}
};
