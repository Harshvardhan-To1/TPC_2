/**
 * PLACEMAT — routes/studentRoutes.js
 */

const express  = require('express');
const router   = express.Router();
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');
const { sanitizeInputs } = require('../middlewares/validate');
const { resumeUpload }   = require('../middlewares/upload');

const authCtrl    = require('../controllers/studentAuthController');
const studentCtrl = require('../controllers/studentController');

// ─── AUTH (public) ────────────────────────────────────────────
router.get('/placed-students', studentCtrl.getPlacedStudentsPublic);
router.post('/auth/login',    sanitizeInputs, authCtrl.login);
router.post('/auth/register', sanitizeInputs, authCtrl.register);

// ─── PROTECTED ────────────────────────────────────────────────
router.use(authenticateToken, authorizeRoles('student'));

// Dashboard
router.get('/dashboard',        studentCtrl.getDashboardStats);

// Profile
router.get('/profile',          studentCtrl.getProfile);
router.put('/profile',          sanitizeInputs, studentCtrl.updateProfile);
router.post('/profile/resume',  resumeUpload.single('resume'), studentCtrl.uploadResume);

// Drives & Applications
router.get('/drives',           studentCtrl.getAvailableDrives);
router.post('/apply',           sanitizeInputs, studentCtrl.applyToDrive);
router.get('/applications',     studentCtrl.getMyApplications);

// Interviews & Offers
router.get('/interviews',       studentCtrl.getMyInterviews);
router.get('/offer',            studentCtrl.getMyOffer);
router.post('/offer/respond',   sanitizeInputs, studentCtrl.respondToOffer);

// Notifications & Queries
router.get('/notifications',    studentCtrl.getMyNotifications);
router.post('/queries',         sanitizeInputs, studentCtrl.submitQuery);
router.get('/queries',          studentCtrl.getMyQueries);

module.exports = router;
