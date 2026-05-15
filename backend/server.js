const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(cors()); // GitHub Pages'den istek gelebilsin

const API_KEY = process.env.FAUCETPAY_API_KEY || '3986fc2b146d945c34832aff72eb3f33fa5341530db9388832d7b8c21afe5cf2';
const FAUCETPAY_BASE = 'https://faucetpay.io/api/v1';

// Para gönder
app.post('/send', async (req, res) => {
  const { address, amount, currency } = req.body;

  if (!address || !amount || !currency) {
    return res.status(400).json({ success: false, message: 'Adres, miktar ve para birimi gerekli.' });
  }

  try {
    const params = new URLSearchParams({
      api_key: API_KEY,
      to: address,
      amount: amount,
      currency: currency,
      referral: 'false',
    });

    const response = await fetch(`${FAUCETPAY_BASE}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası: ' + err.message });
  }
});

// Bakiye kontrol
app.get('/balance', async (req, res) => {
  const { currency } = req.query;

  try {
    const params = new URLSearchParams({
      api_key: API_KEY,
      currency: currency || 'BTC',
    });

    const response = await fetch(`${FAUCETPAY_BASE}/balance?${params}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası: ' + err.message });
  }
});

// Adres kontrol
app.post('/check-address', async (req, res) => {
  const { address, currency } = req.body;

  try {
    const params = new URLSearchParams({
      api_key: API_KEY,
      address: address,
      currency: currency || 'BTC',
    });

    const response = await fetch(`${FAUCETPAY_BASE}/checkaddress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Sunucu hatası: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FaucetPay backend çalışıyor: port ${PORT}`));
