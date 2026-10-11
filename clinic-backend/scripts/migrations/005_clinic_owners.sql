ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';

CREATE TABLE IF NOT EXISTS clinic_owners (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clinic_id integer NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_clinic_owners_user
  ON clinic_owners (user_id);

CREATE INDEX IF NOT EXISTS idx_clinic_owners_clinic
  ON clinic_owners (clinic_id);

ALTER TABLE admin_audit_logs
  ADD COLUMN IF NOT EXISTS clinic_id integer REFERENCES clinics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_clinic
  ON admin_audit_logs (clinic_id);
