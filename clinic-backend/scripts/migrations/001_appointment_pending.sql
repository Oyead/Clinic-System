ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_doctor_active_slot
  ON appointments (doctor_id, appointment_date)
  WHERE status IN ('pending', 'scheduled');
