const express = require('express');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add it to .env before starting the server.');
  process.exit(1);
}

const app = express();
app.use(express.json());

// Serve the plain HTML/CSS frontend (../frontend) on the same origin.
app.use(express.static(require('path').resolve(__dirname, '../frontend')));

const db = require('./src/config/db');

const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const appointmentRoutes = require('./src/routes/appointmentRoutes');
const ownerRoutes = require('./src/routes/ownerRoutes');
const { requireAuth, requireAdmin, requireRole } = require('./src/middleware/auth');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', requireAuth, requireAdmin, adminRoutes);
app.use('/api/v1/appointments', requireAuth, appointmentRoutes);
app.use('/api/v1/owner', requireAuth, requireRole('owner'), ownerRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'API operational' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Bootstrap: on a brand-new deployment with zero admins, create the
  // Super Admin from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD.
  // Never blocks startup and never overwrites existing admins.
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