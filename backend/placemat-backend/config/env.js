/**
 * PLACEMAT — config/env.js
 * Central config values read from environment
 */

'use strict';

require('dotenv').config();

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
  PORT:           toInt(process.env.PORT, 5000),
  NODE_ENV:       process.env.NODE_ENV       || 'development',
  JWT_SECRET:     process.env.JWT_SECRET     || 'placemat_super_secret_change_in_prod_2025',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  DB_PATH:        process.env.DB_PATH        || './database/placemat.db',
  UPLOAD_DIR:     process.env.UPLOAD_DIR     || './uploads',
  MAX_FILE_SIZE:  toInt(process.env.MAX_FILE_SIZE, 5242880), // 5MB
  // Relative to backend working directory (backend/placemat-backend)
  FRONTEND_DIR:   process.env.FRONTEND_DIR   || '../../frontend/placemat-frontend',
  BCRYPT_ROUNDS:  toInt(process.env.BCRYPT_ROUNDS, 12),
};
