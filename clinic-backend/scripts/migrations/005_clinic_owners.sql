-- Clinic-owner role: clinic-scoped managers between global admin and staff.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';

-- Maps owners to the clinics they manage (many-to-many: an owner can run
-- several clinics, a clinic can have several owners).
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

-- Lets audit rows attribute owner-scoped actions to a clinic.
ALTER TABLE admin_audit_logs
  ADD COLUMN IF NOT EXISTS clinic_id integer REFERENCES clinics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_clinic
  ON admin_audit_logs (clinic_id);
