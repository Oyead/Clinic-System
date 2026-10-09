-- Adds a 'pending' status for appointment requests awaiting approval
-- by a doctor or receptionist.
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'pending';

-- Prevents double-booking: a doctor may only have one active (pending or
-- scheduled) appointment at any given time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_active_slot
  ON appointments (doctor_id, appointment_date)
  WHERE status IN ('pending', 'scheduled');