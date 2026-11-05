-- Versión 3. Aplicar una sola vez después de 003_integrity.sql.
USE aluformix;
ALTER TABLE users
 ADD COLUMN failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
 ADD COLUMN locked_until DATETIME(6) NULL;
CREATE TABLE auth_sessions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL,
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 created_at DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
 expires_at DATETIME(6) NOT NULL, revoked_at DATETIME(6) NULL,
 FOREIGN KEY(user_id) REFERENCES users(id), INDEX ix_sessions_user(user_id)
);
CREATE TABLE password_reset_tokens (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL,
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 expires_at DATETIME(6) NOT NULL, used_at DATETIME(6) NULL,
 FOREIGN KEY(user_id) REFERENCES users(id), INDEX ix_reset_user(user_id)
);
INSERT INTO schema_versions(version) VALUES(3);
