-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: boutique_db
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `b_cash_movements`
--

DROP TABLE IF EXISTS `b_cash_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `b_cash_movements` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `session_id` int unsigned NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `method` enum('cash','yape','plin','card','transfer') NOT NULL,
  `kind` enum('sale','purchase','sale_return','purchase_return','income','expense') NOT NULL,
  `reference_id` int unsigned DEFAULT NULL,
  `note` varchar(250) NOT NULL DEFAULT '',
  `user_id` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (utc_timestamp()),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `session_id` (`session_id`,`method`),
  CONSTRAINT `b_cash_movements_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `b_cash_sessions` (`id`),
  CONSTRAINT `b_cash_movements_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `b_cash_movements_chk_1` CHECK ((`amount` <> 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `b_cash_movements`
--

LOCK TABLES `b_cash_movements` WRITE;
/*!40000 ALTER TABLE `b_cash_movements` DISABLE KEYS */;
/*!40000 ALTER TABLE `b_cash_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `b_cash_sessions`
--

DROP TABLE IF EXISTS `b_cash_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `b_cash_sessions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `opening_amount` decimal(11,2) NOT NULL,
  `opened_by` int unsigned NOT NULL,
  `opened_at` datetime NOT NULL,
  `closed_by` int unsigned DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `expected_amount` decimal(11,2) DEFAULT NULL,
  `counted_amount` decimal(11,2) DEFAULT NULL,
  `difference_amount` decimal(12,2) DEFAULT NULL,
  `note` varchar(250) NOT NULL DEFAULT '',
  `active_slot` tinyint GENERATED ALWAYS AS ((case when (`closed_at` is null) then 1 else NULL end)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `active_slot` (`active_slot`),
  KEY `opened_by` (`opened_by`),
  KEY `closed_by` (`closed_by`),
  CONSTRAINT `b_cash_sessions_ibfk_1` FOREIGN KEY (`opened_by`) REFERENCES `users` (`id`),
  CONSTRAINT `b_cash_sessions_ibfk_2` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `b_cash_sessions_chk_1` CHECK ((`opening_amount` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `b_cash_sessions`
--

LOCK TABLES `b_cash_sessions` WRITE;
/*!40000 ALTER TABLE `b_cash_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `b_cash_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `b_categories`
--

DROP TABLE IF EXISTS `b_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `b_categories` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  `active` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `b_categories`
--

LOCK TABLES `b_categories` WRITE;
/*!40000 ALTER TABLE `b_categories` DISABLE KEYS */;
INSERT INTO `b_categories` VALUES (1,'Ropa',1),(2,'Carteras',1),(3,'Aretes',1),(4,'Collares',1),(5,'Pulseras',1),(6,'Accesorios',1);
/*!40000 ALTER TABLE `b_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `b_customers`
--

DROP TABLE IF EXISTS `b_customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `b_customers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `document` varchar(30) DEFAULT NULL,
  `phone` varchar(30) NOT NULL DEFAULT '',
  `address` varchar(250) NOT NULL DEFAULT '',
  `active` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `document` (`document`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `b_customers`
--

LOCK TABLES `b_customers` WRITE;
/*!40000 ALTER TABLE `b_customers` DISABLE KEYS */;
/*!40000 ALTER TABLE `b_customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `b_lock`
--

DROP TABLE IF EXISTS `b_lock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `b_lock` (
  `id` tinyint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `b_lock`
--

LOCK TABLES `b_lock` WRITE;
/*!40000 ALTER TABLE `b_lock` DISABLE KEYS */;
INSERT INTO `b_lock` VALUES (1);
/*!40000 ALTER TABLE `b_lock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `b_order_items`
--

DROP TABLE IF EXISTS `b_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `b_order_items` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int unsigned NOT NULL,
  `variant_id` int unsigned NOT NULL,
  `product_name` varchar(120) NOT NULL,
  `sku` varchar(60) NOT NULL,
  `size` varchar(40) NOT NULL,
  `color` varchar(60) NOT NULL,
  `unit` enum('unit','pair') NOT NULL,
  `quantity` int NOT NULL,
  `returned_quantity` int NOT NULL DEFAULT '0',
  `unit_price` decimal(9,2) NOT NULL,
  `unit_discount` decimal(9,2) NOT NULL DEFAULT '0.00',
  `unit_cost` decimal(9,2) NOT NULL,
  `subtotal` decimal(11,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `variant_id` (`variant_id`),
  CONSTRAINT `b_order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `b_orders` (`id`),
  CONSTRAINT `b_order_items_ibfk_2` FOREIGN KEY (`variant_id`) REFERENCES `b_variants` (`id`),
  CONSTRAINT `b_order_items_chk_1` CHECK ((`quantity` > 0)),
  CONSTRAINT `b_order_items_chk_2` CHECK (((`returned_quantity` >= 0) and (`returned_quantity` <= `quantity`))),
  CONSTRAINT `b_order_items_chk_3` CHECK (((`unit_discount` >= 0) and (`unit_discount` < `unit_price`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `b_order_items`
--

LOCK TABLES `b_order_items` WRITE;
/*!40000 ALTER TABLE `b_order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `b_order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `b_orders`
--

DROP TABLE IF EXISTS `b_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `b_orders` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `kind` enum('sale','purchase') NOT NULL,
  `party_id` int unsigned DEFAULT NULL,
  `party_name` varchar(120) NOT NULL,
  `user_id` int unsigned NOT NULL,
  `session_id` int unsigned NOT NULL,
  `total` decimal(11,2) NOT NULL,
  `payment_method` enum('cash','yape','plin','card','transfer') NOT NULL,
  `tendered` decimal(11,2) NOT NULL,
  `change_amount` decimal(11,2) NOT NULL DEFAULT '0.00',
  `note` varchar(250) NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `session_id` (`session_id`),
  KEY `kind` (`kind`,`created_at`),
  CONSTRAINT `b_orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `b_orders_ibfk_2` FOREIGN KEY (`session_id`) REFERENCES `b_cash_sessions` (`id`),
  CONSTRAINT `b_orders_chk_1` CHECK ((`total` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `b_orders`
--

LOCK TABLES `b_orders` WRITE;
/*!40000 ALTER TABLE `b_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `b_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `b_products`
--

DROP TABLE IF EXISTS `b_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `b_products` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `category_id` int unsigned NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` varchar(1000) NOT NULL DEFAULT '',
  `image_url` varchar(1000) NOT NULL DEFAULT '',
  `unit` enum('unit','pair') NOT NULL DEFAULT 'unit',
  `active` tinyint NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `name` (`name`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `b_products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `b_categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `b_products`
--

LOCK TABLES `b_products` WRITE;
/*!40000 ALTER TABLE `b_products` DISABLE KEYS */;
/*!40000 ALTER TABLE `b_products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `b_requests`
--

DROP TABLE IF EXISTS `b_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `b_requests` (
  `request_id` char(36) NOT NULL,
  `fingerprint` char(64) NOT NULL,
  `result_json` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `b_requests`
--

LOCK TABLES `b_requests` WRITE;
/*!40000 ALTER TABLE `b_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `b_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `b_return_items`
--

DROP TABLE IF EXISTS `b_return_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `b_return_items` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `return_id` int unsigned NOT NULL,
  `order_item_id` int unsigned NOT NULL,
  `quantity` int NOT NULL,
  `subtotal` decimal(11,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `return_id` (`return_id`),
  KEY `order_item_id` (`order_item_id`),
  CONSTRAINT `b_return_items_ibfk_1` FOREIGN KEY (`return_id`) REFERENCES `b_returns` (`id`),
  CONSTRAINT `b_return_items_ibfk_2` FOREIGN KEY (`order_item_id`) REFERENCES `b_order_items` (`id`),
  CONSTRAINT `b_return_items_chk_1` CHECK ((`quantity` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `b_return_items`
--

LOCK TABLES `b_return_items` WRITE;
/*!40000 ALTER TABLE `b_return_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `b_return_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `b_returns`
--

DROP TABLE IF EXISTS `b_returns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `b_returns` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int unsigned NOT NULL,
  `user_id` int unsigned NOT NULL,
  `session_id` int unsigned NOT NULL,
  `total` decimal(11,2) NOT NULL,
  `reason` varchar(250) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `user_id` (`user_id`),
  KEY `session_id` (`session_id`),
  CONSTRAINT `b_returns_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `b_orders` (`id`),
  CONSTRAINT `b_returns_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `b_returns_ibfk_3` FOREIGN KEY (`session_id`) REFERENCES `b_cash_sessions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `b_returns`
--

LOCK TABLES `b_returns` WRITE;
/*!40000 ALTER TABLE `b_returns` DISABLE KEYS */;
/*!40000 ALTER TABLE `b_returns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `b_schema_versions`
--

DROP TABLE IF EXISTS `b_schema_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `b_schema_versions` (
  `version` int NOT NULL,
  `installed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `b_schema_versions`
--

LOCK TABLES `b_schema_versions` WRITE;
/*!40000 ALTER TABLE `b_schema_versions` DISABLE KEYS */;
INSERT INTO `b_schema_versions` VALUES (1,'2026-10-10 04:17:28');
/*!40000 ALTER TABLE `b_schema_versions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `b_settings`
--

DROP TABLE IF EXISTS `b_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `b_settings` (
  `id` tinyint NOT NULL,
  `business_name` varchar(120) NOT NULL DEFAULT 'Mi Boutique',
  `document` varchar(30) NOT NULL DEFAULT '',
  `address` varchar(250) NOT NULL DEFAULT '',
  `phone` varchar(30) NOT NULL DEFAULT '',
  `ticket_message` varchar(250) NOT NULL DEFAULT 'Gracias por tu compra',
  `paper_width` enum('58','80') NOT NULL DEFAULT '80',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `b_settings`
--

LOCK TABLES `b_settings` WRITE;
/*!40000 ALTER TABLE `b_settings` DISABLE KEYS */;
INSERT INTO `b_settings` VALUES (1,'Dafhana Fashion','','','','Gracias por tu compra','80');
/*!40000 ALTER TABLE `b_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `b_stock_movements`
--

DROP TABLE IF EXISTS `b_stock_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `b_stock_movements` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `variant_id` int unsigned NOT NULL,
  `quantity` int NOT NULL,
  `balance` int NOT NULL,
  `kind` enum('sale','purchase','sale_return','purchase_return','initial','adjustment') NOT NULL,
  `reference_id` int unsigned DEFAULT NULL,
  `note` varchar(250) NOT NULL DEFAULT '',
  `user_id` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (utc_timestamp()),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `variant_id` (`variant_id`,`id`),
  CONSTRAINT `b_stock_movements_ibfk_1` FOREIGN KEY (`variant_id`) REFERENCES `b_variants` (`id`),
  CONSTRAINT `b_stock_movements_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `b_stock_movements_chk_1` CHECK ((`balance` >= 0)),
  CONSTRAINT `b_stock_movements_chk_2` CHECK ((`quantity` <> 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `b_stock_movements`
--

LOCK TABLES `b_stock_movements` WRITE;
/*!40000 ALTER TABLE `b_stock_movements` DISABLE KEYS */;
/*!40000 ALTER TABLE `b_stock_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `b_suppliers`
--

DROP TABLE IF EXISTS `b_suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `b_suppliers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `document` varchar(30) DEFAULT NULL,
  `phone` varchar(30) NOT NULL DEFAULT '',
  `address` varchar(250) NOT NULL DEFAULT '',
  `active` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `document` (`document`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `b_suppliers`
--

LOCK TABLES `b_suppliers` WRITE;
/*!40000 ALTER TABLE `b_suppliers` DISABLE KEYS */;
/*!40000 ALTER TABLE `b_suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `b_variants`
--

DROP TABLE IF EXISTS `b_variants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `b_variants` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `product_id` int unsigned NOT NULL,
  `sku` varchar(60) NOT NULL,
  `barcode` varchar(80) DEFAULT NULL,
  `size` varchar(40) NOT NULL DEFAULT '',
  `color` varchar(60) NOT NULL DEFAULT '',
  `cost` decimal(9,2) NOT NULL,
  `price` decimal(9,2) NOT NULL,
  `stock` int NOT NULL DEFAULT '0',
  `min_stock` int NOT NULL DEFAULT '0',
  `active` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `sku` (`sku`),
  UNIQUE KEY `product_id` (`product_id`,`size`,`color`),
  UNIQUE KEY `barcode` (`barcode`),
  CONSTRAINT `b_variants_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `b_products` (`id`),
  CONSTRAINT `b_variants_chk_1` CHECK ((`cost` >= 0)),
  CONSTRAINT `b_variants_chk_2` CHECK ((`price` > 0)),
  CONSTRAINT `b_variants_chk_3` CHECK ((`stock` >= 0)),
  CONSTRAINT `b_variants_chk_4` CHECK ((`min_stock` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `b_variants`
--

LOCK TABLES `b_variants` WRITE;
/*!40000 ALTER TABLE `b_variants` DISABLE KEYS */;
/*!40000 ALTER TABLE `b_variants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cash_counts`
--

DROP TABLE IF EXISTS `cash_counts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cash_counts` (
  `session_id` int unsigned NOT NULL,
  `denomination` int unsigned NOT NULL COMMENT 'Valor en centimos',
  `quantity` int unsigned NOT NULL,
  PRIMARY KEY (`session_id`,`denomination`),
  CONSTRAINT `cash_counts_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `cash_sessions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cash_counts`
--

LOCK TABLES `cash_counts` WRITE;
/*!40000 ALTER TABLE `cash_counts` DISABLE KEYS */;
/*!40000 ALTER TABLE `cash_counts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cash_lock`
--

DROP TABLE IF EXISTS `cash_lock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cash_lock` (
  `id` tinyint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cash_lock`
--

LOCK TABLES `cash_lock` WRITE;
/*!40000 ALTER TABLE `cash_lock` DISABLE KEYS */;
INSERT INTO `cash_lock` VALUES (1);
/*!40000 ALTER TABLE `cash_lock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cash_movements`
--

DROP TABLE IF EXISTS `cash_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cash_movements` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `session_id` int unsigned NOT NULL,
  `kind` enum('income','expense','purchase') NOT NULL,
  `amount` decimal(11,2) NOT NULL,
  `concept` varchar(200) NOT NULL,
  `purchase_id` int unsigned DEFAULT NULL,
  `user_id` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_id` (`purchase_id`),
  KEY `session_id` (`session_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `cash_movements_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `cash_sessions` (`id`),
  CONSTRAINT `cash_movements_ibfk_2` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`),
  CONSTRAINT `cash_movements_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `cash_movements_chk_1` CHECK ((`amount` > 0)),
  CONSTRAINT `cash_movements_chk_2` CHECK ((((`kind` = _utf8mb4'purchase') and (`purchase_id` is not null)) or ((`kind` <> _utf8mb4'purchase') and (`purchase_id` is null))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cash_movements`
--

LOCK TABLES `cash_movements` WRITE;
/*!40000 ALTER TABLE `cash_movements` DISABLE KEYS */;
/*!40000 ALTER TABLE `cash_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cash_requests`
--

DROP TABLE IF EXISTS `cash_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cash_requests` (
  `request_id` char(36) NOT NULL,
  `fingerprint` char(64) NOT NULL,
  `result_json` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cash_requests`
--

LOCK TABLES `cash_requests` WRITE;
/*!40000 ALTER TABLE `cash_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `cash_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cash_sessions`
--

DROP TABLE IF EXISTS `cash_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cash_sessions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `opening_amount` decimal(11,2) NOT NULL,
  `opened_by` int unsigned NOT NULL,
  `opened_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at` timestamp NULL DEFAULT NULL,
  `closed_by` int unsigned DEFAULT NULL,
  `expected_amount` decimal(11,2) DEFAULT NULL,
  `counted_amount` decimal(11,2) DEFAULT NULL,
  `difference_amount` decimal(12,2) DEFAULT NULL,
  `close_note` varchar(200) NOT NULL DEFAULT '',
  `active_slot` tinyint GENERATED ALWAYS AS ((case when (`closed_at` is null) then 1 else NULL end)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `one_open_cash` (`active_slot`),
  KEY `opened_by` (`opened_by`),
  KEY `closed_by` (`closed_by`),
  CONSTRAINT `cash_sessions_ibfk_1` FOREIGN KEY (`opened_by`) REFERENCES `users` (`id`),
  CONSTRAINT `cash_sessions_ibfk_2` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `cash_sessions_chk_1` CHECK ((`opening_amount` >= 0)),
  CONSTRAINT `cash_sessions_chk_2` CHECK (((`counted_amount` is null) or (`counted_amount` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cash_sessions`
--

LOCK TABLES `cash_sessions` WRITE;
/*!40000 ALTER TABLE `cash_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `cash_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `document` varchar(20) DEFAULT NULL,
  `phone` varchar(30) NOT NULL DEFAULT '',
  `address` varchar(250) NOT NULL DEFAULT '',
  `active` tinyint NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `document` (`document`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_adjustments`
--

DROP TABLE IF EXISTS `inventory_adjustments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_adjustments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `request_id` char(36) NOT NULL,
  `fingerprint` char(64) NOT NULL,
  `material_id` int unsigned NOT NULL,
  `kind` enum('initial','loss','correction') NOT NULL,
  `kg` decimal(12,3) NOT NULL,
  `before_kg` decimal(15,3) NOT NULL,
  `after_kg` decimal(15,3) NOT NULL,
  `reason` varchar(250) NOT NULL,
  `user_id` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `request_id` (`request_id`),
  KEY `material_id` (`material_id`,`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `inventory_adjustments_ibfk_1` FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`),
  CONSTRAINT `inventory_adjustments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_adjustments`
--

LOCK TABLES `inventory_adjustments` WRITE;
/*!40000 ALTER TABLE `inventory_adjustments` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_adjustments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `materials`
--

DROP TABLE IF EXISTS `materials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `materials` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `sale_price` decimal(8,2) DEFAULT NULL,
  `purchase_price` decimal(8,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  CONSTRAINT `materials_chk_1` CHECK ((`purchase_price` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `materials`
--

LOCK TABLES `materials` WRITE;
/*!40000 ALTER TABLE `materials` DISABLE KEYS */;
/*!40000 ALTER TABLE `materials` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_cancellations`
--

DROP TABLE IF EXISTS `purchase_cancellations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_cancellations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `purchase_id` int unsigned NOT NULL,
  `request_id` char(36) NOT NULL,
  `fingerprint` char(64) NOT NULL,
  `reason` varchar(250) NOT NULL,
  `cancelled_by` int unsigned NOT NULL,
  `cancelled_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `refund_movement_id` int unsigned DEFAULT NULL,
  `refund_request_id` char(36) DEFAULT NULL,
  `refund_fingerprint` char(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_id` (`purchase_id`),
  UNIQUE KEY `request_id` (`request_id`),
  UNIQUE KEY `refund_movement_id` (`refund_movement_id`),
  UNIQUE KEY `refund_request_id` (`refund_request_id`),
  KEY `cancelled_by` (`cancelled_by`),
  CONSTRAINT `purchase_cancellations_ibfk_1` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`),
  CONSTRAINT `purchase_cancellations_ibfk_2` FOREIGN KEY (`cancelled_by`) REFERENCES `users` (`id`),
  CONSTRAINT `purchase_cancellations_ibfk_3` FOREIGN KEY (`refund_movement_id`) REFERENCES `cash_movements` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_cancellations`
--

LOCK TABLES `purchase_cancellations` WRITE;
/*!40000 ALTER TABLE `purchase_cancellations` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_cancellations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_items`
--

DROP TABLE IF EXISTS `purchase_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_items` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `purchase_id` int unsigned NOT NULL,
  `material_id` int unsigned NOT NULL,
  `material_name` varchar(100) NOT NULL,
  `kg` decimal(9,3) NOT NULL,
  `unit_price` decimal(8,2) NOT NULL,
  `subtotal` decimal(11,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `purchase_id` (`purchase_id`),
  KEY `material_id` (`material_id`),
  CONSTRAINT `purchase_items_ibfk_1` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`),
  CONSTRAINT `purchase_items_ibfk_2` FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`),
  CONSTRAINT `purchase_items_chk_1` CHECK ((`kg` > 0)),
  CONSTRAINT `purchase_items_chk_2` CHECK ((`unit_price` > 0)),
  CONSTRAINT `purchase_items_chk_3` CHECK ((`subtotal` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_items`
--

LOCK TABLES `purchase_items` WRITE;
/*!40000 ALTER TABLE `purchase_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_weights`
--

DROP TABLE IF EXISTS `purchase_weights`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_weights` (
  `purchase_item_id` int unsigned NOT NULL,
  `gross_kg` decimal(9,3) NOT NULL,
  `tare_kg` decimal(9,3) NOT NULL,
  PRIMARY KEY (`purchase_item_id`),
  CONSTRAINT `purchase_weights_ibfk_1` FOREIGN KEY (`purchase_item_id`) REFERENCES `purchase_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_weights`
--

LOCK TABLES `purchase_weights` WRITE;
/*!40000 ALTER TABLE `purchase_weights` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_weights` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchases`
--

DROP TABLE IF EXISTS `purchases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchases` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `request_id` char(36) NOT NULL,
  `supplier_id` int unsigned DEFAULT NULL,
  `seller_name` varchar(120) NOT NULL,
  `user_id` int unsigned NOT NULL,
  `total` decimal(11,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `request_id` (`request_id`),
  KEY `supplier_id` (`supplier_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `purchases_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `purchases_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `purchases_chk_1` CHECK ((`total` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchases`
--

LOCK TABLES `purchases` WRITE;
/*!40000 ALTER TABLE `purchases` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sale_cancellations`
--

DROP TABLE IF EXISTS `sale_cancellations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sale_cancellations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `sale_id` int unsigned NOT NULL,
  `request_id` char(36) NOT NULL,
  `reason` varchar(250) NOT NULL,
  `cancelled_by` int unsigned NOT NULL,
  `cancelled_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `refund_movement_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sale_id` (`sale_id`),
  UNIQUE KEY `request_id` (`request_id`),
  UNIQUE KEY `refund_movement_id` (`refund_movement_id`),
  KEY `cancelled_by` (`cancelled_by`),
  CONSTRAINT `sale_cancellations_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`),
  CONSTRAINT `sale_cancellations_ibfk_2` FOREIGN KEY (`cancelled_by`) REFERENCES `users` (`id`),
  CONSTRAINT `sale_cancellations_ibfk_3` FOREIGN KEY (`refund_movement_id`) REFERENCES `cash_movements` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sale_cancellations`
--

LOCK TABLES `sale_cancellations` WRITE;
/*!40000 ALTER TABLE `sale_cancellations` DISABLE KEYS */;
/*!40000 ALTER TABLE `sale_cancellations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sale_customers`
--

DROP TABLE IF EXISTS `sale_customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sale_customers` (
  `sale_id` int unsigned NOT NULL,
  `customer_id` int unsigned NOT NULL,
  PRIMARY KEY (`sale_id`),
  KEY `customer_id` (`customer_id`,`sale_id`),
  CONSTRAINT `sale_customers_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`),
  CONSTRAINT `sale_customers_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sale_customers`
--

LOCK TABLES `sale_customers` WRITE;
/*!40000 ALTER TABLE `sale_customers` DISABLE KEYS */;
/*!40000 ALTER TABLE `sale_customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sale_items`
--

DROP TABLE IF EXISTS `sale_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sale_items` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `sale_id` int unsigned NOT NULL,
  `material_id` int unsigned NOT NULL,
  `material_name` varchar(100) NOT NULL,
  `kg` decimal(9,3) NOT NULL,
  `unit_price` decimal(8,2) NOT NULL,
  `subtotal` decimal(11,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sale_id` (`sale_id`),
  KEY `material_id` (`material_id`),
  CONSTRAINT `sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`),
  CONSTRAINT `sale_items_ibfk_2` FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`),
  CONSTRAINT `sale_items_chk_1` CHECK ((`kg` > 0)),
  CONSTRAINT `sale_items_chk_2` CHECK ((`unit_price` > 0)),
  CONSTRAINT `sale_items_chk_3` CHECK ((`subtotal` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sale_items`
--

LOCK TABLES `sale_items` WRITE;
/*!40000 ALTER TABLE `sale_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `sale_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sale_receipts`
--

DROP TABLE IF EXISTS `sale_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sale_receipts` (
  `sale_id` int unsigned NOT NULL,
  `movement_id` int unsigned NOT NULL,
  PRIMARY KEY (`sale_id`),
  UNIQUE KEY `movement_id` (`movement_id`),
  CONSTRAINT `sale_receipts_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`),
  CONSTRAINT `sale_receipts_ibfk_2` FOREIGN KEY (`movement_id`) REFERENCES `cash_movements` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sale_receipts`
--

LOCK TABLES `sale_receipts` WRITE;
/*!40000 ALTER TABLE `sale_receipts` DISABLE KEYS */;
/*!40000 ALTER TABLE `sale_receipts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales`
--

DROP TABLE IF EXISTS `sales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `request_id` char(36) NOT NULL,
  `fingerprint` char(64) NOT NULL,
  `customer_name` varchar(120) NOT NULL,
  `user_id` int unsigned NOT NULL,
  `total` decimal(11,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `request_id` (`request_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `sales_chk_1` CHECK ((`total` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales`
--

LOCK TABLES `sales` WRITE;
/*!40000 ALTER TABLE `sales` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `token_hash` char(64) NOT NULL,
  `user_id` int unsigned NOT NULL,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`token_hash`),
  KEY `user_id` (`user_id`),
  KEY `expires_at` (`expires_at`),
  CONSTRAINT `sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES ('7e34a6bd2c44787ca9c8affd38276b1b80cb2e119c4226fc41319e30b868a976',1,'2026-10-13 04:57:40');
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `document` varchar(20) NOT NULL DEFAULT '',
  `phone` varchar(30) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_management_lock`
--

DROP TABLE IF EXISTS `user_management_lock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_management_lock` (
  `id` tinyint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_management_lock`
--

LOCK TABLES `user_management_lock` WRITE;
/*!40000 ALTER TABLE `user_management_lock` DISABLE KEYS */;
INSERT INTO `user_management_lock` VALUES (1);
/*!40000 ALTER TABLE `user_management_lock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(80) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `must_change_password` tinyint(1) NOT NULL DEFAULT '0',
  `role` enum('admin','operator') NOT NULL DEFAULT 'operator',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','$2b$12$hFMSLYBCAreyKHEzqr0qkeeTgPettFLdHDNk8lgq0/6uNW1WtItr6',1,0,'admin','2026-10-10 03:11:39');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-12 16:02:25
