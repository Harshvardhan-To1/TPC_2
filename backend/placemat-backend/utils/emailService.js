const nodemailer = require('nodemailer');
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM
} = require('../config/env');

let cachedTransporter = null;

function isSmtpConfigured() {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
}

async function getTransporter() {
  if (!isSmtpConfigured()) return null;
  if (cachedTransporter) return cachedTransporter;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  await transporter.verify();
  cachedTransporter = transporter;
  return cachedTransporter;
}

async function sendVerificationEmail({ to, name, code, roleLabel }) {
  try {
    const transporter = await getTransporter();
    if (!transporter) {
      return { delivered: false, reason: 'smtp_not_configured' };
    }

    const from = SMTP_FROM || SMTP_USER;
    const safeName = name || 'User';
    const titleRole = roleLabel || 'account';
    const subject = 'PlaceMate email verification code';
    const text = [
      `Hi ${safeName},`,
      '',
      `Your PlaceMate ${titleRole} verification code is: ${code}`,
      '',
      'This code expires soon. If you did not request this, please ignore this email.',
      '',
      'Regards,',
      'PlaceMate Team'
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1C1C2E;">
        <p>Hi ${safeName},</p>
        <p>Your PlaceMate <strong>${titleRole}</strong> verification code is:</p>
        <p style="font-size:24px;font-weight:700;letter-spacing:2px;color:#6C5FBC;">${code}</p>
        <p>This code expires soon. If you did not request this, please ignore this email.</p>
        <p>Regards,<br/>PlaceMate Team</p>
      </div>
    `;

    await transporter.sendMail({ from, to, subject, text, html });
    return { delivered: true };
  } catch (err) {
    console.error('Email send error:', err);
    return { delivered: false, reason: 'smtp_send_failed' };
  }
}

module.exports = {
  isSmtpConfigured,
  sendVerificationEmail
};
