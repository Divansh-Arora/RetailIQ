import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, count } from './helper.js';

let t;
before(async () => { t = await setup(); });
after(async () => { await t.close(); });

const rejects = (sql, params, errno) => assert.rejects(() => t.pool.query(sql, params), (e) => { assert.equal(e.errno, errno, e.message); return true; });

test('duplicate customer email is rejected (case-insensitive)', () =>
  rejects("INSERT INTO customers (name,email) VALUES ('X','ASHA@example.com')", [], 1062));
test('duplicate SKU is rejected', () =>
  rejects("INSERT INTO products (category_id,sku,name,unit_price) VALUES (1,'PEN-1','Dup',1)", [], 1062));
test('invalid foreign keys are rejected', async () => {
  await rejects("INSERT INTO products (category_id,sku,name,unit_price) VALUES (999,'Z-1','Z',1)", [], 1452);
  await rejects("INSERT INTO orders (customer_id,total_amount) VALUES (999, 0)", [], 1452);
  await rejects("INSERT INTO order_items (order_id,product_id,quantity,unit_price) VALUES (1,999,1,1)", [], 1452);
});
test('negative price, stock, reorder level and invalid quantities violate CHECK constraints', async () => {
  await rejects("INSERT INTO products (category_id,sku,name,unit_price) VALUES (1,'N-1','N',-1)", [], 3819);
  await rejects("INSERT INTO products (category_id,sku,name,unit_price,stock_qty) VALUES (1,'N-2','N',1,-1)", [], 3819);
  await rejects("INSERT INTO products (category_id,sku,name,unit_price,reorder_level) VALUES (1,'N-3','N',1,-5)", [], 3819);
  await rejects("INSERT INTO order_items (order_id,product_id,quantity,unit_price) VALUES (2,1,0,1)", [], 3819);
  await rejects("INSERT INTO inventory_movements (product_id,quantity_change,reason) VALUES (1,0,'ADJUSTMENT')", [], 3819);
  await rejects("UPDATE products SET stock_qty = -1 WHERE product_id = 1", [], 3819);
});
test('same product cannot appear twice on one order', () =>
  rejects('INSERT INTO order_items (order_id,product_id,quantity,unit_price) VALUES (1,1,1,10)', [], 1062));
test('deleting referenced customers/products/categories is blocked (no cascade of history)', async () => {
  await rejects('DELETE FROM customers WHERE customer_id = 1', [], 1451);
  await rejects('DELETE FROM products WHERE product_id = 1', [], 1451);
  await rejects('DELETE FROM categories WHERE category_id = 1', [], 1451);
});
test('orders cannot be deleted; inventory history is append-only', async () => {
  await rejects('DELETE FROM orders WHERE order_id = 1', [], 1644);
  await rejects('UPDATE inventory_movements SET quantity_change = 99 WHERE movement_id = 1', [], 1644);
  await rejects('DELETE FROM inventory_movements WHERE movement_id = 1', [], 1644);
});
test('order totals equal the sum of their line totals (fixture)', async () => {
  const [rows] = await t.pool.query(`SELECT o.order_id FROM orders o JOIN order_items oi ON oi.order_id=o.order_id
    GROUP BY o.order_id, o.total_amount HAVING o.total_amount <> SUM(oi.quantity*oi.unit_price)`);
  assert.deepEqual(rows, []);
});
test('stock_qty reconciles with SUM(inventory_movements) for every product', async () => {
  const [rows] = await t.pool.query(`SELECT p.product_id FROM products p LEFT JOIN inventory_movements m ON m.product_id=p.product_id
    GROUP BY p.product_id, p.stock_qty HAVING p.stock_qty <> COALESCE(SUM(m.quantity_change),0)`);
  assert.deepEqual(rows, []);
});
test('sp_adjust_stock procedure updates stock and audit row, and rejects negative balances', async () => {
  await t.pool.query("CALL sp_adjust_stock(1, 7, 'RESTOCK', 'proc test')");
  assert.equal((await t.pool.query('SELECT stock_qty FROM products WHERE product_id=1'))[0][0].stock_qty, 107);
  await assert.rejects(() => t.pool.query("CALL sp_adjust_stock(1, -1000, 'ADJUSTMENT', 'too much')"), /insufficient stock/);
  assert.equal(await count(t.pool, 'inventory_movements'), 13);
});
