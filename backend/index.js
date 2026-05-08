const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();

app.use(cors());
app.use(express.json());

// Railway'den gelen DATABASE_URL'i kullanarak SQL'e bağlanıyoruz
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Veritabanında tabloyu otomatik oluşturur
const initDB = async () => {
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS stats (id INT PRIMARY KEY, clicks BIGINT)');
    await pool.query('INSERT INTO stats (id, clicks) SELECT 1, 0 WHERE NOT EXISTS (SELECT 1 FROM stats WHERE id = 1)');
    console.log("SQL Veritabanı Hazır.");
  } catch (err) {
    console.error("DB Hatası:", err);
  }
};
initDB();

app.get('/stats', async (req, res) => {
  try {
    const result = await pool.query('SELECT clicks FROM stats WHERE id = 1');
    res.json({ globalTotal: parseInt(result.rows[0].clicks) });
  } catch (err) {
    res.status(500).send("Hata");
  }
});

app.post('/click', async (req, res) => {
  try {
    const result = await pool.query('UPDATE stats SET clicks = clicks + 1 WHERE id = 1 RETURNING clicks');
    res.json({ globalTotal: parseInt(result.rows[0].clicks) });
  } catch (err) {
    res.status(500).send("Hata");
  }
});

const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log(`Sunucu ${port} portunda SQL ile yayında!`);
});
