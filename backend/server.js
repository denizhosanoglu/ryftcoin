'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ---------------------------------------------------------------------------
// Ayarlar (ortam değişkenlerinden gelir, koda gizli bilgi YAZILMAZ)
// ---------------------------------------------------------------------------
const env = process.env;
const API_KEY = env.FAUCETPAY_API_KEY || '';

// Gösterilecek para birimleri, virgülle. Varsayılan: sadece USDT
const CURRENCIES = (env.BALANCE_CURRENCIES || 'USDT')
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter((c) => /^[A-Z0-9]{2,10}$/.test(c))
  .slice(0, 10);

const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS || 'https://ryftcoin.com,https://www.ryftcoin.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const CACHE_MS = 30 * 1000; // FaucetPay'i yormamak için bakiye 30 sn önbellekte tutulur
const FAUCETPAY_BALANCE_URL = 'https://faucetpay.io/api/v1/getbalance';

if (CURRENCIES.length === 0) {
  console.error('HATA: BALANCE_CURRENCIES geçerli bir değer içermiyor (örn. USDT).');
  process.exit(1);
}
if (!API_KEY) {
  console.warn('UYARI: FAUCETPAY_API_KEY tanımlı değil, /balance hata verecek.');
}

// ---------------------------------------------------------------------------
// FaucetPay'den bakiye çek
// ---------------------------------------------------------------------------
function formatAmount(data) {
  // balance_bitcoin: coin cinsinden ondalık değer; yoksa en küçük birimden (8 ondalık) hesapla
  const value = data.balance_bitcoin !== undefined ? Number(data.balance_bitcoin) : Number(data.balance) / 1e8;
  if (!Number.isFinite(value)) return null;
  return value.toFixed(8);
}

async function fetchOne(currency) {
  const r = await fetch(FAUCETPAY_BALANCE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ api_key: API_KEY, currency }).toString(),
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json();
  if (!data || data.status !== 200) {
    throw new Error(`FaucetPay ${currency}: durum ${data && data.status} (${data && data.message})`);
  }
  const amount = formatAmount(data);
  if (amount === null) throw new Error(`FaucetPay ${currency}: bakiye okunamadı`);
  return { currency, amount };
}

let cache = { at: 0, data: null };
let inflight = null;

async function getBalances() {
  const now = Date.now();
  if (cache.data && now - cache.at < CACHE_MS) return cache;
  if (inflight) return inflight; // aynı anda gelen istekler tek FaucetPay çağrısını paylaşır

  inflight = (async () => {
    try {
      const balances = await Promise.all(CURRENCIES.map(fetchOne));
      cache = { at: Date.now(), data: balances };
      return cache;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// ---------------------------------------------------------------------------
// Uygulama
// ---------------------------------------------------------------------------
const app = express();
app.set('trust proxy', Number(env.TRUST_PROXY ?? 1)); // Render/Railway tek proxy arkasında
app.disable('x-powered-by');
app.use(helmet());
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(url => url.trim()) 
  : [];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'OPTIONS'] // Tarayıcı ön kontrollerine (preflight) izin verir
  })
);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Çok fazla istek, biraz sonra tekrar dene.' },
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/balance', limiter, async (_req, res) => {
  if (!API_KEY) return res.status(500).json({ success: false, message: 'Sunucu yapılandırması eksik.' });
  try {
    const { at, data } = await getBalances();
    return res.json({ success: true, balances: data, updatedAt: new Date(at).toISOString() });
  } catch (err) {
    console.error('Bakiye alınamadı:', err.message);
    // Önbellekte eski bir değer varsa onu göster
    if (cache.data) {
      return res.json({ success: true, stale: true, balances: cache.data, updatedAt: new Date(cache.at).toISOString() });
    }
    return res.status(502).json({ success: false, message: 'Bakiye şu an alınamadı.' });
  }
});

module.exports = app;

if (require.main === module) {
  const PORT = env.PORT || 3000;
  app.listen(PORT, () => console.log(`RYFTcoin bakiye servisi: port ${PORT}, para birimleri=${CURRENCIES.join(',')}`));
}
