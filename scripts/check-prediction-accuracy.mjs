#!/usr/bin/env node
// index.html'i headless (jsdom) ortamda çalıştırıp generateNumbers()'ı gerçek geçmiş
// çekilişlere karşı "walk-forward" yöntemiyle test eder. İki tür anormallik tespit eder:
//   1) Yapısal: bir algoritma hata fırlatıyor veya geçersiz şekilde sonuç üretiyor
//      (kod regresyonu — örn. bir indeksleme/sıralama hatası).
//   2) İstatistiksel: son N gerçek çekilişteki ortalama isabet sayısı, o oyunun şans
//      seviyesinin (hipergeometrik dağılımla hesaplanan teorik beklenti) istatistiksel
//      olarak anlamlı şekilde altına düşüyor (tek-yönlü z-testi, z <= -3).
// Bu script index.html'i DEĞİŞTİRMEZ. Sadece rapor üretir (accuracy-report.md) ve
// GITHUB_OUTPUT'a anomaly=true/false yazar; gerçek bildirimi (Issue açma) workflow
// dosyası üstlenir.
import { JSDOM } from 'jsdom';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const INDEX_PATH = fileURLToPath(new URL('../index.html', import.meta.url));
const REPORT_PATH = fileURLToPath(new URL('../accuracy-report.md', import.meta.url));
const Z_THRESHOLD = -3.0; // tek-yönlü, p≈0.0013 — doğal lotaryo gürültüsünden ayırmak için muhafazakar

const ANALYSIS_SCRIPT = `
(function(){
  function mode(arr){
    const counts=new Map();
    for(const v of arr) counts.set(v,(counts.get(v)||0)+1);
    let best=arr[0], bestCount=0;
    for(const [v,c] of counts) if(c>bestCount){best=v;bestCount=c;}
    return best;
  }
  function hyperMeanVar(max, drawSize, pickCount){
    if(drawSize<=0 || max<=1) return {mean:0, variance:0};
    const mean = pickCount*drawSize/max;
    const variance = pickCount*(drawSize/max)*((max-drawSize)/max)*((max-pickCount)/(max-1));
    return {mean, variance};
  }
  function hits(pred, actual){
    const aS = new Set(actual.nums);
    let m = pred.main.filter(x=>aS.has(x)).length;
    if(actual.bonus && actual.bonus.length){
      const aBs = new Set(actual.bonus);
      m += (pred.bonus||[]).filter(x=>aBs.has(x)).length;
    }
    return m;
  }
  function validShape(pred, game){
    if(!pred || !Array.isArray(pred.main)) return false;
    if(pred.main.length!==game.count) return false;
    if(new Set(pred.main).size!==game.count) return false;
    if(!pred.main.every(n=>Number.isInteger(n)&&n>=1&&n<=game.max)) return false;
    if(game.bonusCount>0){
      if(!Array.isArray(pred.bonus) || pred.bonus.length!==game.bonusCount) return false;
      if(new Set(pred.bonus).size!==game.bonusCount) return false;
      if(!pred.bonus.every(n=>Number.isInteger(n)&&n>=1&&n<=game.bonusMax)) return false;
    }
    return true;
  }

  const GAME_IDS = ['sayisal','super','sans','onnumara'];
  const RECENT_N = 20;
  const SPARSE_START = 25, SPARSE_END = 150, SPARSE_STEP = 15;
  const EXPENSIVE = new Set(['megavote','proensemble']);
  const TRIALS_RECENT = 5, TRIALS_RECENT_EXPENSIVE = 2;
  const TRIALS_SPARSE = 3, TRIALS_SPARSE_EXPENSIVE = 1;

  const structuralFailures = [];
  const games = {};

  for(const gid of GAME_IDS){
    const game = getGame(gid);
    const D = _kbGetDraws(gid);
    const mainDrawSize = mode(D.map(d=>(d.nums||[]).length));
    const bonusLensNZ = D.map(d=>(d.bonus||[]).length).filter(l=>l>0);
    const bonusDrawSize = bonusLensNZ.length ? mode(bonusLensNZ) : 0;
    const mainHV = hyperMeanVar(game.max, mainDrawSize, game.count);
    const bonusHV = game.bonusCount>0 ? hyperMeanVar(game.bonusMax, bonusDrawSize, game.bonusCount) : {mean:0,variance:0};
    const nullMean = mainHV.mean + bonusHV.mean;
    const nullVar = mainHV.variance + bonusHV.variance;

    let recentSum=0, recentN=0;
    let sparseSum=0, sparseN=0;
    const perAlgo = {};

    for(const algo of ALGOS){
      const aid = algo.id;
      const trR = EXPENSIVE.has(aid) ? TRIALS_RECENT_EXPENSIVE : TRIALS_RECENT;
      let aRecentSum=0, aRecentN=0;
      for(let t=0;t<RECENT_N;t++){
        if(t+1>=D.length) break;
        const actual = D[t];
        const priorChrono = D.slice(t+1).slice().reverse();
        if(priorChrono.length<30) break;
        const freq = buildFreq(priorChrono);
        for(let trial=0; trial<trR; trial++){
          let pred, err=null;
          try{ pred = generateNumbers(game, aid, freq, priorChrono); }
          catch(e){ err = e.message; }
          if(err || !validShape(pred, game)){
            structuralFailures.push(gid+'/'+aid+' t='+t+': '+(err||'geçersiz çıktı şekli'));
            continue;
          }
          const h = hits(pred, actual);
          aRecentSum += h; aRecentN++;
          recentSum += h; recentN++;
        }
      }
      perAlgo[aid] = aRecentN ? +(aRecentSum/aRecentN).toFixed(3) : null;

      const trS = EXPENSIVE.has(aid) ? TRIALS_SPARSE_EXPENSIVE : TRIALS_SPARSE;
      for(let t=SPARSE_START; t<=SPARSE_END; t+=SPARSE_STEP){
        if(t+1>=D.length) break;
        const actual = D[t];
        const priorChrono = D.slice(t+1).slice().reverse();
        if(priorChrono.length<30) continue;
        const freq = buildFreq(priorChrono);
        for(let trial=0; trial<trS; trial++){
          let pred;
          try{ pred = generateNumbers(game, aid, freq, priorChrono); } catch(e){ continue; }
          if(!validShape(pred, game)) continue;
          sparseSum += hits(pred, actual); sparseN++;
        }
      }
    }

    const recentRate = recentN ? recentSum/recentN : null;
    const sparseRate = sparseN ? sparseSum/sparseN : null;
    const z = (recentN && nullVar>0) ? (recentSum - recentN*nullMean) / Math.sqrt(recentN*nullVar) : null;

    games[gid] = {
      name: game.name, nullMean: +nullMean.toFixed(3),
      recentN, recentRate: recentRate!=null? +recentRate.toFixed(3): null,
      sparseN, sparseRate: sparseRate!=null? +sparseRate.toFixed(3): null,
      z: z!=null? +z.toFixed(2): null,
      perAlgo,
      drawDateRange: D.length? [D[Math.min(RECENT_N,D.length)-1].date, D[0].date] : null
    };
  }

  return JSON.stringify({structuralFailures, games});
})()
`;

function buildReport(result, anomaly) {
  const { structuralFailures, games } = result;
  const lines = [];
  lines.push(`# Tahmin Algoritmaları Periyodik Analiz Raporu`);
  lines.push(``);
  lines.push(`Tarih: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(``);

  if (structuralFailures.length) {
    lines.push(`## ⚠️ Yapısal hatalar (${structuralFailures.length})`);
    lines.push(``);
    lines.push('Aşağıdaki algoritma/oyun kombinasyonları hata fırlattı veya geçersiz sonuç üretti. Bu genellikle index.html üzerinde yapılan bir değişikliğin tahmin motorunda regresyona yol açtığını gösterir:');
    lines.push(``);
    for (const f of structuralFailures.slice(0, 50)) lines.push(`- ${f}`);
    if (structuralFailures.length > 50) lines.push(`- ... ve ${structuralFailures.length - 50} tane daha`);
    lines.push(``);
  } else {
    lines.push(`✅ Yapısal kontrol: 17 algoritma × 4 oyun, hepsi geçerli sonuç üretti (hata yok).`);
    lines.push(``);
  }

  lines.push(`## İstatistiksel analiz (son ${20} gerçek çekiliş vs. şans seviyesi)`);
  lines.push(``);
  lines.push(`| Oyun | Tarih aralığı | Şans beklentisi | Son 20 çekiliş ort. | Uzun dönem (sparse) ort. | z-skoru |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (const gid of Object.keys(games)) {
    const g = games[gid];
    const flag = g.z != null && g.z <= Z_THRESHOLD ? ' 🔴' : '';
    lines.push(`| ${g.name} | ${g.drawDateRange ? g.drawDateRange.join(' → ') : '-'} | ${g.nullMean} | ${g.recentRate ?? '-'} | ${g.sparseRate ?? '-'} | ${g.z ?? '-'}${flag} |`);
  }
  lines.push(``);
  lines.push(`z-skoru ≤ ${Z_THRESHOLD} ise, son çekilişlerdeki ortalama isabet sayısı şans seviyesinin istatistiksel olarak anlamlı (p≈0.0013) şekilde altında demektir — bu doğal lotarya rastgeleliğiyle açıklanamayacak kadar düşüktür ve kod regresyonuna işaret edebilir.`);
  lines.push(``);

  lines.push(`## Algoritma bazında detay (son 20 çekiliş ortalama isabet)`);
  lines.push(``);
  for (const gid of Object.keys(games)) {
    const g = games[gid];
    lines.push(`**${g.name}** (şans beklentisi: ${g.nullMean})`);
    lines.push(``);
    const entries = Object.entries(g.perAlgo).map(([aid, v]) => `${aid}=${v ?? 'NA'}`).join(', ');
    lines.push(entries);
    lines.push(``);
  }

  return lines.join('\n');
}

async function main() {
  const html = readFileSync(INDEX_PATH, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
  const win = dom.window;
  win.fetch = () => Promise.reject(new Error('no network in check script'));

  await new Promise((r) => setTimeout(r, 500));

  let resultJson;
  try {
    resultJson = win.eval(ANALYSIS_SCRIPT);
  } catch (e) {
    console.error('Analiz scripti çalıştırılamadı:', e.message);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'anomaly=true\n');
    writeFileSync(REPORT_PATH, `# Tahmin Algoritmaları Periyodik Analiz Raporu\n\n⚠️ Analiz scripti çalışırken hata oluştu: ${e.message}\n`);
    process.exit(1);
  }

  const result = JSON.parse(resultJson);
  const statAnomaly = Object.values(result.games).some((g) => g.z != null && g.z <= Z_THRESHOLD);
  const structuralAnomaly = result.structuralFailures.length > 0;
  const anomaly = statAnomaly || structuralAnomaly;

  const report = buildReport(result, anomaly);
  writeFileSync(REPORT_PATH, report);
  console.log(report);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `anomaly=${anomaly}\n`);
  }

  process.exit(structuralAnomaly ? 1 : 0);
}

main();
