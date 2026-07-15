#!/usr/bin/env node
// index.html'in tarayıcı içi otomatik güncelleme mantığının (autoUpdateDraw) sunucu
// tarafı eşleniği. CORS proxy'sine gerek yok çünkü bu script doğrudan Node'dan
// (GitHub Actions runner'ı üzerinden) lotobil.com'a istek atıyor. Günlük olarak
// çalışır, kaynağın TÜM arşivini tarar, index.html'deki DRAW_DATA ile karşılaştırır
// ve eksik tarih bulursa dosyayı günceller — böylece kullanıcı tarayıcıyı hiç açmasa
// bile veri eksik kalmaz.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const INDEX_PATH = fileURLToPath(new URL('../index.html', import.meta.url));

const _FETCH_URLS = {
  sayisal: ['https://www.lotobil.com/Sayisal-Loto-Butun-Sonuc-Listesi', 'https://www.millipiyangoonline.com/sayisal-loto/cekilis-sonuclari'],
  super: ['https://www.lotobil.com/Super-Loto-Butun-Sonuc-Listesi', 'https://www.millipiyangoonline.com/super-loto/cekilis-sonuclari'],
  sans: ['https://www.lotobil.com/Sans-Topu-Butun-Sonuc-Listesi', 'https://www.millipiyangoonline.com/sans-topu/cekilis-sonuclari'],
  // lotobil'in "Bütün Sonuç Listesi" arşivinde On Numara için tarih sütunu yok (sadece hafta no).
  // Bu yüzden önce tarih içeren tekil "son çekiliş" sayfası denenir.
  onnumara: ['https://www.lotobil.com/On-Numara', 'https://www.millipiyangoonline.com/on-numara/cekilis-sonuclari', 'https://www.lotobil.com/On-Numara-Butun-Sonuc-Listesi'],
};

// mynet.com, lotobil.com'dan (birkaç gün gecikebiliyor) ve millipiyangoonline.com'dan
// (bu ortamdan/Action runner'ından zaman zaman timeout ile hiç ulaşılamıyor) daha güvenilir
// çıktı: her oyun sayfası en güncel çekilişi doğrudan gösteriyor, üstelik "tarih seçici" dropdown'u
// son ~10 çekilişin tarih linkini veriyor — bu da GEÇMİŞE dönük boşlukları da dolduruyor.
// NOT: mynet'teki gerçek "Sayısal Loto" 6 ana sayı + Süperstar formatında — bu uygulamanın
// 7 ana sayı + Süperstar formatıyla ÖRTÜŞMÜYOR, o yüzden sayisal burada YOK (lotobil'de kalıyor).
const MYNET_SLUGS = { super: 'super-loto', sans: 'sans-topu', onnumara: 'on-numara' };
const _TR_AY = { ocak: 1, 'şubat': 2, subat: 2, mart: 3, nisan: 4, 'mayıs': 5, mayis: 5, haziran: 6, temmuz: 7, 'ağustos': 8, agustos: 8, 'eylül': 9, eylul: 9, ekim: 10, 'kasım': 11, kasim: 11, 'aralık': 12, aralik: 12 };

function parseMynetDate(html) {
  const m = /data-name=["']cekilis-tarihi["']>\s*([^<]+?)\s*</i.exec(html);
  if (!m) return null;
  const dm = /(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})/.exec(m[1]);
  if (!dm) return null;
  const mon = _TR_AY[dm[2].toLocaleLowerCase('tr')];
  if (!mon) return null;
  return `${dm[3]}-${String(mon).padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
}

function parseMynetLine(html, gameId, date) {
  const idx = html.indexOf('kazanan-numaralar-box');
  if (idx < 0) return null;
  const seg = html.slice(idx, idx + 1200);
  const ballRe = /<div class="([^"]*\bball-box\b[^"]*)">\s*(\d+)\s*<\/div>/g;
  let bm, main = [], bonus = null;
  while ((bm = ballRe.exec(seg))) {
    const cls = bm[1].replace(/\s+/g, ' ').trim();
    const val = parseInt(bm[2], 10);
    if (cls === 'ball-box') main.push(val);
    else if (/ball-box-plus/.test(cls)) bonus = val;
  }
  if (gameId === 'onnumara') return main.length >= 20 ? `${date} ${main.sort((a, b) => a - b).join(' ')}` : null;
  if (gameId === 'super') return main.length >= 6 ? `${date} ${main.slice(0, 6).sort((a, b) => a - b).join(' ')}` : null;
  if (gameId === 'sans') return (main.length >= 5 && bonus != null) ? `${date} ${main.slice(0, 5).sort((a, b) => a - b).join(' ')} | ${bonus}` : null;
  return null;
}

async function fetchMynetGame(gameId, existing, fetchableDate) {
  const slug = MYNET_SLUGS[gameId];
  if (!slug) return [];
  const base = `https://www.mynet.com/sans-oyunlari/${slug}-sonuclari`;
  const inserted = [];
  const html = await fetchHtml(base);
  if (!html) return inserted;

  const date0 = parseMynetDate(html);
  const line0 = date0 ? parseMynetLine(html, gameId, date0) : null;
  if (date0 && line0 && !existing.has(date0) && fetchableDate(date0)) {
    existing.add(date0);
    inserted.push(line0);
  }

  const slugs = new Set();
  const optRe = /<option\s+value="([a-z0-9-]+)">/g;
  let om;
  while ((om = optRe.exec(html))) slugs.add(om[1]);

  for (const s of slugs) {
    const dm = /^(\d{1,2})-([a-z]+)-(\d{4})$/.exec(s);
    if (!dm) continue;
    const mon = _TR_AY[dm[2]];
    if (!mon) continue;
    const iso = `${dm[3]}-${String(mon).padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
    if (existing.has(iso) || !fetchableDate(iso)) continue;
    const h = await fetchHtml(`${base}/${s}`);
    if (!h) continue;
    const d = parseMynetDate(h) || iso;
    const line = parseMynetLine(h, gameId, d);
    if (line && !existing.has(d) && fetchableDate(d)) {
      existing.add(d);
      inserted.push(line);
    }
  }
  return inserted;
}

function drawLineFromCells(gameId, date, cells) {
  const drawNums = cells.slice(2).map(c => parseInt(c)).filter(n => Number.isFinite(n));
  if (gameId === 'super' && drawNums.length >= 6)
    return `${date} ${drawNums.slice(0, 6).sort((a, b) => a - b).join(' ')}`;
  if (gameId === 'sans' && drawNums.length >= 6)
    return `${date} ${drawNums.slice(0, 5).sort((a, b) => a - b).join(' ')} | ${drawNums[5]}`;
  if (gameId === 'sayisal' && drawNums.length >= 8 && drawNums[7] > 0)
    return `${date} ${drawNums.slice(0, 7).sort((a, b) => a - b).join(' ')} | ${drawNums[7]}`;
  return null;
}

function parseArchiveMap(html, gameId) {
  const map = new Map();
  if (!html) return map;
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(html))) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => c[1].replace(/<[^>]+>/g, '').trim());
    if (cells.length < 3) continue;
    const dm = cells[0].match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (!dm) continue;
    const date = `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
    const line = drawLineFromCells(gameId, date, cells);
    if (line) map.set(date, line);
  }
  return map;
}

function parseLatestSingleResult(html, gameId) {
  if (gameId !== 'onnumara' || !html) return null;
  const dm = /id=["']ssayisaltarih["']>\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(html);
  if (!dm) return null;
  const date = `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
  const after = html.slice(dm.index, dm.index + 6000);
  const nums = [...after.matchAll(/id=["']sayisaltop\d+["'][^>]*\/(\d+)\.png/gi)].map(m => parseInt(m[1])).filter(n => Number.isFinite(n));
  if (nums.length < 10) return null;
  nums.sort((a, b) => a - b);
  return { date, line: `${date} ${nums.join(' ')}` };
}

function resortLines(lines) {
  return [...lines].sort((a, b) => {
    const da = a.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || '';
    const db = b.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || '';
    return db.localeCompare(da);
  });
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; numberselectapp-bot/1.0)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text && text.length > 500 ? text : null;
  } catch (e) {
    console.warn(`[fetch] ${url} başarısız: ${e.message}`);
    return null;
  }
}

function trToday() {
  const trNow = new Date(Date.now() + 3 * 3600 * 1000);
  return { todayTR: trNow.toISOString().slice(0, 10), trHour: trNow.getUTCHours() };
}

async function updateGame(gameId, currentText) {
  const { todayTR, trHour } = trToday();
  const fetchableDate = date => date <= todayTR && !(date === todayTR && trHour < 22);

  const existingLines = currentText.split('\n').filter(l => l.trim());
  const existing = new Set(existingLines.map(l => l.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]).filter(Boolean));
  const inserted = [];

  // mynet.com önce denenir: lotobil.com günler sonra güncelleniyor, millipiyangoonline.com ise
  // bu ortamdan/Action runner'ından sık sık hiç yanıt vermiyor (timeout). mynet en güncel çekilişi
  // anında yayınlıyor ve tarih seçici dropdown'u sayesinde son ~10 çekilişlik boşluğu da dolduruyor.
  try {
    const mynetLines = await fetchMynetGame(gameId, existing, fetchableDate);
    inserted.push(...mynetLines);
  } catch (e) {
    console.warn(`[mynet] ${gameId} başarısız: ${e.message}`);
  }

  for (const url of _FETCH_URLS[gameId] || []) {
    const html = await fetchHtml(url);
    if (!html) continue;
    const archiveMap = parseArchiveMap(html, gameId);
    if (archiveMap.size) {
      for (const [date, line] of archiveMap) {
        if (existing.has(date) || !fetchableDate(date)) continue;
        existing.add(date);
        inserted.push(line);
      }
    } else {
      const single = parseLatestSingleResult(html, gameId);
      if (single && !existing.has(single.date) && fetchableDate(single.date)) {
        existing.add(single.date);
        inserted.push(single.line);
      }
    }
  }

  if (!inserted.length) return { text: currentText, inserted };
  const merged = resortLines([...existingLines, ...inserted]);
  return { text: merged.join('\n'), inserted };
}

async function main() {
  const html = readFileSync(INDEX_PATH, 'utf8');
  const blockRe = /const DRAW_DATA = \{([\s\S]*?)\n\};/;
  const blockMatch = blockRe.exec(html);
  if (!blockMatch) throw new Error('DRAW_DATA bloğu index.html içinde bulunamadı');

  const gameRe = /(sayisal|super|sans|onnumara):`([^`]*)`/g;
  const games = [];
  let gm;
  while ((gm = gameRe.exec(blockMatch[1]))) games.push({ id: gm[1], text: gm[2] });
  if (games.length !== 4) throw new Error(`Beklenen 4 oyun, bulunan: ${games.length}`);

  let anyChange = false;
  const summary = [];
  for (const g of games) {
    // Bir oyunun kaynakları TAMAMEN beklenmedik bir hatayla patlarsa (ör. site yapısı kökten
    // değişti) bile diğer 3 oyunun güncellenmesini engellemesin — her oyun bağımsız denenir.
    try {
      const { text, inserted } = await updateGame(g.id, g.text);
      if (inserted.length) {
        anyChange = true;
        g.text = text;
        summary.push(`${g.id}: +${inserted.length} (${inserted.map(l => l.slice(0, 10)).join(', ')})`);
      }
    } catch (e) {
      console.warn(`[updateGame] ${g.id} tamamen başarısız: ${e.message}`);
    }
  }

  if (!anyChange) {
    console.log('Yeni çekiliş verisi bulunamadı, dosya değiştirilmedi.');
    return;
  }

  const newBlockInner = '\n' + games.map(g => `${g.id}:\`${g.text}\`,`).join('\n\n') + '\n';
  const newHtml = html.slice(0, blockMatch.index) + `const DRAW_DATA = {${newBlockInner}};` + html.slice(blockMatch.index + blockMatch[0].length);
  writeFileSync(INDEX_PATH, newHtml);
  console.log('index.html güncellendi:\n' + summary.join('\n'));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
