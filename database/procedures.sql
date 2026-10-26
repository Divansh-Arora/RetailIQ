-- =============================================================================
-- RetailIQ - procedures.sql
-- Optional stored routines that mirror workflows implemented in the API.
-- The API (backend/src/services) is the primary implementation; these are
-- provided to demonstrate transactional logic inside MySQL.
-- Run via `npm run db:init` or the mysql CLI (the client handles DELIMITER).
-- =============================================================================
DROP PROCEDURE IF EXISTS sp_adjust_stock;
DROP PROCEDURE IF EXISTS sp_revenue_report;

DELIMITER $$

-- Atomically changes stock and writes the audit row. Rejects negative balances.
CREATE PROCEDURE sp_adjust_stock(
  IN p_product_id INT,
  IN p_quantity_change INT,
  IN p_reason VARCHAR(50),
  IN p_notes VARCHAR(255)
)
BEGIN
  DECLARE v_stock INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_quantity_change = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'quantity_change must not be zero';
  END IF;

  START TRANSACTION;
  SELECT stock_qty INTO v_stock FROM products WHERE product_id = p_product_id FOR UPDATE;
  IF v_stock IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'product not found';
  END IF;
  IF v_stock + p_quantity_change < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'insufficient stock';
  END IF;

  UPDATE products SET stock_qty = stock_qty + p_quantity_change WHERE product_id = p_product_id;
  INSERT INTO inventory_movements (product_id, quantity_change, reason, reference_type, notes)
  VALUES (p_product_id, p_quantity_change, p_reason, 'MANUAL', p_notes);
  COMMIT;
END$$

-- Revenue summary for an inclusive date range, using the shared revenue view.
CREATE PROCEDURE sp_revenue_report(IN p_from DATE, IN p_to DATE)
BEGIN
  SELECT COALESCE(SUM(line_total), 0) AS revenue,
         COUNT(DISTINCT order_id)     AS total_orders,
         ROUND(COALESCE(SUM(line_total), 0) / NULLIF(COUNT(DISTINCT order_id), 0), 2) AS avg_order_value
  FROM v_completed_sales
  WHERE order_date >= p_from AND order_date < DATE_ADD(p_to, INTERVAL 1 DAY);
END$$

DELIMITER ;
