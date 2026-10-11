CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 30;

DO $$ BEGIN ALTER TABLE doctors ADD CONSTRAINT doctors_duration_range CHECK (duration_minutes > 0 AND duration_minutes <= 480); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

UPDATE appointments
  SET duration_minutes = 30
  WHERE duration_minutes IS NULL;

ALTER TABLE appointments
  ALTER COLUMN duration_minutes SET DEFAULT 30;

ALTER TABLE appointments
  ALTER COLUMN duration_minutes SET NOT NULL;

DO $$ BEGIN ALTER TABLE appointments ADD CONSTRAINT appointments_duration_range CHECK (duration_minutes > 0 AND duration_minutes <= 480); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS ends_at timestamp
  GENERATED ALWAYS AS (appointment_date + (duration_minutes * INTERVAL '1 minute')) STORED;

CREATE INDEX IF NOT EXISTS idx_appt_doctor_range
  ON appointments USING gist (doctor_id, tsrange(appointment_date, ends_at, '[)'));

DO $$ BEGIN ALTER TABLE appointments ADD CONSTRAINT no_doctor_overlap EXCLUDE USING gist (doctor_id WITH =, tsrange(appointment_date, ends_at, '[)') WITH &&) WHERE (status IN ('pending', 'scheduled')); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE operating_hours ADD CONSTRAINT operating_hours_dow_range CHECK (day_of_week BETWEEN 0 AND 6); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE operating_hours ADD CONSTRAINT operating_hours_open_before_close CHECK (open_time < close_time); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE operating_hours ADD CONSTRAINT operating_hours_clinic_day_unique UNIQUE (clinic_id, day_of_week); EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_operating_hours_clinic
  ON operating_hours (clinic_id);
