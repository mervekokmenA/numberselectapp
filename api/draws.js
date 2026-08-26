// Çekiliş geçmişi
import { sql, cors, yetkili, tablolar, govde, hata } from './_db.js';

const GECERLI = new Set(['sayisal', 'super', 'sans', 'onnumara']);
const sayiDizi = (x) => Array.isArray(x) ? x.map(Number).filter(n => Number.isFinite(n) && n > 0 && n <= 999) : [];

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!yetkili(req)) return hata(res, 401, 'Geçersiz anahtar');
  try {
    await tablolar();
    const q = sql();

    if (req.method === 'GET') {
      const game = (req.query && req.query.game) || '';
      const limit = Math.min(parseInt((req.query && req.query.limit) || '5000', 10) || 5000, 20000);
      const r = game
        ? await q`select game, to_char(draw_date,'YYYY-MM-DD') as date, nums, bonus
                  from draws where game = ${game} order by draw_date desc limit ${limit}`
        : await q`select game, to_char(draw_date,'YYYY-MM-DD') as date, nums, bonus
                  from draws order by game, draw_date desc limit ${limit}`;
      return res.status(200).json({ ok: true, satir: r.length, cekilisler: r });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const b = await govde(req);
      const game = b.game;
      const rows = Array.isArray(b.cekilisler) ? b.cekilisler : [];
      if (!GECERLI.has(game)) return hata(res, 400, 'Geçersiz oyun');
      if (!rows.length) return hata(res, 400, 'cekilisler boş');
      let yazilan = 0;
      for (const d of rows) {
        const tarih = String(d.date || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) continue;
        const nums = sayiDizi(d.nums), bonus = sayiDizi(d.bonus);
        if (!nums.length) continue;
        await q`insert into draws (game, draw_date, nums, bonus, updated_at)
                values (${game}, ${tarih}, ${nums}, ${bonus}, now())
                on conflict (game, draw_date) do update
                set nums = excluded.nums, bonus = excluded.bonus, updated_at = now()`;
        yazilan++;
      }
      return res.status(200).json({ ok: true, yazilan });
    }

    if (req.method === 'DELETE') {
      const game = (req.query && req.query.game) || '';
      const date = (req.query && req.query.date) || '';
      if (!GECERLI.has(game) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return hata(res, 400, 'game ve date gerekli');
      await q`delete from draws where game = ${game} and draw_date = ${date}`;
      return res.status(200).json({ ok: true });
    }

    hata(res, 405, 'Desteklenmeyen yöntem');
  } catch (e) {
    hata(res, 500, String(e.message || e));
  }
}
