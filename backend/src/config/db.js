import 'dotenv/config';
import mysql from 'mysql2/promise';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'retailiq_app',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'retailiq',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, // DECIMAL columns -> JS numbers
  dateStrings: true,    // DATETIME/TIMESTAMP -> 'YYYY-MM-DD HH:MM:SS' (no silent tz shifts)
  charset: 'utf8mb4',
});

/**
 * Runs `fn(conn)` inside ONE checked-out connection: BEGIN, work, COMMIT.
 * Any thrown error triggers ROLLBACK; the connection is always released.
 * Deadlocks (ER_LOCK_DEADLOCK 1213) are retried a bounded number of times.
 */
export async function withTransaction(fn, { maxAttempts = 3 } = {}) {
  for (let attempt = 1; ; attempt++) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (err) {
      try { await conn.rollback(); } catch { /* connection may already be gone */ }
      if (err?.errno === 1213 && attempt < maxAttempts) {
        await sleep(25 * attempt);
        continue; // `finally` still releases this connection before the retry
      }
      throw err;
    } finally {
      conn.release();
    }
  }
}

export async function closePool() { await pool.end(); }
