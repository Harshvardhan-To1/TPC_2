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

// Download a resume (admin or company can download, student can download their own)
router.get('/resume/:filename', authenticateToken, (req, res) => {
  const { filename } = req.params;
  // Sanitize: no path traversal
  const safeName = path.basename(filename);
  const filePath = path.join(UPLOAD_DIR, 'resumes', safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found.' });
  }
  res.download(filePath);
});

// Download offer letter (only student who owns it, or admin/company)
router.get('/offer/:filename', authenticateToken, (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(UPLOAD_DIR, 'offers', safeName);
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
