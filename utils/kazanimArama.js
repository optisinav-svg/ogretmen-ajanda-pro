import kazanmlar from '../assets/kazanimlar.json';

const normalize = value =>
  String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

let kazanımIndex;

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

  for (const group of index.values()) {
    group.sort((a, b) =>
      String(a.kayit.kod || '').localeCompare(String(b.kayit.kod || ''), 'tr', {
        numeric: true,
        sensitivity: 'base',
      }),
    );
  }

  kazanımIndex = index;
  return index;
}

export function listeleKazanimlar({ ders, sinifKodlari = [], arama = '', limit = Infinity }) {
  if (!ders || !sinifKodlari.length) return [];

  const term = normalize(String(arama).trim());
  const index = getKazanımIndex();
  const prefix = normalize(ders) + '|';
  const results = [];
  const seen = new Set();

  for (const grade of sinifKodlari) {
    const group = index.get(prefix + String(grade)) || [];
    for (const item of group) {
      const identity = String(item.kayit.sinif) + '|' + String(item.kayit.kod || '') + '|' + String(item.kayit.ad || '');
      if (seen.has(identity)) continue;
      if (term && !item.aramaMetni.includes(term)) continue;
      seen.add(identity);
      results.push(item.kayit);
    }
  }

  results.sort((a, b) =>
    String(a.kod || '').localeCompare(String(b.kod || ''), 'tr', {
      numeric: true,
      sensitivity: 'base',
    }),
  );

  return Number.isFinite(limit) ? results.slice(0, Math.max(0, limit)) : results;
}

export function araKazanimlar({ ders, sinifKodlari = [], arama = '', limit = 80 }) {
  if (!String(arama).trim()) return [];
  return listeleKazanimlar({ ders, sinifKodlari, arama, limit });
}
