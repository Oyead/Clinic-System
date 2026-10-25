const db = require("../config/db");

const getPatientByUserId = async (userId) => {
  const query = `
    SELECT id, user_id, name
    FROM patients
    WHERE user_id = $1;
  `;
  const result = await db.query(query, [userId]);
  return result.rows[0];
};

const getClinicById = async (id) => {
  const query = `
    SELECT id, name
    FROM clinics
    WHERE id = $1;
  `;
  const result = await db.query(query, [id]);
  return result.rows[0];
};

const getDoctorById = async (id) => {
  const query = `
    SELECT id, user_id, clinic_id, name, specialization, duration_minutes, consultation_fee
    FROM doctors
    WHERE id = $1;
  `;
  const result = await db.query(query, [id]);
  return result.rows[0];
};

const getDoctorByUserId = async (userId) => {
  const query = `
    SELECT id, user_id, clinic_id
    FROM doctors
    WHERE user_id = $1;
  `;
  const result = await db.query(query, [userId]);
  return result.rows[0];
};

const getReceptionistByUserId = async (userId) => {
  const query = `
    SELECT id, user_id, clinic_id
    FROM receptionists
    WHERE user_id = $1;
  `;
  const result = await db.query(query, [userId]);
  return result.rows[0];
};

const getAppointmentConflict = async (doctorId, appointmentDate) => {
  const query = `
    SELECT id
    FROM appointments
    WHERE doctor_id = $1
      AND appointment_date = $2
      AND status IN ('pending', 'scheduled', 'awaiting_payment')
    LIMIT 1;
  `;
  const result = await db.query(query, [doctorId, appointmentDate]);
  return result.rows[0];
};

const getAppointmentOverlap = async (doctorId, start, end) => {
  const query = `
    SELECT id
    FROM appointments
    WHERE doctor_id = $1
      AND status IN ('pending', 'scheduled', 'awaiting_payment')
      AND tsrange(appointment_date, ends_at, '[)') && tsrange($2::timestamp, $3::timestamp, '[)')
    LIMIT 1;
  `;
  const result = await db.query(query, [doctorId, start, end]);
  return result.rows[0];
};

const isWithinOperatingHours = async (clinicId, start, end) => {
  const query = `
    SELECT COALESCE(
      (SELECT COUNT(*)::int FROM operating_hours WHERE clinic_id = $1) = 0
      OR EXISTS (
        SELECT 1
        FROM operating_hours
        WHERE clinic_id = $1
          AND day_of_week = EXTRACT(DOW FROM $2::timestamp)::int
          AND EXTRACT(DOW FROM $2::timestamp) = EXTRACT(DOW FROM $3::timestamp)
          AND open_time <= ($2::timestamp)::time
          AND ($3::timestamp)::time <= close_time
      ),
      false
    ) AS open;
  `;
  const result = await db.query(query, [clinicId, start, end]);
  return result.rows[0].open;
};

const createAppointment = async ({ clinicId, patientId, doctorId, appointmentDate, durationMinutes = 30, reason, slotId = null }) => {
  const query = `
    INSERT INTO appointments (clinic_id, patient_id, doctor_id, appointment_date, duration_minutes, status, reason, slot_id)
    VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
    RETURNING *;
  `;
  const result = await db.query(query, [clinicId, patientId, doctorId, appointmentDate, durationMinutes, reason || null, slotId]);
  return result.rows[0];
};

const getAppointmentById = async (id) => {
  const query = `
    SELECT *
    FROM appointments
    WHERE id = $1;
  `;
  const result = await db.query(query, [id]);
  return result.rows[0];
};

const getAppointmentNotificationById = async (id) => {
  const query = `
    SELECT a.id, a.appointment_date, a.duration_minutes, a.status, a.reason,
           p.name AS patient_name,
           COALESCE(NULLIF(TRIM(p.email), ''), u.email) AS patient_email,
           d.name AS doctor_name, d.specialization, d.consultation_fee,
           a.payment_due_at, a.amount_due_cents,
           c.name AS clinic_name, c.address AS clinic_address,
           c.phone_number AS clinic_phone, c.email AS clinic_email
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    LEFT JOIN users u ON u.id = p.user_id
    JOIN doctors d ON d.id = a.doctor_id
    JOIN clinics c ON c.id = a.clinic_id
    WHERE a.id = $1;
  `;
  const result = await db.query(query, [id]);
  return result.rows[0];
};

const updateAppointmentStatus = async (id, status, client = db) => {
  const query = `
    UPDATE appointments
    SET status = $2
    WHERE id = $1
    RETURNING *;
  `;
  const result = await client.query(query, [id, status]);
  return result.rows[0];
};

const setAppointmentAwaitingPayment = async (id, paymentDueAt, amountDueCents, client = db) => {
  const query = `
    UPDATE appointments
    SET status = 'awaiting_payment',
        payment_due_at = $2,
        amount_due_cents = $3
    WHERE id = $1
    RETURNING *;
  `;
  const result = await client.query(query, [id, paymentDueAt, amountDueCents]);
  return result.rows[0];
};

const listAppointmentsByPatientId = async (patientId, range = {}) => {
  const conditions = ['a.patient_id = $1'];
  const params = [patientId];
  appendRangeClauses(conditions, params, range);
  const query = `
    SELECT a.*, c.name AS clinic_name, d.name AS doctor_name, d.specialization
    FROM appointments a
    JOIN clinics c ON c.id = a.clinic_id
    JOIN doctors d ON d.id = a.doctor_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY a.appointment_date DESC;
  `;
  const result = await db.query(query, params);
  return result.rows;
};

const appendRangeClauses = (conditions, params, range = {}) => {
  if (range.from) {
    params.push(range.from);
    conditions.push(`a.appointment_date >= $${params.length}`);
  }
  if (range.to) {
    params.push(range.to);
    conditions.push(`a.appointment_date < $${params.length}`);
  }
};

const listAppointmentsByDoctorId = async (doctorId, status, range = {}) => {
  const conditions = ['a.doctor_id = $1'];
  const params = [doctorId];
  if (status) {
    params.push(status);
    conditions.push(`a.status = $${params.length}`);
  }
  appendRangeClauses(conditions, params, range);
  const query = `
    SELECT a.*, c.name AS clinic_name, p.name AS patient_name
    FROM appointments a
    JOIN clinics c ON c.id = a.clinic_id
    JOIN patients p ON p.id = a.patient_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY a.appointment_date DESC;
  `;
  const result = await db.query(query, params);
  return result.rows;
};

const listAppointments = async (status, range = {}) => {
  const conditions = [];
  const params = [];
  if (status) {
    params.push(status);
    conditions.push(`a.status = $${params.length}`);
  }
  appendRangeClauses(conditions, params, range);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT a.*, c.name AS clinic_name, p.name AS patient_name, d.name AS doctor_name
    FROM appointments a
    JOIN clinics c ON c.id = a.clinic_id
    JOIN patients p ON p.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    ${where}
    ORDER BY a.appointment_date DESC;
  `;
  const result = await db.query(query, params);
  return result.rows;
};

const listAppointmentsByClinicId = async (clinicId, status, range = {}) => {
  const conditions = ['a.clinic_id = $1'];
  const params = [clinicId];
  if (status) {
    params.push(status);
    conditions.push(`a.status = $${params.length}`);
  }
  appendRangeClauses(conditions, params, range);
  const query = `
    SELECT a.*, c.name AS clinic_name, p.name AS patient_name, d.name AS doctor_name
    FROM appointments a
    JOIN clinics c ON c.id = a.clinic_id
    JOIN patients p ON p.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY a.appointment_date DESC;
  `;
  const result = await db.query(query, params);
  return result.rows;
};

const listClinics = async () => {
  const result = await db.query(
    `SELECT id, name
     FROM clinics
     ORDER BY id;`
  );
  return result.rows;
};

const listDoctors = async () => {
  const result = await db.query(
    `SELECT id, clinic_id, name, specialization, duration_minutes, consultation_fee
     FROM doctors
     ORDER BY id;`
  );
  return result.rows;
};

const listClinicsByIds = async (ids) => {
  if (!ids || !ids.length) return [];
  const result = await db.query(
    `SELECT id, name
     FROM clinics
     WHERE id = ANY($1::int[])
     ORDER BY id;`,
    [ids.map(Number)]
  );
  return result.rows;
};

const listDoctorsByClinicIds = async (ids) => {
  if (!ids || !ids.length) return [];
  const result = await db.query(
    `SELECT id, clinic_id, name, specialization, duration_minutes, consultation_fee
     FROM doctors
     WHERE clinic_id = ANY($1::int[])
     ORDER BY id;`,
    [ids.map(Number)]
  );
  return result.rows;
};

module.exports = {
  getPatientByUserId,
  getClinicById,
  getDoctorById,
  getDoctorByUserId,
  getReceptionistByUserId,
  getAppointmentConflict,
  getAppointmentOverlap,
  isWithinOperatingHours,
  createAppointment,
  getAppointmentById,
  getAppointmentNotificationById,
  updateAppointmentStatus,
  setAppointmentAwaitingPayment,
  listAppointmentsByPatientId,
  listAppointmentsByDoctorId,
  listAppointments,
  listAppointmentsByClinicId,
  listClinics,
  listDoctors,
  listClinicsByIds,
  listDoctorsByClinicIds,
};
