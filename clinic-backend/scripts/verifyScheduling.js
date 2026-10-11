const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const db = require('../src/config/db');
const appointmentModel = require('../src/models/appointmentModel');

const TAG = '__sched_verify__';
const DOCTOR = 9;
const OTHER_DOCTOR = 8;
const CLINIC = 1;
const NO_HOURS_CLINIC = 2;
const PATIENT = 1;

const DAY = '2026-10-19';

let passed = 0;
let failed = 0;
const check = (label, cond, extra = '') => {
  if (cond) { passed += 1; console.log(`PASS  ${label}`); }
  else { failed += 1; console.log(`FAIL  ${label} ${extra}`); }
};

const insert = (doctorId, start, minutes, status = 'pending') =>
  db.query(
    `INSERT INTO appointments (clinic_id, patient_id, doctor_id, appointment_date, duration_minutes, status, reason)
     VALUES ($1, $2, $3, $4::timestamp, $5, $6, $7) RETURNING id, ends_at;`,
    [CLINIC, PATIENT, doctorId, start, minutes, status, TAG]
  );

(async () => {
  try {

    const a = await insert(DOCTOR, `${DAY} 10:00:00`, 30);
    check('base insert ok', !!a.rows[0].id);
    check('ends_at = start + duration', String(a.rows[0].ends_at).includes('10:30'),
      `ends_at=${a.rows[0].ends_at}`);

    try {
      await insert(DOCTOR, `${DAY} 10:15:00`, 30);
      check('partial overlap rejected (23P01)', false, 'insert succeeded');
    } catch (e) {
      check('partial overlap rejected (23P01)', e.code === '23P01', `code=${e.code}`);
    }

    try {
      const c = await insert(DOCTOR, `${DAY} 10:30:00`, 30);
      check('back-to-back allowed', !!c.rows[0].id);
    } catch (e) {
      check('back-to-back allowed', false, `code=${e.code} ${e.message}`);
    }

    try {
      const d = await insert(OTHER_DOCTOR, `${DAY} 10:15:00`, 30);
      check('different doctor same time allowed', !!d.rows[0].id);
    } catch (e) {
      check('different doctor same time allowed', false, `code=${e.code} ${e.message}`);
    }

    try {
      const e = await insert(DOCTOR, `${DAY} 10:15:00`, 30, 'cancelled');
      check('cancelled overlap allowed', !!e.rows[0].id);
    } catch (err) {
      check('cancelled overlap allowed', false, `code=${err.code} ${err.message}`);
    }

    const hit = await appointmentModel.getAppointmentOverlap(DOCTOR, `${DAY} 10:10:00`, `${DAY} 10:20:00`);
    check('getAppointmentOverlap finds overlap', !!hit);
    const miss = await appointmentModel.getAppointmentOverlap(DOCTOR, `${DAY} 11:00:00`, `${DAY} 11:30:00`);
    check('getAppointmentOverlap empty when free', !miss);

    check('open Mon 10:00-10:30 @ clinic 1',
      await appointmentModel.isWithinOperatingHours(CLINIC, `${DAY} 10:00:00`, `${DAY} 10:30:00`) === true);
    check('closed Sun @ clinic 1 (no Sunday row)',
      await appointmentModel.isWithinOperatingHours(CLINIC, '2026-10-18 10:00:00', '2026-10-18 10:30:00') === false);
    check('closed 03:00 @ clinic 1',
      await appointmentModel.isWithinOperatingHours(CLINIC, `${DAY} 03:00:00`, `${DAY} 03:30:00`) === false);
    check('no-hours clinic treated as open',
      await appointmentModel.isWithinOperatingHours(NO_HOURS_CLINIC, `${DAY} 03:00:00`, `${DAY} 03:30:00`) === true);

    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        db.query(
          `INSERT INTO appointments (clinic_id, patient_id, doctor_id, appointment_date, duration_minutes, status, reason)
           VALUES ($1, $2, $3, $4::timestamp, 30, 'pending', $5) RETURNING id;`,
          [CLINIC, PATIENT, DOCTOR, `${DAY} 12:00:00`, TAG]
        )
      )
    );
    const wins = attempts.filter((r) => r.status === 'fulfilled').length;
    const codes = attempts.filter((r) => r.status === 'rejected').map((r) => r.reason.code);
    check('concurrent same-slot: exactly 1 wins', wins === 1, `wins=${wins} codes=${codes}`);
    check('concurrent losers get 23P01/23505',
      codes.every((c) => c === '23P01' || c === '23505'), `codes=${codes}`);
  } finally {
    await db.query(`DELETE FROM appointments WHERE reason = $1;`, [TAG]);
    console.log('(test rows cleaned)');
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
