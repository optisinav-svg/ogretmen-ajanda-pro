const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');

// The PDF builder is a pure function. Load it in an isolated VM so the
// generated HTML can be tested without React Native or Expo dependencies.
const source = fs.readFileSync(
  path.join(__dirname, '..', 'utils', 'ogrenciRaporPdf.js'),
  'utf8',
).replace('export function ogrenciRaporHtml', 'function ogrenciRaporHtml');

const sandbox = { module: { exports: {} }, Date };
vm.runInNewContext(`${source}\nmodule.exports = { ogrenciRaporHtml };`, sandbox);
const { ogrenciRaporHtml } = sandbox.module.exports;

test('Öğrenci PDF raporu haftalık ve tek seferlik bireysel etkinlik programlarını gösterir', () => {
  const html = ogrenciRaporHtml({
    ogrenciAdi: 'Test Öğrencisi',
    bireyselProgramlar: [
      {
        tur: 'Etüt',
        periyot: 'haftalik',
        gun: 'Salı',
        baslangicTarih: '2026-11-01',
        bitisTarih: '2026-12-31',
        baslangicSaat: '16:00',
        bitisSaat: '17:00',
        aciklama: 'Harita tekrarı <önemli>',
        istisnaTarihleri: ['2026-11-10'],
      },
      {
        tur: 'Soru Çözümü',
        periyot: 'tek',
        baslangicTarih: '2026-11-23',
        bitisTarih: '2026-11-23',
        baslangicSaat: '18:00',
        bitisSaat: '18:40',
      },
    ],
  });

  assert.match(html, /Öğrenciye Özel Etkinlik Programı/);
  assert.match(html, /Etüt/);
  assert.match(html, /Haftalık · Salı/);
  assert.match(html, /01\.11\.2026 – 31\.12\.2026/);
  assert.match(html, /Soru Çözümü/);
  assert.match(html, /Tek seferlik/);
  assert.match(html, /Harita tekrarı &lt;önemli&gt;/);
  assert.match(html, /1 tarih hariç/);
});

test('Öğrenci PDF raporu bireysel oturumların yoklama, konu ve not bilgisini gösterir', () => {
  const html = ogrenciRaporHtml({
    ogrenciAdi: 'Test Öğrencisi',
    bireyselEtkinlikler: [
      {
        tur: 'Özel Ders',
        tarih: '2026-11-23',
        baslangicSaat: '14:00',
        bitisSaat: '15:00',
        yoklamaDurumu: 'gecikti',
        konular: ['Türkiye’de iklim tipleri'],
        aciklama: 'Öğrenci 10 dakika geç geldi',
      },
    ],
  });

  assert.match(html, /Özel Ders, Etüt ve Soru Çözümü Oturum Geçmişi/);
  assert.match(html, /23\.11\.2026/);
  assert.match(html, /Geç geldi/);
  assert.match(html, /Türkiye’de iklim tipleri/);
  assert.match(html, /Öğrenci 10 dakika geç geldi/);
});
