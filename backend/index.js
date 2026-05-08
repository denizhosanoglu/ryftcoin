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
