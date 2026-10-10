const db = require('../config/db');
const adminModel = require('../models/adminModel');
const appointmentModel = require('../models/appointmentModel');
const ownerModel = require('../models/ownerModel');
const { hashPassword } = require('../utils/password');

const VALID_STAFF_ROLES = ['doctor', 'receptionist'];
const VALID_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show', 'pending'];

const normalizeEmail = (email) =>
  typeof email === 'string' ? email.trim().toLowerCase() : email;

const parseDateParam = (value, name, res) => {
  if (!value) return { ok: true, date: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    res.status(400).json({ error: `${name} must be a valid date` });
    return { ok: false };
  }
  return { ok: true, date: date.toISOString() };
};

const listMyClinics = async (req, res) => {
  try {
    const clinics = await ownerModel.getOwnedClinics(req.user.id);
    res.status(200).json({ clinics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const listStaff = async (req, res) => {
  try {
    const staff = await ownerModel.listClinicStaff(req.clinicId);
    res.status(200).json({ staff });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createStaff = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password, role, name, specialization } = req.body;
    const phone_number = req.body.phone_number || null;

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'email, password, and role are required.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters.' });
    }
    if (!VALID_STAFF_ROLES.includes(role)) {
      return res.status(400).json({
        error: `role must be one of: ${VALID_STAFF_ROLES.join(', ')} (owners cannot change privileges)`,
      });
    }
    if (!name) {
      return res.status(400).json({ error: 'name is required for the staff profile.' });
    }
    if (role === 'doctor' && !specialization) {
      return res.status(400).json({ error: 'specialization is required for a doctor profile.' });
    }

    try {
      const created = await db.withTransaction(async (client) => {
        const user = await adminModel.createUser(
          { email, password_hash: hashPassword(password), role },
          client
        );

        let profile = null;
        if (role === 'doctor') {
          profile = await adminModel.createDoctor(
            { user_id: user.id, clinic_id: req.clinicId, name, phone_number, specialization },
            client
          );
        } else {
          profile = await adminModel.createReceptionist(
            { user_id: user.id, clinic_id: req.clinicId, name, phone_number },
            client
          );
        }

        await adminModel.createAuditLog({
          action: 'owner_create_staff',
          target_user_id: user.id,
          target_email: user.email,
          old_role: null,
          new_role: role,
          performed_by: req.user.id,
          clinic_id: req.clinicId,
        }, client);

        return { user, profile };
      });

      return res.status(201).json({
        message: 'Staff account created successfully',
        user: { id: created.user.id, email: created.user.email, role: created.user.role },
        profile: created.profile,
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }
      throw error;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const removeStaff = async (req, res) => {
  try {
    const target = await adminModel.getUserById(req.params.userId);
    if (!target || !VALID_STAFF_ROLES.includes(target.role)) {
      return res.status(404).json({ error: 'Staff member not found in your clinic' });
    }

    const inScope = target.role === 'doctor'
      ? await adminModel.getDoctorByUserId(target.id)
      : await adminModel.getReceptionistByUserId(target.id);
    if (!inScope || Number(inScope.clinic_id) !== Number(req.clinicId)) {
      return res.status(404).json({ error: 'Staff member not found in your clinic' });
    }

    const deactivated = await db.withTransaction(async (client) => {
      const row = await adminModel.deactivateUser(target.id, client);
      await adminModel.createAuditLog({
        action: 'owner_remove_staff',
        target_user_id: target.id,
        target_email: target.email,
        old_role: target.role,
        new_role: null,
        performed_by: req.user.id,
        clinic_id: req.clinicId,
      }, client);
      return row;
    });

    return res.status(200).json({
      message: 'Staff account deactivated successfully',
      user: deactivated,
    });
  } catch (error) {
    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid ID format provided' });
    }
    res.status(500).json({ error: error.message });
  }
};

const listQueue = async (req, res) => {
  try {
    const { status } = req.query;
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    const appointments = await appointmentModel.listAppointmentsByClinicId(req.clinicId, status);
    res.status(200).json({ appointments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const decideAppointment = (decision) => async (req, res) => {
  try {
    const appointment = await appointmentModel.getAppointmentById(req.params.apptId);
    const owned = await ownerModel.getOwnerClinicIds(req.user.id);

    if (!appointment || !owned.includes(Number(appointment.clinic_id))) {
      return res.status(404).json({ error: 'Appointment not found in your clinics' });
    }
    if (appointment.status !== 'pending') {
      return res.status(400).json({
        error: `Only pending appointments can be ${decision === 'approve' ? 'approved' : 'rejected'} (current status: ${appointment.status})`,
      });
    }

    const newStatus = decision === 'approve' ? 'scheduled' : 'cancelled';
    const updated = await db.withTransaction(async (client) => {
      const row = await appointmentModel.updateAppointmentStatus(appointment.id, newStatus, client);
      await adminModel.createAuditLog({
        action: decision === 'approve' ? 'appointment_approved' : 'appointment_rejected',
        appointment_id: appointment.id,
        old_status: appointment.status,
        new_status: newStatus,
        performed_by: req.user.id,
        clinic_id: appointment.clinic_id,
      }, client);
      return row;
    });

    res.status(200).json({
      message: decision === 'approve' ? 'Appointment approved' : 'Appointment rejected',
      appointment: updated,
    });
  } catch (error) {
    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid ID format provided' });
    }
    res.status(500).json({ error: error.message });
  }
};

const reportsAppointments = async (req, res) => {
  try {
    const from = parseDateParam(req.query.from, 'from', res);
    if (!from.ok) return;
    const to = parseDateParam(req.query.to, 'to', res);
    if (!to.ok) return;
    const stats = await ownerModel.appointmentStats(req.clinicId, from.date, to.date);
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const reportsBilling = async (req, res) => {
  try {
    const from = parseDateParam(req.query.from, 'from', res);
    if (!from.ok) return;
    const to = parseDateParam(req.query.to, 'to', res);
    if (!to.ok) return;
    const stats = await ownerModel.billingStats(req.clinicId, from.date, to.date);
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  listMyClinics,
  listStaff,
  createStaff,
  removeStaff,
  listQueue,
  decideAppointment,
  reportsAppointments,
  reportsBilling,
};
