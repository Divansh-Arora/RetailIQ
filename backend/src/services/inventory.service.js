import { pool, withTransaction } from '../config/db.js';
import { AppError, notFound } from '../utils/errors.js';
import { dateRangeClause, pageMeta } from '../utils/sql.js';

export async function listLowStock({ limit = 100 } = {}) {
  const [rows] = await pool.query('SELECT product_id, sku, name, category_name, stock_qty, reorder_level, shortfall FROM v_low_stock ORDER BY stock_qty ASC, name ASC LIMIT ?', [limit]);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM v_low_stock');
  return { data: rows, total: n };
}

export const MOVEMENT_SORTS = { created_at: 'm.created_at', quantity_change: 'm.quantity_change', product: 'p.name' };

export async function listMovements({ productId, reason, from, to, page, limit, offset, orderBy }) {
  const where = [];
  const params = [];
  if (productId) { where.push('m.product_id = ?'); params.push(productId); }
  if (reason) { where.push('m.reason = ?'); params.push(reason); }
  const range = dateRangeClause('m.created_at', { from, to });
  where.push(...range.sql); params.push(...range.params);
  const w = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM inventory_movements m${w}`, params);
  const [rows] = await pool.query(
    `SELECT m.movement_id, m.product_id, p.sku, p.name AS product_name, m.quantity_change, m.reason, m.reference_type, m.reference_id, m.created_at, m.notes
     FROM inventory_movements m JOIN products p ON p.product_id = m.product_id${w}
     ORDER BY ${orderBy}, m.movement_id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { data: rows, pagination: pageMeta(total, page, limit) };
}

/** Manual stock change: lock row, forbid negative balance, update balance and append audit row atomically. */
export async function adjustStock({ product_id, quantity_change, reason, notes }) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT product_id, sku, name, stock_qty FROM products WHERE product_id = ? FOR UPDATE', [product_id]);
    if (!rows.length) throw notFound('Product', product_id);
    const before = rows[0].stock_qty;
    if (before + quantity_change < 0) {
      throw new AppError(409, 'INSUFFICIENT_STOCK', `This change would make stock negative (current stock: ${before}).`, [{ product_id, available: before, requested_change: quantity_change }]);
    }
    await conn.query('UPDATE products SET stock_qty = stock_qty + ? WHERE product_id = ?', [quantity_change, product_id]);
    const [mv] = await conn.query(
      "INSERT INTO inventory_movements (product_id, quantity_change, reason, reference_type, notes) VALUES (?, ?, ?, 'MANUAL', ?)",
      [product_id, quantity_change, reason, notes ?? null]);
    return { movement_id: mv.insertId, product_id, sku: rows[0].sku, name: rows[0].name, quantity_change, reason, stock_before: before, stock_after: before + quantity_change };
  });
}
