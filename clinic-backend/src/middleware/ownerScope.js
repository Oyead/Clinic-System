const ownerModel = require('../models/ownerModel');
const adminModel = require('../models/adminModel');

const clinicIdSources = (req) => [
  req.params.clinicId,
  req.params.clinic_id,
  req.body && req.body.clinic_id,
  req.query.clinic_id,
];

const requireClinicScope = async (req, res, next) => {
  try {
    const raw = clinicIdSources(req).find((v) => v !== undefined && v !== null && v !== '');
    const clinicId = Number(raw);

    if (!Number.isInteger(clinicId) || clinicId <= 0) {
      return res.status(400).json({ error: 'A valid clinic_id is required' });
    }

    const owned = await ownerModel.getOwnerClinicIds(req.user.id);
    let inScope = owned.includes(clinicId);
    if (!inScope) {
      // Fallback: clinics.owner_id is the canonical link; the join table is kept in sync.
      const clinic = await adminModel.getClinicById(clinicId);
      inScope = !!clinic && Number(clinic.owner_id) === Number(req.user.id);
    }
    if (!inScope) {
      return res.status(403).json({ error: 'This clinic is not one of your clinics' });
    }

    req.clinicId = clinicId;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { requireClinicScope };
