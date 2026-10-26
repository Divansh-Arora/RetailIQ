-- =============================================================================
-- RetailIQ - indexes.sql
-- Secondary indexes beyond PKs / UNIQUE keys. Each one maps to a query pattern.
-- Validate with EXPLAIN (see docs/explain-notes.md); do not assume gains.
--
-- Not created (redundant): order_items(order_id) and products(category_id).
-- uq_order_items_order_product (order_id, product_id) already serves the first,
-- and the foreign key on products.category_id creates the second implicitly.
-- =============================================================================

-- Customer order history, ordered by date
CREATE INDEX idx_orders_customer_date ON orders (customer_id, order_date);
-- Status + date-range filters (orders list, every revenue report)
CREATE INDEX idx_orders_status_date ON orders (status, order_date);
-- Product sales rollups (top products, category sales)
CREATE INDEX idx_items_product_order ON order_items (product_id, order_id);
-- Payment status lookups per order (v_order_summary)
CREATE INDEX idx_payments_order_status ON payments (order_id, status);
-- Movement history by product and time
CREATE INDEX idx_movements_product_created ON inventory_movements (product_id, created_at);
-- Movement history by reference (e.g. all movements of one order)
CREATE INDEX idx_movements_reference ON inventory_movements (reference_type, reference_id);
