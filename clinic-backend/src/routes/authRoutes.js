const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/signup', authController.signup);
router.post('/signup-clinic', authController.signupClinic);
router.post('/accept-invite', authController.acceptInvite);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/signout', authController.signout);

module.exports = router;
