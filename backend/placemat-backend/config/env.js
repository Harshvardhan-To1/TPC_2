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

function toBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
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
  EMAIL_VERIFICATION_EXP_MINUTES: toInt(process.env.EMAIL_VERIFICATION_EXP_MINUTES, 15),
  EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: toInt(process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS, 60),
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: toInt(process.env.SMTP_PORT, 587),
  SMTP_SECURE: toBool(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
};
