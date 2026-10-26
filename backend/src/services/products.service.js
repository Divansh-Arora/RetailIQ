import { pool, withTransaction } from '../config/db.js';
import { AppError, notFound } from '../utils/errors.js';
import { likeContains, pageMeta } from '../utils/sql.js';

// Sortable columns are an allowlist: untrusted input never reaches ORDER BY directly.
export const PRODUCT_SORTS = { sku: 'p.sku', name: 'p.name', category: 'c.category_name', unit_price: 'p.unit_price', stock_qty: 'p.stock_qty', created_at: 'p.created_at' };

const SELECT = `SELECT p.product_id, p.category_id, c.category_name, p.sku, p.name, p.unit_price, p.stock_qty,
  p.reorder_level, p.is_active, (p.stock_qty <= p.reorder_level) AS is_low_stock, p.created_at, p.updated_at
  FROM products p JOIN categories c ON c.category_id = p.category_id`;

const withFlags = (r) => ({ ...r, is_active: !!r.is_active, is_low_stock: !!r.is_low_stock });

export async function listProducts({ search, categoryId, lowStock, active, page, limit, offset, orderBy }) {
  const where = [];
  const params = [];
  if (search) { where.push('(p.name LIKE ? OR p.sku LIKE ?)'); params.push(likeContains(search), likeContains(search)); }
  if (categoryId) { where.push('p.category_id = ?'); params.push(categoryId); }
  if (lowStock) where.push('p.stock_qty <= p.reorder_level');
  if (active !== undefined) { where.push('p.is_active = ?'); params.push(active ? 1 : 0); }
  const w = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM products p${w}`, params);
  const [rows] = await pool.query(`${SELECT}${w} ORDER BY ${orderBy}, p.product_id ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { data: rows.map(withFlags), pagination: pageMeta(total, page, limit) };
}

export async function getProduct(id, conn = pool) {
  const [rows] = await conn.query(`${SELECT} WHERE p.product_id = ?`, [id]);
  if (!rows.length) throw notFound('Product', id);
  return withFlags(rows[0]);
}

async function assertCategory(conn, categoryId) {
  const [r] = await conn.query('SELECT 1 FROM categories WHERE category_id = ?', [categoryId]);
  if (!r.length) throw new AppError(400, 'CATEGORY_NOT_FOUND', `Category #${categoryId} does not exist.`, [{ field: 'category_id', message: 'Choose an existing category.' }]);
}

export async function createProduct(d) {
  const id = await withTransaction(async (conn) => {
    await assertCategory(conn, d.category_id);
    const [res] = await conn.query(
      'INSERT INTO products (category_id, sku, name, unit_price, stock_qty, reorder_level, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [d.category_id, d.sku, d.name, d.unit_price, d.stock_qty, d.reorder_level, d.is_active ? 1 : 0]);
    if (d.stock_qty > 0) {
      await conn.query(
        "INSERT INTO inventory_movements (product_id, quantity_change, reason, reference_type, notes) VALUES (?, ?, 'OPENING', 'MANUAL', 'Opening balance on product creation')",
        [res.insertId, d.stock_qty]);
    }
    return res.insertId;
  });
  return getProduct(id);
}

/** Stock is intentionally NOT editable here: it changes only via orders or /inventory/adjustments (audited). */
export async function updateProduct(id, d) {
  await withTransaction(async (conn) => {
    const [exists] = await conn.query('SELECT 1 FROM products WHERE product_id = ? FOR UPDATE', [id]);
    if (!exists.length) throw notFound('Product', id);
    await assertCategory(conn, d.category_id);
    await conn.query(
      'UPDATE products SET category_id = ?, sku = ?, name = ?, unit_price = ?, reorder_level = ?, is_active = ? WHERE product_id = ?',
      [d.category_id, d.sku, d.name, d.unit_price, d.reorder_level, d.is_active ? 1 : 0, id]);
  });
  return getProduct(id);
}
