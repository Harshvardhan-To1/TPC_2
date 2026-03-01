/* ============================================================
   PLACEMAT — auth.js
   Shared utilities for all login/register pages
============================================================ */

'use strict';

/* ─── TOGGLE PASSWORD VISIBILITY ───────────────────────── */
function togglePassword(inputId, iconEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (iconEl) iconEl.textContent = '🙈';
  } else {
    input.type = 'password';
    if (iconEl) iconEl.textContent = '👁️';
  }
}

/* ─── SHOW / HIDE ALERT ─────────────────────────────────── */
function showAlert(type, message) {
  const el = document.getElementById('authAlert');
  if (!el) return;
  el.className = `auth-alert ${type} show`;
  el.innerHTML = `<span>${type === 'error' ? '⚠️' : '✅'}</span> ${message}`;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAlert() {
  const el = document.getElementById('authAlert');
  if (el) el.classList.remove('show');
}

/* ─── BUTTON LOADING STATE ──────────────────────────────── */
function setButtonLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

/* ─── FORM VALIDATION ───────────────────────────────────── */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(pwd) {
  return pwd.length >= 8;
}

function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(`${fieldId}Error`);
  if (field) field.style.borderColor = '#EF4444';
  if (error) { error.textContent = message; error.classList.add('show'); }
}

function clearFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(`${fieldId}Error`);
  if (field) field.style.borderColor = '';
  if (error) error.classList.remove('show');
}

function clearAllErrors() {
  document.querySelectorAll('.form-error').forEach(e => e.classList.remove('show'));
  document.querySelectorAll('.form-input').forEach(i => i.style.borderColor = '');
}

/* ─── REAL-TIME FIELD VALIDATION ────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('input', () => {
      clearFieldError(input.id);
      hideAlert();
    });
  });
});

/* ─── TOKEN HELPERS ─────────────────────────────────────── */
function saveAuth(token, user) {
  localStorage.setItem('placemat_token', token);
  localStorage.setItem('placemat_user', JSON.stringify(user));
}

function getAuth() {
  const token = localStorage.getItem('placemat_token');
  try {
    const user = JSON.parse(localStorage.getItem('placemat_user'));
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

function clearAuth() {
  localStorage.removeItem('placemat_token');
  localStorage.removeItem('placemat_user');
}

/* ─── REDIRECT IF ALREADY LOGGED IN ────────────────────── */
function redirectIfLoggedIn() {
  const { token, user } = getAuth();
  if (!token || !user) return;

  const dashboards = {
    student: '../student/dashboard.html',
    admin:   '../admin/dashboard.html',
    superadmin: '../admin/dashboard.html',
    company: '../company/dashboard.html'
  };

  const dest = dashboards[user.role];
  if (dest) window.location.href = dest;
}

/* ─── API HELPER ────────────────────────────────────────── */
const API_BASE = '/api';   // adjust if needed

async function apiPost(endpoint, data) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      message: response.ok ? 'Unexpected server response.' : `Request failed with status ${response.status}.`
    };
  }
}
