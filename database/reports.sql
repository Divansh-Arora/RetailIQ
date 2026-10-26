-- =============================================================================
-- RetailIQ - reports.sql : 22 documented business queries
-- Revenue = gross value of COMPLETED orders' line items (see views.sql).
-- Run all:   mysql -u root -p retailiq < database/reports.sql
-- Session variables below parameterise the date-range queries.
-- =============================================================================
SET @from = '2026-01-01', @to = '2026-06-30';

-- Q01 Monthly revenue and order count -----------------------------------------
SELECT DATE_FORMAT(o.order_date, '%Y-%m') AS sales_month,
       SUM(oi.quantity * oi.unit_price)   AS revenue,
       COUNT(DISTINCT o.order_id)         AS total_orders
FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status = 'COMPLETED'
GROUP BY DATE_FORMAT(o.order_date, '%Y-%m')
ORDER BY sales_month;

-- Q02 Revenue, orders and AOV for an inclusive date range ---------------------
SELECT COALESCE(SUM(line_total), 0) AS revenue,
       COUNT(DISTINCT order_id)     AS total_orders,
       ROUND(SUM(line_total) / NULLIF(COUNT(DISTINCT order_id), 0), 2) AS avg_order_value
FROM v_completed_sales
WHERE order_date >= @from AND order_date < DATE_ADD(@to, INTERVAL 1 DAY);

-- Q03 Top five products by revenue --------------------------------------------
SELECT p.product_id, p.name, SUM(oi.quantity) AS units_sold,
       SUM(oi.quantity * oi.unit_price) AS revenue
FROM products p
JOIN order_items oi ON oi.product_id = p.product_id
JOIN orders o ON o.order_id = oi.order_id
WHERE o.status = 'COMPLETED'
GROUP BY p.product_id, p.name
ORDER BY revenue DESC
LIMIT 5;

-- Q04 Low-stock products (at or below reorder level) --------------------------
SELECT product_id, sku, name, stock_qty, reorder_level
FROM products
WHERE is_active = 1 AND stock_qty <= reorder_level
ORDER BY stock_qty ASC, name ASC;

-- Q05 Rank products within their category (window: RANK) ----------------------
WITH product_sales AS (
  SELECT p.product_id, p.name, p.category_id, SUM(s.line_total) AS revenue
  FROM v_completed_sales s JOIN products p ON p.product_id = s.product_id
  GROUP BY p.product_id, p.name, p.category_id
)
SELECT name, category_id, revenue,
       RANK() OVER (PARTITION BY category_id ORDER BY revenue DESC) AS category_rank
FROM product_sales
ORDER BY category_id, category_rank;

-- Q06 Category share of total revenue (window: SUM() OVER ()) -----------------
SELECT category_name, revenue,
       ROUND(revenue / SUM(revenue) OVER () * 100, 2) AS revenue_share_pct
FROM v_category_sales
ORDER BY revenue DESC;

-- Q07 Average order value per month (aggregates over aggregates via CTE) ------
WITH order_totals AS (
  SELECT order_id, MIN(order_date) AS order_date, SUM(line_total) AS order_total
  FROM v_completed_sales GROUP BY order_id
)
SELECT DATE_FORMAT(order_date, '%Y-%m') AS sales_month,
       COUNT(*) AS orders, ROUND(AVG(order_total), 2) AS avg_order_value,
       MAX(order_total) AS largest_order
FROM order_totals GROUP BY sales_month ORDER BY sales_month;

-- Q08 Highest-value customers with at least two orders (GROUP BY + HAVING) ----
SELECT c.customer_id, c.name, c.city,
       COUNT(DISTINCT s.order_id) AS total_orders, SUM(s.line_total) AS total_spent
FROM customers c JOIN v_completed_sales s ON s.customer_id = c.customer_id
GROUP BY c.customer_id, c.name, c.city
HAVING COUNT(DISTINCT s.order_id) >= 2
ORDER BY total_spent DESC
LIMIT 10;

-- Q09 One-time vs repeat customers (CTE + CASE) -------------------------------
WITH per_customer AS (
  SELECT customer_id, COUNT(DISTINCT order_id) AS n FROM v_completed_sales GROUP BY customer_id
)
SELECT CASE WHEN n = 1 THEN 'One-time' ELSE 'Repeat' END AS customer_type,
       COUNT(*) AS customers
FROM per_customer GROUP BY customer_type;

-- Q10 Order counts and value by status ----------------------------------------
SELECT status, COUNT(*) AS orders, SUM(total_amount) AS order_value
FROM orders GROUP BY status ORDER BY orders DESC;

-- Q11 Products priced above their category average (correlated subquery) ------
SELECT p.sku, p.name, p.unit_price,
       (SELECT ROUND(AVG(p2.unit_price), 2) FROM products p2 WHERE p2.category_id = p.category_id) AS category_avg_price
FROM products p
WHERE p.unit_price > (SELECT AVG(p2.unit_price) FROM products p2 WHERE p2.category_id = p.category_id)
ORDER BY p.category_id, p.unit_price DESC;

-- Q12 Active products with no sales in the 90 days before the latest order ----
SELECT p.sku, p.name, p.stock_qty
FROM products p
WHERE p.is_active = 1 AND NOT EXISTS (
  SELECT 1 FROM v_completed_sales s
  WHERE s.product_id = p.product_id
    AND s.order_date >= (SELECT DATE_SUB(MAX(order_date), INTERVAL 90 DAY) FROM orders)
)
ORDER BY p.stock_qty DESC;

-- Q13 Month-over-month revenue change (window: LAG) ---------------------------
SELECT sales_month, revenue, prev_month_revenue, mom_change_pct FROM v_monthly_revenue;

-- Q14 Running (cumulative) revenue by month (window: SUM OVER) ----------------
SELECT sales_month, revenue,
       SUM(revenue) OVER (ORDER BY sales_month ROWS UNBOUNDED PRECEDING) AS cumulative_revenue
FROM v_monthly_revenue;

-- Q15 Inventory reconciliation: stock_qty must equal SUM(movements). 0 rows = OK
SELECT p.product_id, p.sku, p.stock_qty, COALESCE(SUM(m.quantity_change), 0) AS movement_total
FROM products p LEFT JOIN inventory_movements m ON m.product_id = p.product_id
GROUP BY p.product_id, p.sku, p.stock_qty
HAVING p.stock_qty <> COALESCE(SUM(m.quantity_change), 0);

-- Q16 Order total reconciliation: header total must equal SUM(items). 0 rows = OK
SELECT o.order_id, o.total_amount, SUM(oi.quantity * oi.unit_price) AS items_total
FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
GROUP BY o.order_id, o.total_amount
HAVING o.total_amount <> SUM(oi.quantity * oi.unit_price);

-- Q17 Payment reconciliation: COMPLETED orders not fully paid -----------------
SELECT order_id, customer_name, total_amount, paid_amount, payment_status
FROM v_order_summary
WHERE order_status = 'COMPLETED' AND payment_status <> 'PAID'
ORDER BY order_date DESC LIMIT 20;

-- Q18 Revenue by customer city -------------------------------------------------
SELECT COALESCE(c.city, 'Unknown') AS city, COUNT(DISTINCT s.order_id) AS orders, SUM(s.line_total) AS revenue
FROM v_completed_sales s JOIN customers c ON c.customer_id = s.customer_id
GROUP BY COALESCE(c.city, 'Unknown') ORDER BY revenue DESC;

-- Q19 Top three products per category (window: ROW_NUMBER) --------------------
WITH ranked AS (
  SELECT c.category_name, p.name, SUM(s.line_total) AS revenue,
         ROW_NUMBER() OVER (PARTITION BY c.category_id ORDER BY SUM(s.line_total) DESC) AS rn
  FROM v_completed_sales s
  JOIN products p ON p.product_id = s.product_id
  JOIN categories c ON c.category_id = p.category_id
  GROUP BY c.category_id, c.category_name, p.product_id, p.name
)
SELECT category_name, name, revenue FROM ranked WHERE rn <= 3 ORDER BY category_name, rn;

-- Q20 Days of stock cover based on units sold in the last 90 days -------------
WITH recent AS (
  SELECT product_id, SUM(quantity) / 90 AS avg_daily_units
  FROM v_completed_sales
  WHERE order_date >= (SELECT DATE_SUB(MAX(order_date), INTERVAL 90 DAY) FROM orders)
  GROUP BY product_id
)
SELECT p.sku, p.name, p.stock_qty, ROUND(r.avg_daily_units, 3) AS avg_daily_units,
       ROUND(p.stock_qty / r.avg_daily_units, 1) AS days_of_cover
FROM products p JOIN recent r ON r.product_id = p.product_id
ORDER BY days_of_cover ASC LIMIT 15;

-- Q21 Sales by weekday ---------------------------------------------------------
SELECT DAYNAME(order_date) AS weekday, COUNT(DISTINCT order_id) AS orders, SUM(line_total) AS revenue
FROM v_completed_sales GROUP BY DAYNAME(order_date), DAYOFWEEK(order_date)
ORDER BY DAYOFWEEK(order_date);

-- Q22 Query-plan inspection (see docs/explain-notes.md) -----------------------
EXPLAIN
SELECT DATE_FORMAT(o.order_date, '%Y-%m') AS sales_month, SUM(oi.quantity * oi.unit_price) AS revenue
FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status = 'COMPLETED' AND o.order_date >= '2026-01-01' AND o.order_date < '2026-07-01'
GROUP BY sales_month;
