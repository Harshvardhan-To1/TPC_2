const bcrypt = require('bcrypt');
const {
  EMAIL_VERIFICATION_EXP_MINUTES,
  EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS
} = require('../config/env');

const CODE_HASH_ROUNDS = 10;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function buildVerificationRecord() {
  const code = generateVerificationCode();
  const codeHash = await bcrypt.hash(code, CODE_HASH_ROUNDS);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_EXP_MINUTES * 60 * 1000).toISOString();

  return {
    code,
    codeHash,
    sentAt: now.toISOString(),
    expiresAt
  };
}

async function verifyCode(code, codeHash) {
  if (!code || !codeHash) return false;
  return bcrypt.compare(String(code).trim(), codeHash);
}

function isCodeExpired(expiresAt) {
  if (!expiresAt) return true;
  const timestamp = Date.parse(expiresAt);
  if (!Number.isFinite(timestamp)) return true;
  return Date.now() > timestamp;
}

function canResendCode(lastSentAt) {
  if (!lastSentAt) return true;
  const timestamp = Date.parse(lastSentAt);
  if (!Number.isFinite(timestamp)) return true;
  return Date.now() - timestamp >= EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000;
}

function getResendWaitSeconds(lastSentAt) {
  if (!lastSentAt) return 0;
  const timestamp = Date.parse(lastSentAt);
  if (!Number.isFinite(timestamp)) return 0;
  const elapsed = Math.floor((Date.now() - timestamp) / 1000);
  return Math.max(0, EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS - elapsed);
}

module.exports = {
  normalizeEmail,
  buildVerificationRecord,
  verifyCode,
  isCodeExpired,
  canResendCode,
  getResendWaitSeconds
};
