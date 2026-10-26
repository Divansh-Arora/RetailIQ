import { Validator } from '../utils/validate.js';
import { toCsv } from '../utils/csv.js';
import * as svc from '../services/reports.service.js';

function rangeAndFormat(q, extra) {
  const v = new Validator();
  const range = v.dateRange(q);
  const format = v.oneOf(q.format, 'format', ['JSON', 'CSV'], { def: 'JSON' });
  const more = extra ? extra(v) : {};
  v.assert();
  return { range, csv: format === 'CSV', ...more };
}
function sendCsv(res, name, rows, columns, range) {
  const tag = `${range.from ?? 'start'}_${range.to ?? 'today'}`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="retailiq-${name}-${tag}.csv"`);
  res.send(toCsv(rows, columns));
}
const limitOf = (def) => (v, q) => v.int(q.limit, 'limit', { min: 1, max: 100, def });

// ---- dashboard ----
export async function summary(req, res) { const { range } = rangeAndFormat(req.query); res.json(await svc.dashboardSummary(range)); }
export async function monthlySales(req, res) { const { range } = rangeAndFormat(req.query); res.json({ data: await svc.monthlySales(range) }); }
export async function topProducts(req, res) {
  const { range, limit, by } = rangeAndFormat(req.query, (v) => ({ limit: limitOf(5)(v, req.query), by: v.oneOf(req.query.by, 'by', ['REVENUE', 'UNITS'], { def: 'REVENUE' }) }));
  res.json({ data: await svc.topProducts(range, { limit, by: by.toLowerCase() === 'units' ? 'units' : 'revenue' }) });
}
export async function categorySales(req, res) {
  const { range, csv } = rangeAndFormat(req.query);
  const data = await svc.categorySales(range);
  if (csv) return sendCsv(res, 'category-sales', data, [{ key: 'category_name', header: 'Category' }, { key: 'units_sold', header: 'Units sold' }, { key: 'total_orders', header: 'Orders' }, { key: 'revenue', header: 'Revenue' }, { key: 'revenue_share_pct', header: 'Share %' }], range);
  res.json({ data });
}

// ---- reports ----
export async function revenue(req, res) {
  const { range, csv } = rangeAndFormat(req.query);
  const report = await svc.revenueReport(range);
  if (csv) return sendCsv(res, 'revenue', report.monthly, [{ key: 'sales_month', header: 'Month' }, { key: 'revenue', header: 'Revenue' }, { key: 'total_orders', header: 'Orders' }, { key: 'avg_order_value', header: 'Avg order value' }, { key: 'mom_change_pct', header: 'MoM change %' }], range);
  res.json(report);
}
export async function topCustomers(req, res) {
  const { range, csv, limit } = rangeAndFormat(req.query, (v) => ({ limit: limitOf(10)(v, req.query) }));
  const data = await svc.topCustomers(range, { limit });
  if (csv) return sendCsv(res, 'top-customers', data, [{ key: 'name', header: 'Customer' }, { key: 'email', header: 'Email' }, { key: 'city', header: 'City' }, { key: 'total_orders', header: 'Orders' }, { key: 'total_spent', header: 'Total spent' }, { key: 'avg_order_value', header: 'Avg order value' }], range);
  res.json({ data });
}
export async function topProductsReport(req, res) {
  const { range, csv, limit, by } = rangeAndFormat(req.query, (v) => ({ limit: limitOf(10)(v, req.query), by: v.oneOf(req.query.by, 'by', ['REVENUE', 'UNITS'], { def: 'REVENUE' }) }));
  const data = await svc.topProducts(range, { limit, by: by === 'UNITS' ? 'units' : 'revenue' });
  if (csv) return sendCsv(res, 'top-products', data, [{ key: 'sku', header: 'SKU' }, { key: 'name', header: 'Product' }, { key: 'category_name', header: 'Category' }, { key: 'units_sold', header: 'Units sold' }, { key: 'revenue', header: 'Revenue' }], range);
  res.json({ data });
}
export async function orderStatus(req, res) { const { range } = rangeAndFormat(req.query); res.json({ data: await svc.orderStatusCounts(range) }); }
