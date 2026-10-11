const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const db = require('../src/config/db');

const EXPECTED_INDEXES = [
  'idx_users_lower_email',
  'idx_appt_patient_date',
  'idx_appt_doctor_status_date',
  'idx_appt_clinic_status_date',
  'idx_appt_clinic_date',
  'idx_appt_status_date',
  'idx_appt_doctor_range',
  'idx_operating_hours_clinic',
  'idx_users_role',
  'idx_users_role_active',
  'idx_audit_created_id',
  'idx_bills_clinic_created',
  'idx_bills_clinic_status_created',
  'idx_doctors_clinic',
  'idx_receptionists_clinic',
  'idx_doctors_user_clinic',
  'idx_receptionists_user_clinic',
  'idx_patients_unlinked',
];

const PRE_EXISTING_COVERAGE = [
  'doctors_user_id_key',
  'receptionists_user_id_key',
  'patients_user_id_key',
  'users_email_key',
  'idx_doctor_schedule',
  'idx_doctor_active_slot',
];

const EXPLAIN_QUERIES = [
  ['login by email (adminModel.getUserByEmail)',
    `EXPLAIN SELECT id, email, password_hash, role, is_active FROM users WHERE LOWER(email) = LOWER('a@b.c')`],
  ['doctor by user (appointmentModel.getDoctorByUserId)',
    `EXPLAIN SELECT id, user_id, clinic_id FROM doctors WHERE user_id = 1`],
  ['receptionist by user (appointmentModel.getReceptionistByUserId)',
    `EXPLAIN SELECT id, user_id, clinic_id FROM receptionists WHERE user_id = 1`],
  ['patient by user (appointmentModel.getPatientByUserId)',
    `EXPLAIN SELECT id, user_id, name FROM patients WHERE user_id = 1`],
  ['appointments by patient (listAppointmentsByPatientId)',
    `EXPLAIN SELECT a.* FROM appointments a JOIN clinics c ON c.id = a.clinic_id JOIN doctors d ON d.id = a.doctor_id WHERE a.patient_id = 1 ORDER BY a.appointment_date DESC`],
  ['appointments by doctor+status (listAppointmentsByDoctorId)',
    `EXPLAIN SELECT a.* FROM appointments a JOIN clinics c ON c.id = a.clinic_id JOIN patients p ON p.id = a.patient_id WHERE a.doctor_id = 1 AND a.status = 'scheduled' ORDER BY a.appointment_date DESC`],
  ['appointments by clinic+status (listAppointmentsByClinicId)',
    `EXPLAIN SELECT a.* FROM appointments a JOIN clinics c ON c.id = a.clinic_id JOIN patients p ON p.id = a.patient_id JOIN doctors d ON d.id = a.doctor_id WHERE a.clinic_id = 1 AND a.status = 'pending' ORDER BY a.appointment_date DESC`],
  ['appointments global by status (listAppointments)',
    `EXPLAIN SELECT a.* FROM appointments a WHERE a.status = 'pending' ORDER BY a.appointment_date DESC`],
  ['appointment stats range (ownerModel.appointmentStats)',
    `EXPLAIN SELECT status, COUNT(*) FROM appointments WHERE clinic_id = 1 AND appointment_date >= NOW() - INTERVAL '30 days' GROUP BY status`],
  ['users by role (adminModel.listUsers)',
    `EXPLAIN SELECT id, email, role FROM users WHERE role = 'doctor' ORDER BY id LIMIT 100 OFFSET 0`],
  ['active admin count (adminModel.countActiveAdmins)',
    `EXPLAIN SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = true`],
  ['audit log sort (adminModel.listAuditLogs)',
    `EXPLAIN SELECT * FROM admin_audit_logs ORDER BY created_at DESC, id DESC LIMIT 100 OFFSET 0`],
  ['billing by status (ownerModel.billingStats)',
    `EXPLAIN SELECT payment_status, COUNT(*), SUM(total_amount) FROM bills WHERE clinic_id = 1 GROUP BY payment_status`],
  ['staff by clinic join (ownerModel.listClinicStaff)',
    `EXPLAIN SELECT u.id FROM users u LEFT JOIN doctors d ON d.user_id = u.id AND d.clinic_id = 1 LEFT JOIN receptionists r ON r.user_id = u.id AND r.clinic_id = 1 WHERE u.role IN ('doctor','receptionist') AND (d.id IS NOT NULL OR r.id IS NOT NULL) ORDER BY u.id`],
];

(async () => {
  let failed = 0;

  const { rows } = await db.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1)`,
    [EXPECTED_INDEXES]
  );
  const present = new Set(rows.map((r) => r.indexname));
  console.log('--- index presence ---');
  for (const name of EXPECTED_INDEXES) {
    const ok = present.has(name);
    if (!ok) failed += 1;
    console.log(`${ok ? 'OK      ' : 'MISSING '} ${name}`);
  }

  const pre = await db.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1)`,
    [PRE_EXISTING_COVERAGE]
  );
  console.log('--- pre-existing coverage (not created by 006) ---');
  for (const r of pre.rows) console.log(`OK       ${r.indexname}`);

  console.log('\n--- EXPLAIN plans (look for Index Scan / no Seq Scan on large tables) ---');
  for (const [label, sql] of EXPLAIN_QUERIES) {
    try {
      const res = await db.query(sql);
      console.log(`\n## ${label}\n${res.rows.map((r) => r['QUERY PLAN']).join('\n')}`);
    } catch (err) {

      console.log(`\n## ${label}\nERROR: ${err.message.split('\n')[0]}`);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} expected index(es) missing. Run: npm run migrate`);
    process.exit(1);
  }
  console.log('\nAll expected indexes present.');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
