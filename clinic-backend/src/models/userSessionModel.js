const db = require("../config/db");
const crypto = require("crypto");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const createSession = async ({ user_id, token, expires_in_ms }, client = db) => {
  const token_hash = hashToken(token);
  const expires_at = new Date(Date.now() + expires_in_ms);
  const query = `
    INSERT INTO user_sessions (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, token_hash, expires_at, created_at;
  `;
  const result = await client.query(query, [user_id, token_hash, expires_at]);
  return result.rows[0];
};

const getSessionByHash = async (token_hash, client = db) => {
  const query = `
    SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
    FROM user_sessions
    WHERE token_hash = $1;
  `;
  const result = await client.query(query, [token_hash]);
  return result.rows[0];
};

const revokeSession = async (token_hash, client = db) => {
  const query = `
    UPDATE user_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE token_hash = $1 AND revoked_at IS NULL
    RETURNING id, user_id, revoked_at;
  `;
  const result = await client.query(query, [token_hash]);
  return result.rows[0];
};

const revokeAllSessionsForUser = async (user_id, client = db) => {
  const query = `
    UPDATE user_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE user_id = $1 AND revoked_at IS NULL
    RETURNING id;
  `;
  const result = await client.query(query, [user_id]);
  return result.rows;
};

const markSessionRevoked = async (id, client = db) => {
  const query = `
    UPDATE user_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND revoked_at IS NULL
    RETURNING id;
  `;
  const result = await client.query(query, [id]);
  return result.rows[0];
};

module.exports = {
  hashToken,
  createSession,
  getSessionByHash,
  revokeSession,
  revokeAllSessionsForUser,
  markSessionRevoked,
};
