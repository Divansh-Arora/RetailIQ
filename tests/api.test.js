import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, count } from './helper.js';

let t;
before(async () => { t = await setup(); });
after(async () => { await t.close(); });

test('health check', async () => {
  const r = await t.api('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.json.database, 'up');
});

test('product create → 201, read, update; SKU conflict → 409; stock not editable via PUT', async () => {
  const c = await t.api('POST', '/products', { category_id: 1, sku: 'NEW-1', name: 'Notebook', unit_price: '99.50', stock_qty: 12, reorder_level: 3 });
  assert.equal(c.status, 201, JSON.stringify(c.json));
  assert.equal(c.json.unit_price, 99.5);
  assert.equal(c.json.stock_qty, 12);
  const id = c.json.product_id;
  const [mv] = await t.pool.query("SELECT reason, quantity_change FROM inventory_movements WHERE product_id=? AND reason='OPENING'", [id]);
  assert.equal(mv[0].quantity_change, 12);
  const dup = await t.api('POST', '/products', { category_id: 1, sku: 'NEW-1', name: 'Other', unit_price: 1 });
  assert.equal(dup.status, 409);
  assert.equal(dup.json.error.code, 'DUPLICATE_SKU');
  const upd = await t.api('PUT', `/products/${id}`, { category_id: 2, sku: 'NEW-1', name: 'Notebook A5', unit_price: 120, reorder_level: 5, is_active: true });
  assert.equal(upd.status, 200);
  assert.equal(upd.json.category_name, 'Home');
  const bad = await t.api('PUT', `/products/${id}`, { category_id: 2, sku: 'NEW-1', name: 'Notebook A5', unit_price: 120, stock_qty: 999 });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error.details[0].field, 'stock_qty');
});

test('product validation reports every bad field', async () => {
  const r = await t.api('POST', '/products', { sku: '', name: '', unit_price: -5, stock_qty: 1.5, reorder_level: -1 });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, 'VALIDATION_ERROR');
  const fields = r.json.error.details.map((d) => d.field);
  for (const f of ['category_id', 'sku', 'name', 'unit_price', 'stock_qty', 'reorder_level']) assert.ok(fields.includes(f), `${f} missing from ${fields}`);
});

test('unknown category → 400; unknown product → 404', async () => {
  assert.equal((await t.api('POST', '/products', { category_id: 99, sku: 'Q-1', name: 'Q', unit_price: 1 })).json.error.code, 'CATEGORY_NOT_FOUND');
  const r = await t.api('GET', '/products/99999');
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, 'PRODUCT_NOT_FOUND');
});

test('pagination, search, category filter and sorting', async () => {
  const p1 = await t.api('GET', '/products?limit=2&page=1&sort=unit_price&dir=desc');
  assert.equal(p1.json.data.length, 2);
  assert.equal(p1.json.data[0].name, 'Lamp');
  assert.equal(p1.json.pagination.limit, 2);
  assert.ok(p1.json.pagination.totalPages >= 2);
  assert.equal((await t.api('GET', '/products?search=PEN-')).json.data.length, 1);
  assert.equal((await t.api('GET', '/products?category_id=2')).json.pagination.total, 3); // Lamp, Mug + Notebook moved here by the earlier update test
  assert.equal((await t.api('GET', '/products?search=%25')).json.data.length, 0); // "%" is literal, not a wildcard
});

test('out-of-range and malformed query parameters → 400', async () => {
  for (const q of ['limit=0', 'limit=1000', 'page=-1', 'page=abc', 'sort=password', 'dir=sideways', 'low_stock=maybe', 'category_id=1.5']) {
    const r = await t.api('GET', `/products?${q}`);
    assert.equal(r.status, 400, q);
  }
  assert.equal((await t.api('GET', '/orders?from=2026-13-01')).status, 400);
  assert.equal((await t.api('GET', '/orders?from=2026-03-01&to=2026-01-01')).status, 400);
  assert.equal((await t.api('GET', '/orders?status=SHIPPED')).status, 400);
  assert.equal((await t.api('GET', '/dashboard/summary?from=yesterday')).status, 400);
});

test('SQL-injection-like input is treated as data', async () => {
  const evil = "'; DROP TABLE products; --";
  const before = await count(t.pool, 'products');
  assert.equal((await t.api('GET', `/products?search=${encodeURIComponent(evil)}`)).status, 200);
  assert.equal((await t.api('GET', `/products?sort=${encodeURIComponent('name; DROP TABLE products')}`)).status, 400);
  assert.equal((await t.api('GET', `/customers?search=${encodeURIComponent("' OR '1'='1")}`)).json.data.length, 0);
  const c = await t.api('POST', '/customers', { name: evil, email: 'inj@example.com' });
  assert.equal(c.status, 201);
  assert.equal(c.json.name, evil);
  assert.equal(await count(t.pool, 'products'), before);
});

test('customers: create, duplicate email, validation, update, history', async () => {
  const c = await t.api('POST', '/customers', { name: ' Dev ', email: 'Dev@Example.com', city: 'Pune' });
  assert.equal(c.status, 201);
  assert.equal(c.json.email, 'dev@example.com');
  assert.equal(c.json.name, 'Dev');
  assert.equal((await t.api('POST', '/customers', { name: 'Dev2', email: 'DEV@example.com' })).json.error.code, 'DUPLICATE_EMAIL');
  assert.equal((await t.api('POST', '/customers', { name: 'X', email: 'not-an-email' })).status, 400);
  assert.equal((await t.api('POST', '/customers', { email: 'a@b.co' })).status, 400);
  const same = await t.api('PUT', `/customers/${c.json.customer_id}`, { name: 'Dev', email: 'dev@example.com', city: 'Pune' }); // unchanged update still succeeds
  assert.equal(same.status, 200);
  const hist = await t.api('GET', '/customers/1');
  assert.equal(hist.json.summary.total_orders, 2);
  assert.equal(hist.json.summary.total_spent, 220);
  assert.equal(hist.json.summary.avg_order_value, 110);
  assert.equal(hist.json.orders.length, 2);
  assert.equal((await t.api('GET', '/customers/9999')).status, 404);
});

test('categories: list with counts, create, duplicate', async () => {
  const l = await t.api('GET', '/categories');
  assert.equal(l.json.data.find((c) => c.category_name === 'Home').product_count, 3); // Lamp, Mug, Notebook A5
  assert.equal((await t.api('POST', '/categories', { category_name: 'Garden' })).status, 201);
  assert.equal((await t.api('POST', '/categories', { category_name: 'garden' })).json.error.code, 'DUPLICATE_CATEGORY');
});

test('stock adjustments: audited, reason required, never negative', async () => {
  const ok = await t.api('POST', '/inventory/adjustments', { product_id: 2, quantity_change: 10, reason: 'RESTOCK', notes: 'PO-1' });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.stock_after, ok.json.stock_before + 10);
  assert.equal((await t.api('POST', '/inventory/adjustments', { product_id: 2, quantity_change: -1000, reason: 'ADJUSTMENT', notes: 'oops' })).status, 409);
  assert.equal((await t.api('POST', '/inventory/adjustments', { product_id: 2, quantity_change: -1, reason: 'ADJUSTMENT' })).status, 400); // notes required
  assert.equal((await t.api('POST', '/inventory/adjustments', { product_id: 2, quantity_change: -3, reason: 'RESTOCK' })).status, 400);
  assert.equal((await t.api('POST', '/inventory/adjustments', { product_id: 2, quantity_change: 0, reason: 'ADJUSTMENT', notes: 'x' })).status, 400);
  assert.equal((await t.api('POST', '/inventory/adjustments', { product_id: 999, quantity_change: 1, reason: 'RESTOCK' })).status, 404);
  const mv = await t.api('GET', '/inventory/movements?product_id=2&reason=RESTOCK');
  assert.equal(mv.json.data[0].notes, 'PO-1');
  assert.equal(mv.json.data[0].reference_type, 'MANUAL');
});

test('orders list: filters, pagination and separate order / payment status', async () => {
  const all = await t.api('GET', '/orders?limit=2');
  assert.equal(all.json.data.length, 2);
  const cancelled = await t.api('GET', '/orders?status=CANCELLED');
  assert.equal(cancelled.json.pagination.total, 1);
  assert.equal(cancelled.json.data[0].order_status, 'CANCELLED');
  assert.equal(cancelled.json.data[0].payment_status, 'FAILED');
  const jan = await t.api('GET', '/orders?from=2026-01-01&to=2026-01-31&sort=order_id&dir=asc');
  assert.deepEqual(jan.json.data.map((o) => o.order_id), [1, 2]);
  assert.equal((await t.api('GET', '/orders?search=ben')).json.data.length, 2);
  assert.equal((await t.api('GET', '/orders/999999')).status, 404);
});

test('malformed JSON and unknown routes return structured errors', async () => {
  const bad = await t.api('POST', '/customers', '{not json');
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error.code, 'INVALID_JSON');
  const nf = await t.api('GET', '/nope');
  assert.equal(nf.status, 404);
  assert.equal(nf.json.error.code, 'ROUTE_NOT_FOUND');
});

test('unexpected database errors return a generic 500 without leaking internals', async () => {
  await t.pool.query('RENAME TABLE v_order_summary TO v_order_summary_tmp');
  try {
    const r = await t.api('GET', '/orders');
    assert.equal(r.status, 500);
    assert.equal(r.json.error.code, 'INTERNAL_ERROR');
    assert.ok(!/v_order_summary|SELECT|ER_|sql|stack|at /i.test(r.text), r.text);
  } finally {
    await t.pool.query('RENAME TABLE v_order_summary_tmp TO v_order_summary');
  }
});
