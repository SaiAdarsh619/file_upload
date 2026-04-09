import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'app.db'));

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

// Create users table
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

/**
 * Create a new user
 * @param {string} username 
 * @param {string} passwordHash 
 * @returns {object} Created user row
 */
export function createUser(username, passwordHash) {
    const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    const result = stmt.run(username, passwordHash);
    return findUserById(result.lastInsertRowid);
}

/**
 * Find user by username (case-insensitive)
 * @param {string} username
 * @returns {object|undefined}
 */
export function findUserByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

/**
 * Find user by ID
 * @param {number} id
 * @returns {object|undefined}
 */
export function findUserById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export default db;
