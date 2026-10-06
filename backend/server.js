'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Ayarlar (hepsi ortam değişkeninden gelir, koda gizli bilgi YAZILMAZ)
// ---------------------------------------------------------------------------
const env = process.env;

const PAYOUT_MODE = env.PAYOUT_MODE === 'live' ? 'live' : 'test';
const API_KEY = env.FAUCETPAY_API_KEY || '';
const TURNSTILE_SECRET = env.TURNSTILE_SECRET || '';
const TURNSTILE_SITE_KEY = env.TURNSTILE_SITE_KEY || '';
const ADMIN_TOKEN = env.ADMIN_TOKEN || '';

const FAUCETPAY_BASE = 'https://faucetpay.io/api/v1';
const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const COOLDOWN_MS = Math.max(1, Number(env.COOLDOWN_MINUTES) || 60) * 60 * 1000;
const DAILY_MAX_PAYOUTS = Math.max(1, Number(env.DAILY_MAX_PAYOUTS) || 50);
const DATA_FILE = env.DATA_FILE || path.join(__dirname, 'data', 'state.json');

const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS || 'https://ryftcoin.com,https://www.ryftcoin.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// "USDT:10000,DOGE:50000" -> { USDT: 10000, DOGE: 50000 }  (FaucetPay'in en küçük birimi cinsinden)
function parsePayouts(raw) {
  const out = {};
  for (const part of String(raw || '').split(',')) {
    const [code, amt] = part.split(':').map((s) => (s || '').trim());
    const n = Number(amt);
    if (/^[A-Z0-9]{2,10}$/.test(code || '') && Number.isSafeInteger(n) && n > 0) out[code] = n;
  }
  return out;
}
const PAYOUTS = parsePayouts(env.PAYOUT_AMOUNTS || 'USDT:10000');

const UNIT_DECIMALS = 8; // FaucetPay bakiyeleri 8 ondalık (1 birim = 0.00000001)
function displayAmount(units) {
  return (units / 10 ** UNIT_DECIMALS).toFixed(UNIT_DECIMALS).replace(/0+$/, '').replace(/\.$/, '');
}

// Başlangıç kontrolleri
if (Object.keys(PAYOUTS).length === 0) {
  console.error('HATA: PAYOUT_AMOUNTS geçerli bir değer içermiyor (örn. USDT:10000).');
  process.exit(1);
}
if (PAYOUT_MODE === 'live' && (!API_KEY || !TURNSTILE_SECRET)) {
  console.error('HATA: live modda FAUCETPAY_API_KEY ve TURNSTILE_SECRET zorunlu.');
  process.exit(1);
}
if (!TURNSTILE_SECRET) {
  console.warn('UYARI: TURNSTILE_SECRET yok, bot doğrulaması geçilemez, çekimler reddedilecek.');
}

// ---------------------------------------------------------------------------
// Basit kalıcı durum (bekleme süreleri + günlük sayaç)
// Not: Railway/Render'da dosya sistemi deploy'da sıfırlanabilir; kalıcı olması için
// bir Volume bağla ve DATA_FILE'ı onun içine yönlendir, ya da ileride veritabanına geç.
// ---------------------------------------------------------------------------
let state = { cooldowns: {}, daily: { day: '', count: 0 } };

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object') {
      state.cooldowns = parsed.cooldowns && typeof parsed.cooldowns === 'object' ? parsed.cooldowns : {};
      state.daily = parsed.daily && typeof parsed.daily === 'object' ? parsed.daily : state.daily;
    }
  } catch (_) {
    /* dosya yoksa ya da bozuksa sıfırdan başla */
  }
}

function saveState() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error('Durum kaydedilemedi:', err.message);
  }
}

function pruneState(now) {
  for (const [k, t] of Object.entries(state.cooldowns)) {
    if (now - t >= COOLDOWN_MS) delete state.cooldowns[k];
  }
}

function today() {
  return new Date().toISOString().slice(0, 10); // UTC günü
}

loadState();

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------
const ADDRESS_RE = /^[A-Za-z0-9@._+\-:]{3,128}$/; // e-posta, kullanıcı adı ya da cüzdan adresi

function fail(res, status, message, extra) {
  return res.status(status).json({ success: false, message, ...(extra || {}) });
}

async function verifyTurnstile(token, ip) {
  if (!TURNSTILE_SECRET) return false;
  try {
    const body = new URLSearchParams({ secret: TURNSTILE_SECRET, response: token });
    if (ip) body.set('remoteip', ip);
    const r = await fetch(TURNSTILE_URL, { method: 'POST', body, signal: AbortSignal.timeout(10000) });
    const data = await r.json();
    return data.success === true;
  } catch (err) {
    console.error('Turnstile doğrulama hatası:', err.message);
    return false;
  }
}

// Dönüş: { ok, id, definitive, message }
//  definitive=false -> sonuç belirsiz (zaman aşımı vb.), bekleme süresi GERİ ALINMAZ (çift ödeme riski)
async function sendPayout({ address, amount, currency, ip }) {
  if (PAYOUT_MODE === 'test') {
    console.log(`[TEST] ${amount} ${currency} -> ${address} (gerçek ödeme yapılmadı)`);
    return { ok: true, id: 'test-' + crypto.randomUUID() };
  }
  try {
    const body = new URLSearchParams({
      api_key: API_KEY,
      to: address,
      amount: String(amount),
      currency,
    });
    if (ip) body.set('ip_address', ip);

    const r = await fetch(`${FAUCETPAY_BASE}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(20000),
    });
    const data = await r.json().catch(() => null);

    if (data && data.status === 200) return { ok: true, id: data.payout_id || null };

    const code = data && data.status;
    console.error(`FaucetPay hata kodu: ${code} (${data && data.message})`);
    if (code === 456) return { ok: false, definitive: true, message: 'Bu adres FaucetPay hesabına bağlı değil.' };
    if (code === 402) return { ok: false, definitive: true, message: 'Faucet bakiyesi şu an yetersiz, sonra tekrar dene.' };
    if (code === 459) return { ok: false, definitive: true, message: 'Çok sık istek, biraz bekleyip tekrar dene.' };
    return { ok: false, definitive: true, message: 'Ödeme şu an yapılamadı, sonra tekrar dene.' };
  } catch (err) {
    console.error('FaucetPay istek hatası (sonuç belirsiz):', err.message);
    return { ok: false, definitive: false, message: 'Ödeme durumu doğrulanamadı, lütfen daha sonra tekrar dene.' };
  }
}

// ---------------------------------------------------------------------------
// Uygulama
// ---------------------------------------------------------------------------
const app = express();
app.set('trust proxy', Number(env.TRUST_PROXY ?? 1)); // Railway/Render tek proxy arkasında
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(
  cors({
    origin(origin, cb) {
      // origin yoksa (curl vb.) geç; asıl koruma Turnstile + limitler
      cb(null, !origin || ALLOWED_ORIGINS.includes(origin));
    },
    methods: ['GET', 'POST'],
  })
);

const withdrawLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Çok fazla deneme yaptın, biraz sonra tekrar dene.' },
});

app.get('/health', (_req, res) => res.json({ ok: true }));

// Arayüz için herkese açık, hassas olmayan ayarlar
app.get('/config', (_req, res) => {
  res.json({
    mode: PAYOUT_MODE,
    cooldownMinutes: Math.round(COOLDOWN_MS / 60000),
    turnstileSiteKey: TURNSTILE_SITE_KEY,
    currencies: Object.entries(PAYOUTS).map(([code, amount]) => ({ code, amount: displayAmount(amount) })),
  });
});

app.post('/withdraw', withdrawLimiter, async (req, res) => {
  const { address, currency, token } = req.body || {};

  if (typeof address !== 'string' || typeof currency !== 'string' || typeof token !== 'string') {
    return fail(res, 400, 'Eksik ya da hatalı istek.');
  }
  const addr = address.trim();
  const cur = currency.trim().toUpperCase();
  const amount = PAYOUTS[cur];

  if (!ADDRESS_RE.test(addr)) return fail(res, 400, 'Adres geçersiz görünüyor.');
  if (!amount) return fail(res, 400, 'Bu para birimi desteklenmiyor.');
  if (token.length < 10 || token.length > 2048) return fail(res, 400, 'Bot doğrulamasını tamamla.');

  const ip = req.ip;

  // 1) Bot doğrulaması
  if (!(await verifyTurnstile(token, ip))) {
    return fail(res, 403, 'Bot doğrulaması başarısız, sayfayı yenileyip tekrar dene.');
  }

  // 2) Limit kontrolü + rezervasyon (arada await yok, yarış durumu oluşmaz)
  const now = Date.now();
  pruneState(now);
  const addrKey = 'addr:' + addr.toLowerCase();
  const ipKey = 'ip:' + ip;

  for (const key of [addrKey, ipKey]) {
    const last = state.cooldowns[key];
    if (last && now - last < COOLDOWN_MS) {
      const mins = Math.ceil((COOLDOWN_MS - (now - last)) / 60000);
      return fail(res, 429, `Bir sonraki çekim için ${mins} dakika beklemelisin.`, { retryAfterMinutes: mins });
    }
  }
  if (state.daily.day !== today()) state.daily = { day: today(), count: 0 };
  if (state.daily.count >= DAILY_MAX_PAYOUTS) {
    return fail(res, 503, 'Bugünkü çekim limiti doldu, yarın tekrar dene.');
  }

  state.cooldowns[addrKey] = now;
  state.cooldowns[ipKey] = now;
  state.daily.count += 1;
  saveState();

  // 3) Ödeme
  const result = await sendPayout({ address: addr, amount, currency: cur, ip });

  if (!result.ok) {
    if (result.definitive) {
      // Ödeme kesin yapılmadı: rezervasyonu geri al
      if (state.cooldowns[addrKey] === now) delete state.cooldowns[addrKey];
      if (state.cooldowns[ipKey] === now) delete state.cooldowns[ipKey];
      if (state.daily.day === today() && state.daily.count > 0) state.daily.count -= 1;
      saveState();
    }
    return fail(res, 502, result.message);
  }

  console.log(`Ödeme: ${displayAmount(amount)} ${cur} -> ${addr} (ip ${ip})`);
  return res.json({
    success: true,
    message: 'Çekim gönderildi.',
    amount: displayAmount(amount),
    currency: cur,
    id: result.id || null,
    test: PAYOUT_MODE === 'test',
  });
});

// Yönetici: faucet bakiyesini gör (ADMIN_TOKEN yoksa kapalı). Birimleri doğrulamak için de kullanılır.
app.get('/admin/balance', async (req, res) => {
  const given = String(req.get('x-admin-token') || '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(ADMIN_TOKEN).digest();
  if (!ADMIN_TOKEN || !crypto.timingSafeEqual(a, b)) return fail(res, 401, 'Yetkisiz.');
  if (!API_KEY) return fail(res, 500, 'FAUCETPAY_API_KEY tanımlı değil.');
  try {
    const currency = String(req.query.currency || 'USDT').toUpperCase();
    const r = await fetch(`${FAUCETPAY_BASE}/balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ api_key: API_KEY, currency }).toString(),
      signal: AbortSignal.timeout(15000),
    });
    return res.json(await r.json());
  } catch (err) {
    return fail(res, 502, 'FaucetPay erişilemedi: ' + err.message);
  }
});

module.exports = app;

if (require.main === module) {
  const PORT = env.PORT || 3000;
  app.listen(PORT, () =>
    console.log(`RYFTcoin backend: port ${PORT}, mod=${PAYOUT_MODE}, para birimleri=${Object.keys(PAYOUTS).join(',')}`)
  );
}
