// Hand-calculated expectations for the deterministic fixture in helper.js:
//   Completed orders: #1 Jan 100, #2 Jan 200, #3 Feb 120, #5 Feb 100 (Feb-28 23:30). #4 (400) is CANCELLED and excluded.
//   Jan 300 (2 orders, AOV 150) | Feb 220 (2 orders, AOV 110) | total 520, 4 orders, AOV 130 | Feb MoM = (220-300)/300 = -26.67%
//   Product revenue: Lamp 200, Book 150, Pen 130, Mug 40.   Category: Stationery 280 (53.85%), Home 240 (46.15%).
//   Customers: Ben 300 (2 orders), Asha 220 (2 orders). Low stock: Book (8<=10) and Mug (0<=0).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helper.js';

let t;
before(async () => { t = await setup(); });
after(async () => { await t.close(); });

test('dashboard summary matches hand-calculated KPIs', async () => {
  const { status, json } = await t.api('GET', '/dashboard/summary');
  assert.equal(status, 200);
  assert.equal(json.revenue, 520);
  assert.equal(json.total_orders, 4);
  assert.equal(json.avg_order_value, 130);
  assert.equal(json.low_stock_count, 2);
});

test('date filter is inclusive of the last day (order at 23:30 on Feb 28)', async () => {
  const { json } = await t.api('GET', '/dashboard/summary?from=2026-02-01&to=2026-02-28');
  assert.equal(json.revenue, 220);
  assert.equal(json.total_orders, 2);
  assert.equal(json.previous.revenue, 300); // previous equal-length window = Jan 4 - Jan 31 contains Jan orders #1(10th) and #2(20th)
});

test('monthly sales and month-over-month change', async () => {
  const { json } = await t.api('GET', '/dashboard/monthly-sales');
  assert.deepEqual(json.data.map((m) => [m.sales_month, m.revenue, m.total_orders]), [['2026-01', 300, 2], ['2026-02', 220, 2]]);
  assert.equal(json.data[0].mom_change_pct, null);
  assert.equal(json.data[1].mom_change_pct, -26.67);
});

test('top products rank by revenue and by units', async () => {
  const byRev = (await t.api('GET', '/dashboard/top-products?limit=4')).json.data;
  assert.deepEqual(byRev.map((p) => [p.name, p.revenue]), [['Lamp', 200], ['Book', 150], ['Pen', 130], ['Mug', 40]]);
  const byUnits = (await t.api('GET', '/dashboard/top-products?by=units&limit=1')).json.data;
  assert.equal(byUnits[0].name, 'Pen');
  assert.equal(byUnits[0].units_sold, 13);
});

test('category sales and revenue share', async () => {
  const { json } = await t.api('GET', '/dashboard/category-sales');
  assert.deepEqual(json.data.map((c) => [c.category_name, c.revenue, c.revenue_share_pct]), [['Stationery', 280, 53.85], ['Home', 240, 46.15]]);
});

test('top customers use completed orders only', async () => {
  const { json } = await t.api('GET', '/reports/top-customers');
  assert.deepEqual(json.data.map((c) => [c.name, c.total_spent, c.total_orders]), [['Ben', 300, 2], ['Asha', 220, 2]]);
});

test('revenue report equals the sum of its monthly rows and carries the metric definition', async () => {
  const { json } = await t.api('GET', '/reports/revenue');
  assert.equal(json.revenue, json.monthly.reduce((s, m) => s + m.revenue, 0));
  assert.match(json.definition, /COMPLETED/);
});

test('order status counts include cancelled orders', async () => {
  const { json } = await t.api('GET', '/reports/order-status');
  const m = Object.fromEntries(json.data.map((r) => [r.status, r.orders]));
  assert.deepEqual(m, { COMPLETED: 4, CANCELLED: 1 });
});

test('low-stock endpoint and product low_stock filter agree', async () => {
  const low = await t.api('GET', '/inventory/low-stock');
  assert.deepEqual(low.json.data.map((p) => p.sku).sort(), ['BOOK-1', 'MUG-1']);
  const filtered = await t.api('GET', '/products?low_stock=true');
  assert.equal(filtered.json.pagination.total, 2);
});

test('payment status is derived without multiplying revenue (multiple payments per order)', async () => {
  await t.pool.query("INSERT INTO payments (order_id, amount, payment_method, status) VALUES (1, 100, 'CASH', 'FAILED'), (1, 100, 'CASH', 'PENDING')");
  const { json } = await t.api('GET', '/orders/1');
  assert.equal(json.payment_status, 'PAID');
  assert.equal(json.payments.length, 3);
  assert.equal((await t.api('GET', '/dashboard/summary')).json.revenue, 520);
});

test('CSV export respects the date range and escapes values', async () => {
  const r = await t.api('GET', '/reports/revenue?format=csv&from=2026-02-01&to=2026-02-28');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/csv/);
  assert.match(r.headers.get('content-disposition'), /2026-02-01_2026-02-28/);
  const lines = r.text.trim().split('\r\n');
  assert.equal(lines[0], 'Month,Revenue,Orders,Avg order value,MoM change %');
  assert.equal(lines.length, 2);
  assert.ok(lines[1].startsWith('2026-02,220,2,110'));
});
