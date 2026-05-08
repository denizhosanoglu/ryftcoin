
oyun
/
Claude finished the response
You said: Claude'a Göndereceğin Komut Metni (Prompt)
Claude'a Göndereceğin Komut Metni (Prompt)
"Selam Claude, mevcut bir 'Clicker' projesini geliştirmek istiyorum. Senden bu projenin hem Frontend (HTML/JS) hem de Backend (Node.js/Express) kodlarını, aşağıdaki dosya yapısına ve teknik özelliklere uygun şekilde yeniden yazmanı istiyorum.
Teknik Altyapı:

Hosting: Frontend GitHub Pages üzerinde (/docs klasöründen), Backend ise Railway üzerinde çalışıyor.
Veritabanı: Railway üzerinde PostgreSQL kullanıyorum.
Bağlantı: Backend, veritabanına process.env.DATABASE_URL üzerinden bağlanıyor. CORS ayarları yapılmış durumda.
Dosya Yapısı:

/docs/index.html: Frontend kodları burada.
/docs/CNAME: ryftcoin.com domaini tanımlı.
/backend/index.js: Express sunucusu ve API endpointleri burada.
/backend/package.json: Bağımlılıklar: express, cors, pg.
Oyun Özellikleri (İsteklerim):

Global Leaderboard: Veritabanında her kullanıcının (şimdilik sadece IP tabanlı veya basit bir isim girişiyle) toplam skorunu tutan bir liderlik tablosu olsun.
Upgrade Sistemi: Kullanıcı tıkladıkça kazandığı coinlerle 'Upgrade' alabilsin (Örn: Tıklama başına +5 coin veya Saniyede +1 coin otomatik kazanç).
Kalıcılık: Hem global skor hem de kullanıcının upgrade'leri PostgreSQL veritabanında saklanmalı.
Görsellik: Modern, karanlık tema (dark mode) ve ortalanmış, tıklanabilir şık bir coin görseli/butonu olsun.
Lütfen bu yapıya uygun, hatasız ve birbirine entegre index.js ve index.html kodlarını yazar mısın?"
Senin İçin Küçük Bir Not:
Claude sana kodları verdiğinde şu iki noktaya dikkat et:

URL Kontrolü: Claude kodun içine fetch('http://localhost:8080') yazabilir. Onu mutlaka senin kendi adresin olan https://api.ryftcoin.com ile değiştirmeyi unutma.
SQL Tabloları: Yeni özellikler (upgrade'ler gibi) için veritabanında yeni sütunlar gerekecektir. Claude'un verdiği CREATE TABLE komutlarının index.js içinde olduğundan emin ol. Projen devasa bir şeye dönüşüyor, Sabancı'daki arkadaşlarınla (Barış ve diğerleri) bu global skor tablosunda kapışırken çok eğleneceksiniz! Başka bir sorunda yine buradayım.
Show less
15:12
Claude responded: İki dosyayı da yazıyorum — önce backend, sonra frontend.

Reading frontend design skill
Reading frontend design skill
İki dosyayı da yazıyorum — önce backend, sonra frontend.


Created 3 files, read a file
Created 3 files, read a file
3 dosya hazır. İşte özet:

Ne yaptım
backend/index.js
Veritabanı otomatik kurulum — initDB() ile players tablosu ilk çalışmada oluşur, manuel SQL girmen gerekmez.
6 endpoint:
Endpoint	İş
GET /player/:username	Oyuncuyu getir veya oluştur
POST /click	Tıklama skoru ekle (click_power kadar)
POST /auto	Otomatik kazanç ekle (auto_power kadar)
GET /upgrades	Upgrade listesini döndür
POST /upgrade	Upgrade satın al (transaction ile güvenli)
GET /leaderboard	Top 10
6 upgrade tanımlı (3 tıklama, 3 oto-kazanç), kolayca genişletebilirsin.
docs/index.html
Koyu siber tema — Orbitron + Share Tech Mono, altın/neon renk paleti
Coin ripple animasyonu + tıklayınca uçan +N label
3 sütun düzen: İstatistikler | Coin | Liderlik Tablosu + alt kısımda Upgrade paneli
Liderlik tablosu 30 saniyede bir otomatik yenilenir
Basit kullanıcı adı girişi (IP yok, istersen sonra token/auth ekleyebilirsin)
Yapman gerekenler
Railway'de DATABASE_URL env var'ının set edildiğinden emin ol.
CORS satırı backend/index.js'de zaten https://ryftcoin.com ve https://www.ryftcoin.com için açık.
Frontend'deki API URL'i https://api.ryftcoin.com olarak ayarlı — Railway subdomain'in farklıysa const API = '...' satırını değiştir.
Barış ve diğerleriyle liderlik tablosunda eğlenceli kapışmalar! 🪙


Index
Code · HTML 

Index
JS 

Package
Code · JSON 





Claude is AI and can make mistakes. Please double-check responses.
Index · JS
Copy

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
 
const app = express();
const PORT = process.env.PORT || 8080;
 
// PostgreSQL bağlantısı
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
 
// CORS ayarları
app.use(cors({
  origin: ['https://ryftcoin.com', 'https://www.ryftcoin.com'],
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
 
// ─── Veritabanı Tablolarını Oluştur ───────────────────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id            SERIAL PRIMARY KEY,
        username      VARCHAR(32) UNIQUE NOT NULL,
        total_coins   BIGINT      DEFAULT 0,
        coins         BIGINT      DEFAULT 0,
        click_power   INT         DEFAULT 1,
        auto_power    INT         DEFAULT 0,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Veritabanı tabloları hazır.');
  } catch (err) {
    console.error('❌ DB init hatası:', err.message);
  } finally {
    client.release();
  }
}
 
initDB();
 
// ─── Yardımcı: Oyuncu Getir veya Oluştur ──────────────────────────────────────
async function getOrCreatePlayer(username) {
  let result = await pool.query(
    'SELECT * FROM players WHERE username = $1',
    [username]
  );
  if (result.rows.length === 0) {
    result = await pool.query(
      `INSERT INTO players (username) VALUES ($1) RETURNING *`,
      [username]
    );
  }
  return result.rows[0];
}
 
// ─── ENDPOINTS ────────────────────────────────────────────────────────────────
 
// GET /player/:username  →  Oyuncu verisini getir (veya oluştur)
app.get('/player/:username', async (req, res) => {
  const { username } = req.params;
  if (!username || username.length > 32) return res.status(400).json({ error: 'Geçersiz kullanıcı adı.' });
  try {
    const player = await getOrCreatePlayer(username.toLowerCase());
    res.json(player);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});
 
// POST /click  →  Tıklama skoru ekle
app.post('/click', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username gerekli.' });
  try {
    const result = await pool.query(
      `UPDATE players
         SET coins       = coins + click_power,
             total_coins = total_coins + click_power,
             updated_at  = NOW()
       WHERE username = $1
       RETURNING *`,
      [username.toLowerCase()]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Oyuncu bulunamadı.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});
 
// POST /auto  →  Otomatik kazanç (her saniye frontend tarafından çağrılır)
app.post('/auto', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username gerekli.' });
  try {
    const result = await pool.query(
      `UPDATE players
         SET coins       = coins + auto_power,
             total_coins = total_coins + auto_power,
             updated_at  = NOW()
       WHERE username = $1
       RETURNING *`,
      [username.toLowerCase()]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Oyuncu bulunamadı.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});
 
// ─── UPGRADE TANIMLARI ────────────────────────────────────────────────────────
const UPGRADES = {
  click_1:  { field: 'click_power', bonus: 1,  cost: 50,   label: '+1 Tıklama Gücü'     },
  click_2:  { field: 'click_power', bonus: 4,  cost: 200,  label: '+4 Tıklama Gücü'     },
  click_3:  { field: 'click_power', bonus: 10, cost: 800,  label: '+10 Tıklama Gücü'    },
  auto_1:   { field: 'auto_power',  bonus: 1,  cost: 100,  label: '+1 Otomatik / sn'    },
  auto_2:   { field: 'auto_power',  bonus: 3,  cost: 500,  label: '+3 Otomatik / sn'    },
  auto_3:   { field: 'auto_power',  bonus: 10, cost: 2000, label: '+10 Otomatik / sn'   },
};
 
// GET /upgrades  →  Tüm upgrade tanımlarını döndür
app.get('/upgrades', (_req, res) => {
  res.json(UPGRADES);
});
 
// POST /upgrade  →  Upgrade satın al
app.post('/upgrade', async (req, res) => {
  const { username, upgrade_id } = req.body;
  if (!username || !upgrade_id) return res.status(400).json({ error: 'username ve upgrade_id gerekli.' });
 
  const upg = UPGRADES[upgrade_id];
  if (!upg) return res.status(400).json({ error: 'Geçersiz upgrade.' });
 
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
 
    const { rows } = await client.query(
      'SELECT coins FROM players WHERE username = $1 FOR UPDATE',
      [username.toLowerCase()]
    );
    if (rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Oyuncu bulunamadı.' }); }
 
    if (rows[0].coins < upg.cost) {
      await client.query('ROLLBACK');
      return res.status(402).json({ error: 'Yetersiz coin.' });
    }
 
    const result = await client.query(
      `UPDATE players
         SET coins      = coins - $1,
             ${upg.field} = ${upg.field} + $2,
             updated_at = NOW()
       WHERE username = $3
       RETURNING *`,
      [upg.cost, upg.bonus, username.toLowerCase()]
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  } finally {
    client.release();
  }
});
 
// GET /leaderboard  →  Top 10 liderlik tablosu
app.get('/leaderboard', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT username, total_coins, click_power, auto_power
         FROM players
        ORDER BY total_coins DESC
        LIMIT 10`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});
 
// Sağlık kontrolü
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
 
app.listen(PORT, () => console.log(`🚀 RyftCoin API ${PORT} portunda çalışıyor.`));
 
