const jwt = require('jsonwebtoken');
const adminModel = require('../models/adminModel');
const { normalizeRole, LOGINABLE_STATUSES } = require('../utils/roles');

const statusError = (status) => {
  if (status === 'invited') return 'Invite not accepted yet. Use your invite link to set a password.';
  if (status === 'suspended') return 'Account suspended. Contact your clinic or platform support.';
  if (status === 'offboarded') return 'Invalid or expired token';
  if (status === 'pending_verification') return null;
  return 'Invalid or expired token';
};

const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await adminModel.getUserById(payload.id);
    if (!user || !user.is_active || !LOGINABLE_STATUSES.includes(user.status)) {
      const message = user ? statusError(user.status) || 'Invalid or expired token' : 'Invalid or expired token';
      const code = user && (user.status === 'invited' || user.status === 'suspended' || user.status === 'pending_verification') ? 403 : 401;
      return res.status(code).json({ error: message });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || normalizeRole(req.user.role) !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requireRole = (...roles) => {
  const wanted = roles.map(normalizeRole);
  return (req, res, next) => {
    if (!req.user || !wanted.includes(normalizeRole(req.user.role))) {
      return res.status(403).json({ error: 'Access denied for your role' });
    }
    next();
  };
};

module.exports = { requireAuth, requireAdmin, requireRole };
