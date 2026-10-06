# RYFTcoin kurulum

## 0. Önce güvenlik (5 dakika)

1. FaucetPay'de API anahtarını yenile (eskisi eski repo kodunda açıktaydı).
2. Namecheap, Gmail, Cloudflare ve FaucetPay şifrelerini değiştir, hepsinde 2FA aç.
3. `secret.txt` gibi dosyaları asla GitHub'a yükleme (`.gitignore` bunu engeller).

## 1. Cloudflare Turnstile (bot doğrulaması)

1. Cloudflare paneli → Turnstile → "Add site".
2. Domain: `ryftcoin.com`. Widget türü: Managed.
3. Çıkan **Site Key** ve **Secret Key**'i not al (aşağıdaki değişkenlere girilecek).

## 2. Backend'i çalıştır (Railway veya Render)

1. Bu klasördeki `backend/` içeriğini GitHub reposuna yükle (repo kökünde `backend/` ve `docs/` olsun).
2. Railway'de projeyi aç, GitHub reposunu bağla, "Root Directory" olarak `backend` seç.
3. Variables kısmına `backend/.env.example` içindeki değişkenleri gir:
   - `PAYOUT_MODE=test` (önce test)
   - `TURNSTILE_SECRET` ve `TURNSTILE_SITE_KEY` → Cloudflare'dan aldığın gerçek anahtarlar
   - `FAUCETPAY_API_KEY` → yeni anahtar
   - `ADMIN_TOKEN` → uzun rastgele bir parola
4. Deploy sonrası Railway'in verdiği adresi (örn. `https://xxxx.up.railway.app`) kopyala.
5. `docs/index.html` içinde `BACKEND_URL` satırını bu adresle değiştir, GitHub'a yükle.

## 3. Canlıya geçmeden önce birim kontrolü

`PAYOUT_AMOUNTS=USDT:10000` değeri FaucetPay'in en küçük birimi cinsindendir ve 8 ondalık varsayar
(10000 = 0.0001 USDT). Doğrulamak için:

```
curl -H "x-admin-token: <ADMIN_TOKEN>" "https://<backend-adresin>/admin/balance?currency=USDT"
```

Dönen `balance` değeri, FaucetPay panelindeki bakiyenin 100.000.000 katı olmalı
(örnek: panelde 0.00529644 USDT görünüyorsa `529644` dönmeli). Tutmuyorsa `PAYOUT_AMOUNTS` değerini ona göre düzelt.

## 4. Canlıya geç

1. Test modunda siteden çekim dene (log'da `[TEST]` satırı görünür).
2. FaucetPay'e USDT yatır, `PAYOUT_MODE=live` yap, kendi FaucetPay adresinle en küçük miktarı dene.
3. `COOLDOWN_MINUTES` ve `DAILY_MAX_PAYOUTS` ile günlük harcamanı sınırla (günlük maksimum = `DAILY_MAX_PAYOUTS` × çekim miktarı).

## Bilinmesi gerekenler

- Çekimler sadece FaucetPay'e kayıtlı adreslere gidebilir (FaucetPay kuralı); kayıtsız adres "bağlı değil" hatası alır.
- Bekleme süreleri `backend/data/state.json` dosyasında tutulur. Railway/Render'da dosyalar yeniden deploy'da silinebilir; kalıcı yapmak için Volume bağla ve `DATA_FILE` değişkenini onun içine yönlendir.
- Bu sürümde kullanıcı hesabı/bakiye yok, sadece adres + captcha ile tek seferlik çekim var. Oyun/CP/seviye sistemi bir sonraki adım.
