const db = require("../config/db")
const createClinic =async({name,phone_number,address,email,status = 'active', owner_id = null}, client = db)=>{
    const query = `
    INSERT INTO clinics (name,phone_number,address,email,status,owner_id)
    VALUES ($1,$2, $3, $4, $5, $6)
    RETURNING *;
    `
    const result = await client.query(query,[name,phone_number,address,email,status,owner_id])
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

const createUser = async ({ email, password_hash, role, clinic_id = null, status = 'active', invited_by = null }, client = db) => {
  const query = `
    INSERT INTO users (email, password_hash, role, clinic_id, status, invited_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, email, role, clinic_id, status, invited_by, is_active, created_at, updated_at;
  `;
  const result = await client.query(query, [email, password_hash, role, clinic_id, status, invited_by]);
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
    SELECT id, name, status, owner_id
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
    SELECT id, email, original_email, role, clinic_id, status, invited_by, offboarded_at, is_active
    FROM users
    WHERE id = $1;
  `;
  const result = await db.query(query, [id]);
  return result.rows[0];
};

const getUserByEmail = async (email) => {
  const query = `
    SELECT id, email, original_email, password_hash, role, clinic_id, status, invited_by, offboarded_at, is_active
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

const listUsers = async ({ role, status, limit = 100, offset = 0 } = {}) => {
  const values = [];
  const clauses = [];
  if (role) {
    values.push(role);
    clauses.push(`role = $${values.length}`);
  }
  if (status) {
    values.push(status);
    clauses.push(`status = $${values.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  values.push(limit, offset);
  const result = await db.query(
    `SELECT id, email, role, clinic_id, status, is_active, created_at, updated_at
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

const setUserStatus = async (id, status, client = db) => {
  const active = status === 'active';
  const result = await client.query(
    `UPDATE users
      SET status = $1, is_active = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, email, role, clinic_id, status, is_active;`,
    [status, active, id]
  );
  return result.rows[0];
};

const setUserPassword = async (id, password_hash, client = db) => {
  const result = await client.query(
    `UPDATE users
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id;`,
    [password_hash, id]
  );
  return result.rows[0];
};

// Clean departure: anonymize + free the email, keep the user_id for history.
const offboardUser = async (id, client = db) => {
  const current = await client.query(`SELECT id, email FROM users WHERE id = $1;`, [id]);
  const row = current.rows[0];
  if (!row) return null;
  const result = await client.query(
    `UPDATE users
      SET status = 'offboarded',
          offboarded_at = CURRENT_TIMESTAMP,
          original_email = COALESCE(original_email, email),
          email = 'offboarded+' || $1 || '@internal.local',
          password_hash = 'offboarded$' || md5(random()::text || clock_timestamp()::text),
          is_active = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, original_email, role, clinic_id, status, offboarded_at, is_active;`,
    [id]
  );
  return result.rows[0];
};

// Policy suspension: sessions killed via status gate, email stays blocked.
const suspendUser = async (id, client = db) => {
  const result = await client.query(
    `UPDATE users
      SET status = 'suspended',
          password_hash = 'suspended$' || md5(random()::text || clock_timestamp()::text),
          is_active = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, role, clinic_id, status, is_active;`,
    [id]
  );
  return result.rows[0];
};

const reinstateUser = async (id, password_hash, client = db) => {
  const result = await client.query(
    `UPDATE users
      SET status = 'active',
          password_hash = COALESCE($2, password_hash),
          is_active = true,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, role, clinic_id, status, is_active;`,
    [id, password_hash || null]
  );
  return result.rows[0];
};

const setClinicStatus = async (id, status, client = db) => {
  const result = await client.query(
    `UPDATE clinics SET status = $1 WHERE id = $2 RETURNING *;`,
    [status, id]
  );
  return result.rows[0];
};

const setClinicOwner = async (clinicId, ownerId, client = db) => {
  const result = await client.query(
    `UPDATE clinics SET owner_id = $1 WHERE id = $2 RETURNING *;`,
    [ownerId, clinicId]
  );
  return result.rows[0];
};

const listClinicsByStatus = async (status, client = db) => {
  const result = await client.query(
    `SELECT c.*, u.email AS owner_email
     FROM clinics c
     LEFT JOIN users u ON u.id = c.owner_id
     WHERE c.status = $1
     ORDER BY c.id;`,
    [status]
  );
  return result.rows;
};

const createStaffInvite = async ({ user_id, token_hash, role, clinic_id, expires_at, created_by }, client = db) => {
  const result = await client.query(
    `INSERT INTO staff_invites (user_id, token_hash, role, clinic_id, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *;`,
    [user_id, token_hash, role, clinic_id, expires_at, created_by]
  );
  return result.rows[0];
};

const getInviteByTokenHash = async (token_hash, client = db) => {
  const result = await client.query(
    `SELECT i.*, u.email AS user_email, u.status AS user_status
     FROM staff_invites i
     JOIN users u ON u.id = i.user_id
     WHERE i.token_hash = $1;`,
    [token_hash]
  );
  return result.rows[0];
};

const getInviteById = async (id, client = db) => {
  const result = await client.query(`SELECT * FROM staff_invites WHERE id = $1;`, [id]);
  return result.rows[0];
};

const listInvitesByClinic = async (clinicId, client = db) => {
  const result = await client.query(
    `SELECT i.*, u.email AS user_email, u.status AS user_status
     FROM staff_invites i
     JOIN users u ON u.id = i.user_id
     WHERE i.clinic_id = $1
     ORDER BY i.created_at DESC, i.id DESC;`,
    [clinicId]
  );
  return result.rows;
};

const rotateInviteToken = async (id, token_hash, expires_at, client = db) => {
  const result = await client.query(
    `UPDATE staff_invites
      SET token_hash = $1, expires_at = $2, revoked_at = NULL
      WHERE id = $3
      RETURNING *;`,
    [token_hash, expires_at, id]
  );
  return result.rows[0];
};

const revokeInvite = async (id, client = db) => {
  const result = await client.query(
    `UPDATE staff_invites SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *;`,
    [id]
  );
  return result.rows[0];
};

const acceptInvite = async (id, client = db) => {
  const result = await client.query(
    `UPDATE staff_invites SET accepted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *;`,
    [id]
  );
  return result.rows[0];
};

// Legacy alias: historic "deactivate" maps to suspension (email stays blocked).
const deactivateUser = async (id, client = db) => suspendUser(id, client);

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
  setUserStatus,
  setUserPassword,
  suspendUser,
  reinstateUser,
  offboardUser,
  deactivateUser,
  setClinicStatus,
  setClinicOwner,
  listClinicsByStatus,
  createStaffInvite,
  getInviteByTokenHash,
  getInviteById,
  listInvitesByClinic,
  rotateInviteToken,
  revokeInvite,
  acceptInvite,
  createAuditLog,
  listAuditLogs,
};
