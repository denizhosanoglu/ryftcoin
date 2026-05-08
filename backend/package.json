const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json()); // JSON verilerini okuyabilmek için

let totalGlobalClicks = 0;

// Ana sayfa
app.get('/', (req, res) => {
  res.send('Ryftcoin API Aktif!');
});

// Tıklama verisini alan ve toplamı döndüren kısım
app.post('/click', (req, res) => {
  totalGlobalClicks += 1;
  res.json({ 
    message: "Tıklama kaydedildi!", 
    globalTotal: totalGlobalClicks 
  });
});

const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log(`Sunucu ${port} portunda çalışıyor`);
});
