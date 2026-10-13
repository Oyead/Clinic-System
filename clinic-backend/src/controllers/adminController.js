const adminModel = require('../models/adminModel')
const ownerModel = require('../models/ownerModel')
const { hashPassword } = require('../utils/password');
const db = require('../config/db');
const { ROLES, normalizeRole, canInvite, USER_STATUSES } = require('../utils/roles');
const { generateInviteToken, inviteExpiry, placeholderPasswordHash, INVITE_TTL_DAYS } = require('../utils/invites');

const VALID_ROLES = ROLES;

const normalizeEmail = (email) =>
  typeof email === 'string' ? email.trim().toLowerCase() : email;

const parseDuration = (value) => {
  if (value === undefined || value === null || value === '') {
    return { ok: true, duration: undefined };
  }
  const duration = Number(value);
  if (!Number.isInteger(duration) || duration <= 0 || duration > 480) {
    return { ok: false };
  }
  return { ok: true, duration };
};

const publicUser = (u) => u && {
  id: u.id,
  email: u.email,
  role: u.role,
  clinic_id: u.clinic_id || null,
  status: u.status,
  is_active: u.is_active,
};

const addClinic = async(req,res)=>{
    try {
    const { name, phone_number, address, email } = req.body;

    if (!name || !phone_number || !address || !email) {
    return res.status(400).json({
    error: 'All fields (name, phone_number, address, email) are required.'
  });
}
    const clinic = await adminModel.createClinic({ name, phone_number, address, email, status: 'active' });
    await adminModel.createAuditLog({
      action: 'admin_create_clinic',
      performed_by: req.user ? req.user.id : null,
      clinic_id: clinic.id,
    }, db);
    res.status(201).json({ message: 'Clinic created successfully', clinic });
    } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const listClinics = async (req, res) => {
  try {
    const { status } = req.query;
    if (status) {
      if (!['pending_verification', 'active', 'suspended'].includes(status)) {
        return res.status(400).json({ error: 'status must be one of: pending_verification, active, suspended' });
      }
      const clinics = await adminModel.listClinicsByStatus(status);
      return res.status(200).json({ clinics });
    }
    const pending = await adminModel.listClinicsByStatus('pending_verification');
    const active = await adminModel.listClinicsByStatus('active');
    res.status(200).json({ clinics: [...pending, ...active], pending, active });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Owner signup review: pending_verification -> active for clinic + owner.
const approveClinic = async (req, res) => {
  try {
    const clinic = await adminModel.getClinicById(req.params.id);
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }
    if (clinic.status === 'active') {
      return res.status(200).json({ message: 'Clinic already active', clinic });
    }
    const result = await db.withTransaction(async (client) => {
      const updated = await adminModel.setClinicStatus(clinic.id, 'active', client);
      let owner = null;
      if (clinic.owner_id) {
        const ownerRow = await adminModel.getUserById(clinic.owner_id);
        if (ownerRow && ownerRow.status === 'pending_verification') {
          owner = await adminModel.setUserStatus(ownerRow.id, 'active', client);
        } else {
          owner = ownerRow;
        }
      }
      await adminModel.createAuditLog({
        action: 'clinic_approved',
        target_user_id: clinic.owner_id,
        performed_by: req.user.id,
        clinic_id: clinic.id,
      }, client);
      return { clinic: updated, owner: publicUser(owner) };
    });
    res.status(200).json({ message: 'Clinic approved. Owner can now invite staff.', ...result });
  } catch (error) {
    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid ID format provided' });
    }
    res.status(500).json({ error: error.message });
  }
};

// Additional admins: created only by existing admins. Role hardcoded.
const createAdmin = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters.' });
    }
    try {
      const user = await db.withTransaction(async (client) => {
        const created = await adminModel.createUser(
          { email, password_hash: hashPassword(password), role: 'admin', status: 'active' },
          client
        );
        await adminModel.createAuditLog({
          action: 'admin_created',
          target_user_id: created.id,
          target_email: created.email,
          old_role: null,
          new_role: 'admin',
          performed_by: req.user.id,
        }, client);
        return created;
      });
      res.status(201).json({ message: 'Admin created successfully', user: publicUser(user) });
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

// Support override: admin invites doctor/receptionist (or clinic_owner to an
// existing clinic). Same invite lifecycle as the owner flow.
const inviteStaff = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { role, name, clinic_id, specialization } = req.body;
    const phone_number = req.body.phone_number || null;

    if (!email || !role || !name || !clinic_id) {
      return res.status(400).json({ error: 'email, role, name, and clinic_id are required.' });
    }
    if (!canInvite('admin', role)) {
      return res.status(403).json({ error: `Admins can invite: clinic_owner, doctor, receptionist.` });
    }
    const clinic = await adminModel.getClinicById(clinic_id);
    if (!clinic) {
      return res.status(400).json({ error: 'The provided clinic_id does not exist' });
    }
    if (role === 'doctor' && !specialization) {
      return res.status(400).json({ error: 'specialization is required for a doctor invite.' });
    }

    try {
      const { token, tokenHash } = generateInviteToken();
      const created = await db.withTransaction(async (client) => {
        const user = await adminModel.createUser(
          { email, password_hash: placeholderPasswordHash(), role, clinic_id, status: 'invited', invited_by: req.user.id },
          client
        );
        let profile = null;
        if (role === 'doctor') {
          const parsed = parseDuration(req.body.duration_minutes);
          if (!parsed.ok) throw Object.assign(new Error('duration_minutes must be an integer between 1 and 480'), { statusCode: 400 });
          profile = await adminModel.createDoctor(
            { user_id: user.id, clinic_id, name, phone_number, specialization, ...(parsed.duration !== undefined ? { duration_minutes: parsed.duration } : {}) },
            client
          );
        } else if (role === 'receptionist') {
          profile = await adminModel.createReceptionist({ user_id: user.id, clinic_id, name, phone_number }, client);
        } else if (role === 'clinic_owner') {
          await ownerModel.assignOwner(user.id, clinic_id, client);
          const current = await adminModel.getClinicById(clinic_id, client);
          if (!current.owner_id) await adminModel.setClinicOwner(clinic_id, user.id, client);
        }
        const invite = await adminModel.createStaffInvite(
          { user_id: user.id, token_hash: tokenHash, role, clinic_id, expires_at: inviteExpiry(), created_by: req.user.id },
          client
        );
        await adminModel.createAuditLog({
          action: 'staff_invited',
          target_user_id: user.id,
          target_email: user.email,
          old_role: null,
          new_role: role,
          performed_by: req.user.id,
          clinic_id,
        }, client);
        return { user, profile, invite };
      });
      res.status(201).json({
        message: `Invite created (expires in ${INVITE_TTL_DAYS} days).`,
        user: publicUser(created.user),
        ...(created.profile ? { profile: created.profile } : {}),
        invite: { id: created.invite.id, expires_at: created.invite.expires_at },
        inviteToken: token,
      });
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
      if (error.code === '23505') {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }
      throw error;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Retired: role is never taken from client input anymore.
const roleFromClientRetired = (what) => async (req, res) =>
  res.status(410).json({ error: `${what} is retired. Roles derive from the signup/invite flow; use suspend / reinstate / offboard for lifecycle changes.` });

const suspendUser = async (req, res) => {
  try {
    const target = await adminModel.getUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (String(target.id) === String(req.user.id)) {
      return res.status(403).json({ error: 'You cannot suspend your own admin account.' });
    }
    if (target.role === 'admin' && target.is_active) {
      const adminCount = await adminModel.countActiveAdmins();
      if (adminCount <= 1) {
        return res.status(403).json({ error: 'Cannot suspend the last remaining active admin.' });
      }
    }
    if (target.status !== 'active') {
      return res.status(409).json({ error: `Only active accounts can be suspended (current: ${target.status}).` });
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
        clinic_id: target.clinic_id,
      }, client);
      return row;
    });
    res.status(200).json({ message: 'User suspended. Resolve explicitly: reinstate or offboard.', user: publicUser(suspended) });
  } catch (error) {
    if (error.code === '22P02') return res.status(400).json({ error: 'Invalid ID format provided' });
    res.status(500).json({ error: error.message });
  }
};

// Explicit resolve branch 1: reinstated -> active + fresh password.
const reinstateUser = async (req, res) => {
  try {
    const target = await adminModel.getUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.status !== 'suspended') {
      return res.status(409).json({ error: `Only suspended accounts can be reinstated (current: ${target.status}).` });
    }
    const { password } = req.body;
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'A new password (min 8 characters) is required to reinstate.' });
    }
    const reinstated = await db.withTransaction(async (client) => {
      const row = await adminModel.reinstateUser(target.id, hashPassword(password), client);
      await adminModel.createAuditLog({
        action: 'user_reinstated',
        target_user_id: target.id,
        target_email: target.email,
        old_role: null,
        new_role: target.role,
        performed_by: req.user.id,
        clinic_id: target.clinic_id,
      }, client);
      return row;
    });
    res.status(200).json({ message: 'User reinstated with a fresh password.', user: publicUser(reinstated) });
  } catch (error) {
    if (error.code === '22P02') return res.status(400).json({ error: 'Invalid ID format provided' });
    res.status(500).json({ error: error.message });
  }
};

// Explicit resolve branch 2 (or clean departure): offboard, anonymize, free email.
const offboardUser = async (req, res) => {
  try {
    const target = await adminModel.getUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (String(target.id) === String(req.user.id)) {
      return res.status(403).json({ error: 'You cannot offboard your own admin account.' });
    }
    if (target.role === 'admin' && target.is_active) {
      const adminCount = await adminModel.countActiveAdmins();
      if (adminCount <= 1) {
        return res.status(403).json({ error: 'Cannot offboard the last remaining active admin.' });
      }
    }
    if (target.status === 'offboarded') {
      return res.status(409).json({ error: 'User is already offboarded.' });
    }
    const offboarded = await db.withTransaction(async (client) => {
      const pending = await client.query(
        `SELECT id FROM staff_invites WHERE user_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL;`,
        [target.id]
      );
      for (const row of pending.rows) {
        await adminModel.revokeInvite(row.id, client);
      }
      if (target.status === 'invited') {
        await client.query(`DELETE FROM doctors WHERE user_id = $1;`, [target.id]);
        await client.query(`DELETE FROM receptionists WHERE user_id = $1;`, [target.id]);
      }
      const row = await adminModel.offboardUser(target.id, client);
      await adminModel.createAuditLog({
        action: 'user_offboarded',
        target_user_id: target.id,
        target_email: target.email,
        old_role: target.role,
        new_role: null,
        performed_by: req.user.id,
        clinic_id: target.clinic_id,
      }, client);
      return row;
    });
    res.status(200).json({ message: 'User offboarded. Email freed.', user: publicUser(offboarded) });
  } catch (error) {
    if (error.code === '22P02') return res.status(400).json({ error: 'Invalid ID format provided' });
    res.status(500).json({ error: error.message });
  }
};

// Back-compat: historic DELETE now suspends (email stays blocked).
const deleteUser = async (req, res) => suspendUser(req, res);

const listPatients = async (req, res) => {
  try {
    const unlinked = req.query.unlinked === 'true';
    const patients = await adminModel.listPatients({ unlinked });
    res.status(200).json({ patients });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const linkPatient = async (req, res) => {
  try {
    const patientId = req.params.id;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required in body' });
    }

    const patient = await adminModel.getPatientById(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    if (patient.user_id) {
      return res.status(409).json({ error: 'This patient is already linked to a user account' });
    }

    const user = await adminModel.getUserById(user_id);
    if (!user) {
      return res.status(400).json({ error: 'Referenced user_id does not exist' });
    }

    if (normalizeRole(user.role) !== 'patient') {
      return res.status(400).json({ error: "user_id must reference a user with role 'patient'" });
    }

    const linked = await adminModel.linkPatientToUser(patientId, user_id);

    return res.status(200).json({
      message: 'Patient linked to user account successfully',
      patient: linked
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'This patient or user is already linked elsewhere'
      });
    }

    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid ID format provided' });
    }

    return res.status(500).json({ error: error.message });
  }
};

const listUsers = async (req, res) => {
  try {
    let { role, status } = req.query;
    if (role) {
      role = normalizeRole(role);
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({
          error: `role filter must be one of: ${VALID_ROLES.join(', ')}`,
        });
      }
    }
    if (status && !USER_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `status filter must be one of: ${USER_STATUSES.join(', ')}`,
      });
    }
    const users = await adminModel.listUsers({
      role: role || undefined,
      status: status || undefined,
      limit: Math.min(parseInt(req.query.limit, 10) || 100, 500),
      offset: Math.max(parseInt(req.query.offset, 10) || 0, 0),
    });
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const listAuditLogs = async (req, res) => {
  try {
    const logs = await adminModel.listAuditLogs({
      limit: Math.min(parseInt(req.query.limit, 10) || 100, 500),
      offset: Math.max(parseInt(req.query.offset, 10) || 0, 0),
    });
    res.status(200).json({ audit_logs: logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  addClinic,
  listClinics,
  approveClinic,
  createAdmin,
  inviteStaff,
  addUser: roleFromClientRetired('Generic user creation with a client-supplied role'),
  addDoctor: roleFromClientRetired('Manual doctor profile surgery'),
  assignDoctor: roleFromClientRetired('In-place doctor reassignment (offboard-and-recreate instead)'),
  addReceptionist: roleFromClientRetired('Manual receptionist profile surgery'),
  assignReceptionist: roleFromClientRetired('In-place receptionist reassignment (offboard-and-recreate instead)'),
  listPatients,
  linkPatient,
  listUsers,
  updateUserRole: roleFromClientRetired('Arbitrary role changes'),
  suspendUser,
  reinstateUser,
  offboardUser,
  deleteUser,
  listAuditLogs,
};
