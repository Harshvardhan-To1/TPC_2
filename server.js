/**
 * Root launcher for the PLACEMAT app.
 * Allows: node server.js (from repository root)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const backendDir = path.resolve(__dirname, 'backend/placemat-backend');
const backendEntry = path.join(backendDir, 'server.js');

if (!fs.existsSync(backendEntry)) {
  console.error(`❌ Backend entry not found: ${backendEntry}`);
  process.exit(1);
}

// Keep backend relative paths (.env, uploads, DB, FRONTEND_DIR) consistent.
process.chdir(backendDir);
require(backendEntry);
