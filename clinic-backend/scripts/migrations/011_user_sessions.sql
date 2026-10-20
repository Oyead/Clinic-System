-- Refresh token store for persistent login sessions.
-- One row per active refresh token. Rotated on refresh; revoked on signout,
-- suspension, offboarding, or password change.
CREATE TABLE IF NOT EXISTS user_sessions (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(255) NOT NULL UNIQUE,
  expires_at timestamp without time zone NOT NULL,
  revoked_at timestamp without time zone,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions (expires_at);
