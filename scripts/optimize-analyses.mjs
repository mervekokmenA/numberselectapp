#!/usr/bin/env node
// ÖĞRENEN OPTİMİZASYON AJANI
// index.html'i başsız (headless) bir tarayıcıda açar, uygulamanın kendi geriye dönük test
// motorlarını (_optSearchAll) çalıştırır ve her oyun için en iyi analiz-ağırlık parametrelerini
// bulur; yalnızca validation'da mevcut sistemi belirgin biçimde GEÇEN oyunlarda enabled:true yapar
// (zarar-verme kuralı). Bulunan sonucu index.html içindeki `const _OPT_PARAMS = {...}` bloğuna yazar.
// GitHub Actions'tan elle (workflow_dispatch) ya da zamanlanmış olarak tetiklenir — böylece analizler
// veri büyüdükçe / sinyal kalitesi kaydıkça kendini yeniden ayarlar.
//
// Kullanım: node scripts/optimize-analyses.mjs
// Gerekli: playwright + chromium (CI'da `npx playwright install --with-deps chromium`).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const INDEX_PATH = fileURLToPath(new URL('../index.html', import.meta.url));

function todayTR() {
  const d = new Date(Date.now() + 3 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// _OPT_PARAMS nesnesini index.html'e yazılacak, okunası tek-satır-per-oyun JS metnine çevirir.
function serialize(opt) {
  const gline = (gid) => {
    const g = opt[gid];
    if (!g || !g.enabled) return `  ${gid}: { enabled: false },`;
    const sw = Object.entries(g.sigW).map(([k, v]) => `${k}:${v}`).join(', ');
    return `  ${gid}: { enabled: true, alpha: ${g.alpha}, gamma: ${g.gamma}, floor: ${g.floor}, sigW: { ${sw} } },`;
  };
  return [
    'const _OPT_PARAMS = {',
    `  tunedAt: "${opt.tunedAt}",`,
    gline('sayisal'),
    gline('super'),
    gline('sans'),
    gline('onnumara'),
    '};',
  ].join('\n');
}

async function main() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM || undefined; // CI'da varsayılan indirilen chromium kullanılır
  const launchOpts = executablePath ? { executablePath } : {};
  const browser = await chromium.launch(launchOpts);
  try {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto('file://' + INDEX_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Uygulamanın kendi tuner'ı — ağır (birkaç dakika sürebilir).
    const result = await page.evaluate((dateStr) => {
      if (typeof _optSearchAll !== 'function') return { error: '_optSearchAll bulunamadı' };
      return _optSearchAll(dateStr);
    }, todayTR());

    if (result.error) throw new Error(result.error);
    if (errs.length) console.warn('[uyarı] sayfa hataları:', errs.slice(0, 5));

    // Rapor
    console.log('Optimizasyon raporu:');
    for (const gid of ['sayisal', 'super', 'sans', 'onnumara']) {
      const g = result[gid] || {};
      const r = g._report || {};
      console.log(`  ${gid}: ${g.enabled ? 'BENIMSENDI' : 'mevcut korundu'}` +
        (r.cur != null ? ` (skor mevcut ${r.cur} → aday ${r.new}${g.enabled ? `, ≥3 K10 %${r.curGe3_10}→%${r.newGe3_10}, K20 %${r.curGe3_20}→%${r.newGe3_20}` : ''})` : ''));
      // _report'u kaydedilecek nesneden çıkar (yalnızca temiz parametreler yazılsın)
      if (g._report) delete g._report;
      if (g.note) delete g.note;
    }

    const block = serialize(result);
    const html = readFileSync(INDEX_PATH, 'utf8');
    const re = /const _OPT_PARAMS = \{[\s\S]*?\n\};/;
    if (!re.test(html)) throw new Error('_OPT_PARAMS bloğu index.html içinde bulunamadı');
    const newHtml = html.replace(re, block);
    if (newHtml === html) {
      console.log('Parametreler değişmedi — dosya güncellenmedi.');
      return;
    }
    writeFileSync(INDEX_PATH, newHtml);
    console.log('index.html güncellendi (yeni _OPT_PARAMS yazıldı).');
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
