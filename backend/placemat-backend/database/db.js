const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const fs      = require('fs');
const bcrypt  = require('bcrypt');

const DB_PATH     = process.env.DB_PATH || path.join(__dirname, 'placemat.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDb() {
  if (!db) throw new Error('Database not initialized.');
  return db;
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function execAsync(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function initDb() {
  return new Promise(async (resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, async (err) => {
      if (err) {
        console.error('Database connection error:', err);
        return reject(err);
      }
      try {
        await runAsync('PRAGMA journal_mode = WAL');
        await runAsync('PRAGMA foreign_keys = ON');
        await runAsync('PRAGMA synchronous = NORMAL');

        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        await execAsync(schema);

        await seedDefaultAdmin();
        console.log('✅  Database initialized at:', DB_PATH);
        resolve(db);
      } catch (e) {
        console.error('Database init error:', e);
        reject(e);
      }
    });
  });
}

async function seedDefaultAdmin() {
  const existing = await getAsync(
    'SELECT id FROM admins WHERE email = ?',
    ['admin@placemat.com']
  );
  if (!existing) {
    const hash = await bcrypt.hash('admin@123', 12);
    await runAsync(
      'INSERT INTO admins (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Super Admin', 'admin@placemat.com', hash, 'superadmin']
    );
    console.log('🌱  Default admin seeded: admin@placemat.com / admin@123');
  }
}

function closeDb() {
  if (db) { db.close(); db = null; }
}

module.exports = { initDb, getDb, runAsync, getAsync, allAsync, execAsync, closeDb };