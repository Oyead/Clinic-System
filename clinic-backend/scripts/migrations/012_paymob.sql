ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'awaiting_payment';

ALTER TABLE doctors ADD COLUMN IF NOT EXISTS consultation_fee numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE doctors DROP CONSTRAINT IF EXISTS doctors_consultation_fee_nonnegative;
ALTER TABLE doctors ADD CONSTRAINT doctors_consultation_fee_nonnegative CHECK (consultation_fee >= 0);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_due_at timestamp without time zone;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS paid_at timestamp without time zone;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS amount_due_cents integer;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_amount_due_nonnegative;
ALTER TABLE appointments ADD CONSTRAINT appointments_amount_due_nonnegative CHECK (amount_due_cents IS NULL OR amount_due_cents >= 0);

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_doctor_overlap;
ALTER TABLE appointments ADD CONSTRAINT no_doctor_overlap EXCLUDE USING gist (
  doctor_id WITH =,
  tsrange(appointment_date, ends_at, '[)') WITH &&
) WHERE (status IN ('pending', 'scheduled', 'awaiting_payment'));

DROP INDEX IF EXISTS idx_doctor_active_slot;
CREATE UNIQUE INDEX idx_doctor_active_slot ON appointments (doctor_id, appointment_date)
  WHERE status IN ('pending', 'scheduled', 'awaiting_payment');

CREATE TABLE IF NOT EXISTS payment_transactions (
  id serial PRIMARY KEY,
  clinic_id integer NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id integer NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id integer NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  provider varchar(30) NOT NULL DEFAULT 'paymob',
  provider_intention_id varchar(255),
  provider_order_id varchar(255),
  provider_transaction_id varchar(255) UNIQUE,
  special_reference varchar(255) NOT NULL UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency varchar(3) NOT NULL DEFAULT 'EGP',
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'refunded', 'voided')),
  payment_method varchar(30),
  client_secret varchar(255),
  hmac_verified boolean NOT NULL DEFAULT false,
  failure_reason text,
  raw_response jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_appointment
  ON payment_transactions (appointment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_clinic
  ON payment_transactions (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status
  ON payment_transactions (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_appointment_unique
  ON bills (appointment_id) WHERE appointment_id IS NOT NULL;
