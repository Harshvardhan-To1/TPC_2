# 🎓 PLACEMAT — Backend Module
## SCSIT DAVV Campus Placement System 2025–26

---

## 📁 Folder Structure

```
placemat-backend/
├── config/
│   └── env.js                  ← Reads .env values
├── controllers/
│   ├── adminAuthController.js  ← Admin login
│   ├── adminController.js      ← All admin operations
│   ├── companyAuthController.js← Company login/register
│   ├── companyController.js    ← All company operations
│   ├── studentAuthController.js← Student login/register
│   └── studentController.js   ← All student operations
├── database/
│   ├── db.js                   ← SQLite connection + auto-init
│   ├── schema.sql              ← Full database schema
│   └── placemat.db             ← Auto-created on first run
├── middlewares/
│   ├── auth.js                 ← JWT verify + role-based guard
│   ├── auditLogger.js          ← Auto audit trail on responses
│   ├── upload.js               ← Multer file upload configs
│   └── validate.js             ← Input sanitization + validation
├── routes/
│   ├── adminRoutes.js          ← /api/admin/*
│   ├── companyRoutes.js        ← /api/company/*
│   ├── studentRoutes.js        ← /api/student/*
│   └── fileRoutes.js           ← /api/files/*
├── utils/
│   ├── csvExport.js            ← JSON to CSV converter
│   └── exportController.js    ← CSV download endpoints
├── uploads/                    ← Auto-created; file storage
│   ├── resumes/
│   ├── logos/
│   └── offers/
├── server.js                   ← Express app entry point
├── package.json
├── .env.example                ← Copy to .env
└── .gitignore
```

---

## 💻 System Requirements (Install These First)

### 1. Node.js (v18 or higher — REQUIRED)

**Windows:**
- Download from https://nodejs.org (choose "LTS" version)
- Run installer, keep all defaults
- Verify: open Command Prompt → `node --version` (should show v18+)

**macOS:**
```bash
# Option A: Download from nodejs.org
# Option B: Using Homebrew
brew install node
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Git (optional, for cloning)
- Windows: https://git-scm.com/download/win
- macOS: `brew install git`
- Linux: `sudo apt install git`

### 3. Node-gyp build tools (required for better-sqlite3)

**Windows:**
```cmd
npm install -g windows-build-tools
# OR install Visual Studio Build Tools from:
# https://visualstudio.microsoft.com/visual-cpp-build-tools/
# Select "Desktop development with C++"
```

**macOS:**
```bash
xcode-select --install
```

**Linux:**
```bash
sudo apt install build-essential python3
```

---

## 🚀 Installation & Setup

### Step 1 — Clone or place the backend folder

```
your-project/
├── placemat-backend/     ← backend folder
└── placemat-frontend/    ← frontend folder (your existing one)
```

### Step 2 — Navigate to backend

```bash
cd placemat-backend
```

### Step 3 — Install dependencies

```bash
npm install
```

This installs: express, better-sqlite3, jsonwebtoken, bcrypt, multer, helmet, cors, morgan, dotenv, cookie-parser

### Step 4 — Create .env file

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Open `.env` in any text editor (Notepad, VS Code) and set:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your_very_long_random_secret_string_here
FRONTEND_DIR=../placemat-frontend/placemat-frontend
```

> ⚠️ **IMPORTANT**: Change `JWT_SECRET` to a long random string. Never share it.

### Step 5 — Start the server

```bash
# Production mode
npm start

# Development mode (auto-restarts on file changes — recommended)
npm run dev
```

> First time: install nodemon for dev mode:
> ```bash
> npm install -g nodemon
> ```

### Step 6 — Verify it's running

Open browser → `http://localhost:5000/api/health`

You should see:
```json
{ "success": true, "status": "running" }
```

### Step 7 — View the website

Open browser → `http://localhost:5000`

The frontend is automatically served from the path set in `FRONTEND_DIR`.

---

## 🗄️ Database

The SQLite database is **automatically created** when the server first starts.

Location: `placemat-backend/database/placemat.db`

### Default Admin Credentials
| Field    | Value               |
|----------|---------------------|
| Email    | admin@placemat.com  |
| Password | admin@123           |

> Change this immediately after first login!

### How to reset the database
```bash
# Delete the database file
rm database/placemat.db

# Restart the server (it will recreate it)
npm start
```

### View the database (optional tools)
- **DB Browser for SQLite**: https://sqlitebrowser.org (free, visual)
- **VS Code extension**: "SQLite Viewer" by Florian Klampfer

---

## 🔌 Complete API Reference

### Base URL: `http://localhost:5000/api`

### Auth Endpoints (Public — no token required)

| Method | Endpoint                    | Body Fields |
|--------|-----------------------------|-------------|
| POST   | `/student/auth/login`       | `email`, `password` |
| POST   | `/student/auth/register`    | `name`, `roll_number`, `email`, `phone`, `branch`, `year`, `cgpa`, `password` |
| POST   | `/admin/auth/login`         | `email`, `password` |
| POST   | `/company/auth/login`       | `email`, `password` |
| POST   | `/company/auth/register`    | `name`, `email`, `password`, `industry`, `phone`, `hr_name`, `website` |

### Response Format

All endpoints return:
```json
{
  "success": true | false,
  "message": "...",
  "data": { ... },    // on success
  "token": "...",     // on login
  "user": { ... }     // on login
}
```

### Using the JWT token

After login, include in every request header:
```
Authorization: Bearer <your_token_here>
```

In JavaScript (frontend):
```javascript
const token = localStorage.getItem('placemat_token');
fetch('/api/admin/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Admin Endpoints (role: admin or superadmin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/admin/dashboard` | Overview stats |
| GET    | `/admin/companies` | List all companies (filter: `?status=pending`) |
| GET    | `/admin/companies/:id` | Company details + drives |
| PATCH  | `/admin/companies/:id/status` | `{ status: "approved"/"rejected", rejection_note }` |
| PATCH  | `/admin/companies/:id/toggle-active` | Activate/deactivate |
| GET    | `/admin/students` | List students (filter: `?branch=CSE&cgpa_min=7`) |
| GET    | `/admin/students/:id` | Student details + applications |
| PATCH  | `/admin/students/:id/toggle-block` | Block/unblock student |
| PATCH  | `/admin/students/:id/verify` | `{ profile_verified: 1, resume_verified: 1 }` |
| PATCH  | `/admin/students/:id/mark-placed` | `{ company_id, package }` |
| GET    | `/admin/drives` | All drives |
| POST   | `/admin/drives` | Create drive |
| PUT    | `/admin/drives/:id` | Edit drive |
| DELETE | `/admin/drives/:id` | Delete drive |
| PATCH  | `/admin/drives/:id/status` | `{ status: "active"/"closed" }` |
| GET    | `/admin/drives/:drive_id/applicants` | Applicants for a drive |
| PATCH  | `/admin/applications/:id/status` | `{ status, notes }` |
| PATCH  | `/admin/applications/bulk` | `{ application_ids: [], status }` |
| GET    | `/admin/notifications` | All sent notifications |
| POST   | `/admin/notifications` | Send notification |
| GET    | `/admin/queries` | All queries |
| PATCH  | `/admin/queries/:id/reply` | Reply to query |
| GET    | `/admin/analytics` | Chart data |
| GET    | `/admin/audit-logs` | Action history |
| GET    | `/admin/export/students` | Download students CSV |
| GET    | `/admin/export/applications` | Download applications CSV |
| GET    | `/admin/export/placements` | Download placements CSV |
| GET    | `/admin/export/drives/:drive_id/applicants` | Download drive applicants CSV |

### Company Endpoints (role: company)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/company/profile` | Get profile |
| PUT    | `/company/profile` | Update profile |
| POST   | `/company/profile/logo` | Upload logo (multipart, field: `logo`) |
| GET    | `/company/drives` | My drives |
| GET    | `/company/drives/:id` | Drive details |
| POST   | `/company/drives` | Create drive |
| PUT    | `/company/drives/:id` | Update drive |
| PATCH  | `/company/drives/:id/close` | Close drive |
| GET    | `/company/drives/:id/applicants` | Applicants |
| PATCH  | `/company/applications/:id/status` | Update applicant status |
| PATCH  | `/company/applications/bulk` | Bulk update |
| POST   | `/company/interviews` | Schedule interview |
| PATCH  | `/company/interviews/:id` | Update interview result |
| POST   | `/company/offers` | Issue offer (multipart, field: `offer_letter`) |
| GET    | `/company/reports` | Reports & stats |
| POST   | `/company/queries` | Submit query |
| GET    | `/company/queries` | My queries |
| GET    | `/company/notifications` | My notifications |

### Student Endpoints (role: student)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/student/dashboard` | Stats overview |
| GET    | `/student/profile` | Get profile |
| PUT    | `/student/profile` | Update profile |
| POST   | `/student/profile/resume` | Upload resume (multipart, field: `resume`) |
| GET    | `/student/drives` | Eligible drives |
| POST   | `/student/apply` | Apply `{ drive_id }` |
| GET    | `/student/applications` | My applications |
| GET    | `/student/interviews` | My interviews |
| GET    | `/student/offer` | My offer (if any) |
| POST   | `/student/offer/respond` | `{ offer_id, response: "accepted"/"declined" }` |
| GET    | `/student/notifications` | My notifications |
| POST   | `/student/queries` | Submit query |

### File Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/files/resume/:filename` | Download resume (auth required) |
| GET    | `/files/offer/:filename` | Download offer letter (auth required) |
| GET    | `/files/logo/:filename` | View company logo (public) |

---

## 🔄 Integration with Existing Student Dashboard

If you already have a separate Node.js backend for the student dashboard, here's how to merge:

### Option A — Run as Separate Service (Recommended)

Keep both servers running:
- Existing student backend: `http://localhost:3000`
- Placemat backend: `http://localhost:5000`

Use a reverse proxy (nginx or the frontend) to route:
```
/api/old-student/* → localhost:3000
/api/*             → localhost:5000
```

### Option B — Mount as Express Sub-app

In your existing `server.js`:

```javascript
// Import placemat routes
const adminRoutes   = require('./placemat-backend/routes/adminRoutes');
const companyRoutes = require('./placemat-backend/routes/companyRoutes');
const studentRoutes = require('./placemat-backend/routes/studentRoutes');

// Mount under /api prefix
app.use('/api/admin',   adminRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/student', studentRoutes);
```

### Sharing the JWT Secret

If your existing system uses JWT, use the **same secret** in both systems:

In `.env`:
```env
JWT_SECRET=the_same_secret_as_your_existing_system
```

This way tokens issued by one system work in the other.

### Connecting to the Same SQLite Database

If your existing app uses the same SQLite DB:

```env
DB_PATH=/absolute/path/to/existing/database.db
```

The schema.sql uses `CREATE TABLE IF NOT EXISTS` — it won't overwrite existing tables.

### Avoiding Route Conflicts

Placemat uses these prefixes:
- `/api/admin/*`
- `/api/company/*`  
- `/api/student/*`
- `/api/files/*`

If your existing routes clash, rename by changing the mount paths:
```javascript
app.use('/api/placemat/admin', adminRoutes);
```

And update `API_BASE` in `common/js/auth.js`:
```javascript
const API_BASE = '/api/placemat';
```

---

## 🔒 Security Features

| Feature | Implementation |
|---------|----------------|
| Password hashing | bcrypt with 12 rounds |
| JWT tokens | 7-day expiry, signed with secret |
| Role-based access | `authorizeRoles()` middleware |
| Input sanitization | Strip HTML/scripts from all inputs |
| File type validation | Multer MIME type checks |
| Audit trail | All admin actions logged |
| Placed student guard | Cannot reapply after placement |
| Blocked student guard | Login denied if blocked |
| Helmet | Security HTTP headers |
| Path traversal guard | `path.basename()` on filenames |

---

## 🛠️ Troubleshooting

### "Cannot find module 'better-sqlite3'"
```bash
npm install better-sqlite3
# If it fails on Windows, run as Administrator:
npm install --global windows-build-tools
npm install better-sqlite3
```

### "Port 5000 already in use"
```bash
# Windows:
netstat -ano | findstr :5000
taskkill /PID <pid> /F

# macOS/Linux:
lsof -ti:5000 | xargs kill
```

### Database not creating
Check that the `database/` folder exists and is writable:
```bash
mkdir -p database
```

### JWT errors in frontend
Make sure `API_BASE = '/api'` in `common/js/auth.js`.

---

## 🌐 Production Deployment Checklist

- [ ] Change `JWT_SECRET` to a long random string (50+ chars)
- [ ] Set `NODE_ENV=production`
- [ ] Set `BCRYPT_ROUNDS=12` (already default)
- [ ] Use PM2 to keep server running: `npm install -g pm2 && pm2 start server.js`
- [ ] Set up nginx as reverse proxy
- [ ] Enable HTTPS (Let's Encrypt)
- [ ] Set `ALLOWED_ORIGIN` in .env
- [ ] Regular database backups: `cp database/placemat.db backups/placemat_$(date +%Y%m%d).db`

---

Made with ❤️ | SCSIT DAVV Campus Placement Cell 2025–26
