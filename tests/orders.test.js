import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, stockOf, count } from './helper.js';

let t, svc;
before(async () => { t = await setup(); svc = await import('../backend/src/services/orders.service.js'); });
after(async () => { await t.close(); });

const order = (items, extra = {}, headers) => t.api('POST', '/orders', { customer_id: 1, items, ...extra }, headers);

test('valid order deducts stock, writes audit rows, payment and server-side total', async () => {
  const before = await stockOf(t.pool, 1);
  const r = await order([{ product_id: 1, quantity: 3 }, { product_id: 3, quantity: 1 }], { payment_method: 'UPI_DEMO' });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.total_amount, 230);
  assert.equal(r.json.order_status, 'COMPLETED');
  assert.equal(r.json.payment_status, 'PAID');
  assert.equal(await stockOf(t.pool, 1), before - 3);
  const [mv] = await t.pool.query("SELECT product_id, quantity_change FROM inventory_movements WHERE reference_type='ORDER' AND reference_id=? ORDER BY product_id", [r.json.order_id]);
  assert.deepEqual(mv.map((m) => [m.product_id, m.quantity_change]), [[1, -3], [3, -1]]);
});

test('client-submitted prices and totals are ignored', async () => {
  const r = await order([{ product_id: 1, quantity: 1, unit_price: 0.01 }], { total_amount: 1 });
  assert.equal(r.status, 201);
  assert.equal(r.json.total_amount, 10);
  assert.equal(r.json.items[0].unit_price, 10);
});

test('duplicate product lines are merged', async () => {
  const r = await order([{ product_id: 1, quantity: 2 }, { product_id: 1, quantity: 3 }]);
  assert.equal(r.status, 201);
  assert.equal(r.json.items.length, 1);
  assert.equal(r.json.items[0].quantity, 5);
});

test('insufficient stock is rejected with 409 and changes nothing', async () => {
  const orders = await count(t.pool, 'orders'), stock = await stockOf(t.pool, 2);
  const r = await order([{ product_id: 1, quantity: 1 }, { product_id: 2, quantity: stock + 1 }]);
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, 'INSUFFICIENT_STOCK');
  assert.equal(r.json.error.details[0].available, stock);
  assert.equal(await count(t.pool, 'orders'), orders);
  assert.equal(await stockOf(t.pool, 2), stock);
});

test('invalid customer, product, quantity and empty orders are rejected', async () => {
  assert.equal((await t.api('POST', '/orders', { customer_id: 999, items: [{ product_id: 1, quantity: 1 }] })).json.error.code, 'CUSTOMER_NOT_FOUND');
  assert.equal((await order([{ product_id: 999, quantity: 1 }])).json.error.code, 'PRODUCT_NOT_FOUND');
  for (const bad of [[], [{ product_id: 1, quantity: 0 }], [{ product_id: 1, quantity: -2 }], [{ product_id: 1, quantity: 1.5 }], [{ product_id: 'x', quantity: 1 }]]) {
    const r = await order(bad);
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.equal(r.json.error.code, 'VALIDATION_ERROR');
  }
});

test('a failure midway rolls back the order, items, stock, movements and payment', async () => {
  const snap = async () => [await count(t.pool, 'orders'), await count(t.pool, 'order_items'), await count(t.pool, 'inventory_movements'), await count(t.pool, 'payments'), await stockOf(t.pool, 1), await stockOf(t.pool, 3)];
  const before = await snap();
  await assert.rejects(() => svc.createOrder(
    { customer_id: 1, items: [{ product_id: 1, quantity: 2 }, { product_id: 3, quantity: 1 }], payment_method: 'CASH', payment_status: 'SUCCESS' },
    { afterStockUpdated: () => { throw new Error('simulated crash'); } }), /simulated crash/);
  assert.deepEqual(await snap(), before);
});

test('concurrent orders cannot oversell the same product', async () => {
  await t.pool.query('UPDATE products SET stock_qty = 5 WHERE product_id = 1');
  await t.pool.query("INSERT INTO inventory_movements (product_id, quantity_change, reason, reference_type, notes) SELECT 1, 5 - SUM(quantity_change), 'ADJUSTMENT', 'MANUAL', 'test reset' FROM inventory_movements WHERE product_id = 1");
  const results = await Promise.all(Array.from({ length: 10 }, () => order([{ product_id: 1, quantity: 1 }])));
  const ok = results.filter((r) => r.status === 201).length;
  const conflict = results.filter((r) => r.status === 409).length;
  assert.equal(ok, 5);
  assert.equal(conflict, 5);
  assert.equal(await stockOf(t.pool, 1), 0);
});

test('multi-product orders in opposite line order do not deadlock', async () => {
  for (const product_id of [2, 3]) await t.api('POST', '/inventory/adjustments', { product_id, quantity_change: 100, reason: 'RESTOCK', notes: 'test stock' }); // audited, keeps ledger reconciled
  const calls = Array.from({ length: 8 }, (_, i) => order(i % 2 ? [{ product_id: 2, quantity: 1 }, { product_id: 3, quantity: 1 }] : [{ product_id: 3, quantity: 1 }, { product_id: 2, quantity: 1 }]));
  const results = await Promise.all(calls);
  assert.ok(results.every((r) => r.status === 201), results.map((r) => r.status).join(','));
});

test('idempotency key: repeated submission returns the original order and creates no duplicate', async () => {
  const key = 'idem-test-key-0001';
  const before = await count(t.pool, 'orders');
  const first = await order([{ product_id: 3, quantity: 1 }], {}, { 'Idempotency-Key': key });
  const second = await order([{ product_id: 3, quantity: 1 }], {}, { 'Idempotency-Key': key });
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(second.json.order_id, first.json.order_id);
  assert.equal(second.json.idempotent_replay, true);
  assert.equal(await count(t.pool, 'orders'), before + 1);
});

test('idempotency key: simultaneous submissions create exactly one order', async () => {
  const key = 'idem-race-key-0002';
  const before = await count(t.pool, 'orders');
  const rs = await Promise.all(Array.from({ length: 5 }, () => order([{ product_id: 3, quantity: 1 }], {}, { 'Idempotency-Key': key })));
  assert.ok(rs.every((r) => [200, 201].includes(r.status)), rs.map((r) => r.status).join(','));
  assert.equal(new Set(rs.map((r) => r.json.order_id)).size, 1);
  assert.equal(await count(t.pool, 'orders'), before + 1);
});

test('cancelling restores stock exactly once with compensating movements', async () => {
  const created = await order([{ product_id: 3, quantity: 4 }]);
  const stockAfterSale = await stockOf(t.pool, 3);
  const c1 = await t.api('POST', `/orders/${created.json.order_id}/cancel`);
  assert.equal(c1.status, 200);
  assert.equal(c1.json.order_status, 'CANCELLED');
  assert.equal(await stockOf(t.pool, 3), stockAfterSale + 4);
  const c2 = await t.api('POST', `/orders/${created.json.order_id}/cancel`);
  assert.equal(c2.status, 409);
  assert.equal(c2.json.error.code, 'ORDER_NOT_CANCELLABLE');
  assert.equal(await stockOf(t.pool, 3), stockAfterSale + 4);
  const [mv] = await t.pool.query("SELECT quantity_change FROM inventory_movements WHERE reference_id=? AND reason='CANCELLATION'", [created.json.order_id]);
  assert.deepEqual(mv.map((m) => m.quantity_change), [4]);
});

test('concurrent cancellations restore stock only once', async () => {
  const created = await order([{ product_id: 3, quantity: 2 }]);
  const base = await stockOf(t.pool, 3);
  const rs = await Promise.all(Array.from({ length: 4 }, () => t.api('POST', `/orders/${created.json.order_id}/cancel`)));
  assert.equal(rs.filter((r) => r.status === 200).length, 1);
  assert.equal(await stockOf(t.pool, 3), base + 2);
});

test('pay-later orders show PENDING payment status', async () => {
  const r = await order([{ product_id: 3, quantity: 1 }], { payment_status: 'PENDING' });
  assert.equal(r.json.payment_status, 'PENDING');
});

test('after all workflows stock still reconciles with the movement ledger', async () => {
  const [rows] = await t.pool.query(`SELECT p.product_id FROM products p LEFT JOIN inventory_movements m ON m.product_id=p.product_id
    GROUP BY p.product_id, p.stock_qty HAVING p.stock_qty <> COALESCE(SUM(m.quantity_change),0)`);
  assert.deepEqual(rows, []);
  const [bad] = await t.pool.query(`SELECT o.order_id FROM orders o JOIN order_items oi ON oi.order_id=o.order_id GROUP BY o.order_id, o.total_amount HAVING o.total_amount <> SUM(oi.quantity*oi.unit_price)`);
  assert.deepEqual(bad, []);
});
