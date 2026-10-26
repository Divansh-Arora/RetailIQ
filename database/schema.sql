-- =============================================================================
-- RetailIQ - schema.sql
-- MySQL 8.0.16+ (CHECK constraints are enforced from 8.0.16).
-- WARNING: this script DROPS and recreates all RetailIQ tables. Run on a
-- development database only. Create the database first:
--     CREATE DATABASE retailiq CHARACTER SET utf8mb4;
-- =============================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS inventory_movements;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS customers;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE customers (
  customer_id INT NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL,
  city        VARCHAR(80)  NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id),
  UNIQUE KEY uq_customers_email (email),
  CONSTRAINT chk_customers_name CHECK (CHAR_LENGTH(TRIM(name)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE categories (
  category_id   INT NOT NULL AUTO_INCREMENT,
  category_name VARCHAR(100) NOT NULL,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_categories_name (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE products (
  product_id    INT NOT NULL AUTO_INCREMENT,
  category_id   INT NOT NULL,
  sku           VARCHAR(50)   NOT NULL,
  name          VARCHAR(150)  NOT NULL,
  unit_price    DECIMAL(10,2) NOT NULL,
  stock_qty     INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 10,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  UNIQUE KEY uq_products_sku (sku),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id)
    REFERENCES categories (category_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_products_price   CHECK (unit_price >= 0),
  CONSTRAINT chk_products_stock   CHECK (stock_qty >= 0),
  CONSTRAINT chk_products_reorder CHECK (reorder_level >= 0),
  CONSTRAINT chk_products_name    CHECK (CHAR_LENGTH(TRIM(name)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Orders created through the API are written as COMPLETED in one transaction
-- (stock is deducted at creation). PENDING exists in the enum for future
-- reservation workflows; it never holds stock in this MVP.
CREATE TABLE orders (
  order_id        BIGINT NOT NULL AUTO_INCREMENT,
  customer_id     INT NOT NULL,
  order_date      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status          ENUM('PENDING','COMPLETED','CANCELLED') NOT NULL DEFAULT 'COMPLETED',
  total_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  idempotency_key VARCHAR(64) NULL,
  cancelled_at    DATETIME NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  UNIQUE KEY uq_orders_idempotency (idempotency_key),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id)
    REFERENCES customers (customer_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_orders_total CHECK (total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_items (
  order_item_id BIGINT NOT NULL AUTO_INCREMENT,
  order_id      BIGINT NOT NULL,
  product_id    INT NOT NULL,
  quantity      INT NOT NULL,
  unit_price    DECIMAL(10,2) NOT NULL COMMENT 'Price snapshot at time of sale',
  PRIMARY KEY (order_item_id),
  UNIQUE KEY uq_order_items_order_product (order_id, product_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id)
    REFERENCES orders (order_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id)
    REFERENCES products (product_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_items_qty   CHECK (quantity > 0),
  CONSTRAINT chk_items_price CHECK (unit_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Demo payments only. No card numbers, CVVs or credentials are ever stored.
CREATE TABLE payments (
  payment_id     BIGINT NOT NULL AUTO_INCREMENT,
  order_id       BIGINT NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  payment_method ENUM('CASH','CARD_DEMO','UPI_DEMO') NOT NULL,
  status         ENUM('PENDING','SUCCESS','FAILED') NOT NULL DEFAULT 'PENDING',
  paid_at        DATETIME NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (payment_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id)
    REFERENCES orders (order_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_payments_amount CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Append-only audit trail (enforced by triggers.sql). products.stock_qty is the
-- balance; this table explains every change to it.
-- reference_type/reference_id is a polymorphic reference (ORDER, MANUAL, ...)
-- and therefore intentionally NOT a foreign key (documented trade-off).
CREATE TABLE inventory_movements (
  movement_id     BIGINT NOT NULL AUTO_INCREMENT,
  product_id      INT NOT NULL,
  quantity_change INT NOT NULL,
  reason          VARCHAR(50) NOT NULL,
  reference_type  VARCHAR(30) NULL,
  reference_id    BIGINT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes           VARCHAR(255) NULL,
  PRIMARY KEY (movement_id),
  CONSTRAINT fk_movements_product FOREIGN KEY (product_id)
    REFERENCES products (product_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_movements_qty    CHECK (quantity_change <> 0),
  CONSTRAINT chk_movements_reason CHECK (reason IN ('SALE','RESTOCK','ADJUSTMENT','CANCELLATION','OPENING'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
