# RYFTcoin

Sayfada FaucetPay faucet hesabının bakiyesi görünür. Başka bir şey yapmaz.

İki parçası var:

- `docs/` : sayfa (GitHub Pages ile ryftcoin.com'da yayınlanır)
- `backend/` : küçük bir sunucu. FaucetPay'den bakiyeyi o çeker, çünkü API anahtarı sayfaya konamaz (herkes görür).

## Backend'i çalıştırmak (Render, ücretsiz)

1. render.com'da giriş yap, **New → Web Service**, bu GitHub reposunu seç.
2. Ayarlar:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Free
3. **Environment** kısmına şunu ekle:
   - `FAUCETPAY_API_KEY` = FaucetPay'den aldığın anahtar
4. Deploy bitince Render'ın verdiği adresi (örn. `https://ryftcoin.onrender.com`) kopyala.
5. `docs/index.html` içinde `BACKEND_URL` satırına bu adresi yaz, GitHub'a yükle.

Not: Ücretsiz sunucu 15 dakika kullanılmazsa uyur, ilk açılışta bakiye yaklaşık 1 dakika geç gelir.

## Güvenlik

API anahtarını koda, README'ye ya da herhangi bir dosyaya YAZMA. Sadece Render'daki Environment alanında dursun.
