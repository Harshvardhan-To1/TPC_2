/* ============================================================
   PLACEMAT — main.js
   Handles: Typed text effect, counter animation, modal logic
============================================================ */

'use strict';

/* ─── TYPED TEXT EFFECT ────────────────────────────────── */
const typedWords = ['focus.', 'grow.', 'succeed.', 'shine.', 'excel.'];
let wordIndex  = 0;
let charIndex  = 0;
let isDeleting = false;
const typedEl  = document.getElementById('typedText');

function typeEffect() {
  if (!typedEl) return;
  const current = typedWords[wordIndex];

  if (isDeleting) {
    typedEl.textContent = current.substring(0, charIndex - 1);
    charIndex--;
  } else {
    typedEl.textContent = current.substring(0, charIndex + 1);
    charIndex++;
  }

  if (!isDeleting && charIndex === current.length) {
    isDeleting = true;
    setTimeout(typeEffect, 1800);
    return;
  }
  if (isDeleting && charIndex === 0) {
    isDeleting = false;
    wordIndex = (wordIndex + 1) % typedWords.length;
    setTimeout(typeEffect, 300);
    return;
  }

  setTimeout(typeEffect, isDeleting ? 60 : 90);
}

typeEffect();


/* ─── COUNTER ANIMATION ────────────────────────────────── */
function animateCounter(el, target, suffix) {
  let current = 0;
  const increment = Math.ceil(target / 60);
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = current + suffix;
  }, 25);
}

function initCounters() {
  const statCards = document.querySelectorAll('.stat-card');
  const targets   = [
    { value: 500, suffix: '+' },
    { value: 150, suffix: '+' },
    { value: 95,  suffix: '%' },
    { value: 12,  suffix: ' LPA' }
  ];

  statCards.forEach((card, i) => {
    const el = card.querySelector('.stat-value');
    if (!el || !targets[i]) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(el, targets[i].value, targets[i].suffix);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    observer.observe(card);
  });
}

initCounters();


/* ─── SCROLL REVEAL ────────────────────────────────────── */
function initScrollReveal() {
  const elements = document.querySelectorAll(
    '.service-card, .why-card, .stat-card, .white-card-content, .signflow-content'
  );

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity    = '1';
        entry.target.style.transform  = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  elements.forEach(el => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(28px)';
    el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
    observer.observe(el);
  });
}

initScrollReveal();

/* ─── SHARED AUTH ROUTING HELPERS ─────────────────────── */
function readStoredAuth() {
  try {
    const token = localStorage.getItem('placemat_token');
    const rawUser = localStorage.getItem('placemat_user');
    const user = rawUser ? JSON.parse(rawUser) : null;

    if (!token || !user || typeof user !== 'object') return null;
    return { token, user };
  } catch {
    return null;
  }
}

function goToDashboardSection(role, section = 'dashboard') {
  const routes = {
    student: 'student/dashboard.html',
    admin: 'admin/dashboard.html',
    superadmin: 'admin/dashboard.html',
    company: 'company/dashboard.html'
  };

  const baseRoute = routes[role];
  if (!baseRoute) return false;

  const target = section && section !== 'dashboard'
    ? `${baseRoute}?section=${encodeURIComponent(section)}`
    : baseRoute;

  window.location.href = target;
  return true;
}

function openNotificationsEntry() {
  const auth = readStoredAuth();
  if (auth?.user?.role && goToDashboardSection(auth.user.role, 'notifications')) return;

  openRoleModal('signin');
  showRoleNotice('Sign in to view your role-specific notifications.');
}


/* ─── NAVBAR SHADOW ON SCROLL ──────────────────────────── */
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  nav.style.boxShadow = window.scrollY > 10
    ? '0 4px 20px rgba(0,0,0,0.12)'
    : '0 2px 12px rgba(0,0,0,0.07)';
});


/* ─── ROLE MODAL ────────────────────────────────────────── */
let currentAction = 'signin'; // 'signin' | 'signup'

const roleDescriptions = {
  signin: {
    student: 'Browse drives, apply to jobs, track your placement journey',
    admin: 'Manage companies, students, drives and placement analytics',
    company: 'Post drives, shortlist candidates and manage hiring'
  },
  signup: {
    student: 'Create your student profile and start applying to drives',
    admin: 'Invite only access. Admin accounts are created by placement cell',
    company: 'Register your company and start campus recruitment'
  }
};

function showRoleNotice(message, type = 'info') {
  const notice = document.getElementById('modalNotice');
  if (!notice) return;

  notice.textContent = message;
  notice.className = `modal-note show ${type}`;
}

function clearRoleNotice() {
  const notice = document.getElementById('modalNotice');
  if (!notice) return;
  notice.className = 'modal-note';
  notice.textContent = '';
}

/**
 * Open the role selection modal
 * @param {string} action - 'signin' or 'signup'
 */
function openRoleModal(action = 'signin') {
  currentAction = action;
  const modal    = document.getElementById('roleModal');
  const title    = document.getElementById('modalTitle');
  const subtitle = document.getElementById('modalSubtitle');
  const studentRoleDesc = document.getElementById('studentRoleDesc');
  const adminRoleDesc = document.getElementById('adminRoleDesc');
  const companyRoleDesc = document.getElementById('companyRoleDesc');

  clearRoleNotice();

  const descriptions = roleDescriptions[action] || roleDescriptions.signin;
  if (studentRoleDesc) studentRoleDesc.textContent = descriptions.student;
  if (adminRoleDesc) adminRoleDesc.textContent = descriptions.admin;
  if (companyRoleDesc) companyRoleDesc.textContent = descriptions.company;

  if (action === 'signup') {
    title.textContent    = 'Create Your Account';
    subtitle.textContent = 'Register as a student or company';
  } else {
    title.textContent    = 'Welcome Back!';
    subtitle.textContent = 'Select your role to continue';
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeRoleModal() {
  const modal = document.getElementById('roleModal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
  clearRoleNotice();
}

function closeRoleModalOutside(event) {
  if (event.target === document.getElementById('roleModal')) {
    closeRoleModal();
  }
}

/**
 * Redirect to role-specific login or signup page
 * @param {string} role - 'student' | 'admin' | 'company'
 */
function goToRole(role) {
  const action = currentAction || 'signin';

  if (action === 'signup' && role === 'admin') {
    openRoleModal('signin');
    showRoleNotice(
      'Admin self-sign-up is disabled. Use Admin Sign In with authorized credentials.',
      'warning'
    );
    return;
  }

  const routes = {
    signin: {
      student: 'student/login.html',
      admin:   'admin/login.html',
      company: 'company/login.html'
    },
    signup: {
      student: 'student/register.html',
      admin:   'admin/login.html',      // admins don't self-register
      company: 'company/login.html?action=register'
    }
  };

  const page   = routes[action]?.[role];

  // Visual feedback before redirect
  const cards = document.querySelectorAll('.role-card');
  cards.forEach(c => c.style.opacity = '0.5');

  const clickedCard = document.getElementById(`${role}RoleCard`);
  if (clickedCard) {
    clickedCard.style.opacity = '1';
    clickedCard.style.borderColor = '#6C5FBC';
    clickedCard.style.background  = '#ede9ff';
  }

  if (page) {
    setTimeout(() => {
      window.location.href = page;
    }, 280);
  } else {
    console.warn(`No route found for role: ${role}, action: ${action}`);
  }
}

// ESC to close modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeRoleModal();
});
