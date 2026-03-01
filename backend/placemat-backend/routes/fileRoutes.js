/**
 * PLACEMAT — routes/fileRoutes.js
 * Secure file downloads
 */

const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const { authenticateToken } = require('../middlewares/auth');
const { UPLOAD_DIR }        = require('../config/env');
const { getDb } = require('../database/db');

function canAccessResume(user, safeName) {
  const db = getDb();
  const pattern = `%${safeName}`;

  if (user.role === 'admin' || user.role === 'superadmin') return true;
  if (user.role === 'student') {
    const own = db.prepare(`
      SELECT id FROM students
      WHERE id = ? AND resume_path IS NOT NULL AND resume_path LIKE ?
    `).get(user.id, pattern);
    return !!own;
  }
  if (user.role === 'company') {
    const related = db.prepare(`
      SELECT s.id
      FROM applications a
      JOIN job_drives jd ON jd.id = a.drive_id
      JOIN students s ON s.id = a.student_id
      WHERE jd.company_id = ? AND s.resume_path IS NOT NULL AND s.resume_path LIKE ?
      LIMIT 1
    `).get(user.id, pattern);
    return !!related;
  }
  return false;
}

function canAccessOffer(user, safeName) {
  const db = getDb();
  const pattern = `%${safeName}`;

  if (user.role === 'admin' || user.role === 'superadmin') return true;
  if (user.role === 'student') {
    const own = db.prepare(`
      SELECT id FROM offers
      WHERE student_id = ? AND offer_letter IS NOT NULL AND offer_letter LIKE ?
      LIMIT 1
    `).get(user.id, pattern);
    return !!own;
  }
  if (user.role === 'company') {
    const own = db.prepare(`
      SELECT id FROM offers
      WHERE company_id = ? AND offer_letter IS NOT NULL AND offer_letter LIKE ?
      LIMIT 1
    `).get(user.id, pattern);
    return !!own;
  }
  return false;
}

// Download a resume (admin or company can download, student can download their own)
router.get('/resume/:filename', authenticateToken, (req, res) => {
  const { filename } = req.params;
  // Sanitize: no path traversal
  const safeName = path.basename(filename);
  const filePath = path.join(UPLOAD_DIR, 'resumes', safeName);

  try {
    if (!canAccessResume(req.user, safeName)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to access this resume.' });
    }
  } catch {
    return res.status(500).json({ success: false, message: 'Authorization check failed.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found.' });
  }
  res.download(filePath);
});

// Download offer letter (only student who owns it, or admin/company)
router.get('/offer/:filename', authenticateToken, (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(UPLOAD_DIR, 'offers', safeName);

  try {
    if (!canAccessOffer(req.user, safeName)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to access this offer.' });
    }
  } catch {
    return res.status(500).json({ success: false, message: 'Authorization check failed.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found.' });
  }
  res.download(filePath);
});

// Company logo (public)
router.get('/logo/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(UPLOAD_DIR, 'logos', safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found.' });
  }
  res.sendFile(path.resolve(filePath));
});

module.exports = router;
