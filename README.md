# PLACEMAT (TPC Website) - Unified Project Structure

This repository is organized into two primary apps:

```text
/backend/placemat-backend      # Express + SQLite API server
/frontend/placemat-frontend    # Static frontend (landing + role portals)
```

## What was cleaned up

- Consolidated to a **single canonical frontend** under `frontend/placemat-frontend`.
- Removed duplicate legacy frontend copy (`placemat-frontend-v3/placemat-frontend`).
- Fixed backend/frontend contract mismatches so major features work consistently.
- Updated backend defaults so static frontend serving works out-of-the-box.

## Run locally

### Recommended (single command from repo root)

```bash
cd backend/placemat-backend
npm install
cp .env.example .env
cd ../..
node server.js
```

This starts the backend API and serves the frontend together on `http://localhost:5000`.

### Alternative: backend/frontend separately

Backend:

```bash
cd backend/placemat-backend
npm install
cp .env.example .env
npm start
```

Frontend can still be run alone with a static server if needed:

```bash
cd frontend/placemat-frontend
npx serve .
```

## Key public and auth entry points

- Landing page: `http://localhost:5000/`
- Health: `http://localhost:5000/api/health`
- Student login: `/student/login.html`
- Admin login: `/admin/login.html`
- Company login/register: `/company/login.html`

