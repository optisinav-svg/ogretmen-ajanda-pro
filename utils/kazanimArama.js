import kazanmlar from '../assets/kazanimlar.json';

const normalize = value =>
  String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

let kazanımIndex;
let dersListesi;

function getKazanımIndex() {
  if (kazanımIndex) return kazanımIndex;

  const index = new Map();
  for (const kayit of kazanmlar) {
    if (!kayit?.ders || kayit?.sinif == null) continue;
    const key = normalize(kayit.ders) + '|' + String(kayit.sinif);
    let group = index.get(key);
    if (!group) {
      group = [];
      index.set(key, group);
    }
    group.push({
      kayit,
      aramaMetni: normalize((kayit.kod || '') + ' ' + (kayit.ad || '')),
    });
  }
  kazanımIndex = index;
  return index;
}

export function kazanimDersleri() {
  if (!dersListesi) {
    dersListesi = [...new Set(kazanmlar.map(x => x?.ders).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'tr'));
  }
  return dersListesi;
}

export function araKazanimlar({ ders, sinifKodlari = [], arama = '', limit = 80 }) {
  const term = normalize(String(arama).trim());
  if (!ders || !term || !sinifKodlari.length) return [];

  const index = getKazanımIndex();
  const prefix = normalize(ders) + '|';
  const results = [];

  for (const grade of sinifKodlari) {
    const group = index.get(prefix + String(grade)) || [];
    for (const item of group) {
      if (item.aramaMetni.includes(term)) {
        results.push(item.kayit);
        if (results.length >= limit) return results;
      }
    }
  }
  return results;
}
