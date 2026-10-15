const db = require('../config/db');

const SLOT_STATUSES = ['open', 'booked', 'cancelled'];

const createSlot = async ({ clinicId, doctorId, startsAt, createdBy }, client = db) => {
  const result = await client.query(
    `INSERT INTO availability_slots (clinic_id, doctor_id, starts_at, duration_minutes, status, created_by)
     VALUES ($1, $2, $3, 45, 'open', $4)
     RETURNING *;`,
    [clinicId, doctorId, startsAt, createdBy || null]
  );
  return result.rows[0];
};

const getSlotById = async (id, client = db) => {
  const result = await client.query(
    `SELECT s.*, c.name AS clinic_name, d.name AS doctor_name, d.specialization
     FROM availability_slots s
     JOIN clinics c ON c.id = s.clinic_id
     JOIN doctors d ON d.id = s.doctor_id
     WHERE s.id = $1;`,
    [id]
  );
  return result.rows[0];
};

// Locked read for booking inside a transaction (prevents double-booking).
const getSlotByIdForUpdate = async (id, client) => {
  const result = await client.query(
    `SELECT s.*, c.name AS clinic_name, d.name AS doctor_name, d.specialization
     FROM availability_slots s
     JOIN clinics c ON c.id = s.clinic_id
     JOIN doctors d ON d.id = s.doctor_id
     WHERE s.id = $1
     FOR UPDATE OF s;`,
    [id]
  );
  return result.rows[0];
};

const setSlotStatus = async (id, status, client = db) => {
  const result = await client.query(
    `UPDATE availability_slots
     SET status = $2
     WHERE id = $1
     RETURNING *;`,
    [id, status]
  );
  return result.rows[0];
};

// Overlap of a [start, start+45min) window with live slots of a doctor,
// optionally excluding one slot (useful when re-checking).
const countOverlappingSlots = async (doctorId, startIso, endIso, client = db) => {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM availability_slots
     WHERE doctor_id = $1
       AND status IN ('open', 'booked')
        AND tsrange(starts_at, starts_at + (duration_minutes * INTERVAL '1 minute'), '[)')
            && tsrange($2::timestamp, $3::timestamp, '[)');`,
    [doctorId, startIso, endIso]
  );
  return result.rows[0].count;
};

const listSlots = async ({ clinicId, doctorId, clinicIds, doctorIds, status, from, to }) => {
  const conditions = [];
  const params = [];
  if (clinicId) {
    params.push(clinicId);
    conditions.push(`s.clinic_id = $${params.length}`);
  } else if (clinicIds && clinicIds.length) {
    params.push(clinicIds.map(Number));
    conditions.push(`s.clinic_id = ANY($${params.length}::int[])`);
  }
  if (doctorId) {
    params.push(doctorId);
    conditions.push(`s.doctor_id = $${params.length}`);
  } else if (doctorIds && doctorIds.length) {
    params.push(doctorIds.map(Number));
    conditions.push(`s.doctor_id = ANY($${params.length}::int[])`);
  }
  if (status) {
    params.push(status);
    conditions.push(`s.status = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`s.starts_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`s.starts_at < $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query(
    `SELECT s.*, c.name AS clinic_name, d.name AS doctor_name, d.specialization
     FROM availability_slots s
     JOIN clinics c ON c.id = s.clinic_id
     JOIN doctors d ON d.id = s.doctor_id
     ${where}
     ORDER BY s.starts_at ASC;`,
    params
  );
  return result.rows;
};

module.exports = {
  SLOT_STATUSES,
  createSlot,
  getSlotById,
  getSlotByIdForUpdate,
  setSlotStatus,
  countOverlappingSlots,
  listSlots,
};
