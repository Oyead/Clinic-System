-- Ties receptionists to a clinic, mirroring the doctors table, so
-- receptionists can only manage appointments at their own clinic.
CREATE TABLE IF NOT EXISTS receptionists (
  id serial PRIMARY KEY,
  user_id integer NOT NULL UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  clinic_id integer NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  phone_number varchar(50),
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);