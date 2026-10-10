const db = require('../config/db');
const adminModel = require('../models/adminModel');
const { hashPassword } = require('./password');

const isValidEmail = (email) =>
  typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/**
 * Bootstrap the master Super Admin on a brand-new deployment.
 * Idempotent: creates an admin only when zero active admins exist.
 *
 * Credentials come from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD env vars,
 * with optional explicit overrides (e.g. CLI args).
 *
 * @returns {Promise<{created: boolean, user: object|null}>}
 */
const ensureSuperAdmin = async (overrides = {}) => {
  const email = (overrides.email || process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = overrides.password || process.env.SUPER_ADMIN_PASSWORD || '';

  const adminCount = await adminModel.countActiveAdmins();
  if (adminCount > 0) {
    return { created: false, user: null, reason: 'admin-exists', adminCount };
  }

  if (!isValidEmail(email)) {
    throw new Error(
      'No admin exists and SUPER_ADMIN_EMAIL is missing or invalid. Set a valid SUPER_ADMIN_EMAIL in .env.'
    );
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error(
      'No admin exists and SUPER_ADMIN_PASSWORD is missing or too short (minimum 8 characters). Set it in .env.'
    );
  }

  try {
    const user = await db.withTransaction(async (client) => {
      const created = await adminModel.createUser(
        { email, password_hash: hashPassword(password), role: 'admin' },
        client
      );
      try {
        await adminModel.createAuditLog(
          {
            action: 'bootstrap_super_admin',
            target_user_id: created.id,
            target_email: created.email,
            old_role: null,
            new_role: 'admin',
            performed_by: null,
          },
          client
        );
      } catch (auditError) {
        // Audit table may not be migrated yet on a brand-new DB; don't block bootstrap.
        console.warn('Warning: could not write bootstrap audit log:', auditError.message);
      }
      return created;
    });
    console.log(`Bootstrapped Super Admin: ${user.email} (id=${user.id})`);
    return { created: true, user };
  } catch (error) {
    if (error.code === '23505') {
      // Lost a race with another boot process / seeder.
      const existing = await adminModel.getUserByEmail(email);
      return { created: false, user: null, reason: 'race-exists', existing: existing || null };
    }
    throw error;
  }
};

module.exports = { ensureSuperAdmin };
