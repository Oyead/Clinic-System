const jwt = require('jsonwebtoken');
const adminModel = require('../models/adminModel');
const db = require('../config/db');
const { hashPassword, verifyPassword } = require('../utils/password');

const normalizeEmail = (email) =>
  typeof email === 'string' ? email.trim().toLowerCase() : '';

// Public patient self-registration. Role is fixed to 'patient' —
// privilege escalation via signup is not possible.
const signup = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters.' });
    }

    try {
      const created = await db.withTransaction(async (client) => {
        const user = await adminModel.createUser(
          { email, password_hash: hashPassword(password), role: 'patient' },
          client
        );
        if (name) {
          await adminModel.createPatient(
            { user_id: user.id, name, phone_number: null, email },
            client
          );
        }
        return user;
      });

      return res.status(201).json({
        message: 'Account created. Please sign in.',
        user: { id: created.id, email: created.email, role: created.role },
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'User already exists, please login' });
      }
      throw error;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }

    const user = await adminModel.getUserByEmail(email);
    if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(200).json({
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { signup, login };
