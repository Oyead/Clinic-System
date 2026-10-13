-- Role hierarchy + account lifecycle flows.
-- Roles: admin | clinic_owner | doctor | receptionist | patient
-- ('owner' is the legacy enum label; 'clinic_owner' is canonical going forward.)

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'clinic_owner';

UPDATE users SET role = 'clinic_owner' WHERE role = 'owner';

ALTER TABLE users ADD COLUMN IF NOT EXISTS original_email varchar(255);

ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_id integer REFERENCES clinics(id) ON DELETE SET NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS status varchar(50) NOT NULL DEFAULT 'active';

ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by integer REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS offboarded_at timestamp without time zone;

UPDATE users u SET clinic_id = d.clinic_id FROM doctors d WHERE d.user_id = u.id AND u.clinic_id IS NULL;

UPDATE users u SET clinic_id = r.clinic_id FROM receptionists r WHERE r.user_id = u.id AND u.clinic_id IS NULL;

UPDATE users u SET clinic_id = o.clinic_id FROM clinic_owners o WHERE o.user_id = u.id AND u.clinic_id IS NULL;

UPDATE users SET status = 'suspended' WHERE is_active = false AND status = 'active';

DO $$ BEGIN ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('pending_verification', 'invited', 'active', 'suspended', 'offboarded')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS status varchar(50) NOT NULL DEFAULT 'active';

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS owner_id integer REFERENCES users(id) ON DELETE SET NULL;

UPDATE clinics c SET owner_id = o.user_id FROM clinic_owners o WHERE o.clinic_id = c.id AND c.owner_id IS NULL;

DO $$ BEGIN ALTER TABLE clinics ADD CONSTRAINT clinics_status_check CHECK (status IN ('pending_verification', 'active', 'suspended')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS staff_invites (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(255) NOT NULL UNIQUE,
  role varchar(50) NOT NULL,
  clinic_id integer NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  expires_at timestamp without time zone NOT NULL,
  accepted_at timestamp without time zone,
  revoked_at timestamp without time zone,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_invites_user ON staff_invites (user_id);

CREATE INDEX IF NOT EXISTS idx_staff_invites_token ON staff_invites (token_hash);

CREATE INDEX IF NOT EXISTS idx_staff_invites_clinic ON staff_invites (clinic_id);

CREATE INDEX IF NOT EXISTS idx_users_clinic ON users (clinic_id);

CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

CREATE INDEX IF NOT EXISTS idx_users_original_email ON users (LOWER(original_email));
