-- Lets the audit trail record appointment status transitions
-- (approve / reject / cancel) alongside user/role changes.
ALTER TABLE admin_audit_logs
  ADD COLUMN IF NOT EXISTS appointment_id integer REFERENCES appointments(id) ON DELETE SET NULL;

ALTER TABLE admin_audit_logs
  ADD COLUMN IF NOT EXISTS old_status varchar(50);

ALTER TABLE admin_audit_logs
  ADD COLUMN IF NOT EXISTS new_status varchar(50);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_appointment
  ON admin_audit_logs (appointment_id);
