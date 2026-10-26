import { pool } from '../config/db.js';
import { dateRangeClause } from '../utils/sql.js';

/**
 * Every query here reads v_completed_sales, so dashboard cards, charts and the
 * Reports page always agree. Revenue = gross value of COMPLETED orders' line items.
 */
export const DEFINITIONS = {
  revenue: 'Gross sales value (quantity x unit price at time of sale) of COMPLETED orders. Cancelled orders are excluded; payments are not used.',
  total_orders: 'Number of COMPLETED orders in the period.',
  avg_order_value: 'Revenue divided by completed orders.',
  low_stock_count: 'Active products whose current stock is at or below their reorder level (a live figure, not period-based).',
};

const where = (range) => {
  const r = dateRangeClause('s.order_date', range);
  return { w: r.sql.length ? ` WHERE ${r.sql.join(' AND ')}` : '', params: r.params };
};
const round2 = (n) => Math.round(n * 100) / 100;
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

async function totals(range) {
  const { w, params } = where(range);
  const [[r]] = await pool.query(`SELECT COALESCE(SUM(s.line_total), 0) AS revenue, COUNT(DISTINCT s.order_id) AS total_orders FROM v_completed_sales s${w}`, params);
  return { revenue: round2(r.revenue), total_orders: r.total_orders, avg_order_value: r.total_orders ? round2(r.revenue / r.total_orders) : 0 };
}

export async function dashboardSummary(range) {
  const current = await totals(range);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM v_low_stock');
  let previous = null;
  if (range.from && range.to) {
    const days = (Date.parse(range.to) - Date.parse(range.from)) / 86400000 + 1;
    const prevTo = addDays(range.from, -1);
    const prevFrom = addDays(prevTo, -(days - 1));
    const p = await totals({ from: prevFrom, to: prevTo });
    previous = { from: prevFrom, to: prevTo, ...p, revenue_change_pct: p.revenue ? round2(((current.revenue - p.revenue) / p.revenue) * 100) : null };
  }
  return { period: { from: range.from ?? null, to: range.to ?? null }, ...current, low_stock_count: n, previous, definitions: DEFINITIONS };
}

export async function monthlySales(range) {
  const { w, params } = where(range);
  const [rows] = await pool.query(
    `WITH m AS (
       SELECT DATE_FORMAT(s.order_date, '%Y-%m') AS sales_month, SUM(s.line_total) AS revenue, COUNT(DISTINCT s.order_id) AS total_orders
       FROM v_completed_sales s${w} GROUP BY DATE_FORMAT(s.order_date, '%Y-%m'))
     SELECT sales_month, revenue, total_orders, ROUND(revenue / total_orders, 2) AS avg_order_value,
            ROUND((revenue - LAG(revenue) OVER (ORDER BY sales_month)) / NULLIF(LAG(revenue) OVER (ORDER BY sales_month), 0) * 100, 2) AS mom_change_pct
     FROM m ORDER BY sales_month`, params);
  return rows;
}

export async function topProducts(range, { limit = 5, by = 'revenue' } = {}) {
  const { w, params } = where(range);
  const order = by === 'units' ? 'units_sold DESC, revenue DESC' : 'revenue DESC, units_sold DESC';
  const [rows] = await pool.query(
    `SELECT p.product_id, p.sku, p.name, c.category_name, SUM(s.quantity) AS units_sold, SUM(s.line_total) AS revenue
     FROM v_completed_sales s JOIN products p ON p.product_id = s.product_id JOIN categories c ON c.category_id = p.category_id${w}
     GROUP BY p.product_id, p.sku, p.name, c.category_name ORDER BY ${order}, p.product_id LIMIT ?`, [...params, limit]);
  return rows;
}

export async function categorySales(range) {
  const { w, params } = where(range);
  const [rows] = await pool.query(
    `SELECT c.category_id, c.category_name, SUM(s.quantity) AS units_sold, SUM(s.line_total) AS revenue, COUNT(DISTINCT s.order_id) AS total_orders,
            ROUND(SUM(s.line_total) / SUM(SUM(s.line_total)) OVER () * 100, 2) AS revenue_share_pct
     FROM v_completed_sales s JOIN categories c ON c.category_id = s.category_id${w}
     GROUP BY c.category_id, c.category_name ORDER BY revenue DESC`, params);
  return rows;
}

export async function topCustomers(range, { limit = 10 } = {}) {
  const { w, params } = where(range);
  const [rows] = await pool.query(
    `SELECT c.customer_id, c.name, c.email, c.city, COUNT(DISTINCT s.order_id) AS total_orders, SUM(s.line_total) AS total_spent,
            ROUND(SUM(s.line_total) / COUNT(DISTINCT s.order_id), 2) AS avg_order_value
     FROM v_completed_sales s JOIN customers c ON c.customer_id = s.customer_id${w}
     GROUP BY c.customer_id, c.name, c.email, c.city ORDER BY total_spent DESC, c.customer_id LIMIT ?`, [...params, limit]);
  return rows;
}

export async function orderStatusCounts(range) {
  const r = dateRangeClause('o.order_date', range);
  const w = r.sql.length ? ` WHERE ${r.sql.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT o.status, COUNT(*) AS orders, SUM(o.total_amount) AS order_value FROM orders o${w} GROUP BY o.status ORDER BY orders DESC`, r.params);
  return rows;
}

export async function revenueReport(range) {
  const [summary, monthly] = await Promise.all([totals(range), monthlySales(range)]);
  return { period: { from: range.from ?? null, to: range.to ?? null }, definition: DEFINITIONS.revenue, ...summary, monthly };
}
