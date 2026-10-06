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

const createDoctor = async ({ user_id = null, clinic_id = null, name, phone_number, email, specialization }) => {
  const query = `
    INSERT INTO doctors (user_id, clinic_id, name, phone_number, email, specialization)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const result = await db.query(query, [user_id, clinic_id, name, phone_number, email, specialization]);
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

module.exports = {
  createClinic,
  createDoctor,
  assignDoctorToClinic,
};