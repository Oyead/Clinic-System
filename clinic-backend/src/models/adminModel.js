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

const createDoctor = async ({ user_id = null, clinic_id = null, name, phone_number, specialization }) => {
  const query = `
    INSERT INTO doctors (user_id, clinic_id, name, phone_number, specialization)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const result = await db.query(query, [user_id, clinic_id, name, phone_number, specialization]);
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

const createUser = async ({ email, password_hash, role }) => {
  const query = `
    INSERT INTO users (email, password_hash, role)
    VALUES ($1, $2, $3)
    RETURNING id, email, role, is_active, created_at, updated_at;
  `;
  const result = await db.query(query, [email, password_hash, role]);
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
    WHERE email = $1;
  `;
  const result = await db.query(query, [email]);
  return result.rows[0];
};

module.exports = {
  createClinic,
  createDoctor,
  assignDoctorToClinic,
  createUser,
  getUserById,
  getUserByEmail,
};