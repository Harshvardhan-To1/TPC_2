const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { DB_PATH, BCRYPT_ROUNDS } = require('../config/env');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const RESOLVED_DB_PATH = path.isAbsolute(DB_PATH)
  ? DB_PATH
  : path.resolve(process.cwd(), DB_PATH);

let db;

function getDb() {
  if (!db) throw new Error('Database not initialized.');
  return db;
}

function runAsync(sql, params = []) {
  try {
    const info = db.prepare(sql).run(...params);
    return Promise.resolve({
      lastInsertRowid: Number(info.lastInsertRowid || 0),
      changes: info.changes || 0
    });
  } catch (err) {
    return Promise.reject(err);
  }
}

function getAsync(sql, params = []) {
  try {
    return Promise.resolve(db.prepare(sql).get(...params));
  } catch (err) {
    return Promise.reject(err);
  }
}

function allAsync(sql, params = []) {
  try {
    return Promise.resolve(db.prepare(sql).all(...params));
  } catch (err) {
    return Promise.reject(err);
  }
}

function execAsync(sql) {
  try {
    db.exec(sql);
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}

async function initDb() {
  try {
    if (db) return db;

    fs.mkdirSync(path.dirname(RESOLVED_DB_PATH), { recursive: true });
    db = new Database(RESOLVED_DB_PATH);

    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');

    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema);

    await seedDefaultAdmin();
    console.log('✅  Database initialized at:', RESOLVED_DB_PATH);
    return db;
  } catch (err) {
    if (db) {
      db.close();
      db = null;
    }
    console.error('Database init error:', err);
    throw err;
  }
}

async function seedDefaultAdmin() {
  const existing = await getAsync(
    'SELECT id FROM admins WHERE email = ?',
    ['admin@placemat.com']
  );
  if (!existing) {
    const hash = await bcrypt.hash('admin@123', BCRYPT_ROUNDS);
    await runAsync(
      'INSERT INTO admins (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Super Admin', 'admin@placemat.com', hash, 'superadmin']
    );
    console.log('🌱  Default admin seeded: admin@placemat.com / admin@123');
  }
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { initDb, getDb, runAsync, getAsync, allAsync, execAsync, closeDb };