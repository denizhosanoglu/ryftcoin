const express = require('express');
const app = express();
const port = process.env.PORT || 8000;

app.get('/', (req, res) => {
  res.send('Ryftcoin Backend Yayında!');
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Sunucu ${port} portunda çalışıyor`);
});
