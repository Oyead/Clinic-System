const express = require('express');
require('dotenv').config();

const app = express();
app.use(express.json());

const db = require('./src/config/db');

app.get('/api/health', (req, res) => {
  res.json({ status: 'API operational' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});