# Veritabanı katmanı (Neon Postgres)

Uygulama tek bir `index.html`; bu klasör Vercel üzerinde çalışan sunucusuz API'yi içerir.
**Bağlantı dizesi tarayıcıya hiç gelmez** — yalnızca Vercel ortam değişkeninde durur.

## Kurulum

1. **Neon** (console.neon.tech) → yeni proje → *Connection string* kopyala
   (`postgresql://kullanici:parola@ep-...neon.tech/neondb?sslmode=require`)
2. **Vercel** → proje → Settings → Environment Variables:
   | Ad | Değer |
   |---|---|
   | `DATABASE_URL` | Neon bağlantı dizesi |
   | `APP_KEY` | kendi belirlediğin gizli anahtar (uygulamaya gireceksin) |
   | `ALLOW_ORIGIN` | *(isteğe bağlı)* izin verilen origin, varsayılan `*` |
3. Yeniden dağıt (redeploy).
4. Uygulamada **🗄️ Veritabanı** sayfası → API adresi + erişim anahtarı → **Bağlantıyı Sına** → **Veritabanı senkronunu aç**.

Tablolar ilk istekte otomatik oluşur (`create table if not exists`).

## Uç noktalar

Tümü `x-app-key` başlığı ister (APP_KEY tanımlıysa).

| Yöntem | Yol | Açıklama |
|---|---|---|
| GET | `/api/health` | bağlantı, tablo sayaçları, oyun bazında çekiliş adedi |
| GET | `/api/state?k=…` | tek kayıt · `?onek=` ile ön eke göre · parametresiz tümü |
| PUT | `/api/state` | `{k,v}` ya da `{kayitlar:[{k,v},…]}` — upsert |
| DELETE | `/api/state?k=…` | kayıt sil |
| GET | `/api/draws?game=…&limit=…` | çekilişler (yeniden eskiye) |
| POST | `/api/draws` | `{game,cekilisler:[{date,nums,bonus},…]}` — upsert |
| DELETE | `/api/draws?game=…&date=…` | çekiliş sil |

## Şema

```sql
app_state (k text pk, v jsonb, updated_at timestamptz)
draws     (game text, draw_date date, nums int[], bonus int[], updated_at timestamptz,
           primary key (game, draw_date))
```

## Senkron kuralı (veri kaybı olmadan)

- Yerelde yoksa → veritabanındaki alınır
- Yerel, son senkronla aynıysa → veritabanındaki alınır
- Yerel, son senkrondan farklıysa → **yerel korunur** ve veritabanına gönderilir

Senkronlanan veriler: `_predNotes`, `_onaTickets`, `_kazananMarks`, `_astroInputs`,
`_hbInput`, `_oyunSecimGlobal` ve `_exKolon_*` (Excel sütun düzenleri),
`drawCache_*`, `drawDel_*`.

Senkron kapalıyken uygulama eskisi gibi yalnız `localStorage` ile çalışır.
