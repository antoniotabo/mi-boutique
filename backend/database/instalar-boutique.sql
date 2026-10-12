CREATE DATABASE IF NOT EXISTS boutique_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE boutique_db;
-- MySQL 8.0.16+. Run via npm run db:migrate after configuring DB_NAME=boutique_db.
-- Existing legacy commercial tables are preserved and are not used by this version.
CREATE TABLE IF NOT EXISTS users (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 username VARCHAR(80) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
 role ENUM('admin','operator') NOT NULL DEFAULT 'operator',
 active TINYINT NOT NULL DEFAULT 1, must_change_password TINYINT NOT NULL DEFAULT 0,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS sessions (
 token_hash CHAR(64) PRIMARY KEY, user_id INT UNSIGNED NOT NULL, expires_at DATETIME NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, INDEX(expires_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS user_management_lock (id TINYINT PRIMARY KEY) ENGINE=InnoDB;
INSERT IGNORE INTO user_management_lock(id) VALUES(1);
CREATE TABLE IF NOT EXISTS b_lock (id TINYINT PRIMARY KEY) ENGINE=InnoDB;
INSERT IGNORE INTO b_lock(id) VALUES(1);
CREATE TABLE IF NOT EXISTS b_schema_versions (
 version INT PRIMARY KEY, installed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS b_requests (
 request_id CHAR(36) PRIMARY KEY, fingerprint CHAR(64) NOT NULL,
 result_json JSON NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS b_settings (
 id TINYINT PRIMARY KEY, business_name VARCHAR(120) NOT NULL DEFAULT 'Mi Boutique',
 document VARCHAR(30) NOT NULL DEFAULT '', address VARCHAR(250) NOT NULL DEFAULT '',
 phone VARCHAR(30) NOT NULL DEFAULT '', ticket_message VARCHAR(250) NOT NULL DEFAULT 'Gracias por tu compra',
 paper_width ENUM('58','80') NOT NULL DEFAULT '80'
) ENGINE=InnoDB;
INSERT IGNORE INTO b_settings(id) VALUES(1);
CREATE TABLE IF NOT EXISTS b_categories (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL UNIQUE,
 active TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS b_products (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, category_id INT UNSIGNED NOT NULL,
 name VARCHAR(120) NOT NULL, description VARCHAR(1000) NOT NULL DEFAULT '',
 image_url VARCHAR(1000) NOT NULL DEFAULT '', unit ENUM('unit','pair') NOT NULL DEFAULT 'unit',
 active TINYINT NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(category_id) REFERENCES b_categories(id), INDEX(name), INDEX(category_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS b_variants (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, product_id INT UNSIGNED NOT NULL,
 sku VARCHAR(60) NOT NULL UNIQUE, barcode VARCHAR(80) NULL UNIQUE,
 size VARCHAR(40) NOT NULL DEFAULT '', color VARCHAR(60) NOT NULL DEFAULT '',
 cost DECIMAL(9,2) NOT NULL, price DECIMAL(9,2) NOT NULL,
 stock INT NOT NULL DEFAULT 0, min_stock INT NOT NULL DEFAULT 0, active TINYINT NOT NULL DEFAULT 1,
 FOREIGN KEY(product_id) REFERENCES b_products(id), UNIQUE(product_id,size,color),
 CHECK(cost>=0), CHECK(price>0), CHECK(stock>=0), CHECK(min_stock>=0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS b_customers (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL,
 document VARCHAR(30) NULL UNIQUE, phone VARCHAR(30) NOT NULL DEFAULT '',
 address VARCHAR(250) NOT NULL DEFAULT '', active TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS b_suppliers (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL,
 document VARCHAR(30) NULL UNIQUE, phone VARCHAR(30) NOT NULL DEFAULT '',
 address VARCHAR(250) NOT NULL DEFAULT '', active TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS b_cash_sessions (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, opening_amount DECIMAL(11,2) NOT NULL,
 opened_by INT UNSIGNED NOT NULL, opened_at DATETIME NOT NULL,
 closed_by INT UNSIGNED NULL, closed_at DATETIME NULL,
 expected_amount DECIMAL(11,2) NULL, counted_amount DECIMAL(11,2) NULL,
 difference_amount DECIMAL(12,2) NULL, note VARCHAR(250) NOT NULL DEFAULT '',
 active_slot TINYINT GENERATED ALWAYS AS (CASE WHEN closed_at IS NULL THEN 1 ELSE NULL END) STORED,
 UNIQUE(active_slot), FOREIGN KEY(opened_by) REFERENCES users(id), FOREIGN KEY(closed_by) REFERENCES users(id),
 CHECK(opening_amount>=0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS b_orders (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, kind ENUM('sale','purchase') NOT NULL,
 party_id INT UNSIGNED NULL, party_name VARCHAR(120) NOT NULL,
 user_id INT UNSIGNED NOT NULL, session_id INT UNSIGNED NOT NULL,
 total DECIMAL(11,2) NOT NULL, payment_method ENUM('cash','yape','plin','card','transfer') NOT NULL,
 tendered DECIMAL(11,2) NOT NULL, change_amount DECIMAL(11,2) NOT NULL DEFAULT 0,
 note VARCHAR(250) NOT NULL DEFAULT '', created_at DATETIME NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(session_id) REFERENCES b_cash_sessions(id),
 INDEX(kind,created_at), CHECK(total>0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS b_order_items (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, order_id INT UNSIGNED NOT NULL,
 variant_id INT UNSIGNED NOT NULL, product_name VARCHAR(120) NOT NULL, sku VARCHAR(60) NOT NULL,
 size VARCHAR(40) NOT NULL, color VARCHAR(60) NOT NULL, unit ENUM('unit','pair') NOT NULL,
 quantity INT NOT NULL, returned_quantity INT NOT NULL DEFAULT 0,
 unit_price DECIMAL(9,2) NOT NULL, unit_discount DECIMAL(9,2) NOT NULL DEFAULT 0,
 unit_cost DECIMAL(9,2) NOT NULL, subtotal DECIMAL(11,2) NOT NULL,
 FOREIGN KEY(order_id) REFERENCES b_orders(id), FOREIGN KEY(variant_id) REFERENCES b_variants(id),
 CHECK(quantity>0), CHECK(returned_quantity>=0 AND returned_quantity<=quantity),
 CHECK(unit_discount>=0 AND unit_discount<unit_price)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS b_returns (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, order_id INT UNSIGNED NOT NULL,
 user_id INT UNSIGNED NOT NULL, session_id INT UNSIGNED NOT NULL,
 total DECIMAL(11,2) NOT NULL, reason VARCHAR(250) NOT NULL, created_at DATETIME NOT NULL,
 FOREIGN KEY(order_id) REFERENCES b_orders(id), FOREIGN KEY(user_id) REFERENCES users(id),
 FOREIGN KEY(session_id) REFERENCES b_cash_sessions(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS b_return_items (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, return_id INT UNSIGNED NOT NULL,
 order_item_id INT UNSIGNED NOT NULL, quantity INT NOT NULL, subtotal DECIMAL(11,2) NOT NULL,
 FOREIGN KEY(return_id) REFERENCES b_returns(id), FOREIGN KEY(order_item_id) REFERENCES b_order_items(id),
 CHECK(quantity>0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS b_stock_movements (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, variant_id INT UNSIGNED NOT NULL,
 quantity INT NOT NULL, balance INT NOT NULL,
 kind ENUM('sale','purchase','sale_return','purchase_return','initial','adjustment') NOT NULL,
 reference_id INT UNSIGNED NULL, note VARCHAR(250) NOT NULL DEFAULT '', user_id INT UNSIGNED NOT NULL,
 created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
 FOREIGN KEY(variant_id) REFERENCES b_variants(id), FOREIGN KEY(user_id) REFERENCES users(id),
 INDEX(variant_id,id), CHECK(balance>=0), CHECK(quantity<>0)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS b_cash_movements (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, session_id INT UNSIGNED NOT NULL,
 amount DECIMAL(12,2) NOT NULL, method ENUM('cash','yape','plin','card','transfer') NOT NULL,
 kind ENUM('sale','purchase','sale_return','purchase_return','income','expense') NOT NULL,
 reference_id INT UNSIGNED NULL, note VARCHAR(250) NOT NULL DEFAULT '', user_id INT UNSIGNED NOT NULL,
 created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
 FOREIGN KEY(session_id) REFERENCES b_cash_sessions(id), FOREIGN KEY(user_id) REFERENCES users(id),
 INDEX(session_id,method), CHECK(amount<>0)
) ENGINE=InnoDB;

-- Compatibilidad con usuarios creados por la version anterior.
SET @boutique_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='active'), 'SELECT 1', 'ALTER TABLE users ADD COLUMN active TINYINT NOT NULL DEFAULT 1');
PREPARE boutique_stmt FROM @boutique_sql;
EXECUTE boutique_stmt;
DEALLOCATE PREPARE boutique_stmt;
SET @boutique_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='must_change_password'), 'SELECT 1', 'ALTER TABLE users ADD COLUMN must_change_password TINYINT NOT NULL DEFAULT 0');
PREPARE boutique_stmt FROM @boutique_sql;
EXECUTE boutique_stmt;
DEALLOCATE PREPARE boutique_stmt;
INSERT IGNORE INTO b_categories(name) SELECT 'Ropa' WHERE NOT EXISTS(SELECT 1 FROM b_schema_versions WHERE version=1);
INSERT IGNORE INTO b_categories(name) SELECT 'Carteras' WHERE NOT EXISTS(SELECT 1 FROM b_schema_versions WHERE version=1);
INSERT IGNORE INTO b_categories(name) SELECT 'Aretes' WHERE NOT EXISTS(SELECT 1 FROM b_schema_versions WHERE version=1);
INSERT IGNORE INTO b_categories(name) SELECT 'Collares' WHERE NOT EXISTS(SELECT 1 FROM b_schema_versions WHERE version=1);
INSERT IGNORE INTO b_categories(name) SELECT 'Pulseras' WHERE NOT EXISTS(SELECT 1 FROM b_schema_versions WHERE version=1);
INSERT IGNORE INTO b_categories(name) SELECT 'Accesorios' WHERE NOT EXISTS(SELECT 1 FROM b_schema_versions WHERE version=1);
INSERT IGNORE INTO b_schema_versions(version) VALUES(1);
SELECT DATABASE() AS base_seleccionada;
SHOW TABLES;
