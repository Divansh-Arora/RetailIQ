// Creates the database (if needed) and runs schema -> indexes -> views -> procedures -> triggers -> seed.
// Usage: npm run db:init            (full, with seed data)
//        npm run db:init:schema-only (no seed)
// Uses DB_ADMIN_USER / DB_ADMIN_PASSWORD (falls back to DB_USER / DB_PASSWORD).
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const dbDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../database');

/** Splits a SQL script into statements, honouring `DELIMITER` lines (used by procedures/triggers). */
export function splitSql(text) {
  const out = [];
  let delim = ';';
  let buf = '';
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (m) { delim = m[1]; continue; }
    if (!buf && (/^\s*--/.test(line) || line.trim() === '')) continue; // skip leading comments/blank lines
    buf += line + '\n';
    if (buf.trimEnd().endsWith(delim)) {
      const stmt = buf.trimEnd().slice(0, -delim.length).trim();
      if (stmt) out.push(stmt);
      buf = '';
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

export async function initDatabase({ database, seed = true, log = console.log } = {}) {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_ADMIN_USER || process.env.DB_USER || 'root',
    password: process.env.DB_ADMIN_PASSWORD ?? process.env.DB_PASSWORD ?? '',
    multipleStatements: false,
  });
  try {
    const name = database || process.env.DB_NAME || 'retailiq';
    if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('Invalid database name');
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4`);
    await conn.query(`USE \`${name}\``);
    const files = ['schema', 'indexes', 'views', 'procedures', 'triggers', ...(seed ? ['seed'] : [])];
    for (const f of files) {
      const stmts = splitSql(fs.readFileSync(path.join(dbDir, `${f}.sql`), 'utf8'));
      for (const s of stmts) await conn.query(s);
      log(`  ✓ ${f}.sql (${stmts.length} statements)`);
    }
  } finally {
    await conn.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const seed = !process.argv.includes('--no-seed');
  console.log(`Initialising database "${process.env.DB_NAME || 'retailiq'}"${seed ? ' with demo data' : ''}...`);
  initDatabase({ seed }).then(() => console.log('Done.')).catch((e) => { console.error('Failed:', e.message); process.exit(1); });
}
