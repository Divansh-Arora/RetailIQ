-- =============================================================================
-- RetailIQ - views.sql
--
-- REVENUE RULE (single source of truth)
--   Revenue = gross sales value (quantity * unit_price snapshot) of order items
--   belonging to orders with status = 'COMPLETED', dated by orders.order_date.
--   It is NOT cash collected: payments are never joined into revenue queries,
--   so multiple payment rows can never multiply revenue. Cancelled orders are
--   excluded. Refunds/returns are out of scope for the MVP.
-- Every report, API endpoint and dashboard metric reads v_completed_sales.
-- =============================================================================

CREATE OR REPLACE VIEW v_completed_sales AS
SELECT o.order_id,
       o.order_date,
       o.customer_id,
       oi.product_id,
       p.category_id,
       oi.quantity,
       oi.unit_price,
       oi.quantity * oi.unit_price AS line_total
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
JOIN products p     ON p.product_id = oi.product_id
WHERE o.status = 'COMPLETED';

-- Order header + derived payment status (payments pre-aggregated to avoid fan-out)
CREATE OR REPLACE VIEW v_order_summary AS
SELECT o.order_id,
       o.customer_id,
       c.name  AS customer_name,
       c.email AS customer_email,
       o.order_date,
       o.status AS order_status,
       o.total_amount,
       COALESCE(it.line_count, 0) AS line_count,
       COALESCE(it.units, 0)      AS units,
       COALESCE(pay.paid_amount, 0) AS paid_amount,
       CASE
         WHEN pay.order_id IS NULL THEN 'NONE'
         WHEN COALESCE(pay.paid_amount, 0) >= o.total_amount AND o.total_amount > 0 THEN 'PAID'
         WHEN COALESCE(pay.paid_amount, 0) > 0 THEN 'PARTIAL'
         WHEN pay.pending_count > 0 THEN 'PENDING'
         ELSE 'FAILED'
       END AS payment_status
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
LEFT JOIN (
  SELECT order_id, COUNT(*) AS line_count, SUM(quantity) AS units
  FROM order_items GROUP BY order_id
) it ON it.order_id = o.order_id
LEFT JOIN (
  SELECT order_id,
         SUM(CASE WHEN status = 'SUCCESS' THEN amount ELSE 0 END) AS paid_amount,
         SUM(status = 'PENDING') AS pending_count
  FROM payments GROUP BY order_id
) pay ON pay.order_id = o.order_id;

CREATE OR REPLACE VIEW v_monthly_revenue AS
WITH m AS (
  SELECT DATE_FORMAT(order_date, '%Y-%m') AS sales_month,
         SUM(line_total) AS revenue,
         COUNT(DISTINCT order_id) AS total_orders
  FROM v_completed_sales
  GROUP BY DATE_FORMAT(order_date, '%Y-%m')
)
SELECT sales_month,
       revenue,
       total_orders,
       ROUND(revenue / total_orders, 2) AS avg_order_value,
       LAG(revenue) OVER (ORDER BY sales_month) AS prev_month_revenue,
       ROUND((revenue - LAG(revenue) OVER (ORDER BY sales_month))
             / NULLIF(LAG(revenue) OVER (ORDER BY sales_month), 0) * 100, 2) AS mom_change_pct
FROM m;

CREATE OR REPLACE VIEW v_product_performance AS
SELECT p.product_id, p.sku, p.name, p.category_id, c.category_name,
       COALESCE(SUM(s.quantity), 0)   AS units_sold,
       COALESCE(SUM(s.line_total), 0) AS revenue
FROM products p
JOIN categories c ON c.category_id = p.category_id
LEFT JOIN v_completed_sales s ON s.product_id = p.product_id
GROUP BY p.product_id, p.sku, p.name, p.category_id, c.category_name;

CREATE OR REPLACE VIEW v_category_sales AS
SELECT c.category_id, c.category_name,
       COALESCE(SUM(s.quantity), 0)   AS units_sold,
       COALESCE(SUM(s.line_total), 0) AS revenue,
       COUNT(DISTINCT s.order_id)     AS total_orders
FROM categories c
LEFT JOIN v_completed_sales s ON s.category_id = c.category_id
GROUP BY c.category_id, c.category_name;

CREATE OR REPLACE VIEW v_low_stock AS
SELECT p.product_id, p.sku, p.name, c.category_name, p.stock_qty, p.reorder_level,
       (p.reorder_level - p.stock_qty) AS shortfall
FROM products p
JOIN categories c ON c.category_id = p.category_id
WHERE p.is_active = 1 AND p.stock_qty <= p.reorder_level;

CREATE OR REPLACE VIEW v_customer_value AS
SELECT c.customer_id, c.name, c.email, c.city,
       COUNT(DISTINCT s.order_id)        AS total_orders,
       COALESCE(SUM(s.line_total), 0)    AS total_spent,
       MIN(s.order_date)                 AS first_order_date,
       MAX(s.order_date)                 AS last_order_date
FROM customers c
LEFT JOIN v_completed_sales s ON s.customer_id = c.customer_id
GROUP BY c.customer_id, c.name, c.email, c.city;
