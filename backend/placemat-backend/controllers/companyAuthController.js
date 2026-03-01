const bcrypt = require('bcrypt');
const { getAsync, runAsync } = require('../database/db');
const { generateToken } = require('../middlewares/auth');
const { BCRYPT_ROUNDS, NODE_ENV } = require('../config/env');
const { sendVerificationEmail } = require('../utils/emailService');
const {
  normalizeEmail,
  buildVerificationRecord,
  verifyCode,
  isCodeExpired,
  canResendCode,
  getResendWaitSeconds
} = require('../utils/emailVerification');

async function register(req, res) {
  try {
    const { name, industry, email, phone, hr_name, website, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    const normalizedEmail = normalizeEmail(email);
    const existing = await getAsync(
      'SELECT id FROM companies WHERE email = ?',
      [normalizedEmail]
    );
    if (existing)
      return res.status(409).json({ success: false, message: 'This email is already registered.' });

    const verification = await buildVerificationRecord();
    const hash = await bcrypt.hash(password, parseInt(BCRYPT_ROUNDS));
    const result = await runAsync(
      `INSERT INTO companies (
        name, email, password_hash, industry, phone, hr_name, website,
        email_verified, verification_code_hash, verification_code_expires, verification_code_sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        name.trim(),
        normalizedEmail,
        hash,
        industry || null,
        phone || null,
        hr_name || null,
        website || null,
        verification.codeHash,
        verification.expiresAt,
        verification.sentAt
      ]
    );

    const delivery = await sendVerificationEmail({
      to: normalizedEmail,
      name: name.trim(),
      code: verification.code,
      roleLabel: 'company'
    });

    const responseBody = {
      success: true,
      message: 'Registration submitted. Verify your email, then wait for admin approval.',
      companyId: result.lastInsertRowid,
      requires_email_verification: true,
      email: normalizedEmail
    };

    if (!delivery.delivered) {
      responseBody.message += ' Email service is not configured; use the verification flow from the app.';
    }
    if (NODE_ENV !== 'production') {
      responseBody.debug_verification_code = verification.code;
    }

    return res.status(201).json(responseBody);
  } catch (err) {
    console.error('Company register error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const normalizedEmail = normalizeEmail(email);
    const company = await getAsync(
      'SELECT * FROM companies WHERE email = ?',
      [normalizedEmail]
    );
    if (!company)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, company.password_hash);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    if (!company.email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in.',
        requires_email_verification: true,
        email: company.email
      });
    }
    if (company.approval_status === 'pending')
      return res.status(403).json({ success: false, message: 'Your account is pending admin approval.' });
    if (company.approval_status === 'rejected')
      return res.status(403).json({ success: false, message: 'Your registration was rejected. Contact admin.' });
    if (!company.is_active)
      return res.status(403).json({ success: false, message: 'Your account has been deactivated.' });

    await runAsync(
      'UPDATE companies SET last_login = ? WHERE id = ?',
      [new Date().toISOString(), company.id]
    );

    const token = generateToken({ id: company.id, role: 'company', email: company.email });

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: company.id,
        name: company.name,
        email: company.email,
        role: 'company',
        industry: company.industry
      }
    });
  } catch (err) {
    console.error('Company login error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function verifyEmail(req, res) {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();

    if (!normalizedEmail || !code) {
      return res.status(400).json({ success: false, message: 'email and code are required.' });
    }

    const company = await getAsync(
      `SELECT id, email, email_verified, verification_code_hash, verification_code_expires
       FROM companies WHERE email = ?`,
      [normalizedEmail]
    );

    if (!company) {
      return res.status(404).json({ success: false, message: 'No account found for this email.' });
    }

    if (company.email_verified) {
      return res.json({ success: true, message: 'Email is already verified.' });
    }

    if (!company.verification_code_hash || !company.verification_code_expires) {
      return res.status(400).json({
        success: false,
        message: 'Verification code not found. Please request a new code.'
      });
    }

    if (isCodeExpired(company.verification_code_expires)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.'
      });
    }

    const valid = await verifyCode(code, company.verification_code_hash);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }

    const now = new Date().toISOString();
    await runAsync(
      `UPDATE companies
       SET email_verified = 1,
           email_verified_at = ?,
           verification_code_hash = NULL,
           verification_code_expires = NULL,
           verification_code_sent_at = NULL,
           updated_at = ?
       WHERE id = ?`,
      [now, now, company.id]
    );

    return res.json({
      success: true,
      message: 'Email verified successfully. Your account will be available after admin approval.'
    });
  } catch (err) {
    console.error('Company verify email error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function resendVerification(req, res) {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: 'email is required.' });
    }

    const company = await getAsync(
      `SELECT id, name, email, email_verified, verification_code_sent_at
       FROM companies WHERE email = ?`,
      [normalizedEmail]
    );
    if (!company) {
      return res.status(404).json({ success: false, message: 'No account found for this email.' });
    }

    if (company.email_verified) {
      return res.json({ success: true, message: 'Email is already verified.' });
    }

    if (!canResendCode(company.verification_code_sent_at)) {
      const waitSeconds = getResendWaitSeconds(company.verification_code_sent_at);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds}s before requesting a new code.`
      });
    }

    const verification = await buildVerificationRecord();
    await runAsync(
      `UPDATE companies
       SET verification_code_hash = ?,
           verification_code_expires = ?,
           verification_code_sent_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        verification.codeHash,
        verification.expiresAt,
        verification.sentAt,
        new Date().toISOString(),
        company.id
      ]
    );

    const delivery = await sendVerificationEmail({
      to: company.email,
      name: company.name,
      code: verification.code,
      roleLabel: 'company'
    });

    const responseBody = {
      success: true,
      message: 'Verification code sent. Please check your email.'
    };
    if (!delivery.delivered) {
      responseBody.message += ' Email service is not configured; use the app flow to continue.';
    }
    if (NODE_ENV !== 'production') {
      responseBody.debug_verification_code = verification.code;
    }

    return res.json(responseBody);
  } catch (err) {
    console.error('Company resend verification error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { register, login, verifyEmail, resendVerification };