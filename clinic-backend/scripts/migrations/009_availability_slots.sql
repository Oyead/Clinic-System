-- 45-minute availability slots that staff/owners publish and patients book.
CREATE TABLE IF NOT EXISTS availability_slots (
  id serial PRIMARY KEY,
  clinic_id integer NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id integer NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  starts_at timestamp without time zone NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 45,
  status varchar(20) NOT NULL DEFAULT 'open',
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN ALTER TABLE availability_slots ADD CONSTRAINT availability_slots_status CHECK (status IN ('open', 'booked', 'cancelled')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE availability_slots ADD CONSTRAINT availability_slots_duration CHECK (duration_minutes = 45); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One live slot per doctor per start time (cancelled slots don't collide).
CREATE UNIQUE INDEX IF NOT EXISTS idx_slot_doctor_start_live
  ON availability_slots (doctor_id, starts_at)
  WHERE status IN ('open', 'booked');

CREATE INDEX IF NOT EXISTS idx_slot_doctor_start
  ON availability_slots (doctor_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_slot_clinic_start
  ON availability_slots (clinic_id, starts_at);

-- Link appointments booked through a slot so cancelling frees it again.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS slot_id integer REFERENCES availability_slots(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_appt_slot
  ON appointments (slot_id);
