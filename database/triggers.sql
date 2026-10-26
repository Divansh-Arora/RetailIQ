-- =============================================================================
-- RetailIQ - triggers.sql
-- Audit safeguards. Inventory history is append-only: corrections must be made
-- with compensating movements, never by editing history.
-- =============================================================================
DROP TRIGGER IF EXISTS trg_movements_block_update;
DROP TRIGGER IF EXISTS trg_movements_block_delete;
DROP TRIGGER IF EXISTS trg_orders_block_delete;

DELIMITER $$

CREATE TRIGGER trg_movements_block_update BEFORE UPDATE ON inventory_movements
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'inventory_movements is append-only: use a compensating entry';
END$$

CREATE TRIGGER trg_movements_block_delete BEFORE DELETE ON inventory_movements
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'inventory_movements is append-only: use a compensating entry';
END$$

-- Orders are transactional history: cancel them, never delete them.
CREATE TRIGGER trg_orders_block_delete BEFORE DELETE ON orders
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'orders cannot be deleted: cancel the order instead';
END$$

DELIMITER ;
