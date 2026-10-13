const db = require('../config/db');
const adminModel = require('../models/adminModel');
const appointmentModel = require('../models/appointmentModel');
const ownerModel = require('../models/ownerModel');
const { canInvite, normalizeRole, STAFF_ROLES } = require('../utils/roles');
const {
  generateInviteToken,
  inviteExpiry,
  placeholderPasswordHash,
  INVITE_TTL_DAYS,
} = require('../utils/invites');

const normalizeEmail = (email) =>
  typeof email === 'string' ? email.trim().toLowerCase() : email;

// Owner must be active and the clinic must be approved before staff
// management unlocks. Pending-verification owners can sign in but get 403 here.
const assertCanManageClinic = async (owner, clinicId) => {
  if (normalizeRole(owner.role) !== 'clinic_owner') {
    return { ok: false, status: 403, error: 'Only clinic owners can manage staff.' };
  }
  if (owner.status !== 'active') {
    return { ok: false, status: 403, error: 'Your account is not active yet. Staff management unlocks after verification.' };
  }
  const clinic = await adminModel.getClinicById(clinicId);
  if (!clinic) {
    return { ok: false, status: 404, error: 'Clinic not found.' };
  }
  if (clinic.status !== 'active') {
    return { ok: false, status: 403, error: 'Clinic is pending verification. Staff invites unlock after admin approval.' };
  }
  return { ok: true, clinic };
};

const staffScopeError = (res, target, clinicId) => {
  if (!target || !STAFF_ROLES.includes(normalizeRole(target.role))) {
    res.status(404).json({ error: 'Staff member not found in your clinic' });
    return true;
  }
  if (Number(target.clinic_id) !== Number(clinicId)) {
    res.status(404).json({ error: 'Staff member not found in your clinic' });
    return true;
  }
  return false;
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

// Invite-only staff creation. Role is derived server-side and permission
// checked against the matrix (clinic owners -> doctor, receptionist).
// No password in the request: the invitee sets it on accept.
const inviteStaff = async (req, res) => {
  try {
    const gate = await assertCanManageClinic(req.user, req.clinicId);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    const email = normalizeEmail(req.body.email);
    const { role, name, specialization } = req.body;
    const phone_number = req.body.phone_number || null;

    if (!email || !role || !name) {
      return res.status(400).json({ error: 'email, role, and name are required.' });
    }
    if (!canInvite(req.user.role, role)) {
      return res.status(403).json({ error: `Role cannot invite ${role}. Owners can invite: doctor, receptionist.` });
    }
    if (role === 'doctor' && !specialization) {
      return res.status(400).json({ error: 'specialization is required for a doctor invite.' });
    }

    try {
      const { token, tokenHash } = generateInviteToken();
      const created = await db.withTransaction(async (client) => {
        const user = await adminModel.createUser(
          {
            email,
            password_hash: placeholderPasswordHash(),
            role,
            clinic_id: req.clinicId,
            status: 'invited',
            invited_by: req.user.id,
          },
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

        const invite = await adminModel.createStaffInvite(
          {
            user_id: user.id,
            token_hash: tokenHash,
            role,
            clinic_id: req.clinicId,
            expires_at: inviteExpiry(),
            created_by: req.user.id,
          },
          client
        );

        await adminModel.createAuditLog({
          action: 'staff_invited',
          target_user_id: user.id,
          target_email: user.email,
          old_role: null,
          new_role: role,
          performed_by: req.user.id,
          clinic_id: req.clinicId,
        }, client);

        return { user, profile, invite };
      });

      return res.status(201).json({
        message: `Invite created for ${email}. Share the invite token (expires in ${INVITE_TTL_DAYS} days).`,
        user: { id: created.user.id, email: created.user.email, role: created.user.role, status: created.user.status },
        profile: created.profile,
        invite: { id: created.invite.id, expires_at: created.invite.expires_at },
        // Dev-mode: returned once so the owner can share it. Production sends email instead.
        inviteToken: token,
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

// Legacy direct-create endpoint: staff must be invited now.
const createStaff = async (req, res) =>
  res.status(410).json({
    error: 'Direct staff creation is retired. Invite staff instead: POST /clinics/:clinicId/staff/invite.',
  });

const listInvites = async (req, res) => {
  try {
    const gate = await assertCanManageClinic(req.user, req.clinicId);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });
    const invites = await adminModel.listInvitesByClinic(req.clinicId);
    res.status(200).json({ invites });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const resendInvite = async (req, res) => {
  try {
    const gate = await assertCanManageClinic(req.user, req.clinicId);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    const invite = await adminModel.getInviteById(req.params.inviteId);
    if (!invite || Number(invite.clinic_id) !== Number(req.clinicId)) {
      return res.status(404).json({ error: 'Invite not found in your clinic' });
    }
    if (invite.accepted_at) {
      return res.status(409).json({ error: 'Invite was already accepted.' });
    }
    const target = await adminModel.getUserById(invite.user_id);
    if (!target || target.status !== 'invited') {
      return res.status(409).json({ error: 'Invite can only be resent while the account is still invited.' });
    }

    const { token, tokenHash } = generateInviteToken();
    const updated = await db.withTransaction(async (client) => {
      const row = await adminModel.rotateInviteToken(invite.id, tokenHash, inviteExpiry(), client);
      await adminModel.createAuditLog({
        action: 'invite_resent',
        target_user_id: invite.user_id,
        target_email: target.email,
        old_role: null,
        new_role: invite.role,
        performed_by: req.user.id,
        clinic_id: req.clinicId,
      }, client);
      return row;
    });

    res.status(200).json({
      message: 'Invite resent.',
      invite: { id: updated.id, expires_at: updated.expires_at },
      inviteToken: token,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Revoke: kills the token and offboards the never-activated row so the email
// is freed for a fresh invite.
const revokeInvite = async (req, res) => {
  try {
    const gate = await assertCanManageClinic(req.user, req.clinicId);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    const invite = await adminModel.getInviteById(req.params.inviteId);
    if (!invite || Number(invite.clinic_id) !== Number(req.clinicId)) {
      return res.status(404).json({ error: 'Invite not found in your clinic' });
    }
    if (invite.accepted_at) {
      return res.status(409).json({ error: 'Invite was already accepted. Offboard the staff member instead.' });
    }

    const target = await adminModel.getUserById(invite.user_id);
    await db.withTransaction(async (client) => {
      await adminModel.revokeInvite(invite.id, client);
      if (target && target.status === 'invited') {
        await adminModel.offboardUser(target.id, client);
        await client.query(`DELETE FROM doctors WHERE user_id = $1 AND clinic_id = $2;`, [target.id, req.clinicId]);
        await client.query(`DELETE FROM receptionists WHERE user_id = $1 AND clinic_id = $2;`, [target.id, req.clinicId]);
      }
      await adminModel.createAuditLog({
        action: 'invite_revoked',
        target_user_id: invite.user_id,
        target_email: target ? target.email : invite.user_id,
        old_role: invite.role,
        new_role: null,
        performed_by: req.user.id,
        clinic_id: req.clinicId,
      }, client);
    });

    res.status(200).json({ message: 'Invite revoked.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Clean departure from active OR suspended (confirmed departure).
// clinic_id is never edited in place; rejoining means a brand-new invite row.
const offboardStaff = async (req, res) => {
  try {
    const gate = await assertCanManageClinic(req.user, req.clinicId);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    const target = await adminModel.getUserById(req.params.userId);
    if (staffScopeError(res, target, req.clinicId)) return;
    if (target.status === 'offboarded') {
      return res.status(409).json({ error: 'Staff member is already offboarded.' });
    }
    if (target.status === 'invited') {
      return res.status(409).json({ error: 'Invite not accepted yet. Revoke the invite instead.' });
    }

    const offboarded = await db.withTransaction(async (client) => {
      const row = await adminModel.offboardUser(target.id, client);
      await adminModel.createAuditLog({
        action: 'user_offboarded',
        target_user_id: target.id,
        target_email: target.email,
        old_role: target.role,
        new_role: null,
        performed_by: req.user.id,
        clinic_id: req.clinicId,
      }, client);
      return row;
    });

    return res.status(200).json({ message: 'Staff offboarded. Email freed for future invites.', user: offboarded });
  } catch (error) {
    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid ID format provided' });
    }
    res.status(500).json({ error: error.message });
  }
};

// Policy suspension: email stays blocked, never silently expires.
const suspendStaff = async (req, res) => {
  try {
    const gate = await assertCanManageClinic(req.user, req.clinicId);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    const target = await adminModel.getUserById(req.params.userId);
    if (staffScopeError(res, target, req.clinicId)) return;
    if (target.status !== 'active') {
      return res.status(409).json({ error: `Only active staff can be suspended (current: ${target.status}).` });
    }

    const suspended = await db.withTransaction(async (client) => {
      const row = await adminModel.suspendUser(target.id, client);
      await adminModel.createAuditLog({
        action: 'user_suspended',
        target_user_id: target.id,
        target_email: target.email,
        old_role: target.role,
        new_role: null,
        performed_by: req.user.id,
        clinic_id: req.clinicId,
      }, client);
      return row;
    });

    return res.status(200).json({ message: 'Staff suspended. Resolve explicitly: reinstate or offboard.', user: suspended });
  } catch (error) {
    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid ID format provided' });
    }
    res.status(500).json({ error: error.message });
  }
};

// Back-compat: historic DELETE now performs offboarding.
const removeStaff = async (req, res) => {
  req.params.userId = req.params.userId;
  return offboardStaff(req, res);
};

const parseDateParam = (value, name, res) => {
  if (!value) return { ok: true, date: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    res.status(400).json({ error: `${name} must be a valid date` });
    return { ok: false };
  }
  return { ok: true, date: date.toISOString() };
};

const listQueue = async (req, res) => {
  try {
    const { status } = req.query;
    const VALID_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show', 'pending'];
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
  inviteStaff,
  listInvites,
  resendInvite,
  revokeInvite,
  offboardStaff,
  suspendStaff,
  removeStaff,
  listQueue,
  decideAppointment,
  reportsAppointments,
  reportsBilling,
};
