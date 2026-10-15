const appointmentModel = require('./appointmentModel');
const availabilityModel = require('../models/availabilityModel');
const adminModel = require('../models/adminModel');
const ownerModel = require('../models/ownerModel');
const db = require('../config/db');
const { normalizeRole } = require('../utils/roles');
const { parseDateRange } = require('../utils/range');

const SLOT_MINUTES = 45;

const isValidPositiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

// Resolves which clinic/doctor the caller may manage availability for.
// Returns { ok, clinicId, doctor, doctorId } or { ok: false, status, error }.
const resolveScope = async (user, { doctor_id, clinic_id }) => {
  const role = normalizeRole(user.role);

  if (role === 'doctor') {
    const profile = await appointmentModel.getDoctorByUserId(user.id);
    if (!profile) return { ok: false, status: 403, error: 'No doctor profile is linked to your account.' };
    if (doctor_id && Number(doctor_id) !== Number(profile.id)) {
      return { ok: false, status: 403, error: 'Doctors can only manage their own availability.' };
    }
    const doctor = await appointmentModel.getDoctorById(profile.id);
    if (clinic_id && Number(clinic_id) !== Number(doctor.clinic_id)) {
      return { ok: false, status: 403, error: 'This doctor is not assigned to the selected clinic.' };
    }
    return { ok: true, clinicId: Number(doctor.clinic_id), doctorId: Number(doctor.id), doctor };
  }

  if (role === 'receptionist') {
    const profile = await appointmentModel.getReceptionistByUserId(user.id);
    const clinicId = profile ? Number(profile.clinic_id) : Number(user.clinic_id);
    if (!clinicId) return { ok: false, status: 403, error: 'No clinic is linked to your account.' };
    if (clinic_id && Number(clinic_id) !== clinicId) {
      return { ok: false, status: 403, error: 'You can only manage availability at your own clinic.' };
    }
    if (!doctor_id) return { ok: false, status: 400, error: 'doctor_id is required.' };
    const doctor = await appointmentModel.getDoctorById(doctor_id);
    if (!doctor || Number(doctor.clinic_id) !== clinicId) {
      return { ok: false, status: 404, error: 'Doctor not found at your clinic.' };
    }
    return { ok: true, clinicId, doctorId: Number(doctor.id), doctor };
  }

  if (role === 'clinic_owner') {
    if (!doctor_id) return { ok: false, status: 400, error: 'doctor_id is required.' };
    const doctor = await appointmentModel.getDoctorById(doctor_id);
    if (!doctor) return { ok: false, status: 404, error: 'Doctor not found.' };
    if (clinic_id && Number(clinic_id) !== Number(doctor.clinic_id)) {
      return { ok: false, status: 400, error: 'The selected doctor is not assigned to the selected clinic.' };
    }
    const owned = await ownerModel.getOwnerClinicIds(user.id);
    let inScope = owned.includes(Number(doctor.clinic_id));
    if (!inScope) {
      const clinic = await adminModel.getClinicById(doctor.clinic_id);
      inScope = !!clinic && Number(clinic.owner_id) === Number(user.id);
    }
    if (!inScope) return { ok: false, status: 403, error: 'This doctor is not at one of your clinics.' };
    return { ok: true, clinicId: Number(doctor.clinic_id), doctorId: Number(doctor.id), doctor };
  }

  if (role === 'admin') {
    if (!doctor_id) return { ok: false, status: 400, error: 'doctor_id is required.' };
    const doctor = await appointmentModel.getDoctorById(doctor_id);
    if (!doctor) return { ok: false, status: 404, error: 'Doctor not found.' };
    if (clinic_id && Number(clinic_id) !== Number(doctor.clinic_id)) {
      return { ok: false, status: 400, error: 'The selected doctor is not assigned to the selected clinic.' };
    }
    return { ok: true, clinicId: Number(doctor.clinic_id), doctorId: Number(doctor.id), doctor };
  }

  return { ok: false, status: 403, error: 'Access denied for your role.' };
};

const slotEnd = (start) => new Date(start.getTime() + SLOT_MINUTES * 60000);

// POST /api/v1/availability — publish one or more 45-minute slots.
const createAvailability = async (req, res) => {
  try {
    const { doctor_id, clinic_id, starts_at } = req.body || {};

    if (!isValidPositiveId(doctor_id)) {
      return res.status(400).json({ error: 'doctor_id must be a positive integer' });
    }
    const starts = Array.isArray(starts_at) ? starts_at : [];
    if (!starts.length || starts.length > 100) {
      return res.status(400).json({ error: 'starts_at must be a non-empty array of up to 100 start times' });
    }

    const scope = await resolveScope(req.user, { doctor_id, clinic_id });
    if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

    const parsed = [];
    for (const raw of starts) {
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ error: `Invalid start time: ${raw}` });
      }
      if (date.getTime() <= Date.now()) {
        return res.status(400).json({ error: `Start times must be in the future: ${raw}` });
      }
      parsed.push(date);
    }

    const created = [];
    const conflicts = [];
    await db.withTransaction(async (client) => {
      for (const start of parsed) {
        const end = slotEnd(start);
        const overlap = await appointmentModel.getAppointmentOverlap(
          scope.doctorId, start.toISOString(), end.toISOString()
        );
        if (overlap) {
          conflicts.push({ starts_at: start.toISOString(), reason: 'Overlaps an existing appointment' });
          continue;
        }
        const slotClash = await availabilityModel.countOverlappingSlots(
          scope.doctorId, start.toISOString(), end.toISOString(), client
        );
        if (slotClash > 0) {
          conflicts.push({ starts_at: start.toISOString(), reason: 'Overlaps another availability slot' });
          continue;
        }
        const open = await appointmentModel.isWithinOperatingHours(
          scope.clinicId, start.toISOString(), end.toISOString()
        );
        if (!open) {
          conflicts.push({ starts_at: start.toISOString(), reason: 'The clinic is closed at that time' });
          continue;
        }
        try {
          const row = await availabilityModel.createSlot({
            clinicId: scope.clinicId,
            doctorId: scope.doctorId,
            startsAt: start,
            createdBy: req.user.id,
          }, client);
          created.push(row);
        } catch (error) {
          if (error.code === '23505') {
            conflicts.push({ starts_at: start.toISOString(), reason: 'A slot already starts at that time' });
          } else {
            throw error;
          }
        }
      }
    });

    if (!created.length) {
      return res.status(409).json({ error: 'No slots could be created.', conflicts });
    }
    res.status(201).json({
      message: `Published ${created.length} availability slot(s) of ${SLOT_MINUTES} minutes.`,
      slots: created,
      conflicts,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/v1/availability — role-scoped slot listing with optional
// ?doctor_id=&clinic_id=&status=&from=&to= filters.
const listAvailability = async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    const { doctor_id, clinic_id, status } = req.query;

    if (status && !availabilityModel.SLOT_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${availabilityModel.SLOT_STATUSES.join(', ')}` });
    }
    const { range, error: rangeError } = parseDateRange(req.query);
    if (rangeError) return res.status(400).json({ error: rangeError });

    const filters = { status, ...range };

    if (role === 'patient') {
      if (!doctor_id && !clinic_id) {
        return res.status(400).json({ error: 'doctor_id or clinic_id is required' });
      }
      const slots = await availabilityModel.listSlots({
        ...filters,
        status: 'open',
        doctorId: doctor_id || undefined,
        clinicId: clinic_id || undefined,
      });
      return res.status(200).json({ slots });
    }

    if (role === 'doctor') {
      const profile = await appointmentModel.getDoctorByUserId(req.user.id);
      if (!profile) return res.status(200).json({ slots: [] });
      if (doctor_id && Number(doctor_id) !== Number(profile.id)) {
        return res.status(403).json({ error: 'Doctors can only view their own availability.' });
      }
      const slots = await availabilityModel.listSlots({ ...filters, doctorId: profile.id });
      return res.status(200).json({ slots });
    }

    if (role === 'receptionist') {
      const profile = await appointmentModel.getReceptionistByUserId(req.user.id);
      const clinicId = profile ? Number(profile.clinic_id) : Number(req.user.clinic_id);
      if (!clinicId) return res.status(200).json({ slots: [] });
      if (doctor_id) {
        const doctor = await appointmentModel.getDoctorById(doctor_id);
        if (!doctor || Number(doctor.clinic_id) !== clinicId) {
          return res.status(404).json({ error: 'Doctor not found at your clinic.' });
        }
        const slots = await availabilityModel.listSlots({ ...filters, doctorId: doctor.id });
        return res.status(200).json({ slots });
      }
      const slots = await availabilityModel.listSlots({ ...filters, clinicId });
      return res.status(200).json({ slots });
    }

    if (role === 'clinic_owner') {
      const owned = await ownerModel.getOwnerClinicIds(req.user.id);
      const isOwned = async (cid) => {
        if (owned.includes(Number(cid))) return true;
        const clinic = await adminModel.getClinicById(cid);
        return !!clinic && Number(clinic.owner_id) === Number(req.user.id);
      };
      if (doctor_id) {
        const doctor = await appointmentModel.getDoctorById(doctor_id);
        if (!doctor) return res.status(404).json({ error: 'Doctor not found.' });
        if (!(await isOwned(doctor.clinic_id))) {
          return res.status(403).json({ error: 'This doctor is not at one of your clinics.' });
        }
        if (clinic_id && Number(clinic_id) !== Number(doctor.clinic_id)) {
          return res.status(400).json({ error: 'The selected doctor is not assigned to the selected clinic.' });
        }
        const slots = await availabilityModel.listSlots({ ...filters, doctorId: doctor.id });
        return res.status(200).json({ slots });
      }
      if (clinic_id) {
        if (!(await isOwned(clinic_id))) {
          return res.status(403).json({ error: 'This clinic is not one of your clinics' });
        }
        const slots = await availabilityModel.listSlots({ ...filters, clinicId: clinic_id });
        return res.status(200).json({ slots });
      }
      const slots = await availabilityModel.listSlots({ ...filters, clinicIds: owned });
      return res.status(200).json({ slots });
    }

    // Admin sees everything, optionally filtered.
    const slots = await availabilityModel.listSlots({
      ...filters,
      doctorId: doctor_id || undefined,
      clinicId: clinic_id || undefined,
    });
    return res.status(200).json({ slots });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/v1/availability/:id — withdraw an open slot.
const removeAvailability = async (req, res) => {
  try {
    const slot = await availabilityModel.getSlotById(req.params.id);
    if (!slot) return res.status(404).json({ error: 'Availability slot not found' });

    const scope = await resolveScope(req.user, { doctor_id: slot.doctor_id, clinic_id: slot.clinic_id });
    if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

    if (slot.status !== 'open') {
      return res.status(409).json({
        error: `Only open slots can be withdrawn (current: ${slot.status}). Cancel the appointment first.`,
      });
    }
    await availabilityModel.setSlotStatus(slot.id, 'cancelled');
    res.status(200).json({ message: 'Availability slot withdrawn.' });
  } catch (error) {
    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid ID format provided' });
    }
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  SLOT_MINUTES,
  createAvailability,
  listAvailability,
  removeAvailability,
};
