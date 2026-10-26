import { pool } from '../config/db.js';
import { notFound } from '../utils/errors.js';
import { likeContains, pageMeta } from '../utils/sql.js';

export const CUSTOMER_SORTS = { name: 'c.name', email: 'c.email', city: 'c.city', created_at: 'c.created_at', total_orders: 'total_orders', total_spent: 'total_spent' };

const SELECT = `SELECT c.customer_id, c.name, c.email, c.city, c.is_active, c.created_at,
    COALESCE(v.total_orders, 0) AS total_orders, COALESCE(v.total_spent, 0) AS total_spent, v.last_order_date
  FROM customers c
  LEFT JOIN (SELECT customer_id, COUNT(DISTINCT order_id) AS total_orders, SUM(line_total) AS total_spent, MAX(order_date) AS last_order_date
             FROM v_completed_sales GROUP BY customer_id) v ON v.customer_id = c.customer_id`;
const flag = (r) => ({ ...r, is_active: !!r.is_active });

export async function listCustomers({ search, active, page, limit, offset, orderBy }) {
  const where = [];
  const params = [];
  if (search) { where.push('(c.name LIKE ? OR c.email LIKE ?)'); params.push(likeContains(search), likeContains(search)); }
  if (active !== undefined) { where.push('c.is_active = ?'); params.push(active ? 1 : 0); }
  const w = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM customers c${w}`, params);
  const [rows] = await pool.query(`${SELECT}${w} ORDER BY ${orderBy}, c.customer_id ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { data: rows.map(flag), pagination: pageMeta(total, page, limit) };
}

export async function getCustomer(id) {
  const [rows] = await pool.query(`${SELECT} WHERE c.customer_id = ?`, [id]);
  if (!rows.length) throw notFound('Customer', id);
  const [orders] = await pool.query(
    `SELECT order_id, order_date, order_status, total_amount, payment_status, units
     FROM v_order_summary WHERE customer_id = ? ORDER BY order_date DESC, order_id DESC LIMIT 50`, [id]);
  const [[cancelled]] = await pool.query("SELECT COUNT(*) AS n FROM orders WHERE customer_id = ? AND status = 'CANCELLED'", [id]);
  const c = flag(rows[0]);
  return {
    ...c,
    summary: {
      total_orders: c.total_orders,
      total_spent: c.total_spent,
      avg_order_value: c.total_orders ? Math.round((c.total_spent / c.total_orders) * 100) / 100 : 0,
      last_order_date: c.last_order_date,
      cancelled_orders: cancelled.n,
    },
    orders,
  };
}

export async function createCustomer({ name, email, city }) {
  const [res] = await pool.query('INSERT INTO customers (name, email, city) VALUES (?, ?, ?)', [name, email, city ?? null]);
  return getCustomer(res.insertId);
}

export async function updateCustomer(id, { name, email, city, is_active }) {
  const [res] = await pool.query('UPDATE customers SET name = ?, email = ?, city = ?, is_active = ? WHERE customer_id = ?', [name, email, city ?? null, is_active ? 1 : 0, id]);
  if (!res.affectedRows) throw notFound('Customer', id);
  return getCustomer(id);
}
