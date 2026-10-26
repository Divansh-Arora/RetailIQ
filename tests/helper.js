// Shared test harness. Tests run against a DEDICATED database whose name must end in "_test"
// (default: retailiq_test) so they can never touch development data.
// Credentials come from backend/.env (or the environment). DB_ADMIN_* is used to (re)create the schema.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const testDb = process.env.DB_NAME_TEST || 'retailiq_test';
if (!/_test$/.test(testDb)) throw new Error(`Refusing to run tests against "${testDb}": name must end with _test`);
process.env.DB_NAME = testDb;
process.env.NODE_ENV = 'test';
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../backend')); // so dotenv finds backend/.env

const { initDatabase } = await import('../backend/scripts/init-db.js');
const { pool, closePool } = await import('../backend/src/config/db.js');
const { createApp } = await import('../backend/src/app.js');

// ---- deterministic fixture (hand-calculated expectations live in analytics.test.js) ----
const FIXTURE = [
  "INSERT INTO categories (category_id, category_name) VALUES (1,'Stationery'),(2,'Home')",
  "INSERT INTO customers (customer_id, name, email, city) VALUES (1,'Asha','asha@example.com','Ludhiana'),(2,'Ben','ben@example.com','Delhi'),(3,'Cara','cara@example.com',NULL)",
  `INSERT INTO products (product_id, category_id, sku, name, unit_price, stock_qty, reorder_level) VALUES
     (1,1,'PEN-1','Pen',10.00,100,10),(2,1,'BOOK-1','Book',50.00,8,10),(3,2,'LAMP-1','Lamp',200.00,20,5),(4,2,'MUG-1','Mug',20.00,0,0)`,
  `INSERT INTO orders (order_id, customer_id, order_date, status, total_amount, cancelled_at) VALUES
     (1,1,'2026-01-10 10:00:00','COMPLETED',100.00,NULL),
     (2,2,'2026-01-20 11:00:00','COMPLETED',200.00,NULL),
     (3,1,'2026-02-05 12:00:00','COMPLETED',120.00,NULL),
     (4,3,'2026-02-15 13:00:00','CANCELLED',400.00,'2026-02-15 14:00:00'),
     (5,2,'2026-02-28 23:30:00','COMPLETED',100.00,NULL)`,
  `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
     (1,1,5,10.00),(1,2,1,50.00),(2,3,1,200.00),(3,1,8,10.00),(3,4,2,20.00),(4,3,2,200.00),(5,2,2,50.00)`,
  `INSERT INTO payments (order_id, amount, payment_method, status, paid_at) VALUES
     (1,100.00,'CASH','SUCCESS','2026-01-10 10:05:00'),(2,200.00,'UPI_DEMO','SUCCESS','2026-01-20 11:05:00'),
     (3,120.00,'CARD_DEMO','SUCCESS','2026-02-05 12:05:00'),(4,400.00,'CARD_DEMO','FAILED',NULL),(5,100.00,'CASH','SUCCESS','2026-02-28 23:35:00')`,
  // opening balances + sales + one cancellation so SUM(movements) == stock_qty for every product
  `INSERT INTO inventory_movements (product_id, quantity_change, reason, reference_type, reference_id, created_at) VALUES
     (1,113,'OPENING','MANUAL',NULL,'2026-01-01 00:00:00'),(2,11,'OPENING','MANUAL',NULL,'2026-01-01 00:00:00'),
     (3,21,'OPENING','MANUAL',NULL,'2026-01-01 00:00:00'),(4,2,'OPENING','MANUAL',NULL,'2026-01-01 00:00:00'),
     (1,-5,'SALE','ORDER',1,'2026-01-10 10:00:00'),(2,-1,'SALE','ORDER',1,'2026-01-10 10:00:00'),
     (3,-1,'SALE','ORDER',2,'2026-01-20 11:00:00'),(1,-8,'SALE','ORDER',3,'2026-02-05 12:00:00'),(4,-2,'SALE','ORDER',3,'2026-02-05 12:00:00'),
     (3,-2,'SALE','ORDER',4,'2026-02-15 13:00:00'),(3,2,'CANCELLATION','ORDER',4,'2026-02-15 14:00:00'),(2,-2,'SALE','ORDER',5,'2026-02-28 23:30:00')`,
];

export async function setup() {
  await initDatabase({ database: testDb, seed: false, log: () => {} });
  for (const sql of FIXTURE) await pool.query(sql);
  const server = await new Promise((resolve) => { const s = createApp().listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  async function api(method, url, body, headers = {}) {
    const res = await fetch(baseUrl + url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json (csv) */ }
    return { status: res.status, json, text, headers: res.headers };
  }
  const close = async () => { await new Promise((r) => server.close(r)); await closePool(); };
  return { api, pool, close, baseUrl };
}

export const stockOf = async (pool, id) => (await pool.query('SELECT stock_qty FROM products WHERE product_id = ?', [id]))[0][0].stock_qty;
export const count = async (pool, table) => (await pool.query(`SELECT COUNT(*) AS n FROM ${table}`))[0][0].n;
