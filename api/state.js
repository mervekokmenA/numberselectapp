// Uygulama durumu (Excel sütun düzenleri, kayıtlı tahminler, notlar, ayarlar…)
import { sql, cors, yetkili, tablolar, govde, hata } from './_db.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!yetkili(req)) return hata(res, 401, 'Geçersiz anahtar');
  try {
    await tablolar();
    const q = sql();
    const k = (req.query && req.query.k) || '';

    if (req.method === 'GET') {
      if (k) {
        const r = await q`select k, v, updated_at from app_state where k = ${k}`;
        return res.status(200).json({ ok: true, deger: r[0] ? r[0].v : null, updated_at: r[0]?.updated_at || null });
      }
      const onek = (req.query && req.query.onek) || '';
      const r = onek
        ? await q`select k, v, updated_at from app_state where k like ${onek + '%'} order by k`
        : await q`select k, v, updated_at from app_state order by k`;
      return res.status(200).json({ ok: true, kayitlar: r });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const b = await govde(req);
      const kayitlar = Array.isArray(b.kayitlar) ? b.kayitlar : (b.k ? [{ k: b.k, v: b.v }] : []);
      if (!kayitlar.length) return hata(res, 400, 'k/v ya da kayitlar gerekli');
      for (const kv of kayitlar) {
        if (!kv || !kv.k) continue;
        await q`insert into app_state (k, v, updated_at) values (${kv.k}, ${JSON.stringify(kv.v ?? null)}::jsonb, now())
                on conflict (k) do update set v = excluded.v, updated_at = now()`;
      }
      return res.status(200).json({ ok: true, yazilan: kayitlar.length });
    }

    if (req.method === 'DELETE') {
      if (!k) return hata(res, 400, 'k gerekli');
      await q`delete from app_state where k = ${k}`;
      return res.status(200).json({ ok: true });
    }

    hata(res, 405, 'Desteklenmeyen yöntem');
  } catch (e) {
    hata(res, 500, String(e.message || e));
  }
}
