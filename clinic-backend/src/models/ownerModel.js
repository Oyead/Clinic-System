const db = require('../config/db');

const getOwnerClinicIds = async (userId, client = db) => {
  const result = await client.query(
    `SELECT clinic_id
     FROM clinic_owners
     WHERE user_id = $1
     ORDER BY clinic_id;`,
    [userId]
  );
  return result.rows.map((row) => Number(row.clinic_id));
};

const getOwnedClinics = async (userId, client = db) => {
  const result = await client.query(
    `SELECT c.id, c.name, c.status
     FROM clinics c
     JOIN clinic_owners o ON o.clinic_id = c.id
     WHERE o.user_id = $1
     ORDER BY c.id;`,
    [userId]
  );
  return result.rows;
};

const assignOwner = async (userId, clinicId, client = db) => {
  const result = await client.query(
    `INSERT INTO clinic_owners (user_id, clinic_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, clinic_id) DO NOTHING
     RETURNING *;`,
    [userId, clinicId]
  );
  return result.rows[0] || null;
};

const removeOwner = async (userId, clinicId, client = db) => {
  const result = await client.query(
    `DELETE FROM clinic_owners
     WHERE user_id = $1 AND clinic_id = $2
     RETURNING *;`,
    [userId, clinicId]
  );
  return result.rows[0] || null;
};

const removeAllOwnerClinics = async (userId, client = db) => {
  await client.query(`DELETE FROM clinic_owners WHERE user_id = $1;`, [userId]);
};

const listClinicStaff = async (clinicId, client = db) => {
  const result = await client.query(
    `SELECT u.id AS user_id, u.email, u.role, u.status, u.clinic_id, u.is_active,
            d.id AS doctor_id, d.specialization,
            r.id AS receptionist_id
     FROM users u
     LEFT JOIN doctors d ON d.user_id = u.id AND d.clinic_id = $1
     LEFT JOIN receptionists r ON r.user_id = u.id AND r.clinic_id = $1
     WHERE u.role IN ('doctor', 'receptionist')
       AND (d.id IS NOT NULL OR r.id IS NOT NULL)
     ORDER BY u.id;`,
    [clinicId]
  );
  return result.rows;
};

const appointmentStats = async (clinicId, from, to, client = db) => {
  const values = [clinicId];
  let range = '';
  if (from) {
    values.push(from);
    range += ` AND appointment_date >= $${values.length}`;
  }
  if (to) {
    values.push(to);
    range += ` AND appointment_date <= $${values.length}`;
  }
  const byStatus = await client.query(
    `SELECT status, COUNT(*)::int AS count
     FROM appointments
     WHERE clinic_id = $1 ${range}
     GROUP BY status
     ORDER BY status;`,
    values
  );
  const perDoctor = await client.query(
    `SELECT d.id AS doctor_id, d.name AS doctor_name,
            a.status, COUNT(*)::int AS count
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     WHERE a.clinic_id = $1 ${range}
     GROUP BY d.id, d.name, a.status
     ORDER BY d.id, a.status;`,
    values
  );
  return { by_status: byStatus.rows, per_doctor: perDoctor.rows };
};

const billingStats = async (clinicId, from, to, client = db) => {
  const values = [clinicId];
  let range = '';
  if (from) {
    values.push(from);
    range += ` AND created_at >= $${values.length}`;
  }
  if (to) {
    values.push(to);
    range += ` AND created_at <= $${values.length}`;
  }
  const byStatus = await client.query(
    `SELECT payment_status, COUNT(*)::int AS bills,
            COALESCE(SUM(total_amount), 0)::float AS total
     FROM bills
     WHERE clinic_id = $1 ${range}
     GROUP BY payment_status
     ORDER BY payment_status;`,
    values
  );
  const overall = await client.query(
    `SELECT COUNT(*)::int AS bills,
            COALESCE(SUM(total_amount), 0)::float AS total
     FROM bills
     WHERE clinic_id = $1 ${range};`,
    values
  );
  return { by_payment_status: byStatus.rows, overall: overall.rows[0] };
};

module.exports = {
  getOwnerClinicIds,
  getOwnedClinics,
  assignOwner,
  removeOwner,
  removeAllOwnerClinics,
  listClinicStaff,
  appointmentStats,
  billingStats,
};
