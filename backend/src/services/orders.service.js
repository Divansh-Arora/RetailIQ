import { pool, withTransaction } from '../config/db.js';
import { AppError, notFound } from '../utils/errors.js';
import { dateRangeClause, likeContains, pageMeta, cents } from '../utils/sql.js';

export const ORDER_SORTS = { order_id: 's.order_id', order_date: 's.order_date', customer: 's.customer_name', total_amount: 's.total_amount', status: 's.order_status' };

export async function listOrders({ status, paymentStatus, customerId, search, from, to, page, limit, offset, orderBy }) {
  const where = [];
  const params = [];
  if (status) { where.push('s.order_status = ?'); params.push(status); }
  if (paymentStatus) { where.push('s.payment_status = ?'); params.push(paymentStatus); }
  if (customerId) { where.push('s.customer_id = ?'); params.push(customerId); }
  if (search) {
    where.push('(s.customer_name LIKE ? OR s.customer_email LIKE ? OR s.order_id = ?)');
    params.push(likeContains(search), likeContains(search), /^\d+$/.test(search) ? Number(search) : -1);
  }
  const range = dateRangeClause('s.order_date', { from, to });
  where.push(...range.sql); params.push(...range.params);
  const w = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM v_order_summary s${w}`, params);
  const [rows] = await pool.query(
    `SELECT s.order_id, s.customer_id, s.customer_name, s.order_date, s.order_status, s.total_amount, s.payment_status, s.line_count, s.units
     FROM v_order_summary s${w} ORDER BY ${orderBy}, s.order_id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { data: rows, pagination: pageMeta(total, page, limit) };
}

export async function getOrder(id, conn = pool) {
  const [rows] = await conn.query('SELECT * FROM v_order_summary WHERE order_id = ?', [id]);
  if (!rows.length) throw notFound('Order', id);
  const [[meta]] = await conn.query('SELECT cancelled_at, idempotency_key FROM orders WHERE order_id = ?', [id]);
  const [items] = await conn.query(
    `SELECT oi.order_item_id, oi.product_id, p.sku, p.name, oi.quantity, oi.unit_price, oi.quantity * oi.unit_price AS line_total
     FROM order_items oi JOIN products p ON p.product_id = oi.product_id WHERE oi.order_id = ? ORDER BY oi.order_item_id`, [id]);
  const [payments] = await conn.query('SELECT payment_id, amount, payment_method, status, paid_at, created_at FROM payments WHERE order_id = ? ORDER BY payment_id', [id]);
  return { ...rows[0], cancelled_at: meta.cancelled_at, items, payments };
}

/**
 * Creates an order atomically (PRD section 13).
 * `hooks` exists only so tests can inject a failure mid-transaction and prove rollback.
 */
export async function createOrder({ customer_id, items, payment_method, payment_status, idempotency_key }, hooks = {}) {
  if (idempotency_key) {
    const [existing] = await pool.query('SELECT order_id FROM orders WHERE idempotency_key = ?', [idempotency_key]);
    if (existing.length) return { order: await getOrder(existing[0].order_id), replayed: true };
  }
  try {
    const orderId = await withTransaction(async (conn) => {
      // 1. customer must exist and be active
      const [cust] = await conn.query('SELECT is_active FROM customers WHERE customer_id = ? FOR SHARE', [customer_id]);
      if (!cust.length) throw notFound('Customer', customer_id);
      if (!cust[0].is_active) throw new AppError(409, 'CUSTOMER_INACTIVE', 'This customer is inactive and cannot place orders.');

      // 2. lock product rows in ascending id order (consistent order => lower deadlock risk)
      const ids = items.map((i) => i.product_id).sort((a, b) => a - b);
      const [products] = await conn.query(
        'SELECT product_id, sku, name, unit_price, stock_qty, is_active FROM products WHERE product_id IN (?) ORDER BY product_id FOR UPDATE', [ids]);
      const byId = new Map(products.map((p) => [p.product_id, p]));
      const missing = ids.filter((i) => !byId.has(i));
      if (missing.length) throw new AppError(404, 'PRODUCT_NOT_FOUND', `Product(s) not found: ${missing.join(', ')}.`, missing.map((m) => ({ field: 'product_id', message: `Product #${m} does not exist.` })));

      // 3. eligibility + stock check, using database prices only
      const inactive = items.filter((i) => !byId.get(i.product_id).is_active);
      if (inactive.length) throw new AppError(409, 'PRODUCT_INACTIVE', 'One or more products are not available for sale.', inactive.map((i) => ({ product_id: i.product_id, name: byId.get(i.product_id).name })));
      const short = items.filter((i) => byId.get(i.product_id).stock_qty < i.quantity)
        .map((i) => { const p = byId.get(i.product_id); return { product_id: p.product_id, sku: p.sku, name: p.name, requested: i.quantity, available: p.stock_qty }; });
      if (short.length) throw new AppError(409, 'INSUFFICIENT_STOCK', 'Not enough stock for one or more products.', short);

      const lines = items.map((i) => ({ ...i, unit_price: byId.get(i.product_id).unit_price }));
      const totalCents = lines.reduce((sum, l) => sum + cents(l.unit_price) * l.quantity, 0);
      const total = totalCents / 100;

      // 4. header + items
      const [ord] = await conn.query("INSERT INTO orders (customer_id, status, total_amount, idempotency_key) VALUES (?, 'COMPLETED', ?, ?)", [customer_id, total, idempotency_key ?? null]);
      const oid = ord.insertId;
      await conn.query('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ?', [lines.map((l) => [oid, l.product_id, l.quantity, l.unit_price])]);
      await hooks.afterItemsInserted?.({ conn, orderId: oid });

      // 5. stock deduction (guarded again in SQL) + audit rows
      for (const l of [...lines].sort((a, b) => a.product_id - b.product_id)) {
        const [u] = await conn.query('UPDATE products SET stock_qty = stock_qty - ? WHERE product_id = ? AND stock_qty >= ?', [l.quantity, l.product_id, l.quantity]);
        if (u.affectedRows !== 1) throw new AppError(409, 'INSUFFICIENT_STOCK', 'Not enough stock for one or more products.');
      }
      await hooks.afterStockUpdated?.({ conn, orderId: oid });
      await conn.query(
        'INSERT INTO inventory_movements (product_id, quantity_change, reason, reference_type, reference_id) VALUES ?',
        [lines.map((l) => [l.product_id, -l.quantity, 'SALE', 'ORDER', oid])]);

      // 6. simulated payment (no real payment data is ever collected)
      await conn.query(
        'INSERT INTO payments (order_id, amount, payment_method, status, paid_at) VALUES (?, ?, ?, ?, ?)',
        [oid, total, payment_method, payment_status, payment_status === 'SUCCESS' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null]);
      return oid; // COMMIT happens in withTransaction
    });
    return { order: await getOrder(orderId), replayed: false };
  } catch (err) {
    // Two concurrent submissions with the same key: the loser hits the unique index.
    if (idempotency_key && err?.errno === 1062 && String(err.sqlMessage).includes('uq_orders_idempotency')) {
      const [existing] = await pool.query('SELECT order_id FROM orders WHERE idempotency_key = ?', [idempotency_key]);
      if (existing.length) return { order: await getOrder(existing[0].order_id), replayed: true };
    }
    throw err;
  }
}

/** Cancels a COMPLETED order exactly once: restores stock with compensating movements. */
export async function cancelOrder(id) {
  await withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT status FROM orders WHERE order_id = ? FOR UPDATE', [id]);
    if (!rows.length) throw notFound('Order', id);
    if (rows[0].status !== 'COMPLETED') throw new AppError(409, 'ORDER_NOT_CANCELLABLE', `Order #${id} is ${rows[0].status} and cannot be cancelled.`);
    const [items] = await conn.query('SELECT product_id, quantity FROM order_items WHERE order_id = ? ORDER BY product_id', [id]);
    await conn.query('SELECT product_id FROM products WHERE product_id IN (?) ORDER BY product_id FOR UPDATE', [items.map((i) => i.product_id)]);
    for (const it of items) await conn.query('UPDATE products SET stock_qty = stock_qty + ? WHERE product_id = ?', [it.quantity, it.product_id]);
    await conn.query(
      'INSERT INTO inventory_movements (product_id, quantity_change, reason, reference_type, reference_id, notes) VALUES ?',
      [items.map((it) => [it.product_id, it.quantity, 'CANCELLATION', 'ORDER', id, 'Order cancelled - stock restored'])]);
    await conn.query("UPDATE orders SET status = 'CANCELLED', cancelled_at = NOW() WHERE order_id = ?", [id]);
    // Unsettled payments can no longer succeed. Refunds of SUCCESS payments are out of MVP scope.
    await conn.query("UPDATE payments SET status = 'FAILED' WHERE order_id = ? AND status = 'PENDING'", [id]);
  });
  return getOrder(id);
}
