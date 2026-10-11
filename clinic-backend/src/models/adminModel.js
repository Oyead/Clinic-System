const db = require("../config/db")
const createClinic =async({name,phone_number,address,email,})=>{
    const query = `
    INSERT INTO clinics (name,phone_number,address,email)
    VALUES ($1,$2, $3, $4)
    RETURNING *;
    `
    const result = await db.query(query,[name,phone_number,address,email])
    return result.rows[0]
}

const createDoctor = async ({ user_id = null, clinic_id = null, name, phone_number, specialization, duration_minutes = 30 }, client = db) => {
  const query = `
    INSERT INTO doctors (user_id, clinic_id, name, phone_number, specialization, duration_minutes)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const result = await client.query(query, [user_id, clinic_id, name, phone_number, specialization, duration_minutes]);
  return result.rows[0];
};

const assignDoctorToClinic = async (doctorId, clinicId) => {
  const query = `
    UPDATE doctors
    SET clinic_id = $1
    WHERE id = $2
    RETURNING *;
  `;
  const result = await db.query(query, [clinicId, doctorId]);
  return result.rows[0];
};

const createUser = async ({ email, password_hash, role }, client = db) => {
  const query = `
    INSERT INTO users (email, password_hash, role)
    VALUES ($1, $2, $3)
    RETURNING id, email, role, is_active, created_at, updated_at;
  `;
  const result = await client.query(query, [email, password_hash, role]);
  return result.rows[0];
};

const createPatient = async ({ user_id = null, name, phone_number = null, email = null }, client = db) => {
  const query = `
    INSERT INTO patients (user_id, name, phone_number, email)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const result = await client.query(query, [user_id, name, phone_number, email]);
  return result.rows[0];
};

const getClinicById = async (id, client = db) => {
  const query = `
    SELECT id, name
    FROM clinics
    WHERE id = $1;
  `;
  const result = await client.query(query, [id]);
  return result.rows[0];
};

const getPatientById = async (id) => {
  const query = `
    SELECT *
    FROM patients
    WHERE id = $1;
  `;
  const result = await db.query(query, [id]);
  return result.rows[0];
};

const linkPatientToUser = async (patientId, userId) => {
  const query = `
    UPDATE patients
    SET user_id = $1
    WHERE id = $2
    RETURNING *;
  `;
  const result = await db.query(query, [userId, patientId]);
  return result.rows[0];
};

const listPatients = async ({ unlinked = false } = {}) => {
  const query = `
    SELECT *
    FROM patients
    ${unlinked ? 'WHERE user_id IS NULL' : ''}
    ORDER BY id;
  `;
  const result = await db.query(query);
  return result.rows;
};

const createReceptionist = async ({ user_id, clinic_id, name, phone_number = null }, client = db) => {
  const query = `
    INSERT INTO receptionists (user_id, clinic_id, name, phone_number)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const result = await client.query(query, [user_id, clinic_id, name, phone_number]);
  return result.rows[0];
};

const assignReceptionistToClinic = async (receptionistId, clinicId) => {
  const query = `
    UPDATE receptionists
    SET clinic_id = $1
    WHERE id = $2
    RETURNING *;
  `;
  const result = await db.query(query, [clinicId, receptionistId]);
  return result.rows[0];
};

const getDoctorByUserId = async (userId, client = db) => {
  const query = `
    SELECT id, user_id, clinic_id
    FROM doctors
    WHERE user_id = $1;
  `;
  const result = await client.query(query, [userId]);
  return result.rows[0];
};

const getReceptionistByUserId = async (userId, client = db) => {
  const query = `
    SELECT id, user_id, clinic_id
    FROM receptionists
    WHERE user_id = $1;
  `;
  const result = await client.query(query, [userId]);
  return result.rows[0];
};

const getUserById = async (id) => {
  const query = `
    SELECT id, email, role, is_active
    FROM users
    WHERE id = $1;
  `;
  const result = await db.query(query, [id]);
  return result.rows[0];
};

const getUserByEmail = async (email) => {
  const query = `
    SELECT id, email, password_hash, role, is_active
    FROM users
    WHERE LOWER(email) = LOWER($1);
  `;
  const result = await db.query(query, [email]);
  return result.rows[0];
};

const countActiveAdmins = async (client = db) => {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM users
     WHERE role = 'admin' AND is_active = true;`
  );
  return result.rows[0].count;
};

const listUsers = async ({ role, limit = 100, offset = 0 } = {}) => {
  const values = [];
  let where = '';
  if (role) {
    values.push(role);
    where = 'WHERE role = $1';
  }
  values.push(limit, offset);
  const result = await db.query(
    `SELECT id, email, role, is_active, created_at, updated_at
     FROM users
     ${where}
     ORDER BY id
     LIMIT $${values.length - 1} OFFSET $${values.length};`,
    values
  );
  return result.rows;
};

const updateUserRole = async (id, role, client = db) => {
  const result = await client.query(
    `UPDATE users
     SET role = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, email, role, is_active, created_at, updated_at;`,
    [role, id]
  );
  return result.rows[0];
};

const deactivateUser = async (id, client = db) => {
  const result = await client.query(
    `UPDATE users
     SET is_active = false, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, email, role, is_active;`,
    [id]
  );
  return result.rows[0];
};

const createAuditLog = async (
  { action, target_user_id = null, target_email = null, old_role = null, new_role = null, performed_by = null, appointment_id = null, old_status = null, new_status = null, clinic_id = null },
  client = db
) => {
  const result = await client.query(
    `INSERT INTO admin_audit_logs
       (action, target_user_id, target_email, old_role, new_role, performed_by, appointment_id, old_status, new_status, clinic_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *;`,
    [action, target_user_id, target_email, old_role, new_role, performed_by, appointment_id, old_status, new_status, clinic_id]
  );
  return result.rows[0];
};

const listAuditLogs = async ({ limit = 100, offset = 0 } = {}) => {
  const result = await db.query(
    `SELECT *
     FROM admin_audit_logs
     ORDER BY created_at DESC, id DESC
     LIMIT $1 OFFSET $2;`,
    [limit, offset]
  );
  return result.rows;
};

module.exports = {
  createClinic,
  getClinicById,
  createDoctor,
  assignDoctorToClinic,
  createUser,
  createPatient,
  getPatientById,
  linkPatientToUser,
  listPatients,
  createReceptionist,
  assignReceptionistToClinic,
  getDoctorByUserId,
  getReceptionistByUserId,
  getUserById,
  getUserByEmail,
  countActiveAdmins,
  listUsers,
  updateUserRole,
  deactivateUser,
  createAuditLog,
  listAuditLogs,
};
