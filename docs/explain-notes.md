# Query-plan notes (measured, not assumed)

Measured on MySQL 8.0.46 with the bundled seed (500 orders, 1,145 order items). Dataset is small, so
**only the access path is compared; no timing or speed-up is claimed.**

Query (monthly revenue for Jan–Jun 2026, same shape as `reports.sql` Q22):

```sql
EXPLAIN SELECT DATE_FORMAT(o.order_date,'%Y-%m') m, SUM(oi.quantity*oi.unit_price)
FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status='COMPLETED' AND o.order_date >= '2026-01-01' AND o.order_date < '2026-07-01'
GROUP BY m;
```

| Setup | `orders` access type | key | rows examined (estimate) | filtered |
|---|---|---|---|---|
| With `idx_orders_status_date (status, order_date)` | `range` | idx_orders_status_date | 219 | 100% |
| Index dropped | `ALL` (full scan) | none | 500 | 3.70% |

The composite index lets MySQL seek to `COMPLETED` rows in the date range instead of scanning the table;
`order_items` is reached through `uq_order_items_order_product` in both cases. To reproduce: run the
query, `DROP INDEX idx_orders_status_date ON orders;`, run it again, then recreate it from `indexes.sql`.

Redundant indexes deliberately **not** created: `order_items(order_id)` (covered by the unique
`(order_id, product_id)` key) and `products(category_id)` (created implicitly by the foreign key).
