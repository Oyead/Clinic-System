const express = require('express');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add it to .env before starting the server.');
  process.exit(1);
}

const path = require('path');

const app = express();
app.use(express.json());

const frontendDist = path.resolve(__dirname, '../frontend/dist');
const frontendLegacy = path.resolve(__dirname, '../frontend');
app.use(express.static(frontendDist));
app.use(express.static(frontendLegacy));

const db = require('./src/config/db');

const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const appointmentRoutes = require('./src/routes/appointmentRoutes');
const ownerRoutes = require('./src/routes/ownerRoutes');
const { requireAuth, requireAdmin, requireRole } = require('./src/middleware/auth');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', requireAuth, requireAdmin, adminRoutes);
app.use('/api/v1/appointments', requireAuth, appointmentRoutes);
app.use('/api/v1/owner', requireAuth, requireRole('clinic_owner'), ownerRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'API operational' });
});

// SPA fallback: serve the React build for non-API routes.
app.get(/^(?!\/api\/).*/, (req, res, next) => {
  if (req.method !== 'GET') return next();
  const indexFile = path.join(frontendDist, 'index.html');
  res.sendFile(indexFile, (err) => {
    if (err) next();
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  try {
    const { ensureSuperAdmin } = require('./src/utils/bootstrapAdmin');
    const result = await ensureSuperAdmin();
    if (result.created) {
      console.log('Bootstrap: Super Admin created from .env credentials.');
    }
  } catch (error) {
    console.warn('Bootstrap: Super Admin seed skipped:', error.message);
  }
});
