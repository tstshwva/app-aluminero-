USE aluformix;
ALTER TABLE products ADD COLUMN image_url VARCHAR(1000) NULL;
ALTER TABLE orders ADD COLUMN request_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD COLUMN request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD UNIQUE KEY uq_order_request(customer_id,request_key);
ALTER TABLE order_items ADD COLUMN product_name VARCHAR(150) NULL, ADD COLUMN product_code VARCHAR(40) NULL;
UPDATE order_items i JOIN products p ON p.id=i.product_id SET i.product_name=p.name,i.product_code=p.code;
ALTER TABLE order_items MODIFY product_name VARCHAR(150) NOT NULL, MODIFY product_code VARCHAR(40) NOT NULL;
ALTER TABLE payments ADD COLUMN request_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD COLUMN request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD UNIQUE KEY uq_payment_request(quote_id,request_key);
ALTER TABLE quotes ADD COLUMN revision INT UNSIGNED NOT NULL DEFAULT 1;
CREATE TABLE favorites (
 user_id BIGINT UNSIGNED NOT NULL, product_id BIGINT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,product_id),
 FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(product_id) REFERENCES products(id)
);
CREATE TABLE company_settings (
 id TINYINT UNSIGNED PRIMARY KEY, name VARCHAR(160) NULL, phone VARCHAR(25) NULL,
 address VARCHAR(500) NULL, tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0.1600,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CHECK(id=1), CHECK(tax_rate BETWEEN 0 AND 1)
);
CREATE INDEX ix_notifications_user ON notifications(user_id,id);
ALTER TABLE notifications ADD COLUMN event_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 ADD INDEX ix_notification_event(event_key);
CREATE TABLE push_devices (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
 push_token VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE push_outbox (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 notification_id BIGINT UNSIGNED NOT NULL, device_id BIGINT UNSIGNED NOT NULL,
 status ENUM('Pendiente','Ticket','Entregada','Fallida','Omitida') NOT NULL DEFAULT 'Pendiente',
 attempts TINYINT UNSIGNED NOT NULL DEFAULT 0, ticket_id VARCHAR(100) NULL,
 next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_push_notice(notification_id,device_id),
 INDEX ix_push_pending(status,next_attempt_at),
 FOREIGN KEY(notification_id) REFERENCES notifications(id), FOREIGN KEY(device_id) REFERENCES push_devices(id)
);
CREATE INDEX ix_orders_customer ON orders(customer_id,id);
INSERT INTO schema_versions(version) VALUES(4);
