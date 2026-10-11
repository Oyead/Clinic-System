CREATE INDEX IF NOT EXISTS idx_users_lower_email
  ON users (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_appt_patient_date
  ON appointments (patient_id, appointment_date DESC);

CREATE INDEX IF NOT EXISTS idx_appt_doctor_status_date
  ON appointments (doctor_id, status, appointment_date DESC);

CREATE INDEX IF NOT EXISTS idx_appt_clinic_status_date
  ON appointments (clinic_id, status, appointment_date DESC);

CREATE INDEX IF NOT EXISTS idx_appt_clinic_date
  ON appointments (clinic_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_appt_status_date
  ON appointments (status, appointment_date DESC);

CREATE INDEX IF NOT EXISTS idx_users_role
  ON users (role);

CREATE INDEX IF NOT EXISTS idx_users_role_active
  ON users (role, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_audit_created_id
  ON admin_audit_logs (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_bills_clinic_created
  ON bills (clinic_id, created_at);

CREATE INDEX IF NOT EXISTS idx_bills_clinic_status_created
  ON bills (clinic_id, payment_status, created_at);

CREATE INDEX IF NOT EXISTS idx_doctors_clinic
  ON doctors (clinic_id);

CREATE INDEX IF NOT EXISTS idx_receptionists_clinic
  ON receptionists (clinic_id);

CREATE INDEX IF NOT EXISTS idx_doctors_user_clinic
  ON doctors (user_id, clinic_id);

CREATE INDEX IF NOT EXISTS idx_receptionists_user_clinic
  ON receptionists (user_id, clinic_id);

CREATE INDEX IF NOT EXISTS idx_patients_unlinked
  ON patients (id)
  WHERE user_id IS NULL;
