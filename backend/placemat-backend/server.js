/**
 * PLACEMAT — server.js
 * Main Express application entry point
 * SCSIT DAVV Campus Placement System 2025-26
 */

'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const path       = require('path');
const fs         = require('fs');
const cookieParser = require('cookie-parser');

const { initDb }      = require('./database/db');
const { PORT, UPLOAD_DIR, FRONTEND_DIR, NODE_ENV } = require('./config/env');

// ─── ROUTE IMPORTS ────────────────────────────────────────────
const adminRoutes   = require('./routes/adminRoutes');
const companyRoutes = require('./routes/companyRoutes');
const studentRoutes = require('./routes/studentRoutes');
const fileRoutes    = require('./routes/fileRoutes');

// ─── INIT APP ─────────────────────────────────────────────────
const app = express();

// ─── SECURITY MIDDLEWARE ──────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false  // disable for dev; enable properly in prod
}));

app.use(cors({
  origin: NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN || 'http://localhost:5000'
    : '*',
  credentials: true
}));

// ─── GENERAL MIDDLEWARE ───────────────────────────────────────
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Trust proxy for correct IP in logs
app.set('trust proxy', 1);

// ─── ENSURE UPLOAD DIRS EXIST ─────────────────────────────────
['resumes', 'logos', 'offers'].forEach(sub => {
  const dir = path.join(UPLOAD_DIR, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── SERVE STATIC UPLOADS (images) ───────────────────────────
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

// ─── SERVE FRONTEND STATIC FILES ─────────────────────────────
const frontendPath = path.resolve(FRONTEND_DIR);
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  console.log(`📁  Serving frontend from: ${frontendPath}`);
}

// ─── API ROUTES ───────────────────────────────────────────────
app.use('/api/admin',   adminRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/files',   fileRoutes);

// ─── HEALTH CHECK ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status:  'running',
    version: '1.0.0',
    env:     NODE_ENV,
    time:    new Date().toISOString()
  });
});

// ─── API 404 FALLBACK ─────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found.' });
});

// ─── FALLBACK — serve frontend index for SPA-style routing ────
app.get('*', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ success: false, message: 'Route not found.' });
  }
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌  Unhandled Error:', err.message);

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File too large. Max 5MB allowed.' });
  }
  if (err.message && err.message.includes('Only PDF')) {
    return res.status(400).json({ success: false, message: err.message });
  }

  res.status(500).json({
    success: false,
    message: NODE_ENV === 'production' ? 'Internal server error.' : err.message
  });
});

// ─── BOOTSTRAP ────────────────────────────────────────────────
async function bootstrap() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════╗');
      console.log('║   🎓  PLACEMAT — SCSIT DAVV 2025-26     ║');
      console.log(`║   🚀  Server running on port ${PORT}        ║`);
      console.log(`║   🌍  http://localhost:${PORT}              ║`);
      console.log('╚══════════════════════════════════════════╝');
      console.log('');
    });
  } catch (err) {
    console.error('❌  Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────
process.on('SIGINT',  () => { console.log('\n🛑  Shutting down...'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n🛑  Shutting down...'); process.exit(0); });
