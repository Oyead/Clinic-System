const express = require('express');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add it to .env before starting the server.');
  process.exit(1);
}

const app = express();
app.use(express.json());

const db = require('./src/config/db');

const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const { requireAuth, requireAdmin } = require('./src/middleware/auth');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', requireAuth, requireAdmin, adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'API operational' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});