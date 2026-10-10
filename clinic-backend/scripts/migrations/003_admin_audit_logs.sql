-- Audit trail for admin creation and role changes.
-- Satisfies "Critical Security Safeguards: Audit Logging".
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id serial PRIMARY KEY,
  action varchar(50) NOT NULL,
  target_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  target_email varchar(255),
  old_role varchar(50),
  new_role varchar(50),
  performed_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target
  ON admin_audit_logs (target_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_performed_by
  ON admin_audit_logs (performed_by);
