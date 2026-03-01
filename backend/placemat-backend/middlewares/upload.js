/**
 * PLACEMAT — middlewares/upload.js
 * Multer config for secure file uploads
 */

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { UPLOAD_DIR, MAX_FILE_SIZE } = require('../config/env');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeStorage(subfolder) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOAD_DIR, subfolder);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase();
      const name = `${subfolder}_${req.user?.id || 'anon'}_${Date.now()}${ext}`;
      cb(null, name);
    }
  });
}

// Resume upload (PDF only)
const resumeUpload = multer({
  storage: makeStorage('resumes'),
  limits:  { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed for resumes.'));
  }
});

// Logo upload (images only)
const logoUpload = multer({
  storage: makeStorage('logos'),
  limits:  { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, or WebP images are allowed.'));
  }
});

// Offer letter upload (PDF only)
const offerUpload = multer({
  storage: makeStorage('offers'),
  limits:  { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed for offer letters.'));
  }
});

module.exports = { resumeUpload, logoUpload, offerUpload };
