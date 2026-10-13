const crypto = require('crypto');

// Invite tokens: the raw token is returned once at creation (dev-mode: the
// owner shares it with the invitee; production would email it). Only the
// sha256 hash is persisted.
const INVITE_TTL_DAYS = Number(process.env.INVITE_EXPIRES_DAYS) || 7;

const generateInviteToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
};

const hashInviteToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

const inviteExpiry = () => {
  const d = new Date();
  d.setDate(d.getDate() + INVITE_TTL_DAYS);
  return d;
};

// Unusable password placeholder for invited rows (no login until accepted).
const placeholderPasswordHash = () => `invited$${crypto.randomBytes(16).toString('hex')}`;

// Rotation for suspended rows (kills password auth even if status check is missed).
const suspendedPasswordHash = () => `suspended$${crypto.randomBytes(16).toString('hex')}`;

module.exports = {
  INVITE_TTL_DAYS,
  generateInviteToken,
  hashInviteToken,
  inviteExpiry,
  placeholderPasswordHash,
  suspendedPasswordHash,
};
