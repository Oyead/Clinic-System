const adminModel = require('../models/adminModel');
const ownerModel = require('../models/ownerModel');
const db = require('../config/db');
const { hashPassword, verifyPassword } = require('../utils/password');
const { hashInviteToken } = require('../utils/invites');
const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  REFRESH_EXPIRES_IN_MS,
} = require('../utils/tokens');
const userSessionModel = require('../models/userSessionModel');
const { LOGINABLE_STATUSES } = require('../utils/roles');

const parseCookies = (req) => {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, pair) => {
    const [key, ...valParts] = pair.split('=');
    if (key) acc[key.trim()] = valParts.join('=').trim();
    return acc;
  }, {});
};

const normalizeEmail = (email) =>
  typeof email === 'string' ? email.trim().toLowerCase() : '';

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  clinic_id: user.clinic_id || null,
  status: user.status,
});

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: process.env.COOKIE_SAMESITE || 'Lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: REFRESH_EXPIRES_IN_MS,
});

// Issue a full access + refresh token pair for a user.
const issueTokens = async (res, user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await userSessionModel.createSession({
    user_id: user.id,
    token: refreshToken,
    expires_in_ms: REFRESH_EXPIRES_IN_MS,
  });
  res.cookie('refresh_token', refreshToken, cookieOptions());
  return { accessToken, refreshToken };
};

// Clear the refresh token cookie.
const clearRefreshCookie = (res) => {
  res.clearCookie('refresh_token', { path: '/', sameSite: process.env.COOKIE_SAMESITE || 'Lax', secure: process.env.NODE_ENV === 'production' });
};

// 1. Patients: public signup, no approval. Role hardcoded server-side.
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
          { email, password_hash: hashPassword(password), role: 'patient', status: 'active' },
          client
        );
        if (name) {
          await adminModel.createPatient(
            { user_id: user.id, name, phone_number: null, email },
            client
          );
        }
        await adminModel.createAuditLog({
          action: 'patient_signup',
          target_user_id: user.id,
          target_email: user.email,
          old_role: null,
          new_role: 'patient',
          performed_by: null,
        }, client);
        return user;
      });

      const { accessToken } = await issueTokens(res, created);
      return res.status(201).json({
        message: 'Account created.',
        token: accessToken,
        user: publicUser(created),
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

// 2. Clinic owners: separate public surface. Creates the owner (pending) +
// the clinic (pending). Admin approval activates both.
const signupClinic = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password, name, clinic } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters.' });
    }
    if (!clinic || !clinic.name || !clinic.phone_number || !clinic.address) {
      return res.status(409).json({
        error: 'clinic name, phone_number, and address are required.',
      });
    }

    try {
      const created = await db.withTransaction(async (client) => {
        const user = await adminModel.createUser(
          {
            email,
            password_hash: hashPassword(password),
            role: 'clinic_owner',
            status: 'pending_verification',
          },
          client
        );
        const row = await adminModel.createClinic(
          {
            name: clinic.name,
            phone_number: clinic.phone_number,
            address: clinic.address,
            email: normalizeEmail(clinic.email) || email,
            status: 'pending_verification',
            owner_id: user.id,
          },
          client
        );
        await ownerModel_.assignOwner(user.id, row.id, client);
        await client.query(`UPDATE users SET clinic_id = $1 WHERE id = $2;`, [row.id, user.id]);
        user.clinic_id = row.id;
        await adminModel.createAuditLog({
          action: 'clinic_signup',
          target_user_id: user.id,
          target_email: user.email,
          old_role: null,
          new_role: 'clinic_owner',
          performed_by: null,
          clinic_id: row.id,
        }, client);
        return { user, clinic: row };
      });

      const { accessToken } = await issueTokens(res, created.user);
      return res.status(201).json({
        message: 'Clinic submitted for verification. You can sign in, but staff invites unlock after approval.',
        token: accessToken,
        user: publicUser(created.user),
        clinic: created.clinic,
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
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.status === 'invited') {
      return res.status(403).json({ error: 'Invite not accepted yet. Use your invite link to set a password.' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended. Contact your clinic or platform support.' });
    }
    if (user.status === 'offboarded' || !user.is_active) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { accessToken } = await issueTokens(res, user);

    const payload = { token: accessToken, user: publicUser(user) };
    if (user.status === 'pending_verification') {
      payload.pending_verification = true;
      payload.message = 'Account pending verification. Staff invites unlock after approval.';
    }
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Doctor/receptionist accept: invite token + new password -> active.
const acceptInvite = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'token and password are required.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters.' });
    }

    const invite = await adminModel.getInviteByTokenHash(hashInviteToken(token));
    if (!invite || invite.revoked_at || invite.accepted_at) {
      return res.status(400).json({ error: 'Invite is invalid or no longer active.' });
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return res.status(410).json({ error: 'Invite expired. Ask your clinic owner to resend it.' });
    }
    if (invite.user_status !== 'invited') {
      return res.status(409).json({ error: 'Invite was already used or the account moved on.' });
    }

    const user = await db.withTransaction(async (client) => {
      await adminModel.setUserPassword(invite.user_id, hashPassword(password), client);
      const row = await adminModel.setUserStatus(invite.user_id, 'active', client);
      await adminModel.acceptInvite(invite.id, client);
      await adminModel.createAuditLog({
        action: 'invite_accepted',
        target_user_id: invite.user_id,
        target_email: invite.user_email,
        old_role: null,
        new_role: invite.role,
        performed_by: null,
        clinic_id: invite.clinic_id,
      }, client);
      return row;
    });

    const { accessToken } = await issueTokens(res, { id: user.id, role: invite.role });

    res.status(200).json({
      message: 'Invite accepted. You are now signed in.',
      token: accessToken,
      user: publicUser({ ...user, role: invite.role }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /auth/refresh - rotate access token using the httpOnly refresh cookie.
const refresh = async (req, res) => {
  try {
    const refreshToken = parseCookies(req).refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token. Please sign in.' });
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh token invalid or expired. Please sign in.' });
    }
    if (payload.type !== 'refresh') {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Invalid token type.' });
    }

    const token_hash = userSessionModel.hashToken(refreshToken);
    const session = await userSessionModel.getSessionByHash(token_hash);
    if (!session || session.revoked_at) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Session revoked. Please sign in.' });
    }
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await userSessionModel.revokeSession(token_hash);
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Session expired. Please sign in.' });
    }

    const user = await adminModel.getUserById(session.user_id);
    if (!user || !user.is_active || !LOGINABLE_STATUSES.includes(user.status)) {
      await userSessionModel.revokeSession(token_hash);
      clearRefreshCookie(res);
      const message = user ? (() => {
        if (user.status === 'invited') return 'Invite not accepted yet.';
        if (user.status === 'suspended') return 'Account suspended.';
        if (user.status === 'offboarded') return 'Account offboarded.';
        return 'Invalid session.';
      })() : 'Invalid session.';
      return res.status(403).json({ error: message });
    }

    // Rotate: revoke old session, issue a new one.
    await userSessionModel.revokeSession(token_hash);
    const { accessToken } = await issueTokens(res, user);

    return res.status(200).json({
      token: accessToken,
      user: publicUser(user),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /auth/signout - revoke the current refresh session and clear the cookie.
const signout = async (req, res) => {
  try {
    const refreshToken = parseCookies(req).refresh_token;
    if (refreshToken) {
      await userSessionModel.revokeSession(userSessionModel.hashToken(refreshToken));
    }
    clearRefreshCookie(res);
    return res.status(200).json({ message: 'Signed out.' });
  } catch (error) {
    clearRefreshCookie(res);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = { signup, signupClinic, login, acceptInvite, refresh, signout };
