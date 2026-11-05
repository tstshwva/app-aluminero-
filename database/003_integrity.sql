-- Migración de versión 1 a 2. Aplicar una sola vez después de 001_schema.sql.
-- MySQL confirma DDL automáticamente: respaldar y revisar datos antes de aplicar a una base real.
USE aluformix;
ALTER TABLE products
 ADD CONSTRAINT ck_products_minimum CHECK (minimum_stock >= 0),
 ADD CONSTRAINT ck_products_length CHECK (length_mm IS NULL OR length_mm > 0),
 ADD CONSTRAINT ck_products_code CHECK (CHAR_LENGTH(TRIM(code)) > 0),
 ADD CONSTRAINT ck_products_name CHECK (CHAR_LENGTH(TRIM(name)) > 0);
ALTER TABLE customers
 ADD CONSTRAINT ck_customers_name CHECK (CHAR_LENGTH(TRIM(name)) > 0),
 ADD CONSTRAINT ck_customers_phone CHECK (CHAR_LENGTH(TRIM(phone)) > 0);
ALTER TABLE orders
 ADD CONSTRAINT ck_orders_delivery_address CHECK (fulfillment <> 'Entrega' OR CHAR_LENGTH(TRIM(delivery_address)) > 0);
ALTER TABLE order_items
 ADD CONSTRAINT ck_items_cut_length CHECK (cut_length_mm IS NULL OR cut_length_mm > 0);
ALTER TABLE quotes
 ADD CONSTRAINT ck_quotes_total CHECK (total = subtotal + tax + shipping);
INSERT INTO schema_versions(version) VALUES (2);
