// Canonical role + status vocab for the role-hierarchy flows.
// Role is always derived server-side from the endpoint/flow - never from client input.

const ROLES = ['admin', 'clinic_owner', 'doctor', 'receptionist', 'patient'];

const LEGACY_ROLE_ALIASES = { owner: 'clinic_owner' };

const normalizeRole = (role) => LEGACY_ROLE_ALIASES[role] || role;

// Statuses a user can hold.
const USER_STATUSES = ['pending_verification', 'invited', 'active', 'suspended', 'offboarded'];

// Statuses allowed to obtain/keep a session.
const LOGINABLE_STATUSES = ['active', 'pending_verification'];

// Who can invite whom (inviter -> invitees).
const INVITE_PERMISSIONS = {
  admin: ['clinic_owner', 'doctor', 'receptionist'],
  clinic_owner: ['doctor', 'receptionist'],
  doctor: [],
  receptionist: [],
  patient: [],
};

const canInvite = (inviterRole, inviteeRole) =>
  (INVITE_PERMISSIONS[normalizeRole(inviterRole)] || []).includes(inviteeRole);

// Staff roles share the invite -> active -> offboarded/suspended lifecycle.
const STAFF_ROLES = ['doctor', 'receptionist'];

const CLINIC_STATUSES = ['pending_verification', 'active', 'suspended'];

module.exports = {
  ROLES,
  LEGACY_ROLE_ALIASES,
  normalizeRole,
  USER_STATUSES,
  LOGINABLE_STATUSES,
  INVITE_PERMISSIONS,
  canInvite,
  STAFF_ROLES,
  CLINIC_STATUSES,
};
