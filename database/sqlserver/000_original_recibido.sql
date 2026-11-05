/*
    ALUFORMIX - instalación segura para Microsoft SQL Server 2016+
    Ejecutar el bloque completo una sola vez.
    Si el esquema ya existe, termina sin modificarlo.
*/

USE [master];
GO

IF DB_ID(N'aluformix') IS NULL
BEGIN
    CREATE DATABASE [aluformix];
END;
GO

EXEC sys.sp_executesql N'
USE [aluformix];

IF OBJECT_ID(N''dbo.schema_versions'', N''U'') IS NOT NULL
BEGIN
    PRINT N''La base aluformix ya contiene el esquema; no se realizaron cambios.'';
    RETURN;
END;

CREATE TABLE dbo.schema_versions (
    version INT NOT NULL CONSTRAINT PK_schema_versions PRIMARY KEY,
    applied_at DATETIME2(0) NOT NULL
        CONSTRAINT DF_schema_versions_applied_at DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE dbo.roles (
    id TINYINT NOT NULL CONSTRAINT PK_roles PRIMARY KEY,
    name NVARCHAR(30) NOT NULL CONSTRAINT UQ_roles_name UNIQUE
);

INSERT INTO dbo.roles (id, name)
VALUES (1, N''Administrador''), (2, N''Operador''), (3, N''Cliente'');

CREATE TABLE dbo.users (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
    role_id TINYINT NOT NULL,
    name NVARCHAR(120) NOT NULL,
    email NVARCHAR(254) NOT NULL,
    password_hash NVARCHAR(512) NOT NULL,
    active BIT NOT NULL CONSTRAINT DF_users_active DEFAULT (1),
    created_at DATETIME2(0) NOT NULL
        CONSTRAINT DF_users_created_at DEFAULT (SYSUTCDATETIME()),
    failed_login_attempts INT NOT NULL
        CONSTRAINT DF_users_failed_login_attempts DEFAULT (0),
    locked_until DATETIME2(6) NULL,
    CONSTRAINT UQ_users_email UNIQUE (email),
    CONSTRAINT FK_users_roles FOREIGN KEY (role_id) REFERENCES dbo.roles(id),
    CONSTRAINT CK_users_failed_login_attempts CHECK (failed_login_attempts >= 0),
    CONSTRAINT CK_users_name CHECK (LEN(LTRIM(RTRIM(name))) > 0)
);

CREATE TABLE dbo.customers (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_customers PRIMARY KEY,
    user_id BIGINT NULL,
    name NVARCHAR(120) NOT NULL,
    phone NVARCHAR(25) NOT NULL,
    email NVARCHAR(254) NULL,
    business_name NVARCHAR(160) NULL,
    tax_id NVARCHAR(13) NULL,
    address NVARCHAR(500) NULL,
    created_at DATETIME2(0) NOT NULL
        CONSTRAINT DF_customers_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_customers_user_id UNIQUE (user_id),
    CONSTRAINT FK_customers_users FOREIGN KEY (user_id) REFERENCES dbo.users(id),
    CONSTRAINT CK_customers_name CHECK (LEN(LTRIM(RTRIM(name))) > 0),
    CONSTRAINT CK_customers_phone CHECK (LEN(LTRIM(RTRIM(phone))) > 0)
);

CREATE TABLE dbo.categories (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_categories PRIMARY KEY,
    name NVARCHAR(80) NOT NULL CONSTRAINT UQ_categories_name UNIQUE
);

CREATE TABLE dbo.products (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_products PRIMARY KEY,
    category_id INT NOT NULL,
    code NVARCHAR(40) NOT NULL,
    name NVARCHAR(150) NOT NULL,
    description NVARCHAR(MAX) NULL,
    unit NVARCHAR(30) NOT NULL,
    finish NVARCHAR(60) NOT NULL
        CONSTRAINT DF_products_finish DEFAULT (N''Natural''),
    length_mm INT NULL,
    price DECIMAL(12,2) NOT NULL,
    stock DECIMAL(12,3) NOT NULL
        CONSTRAINT DF_products_stock DEFAULT (0),
    reserved DECIMAL(12,3) NOT NULL
        CONSTRAINT DF_products_reserved DEFAULT (0),
    minimum_stock DECIMAL(12,3) NOT NULL
        CONSTRAINT DF_products_minimum_stock DEFAULT (0),
    active BIT NOT NULL CONSTRAINT DF_products_active DEFAULT (1),
    CONSTRAINT UQ_products_code UNIQUE (code),
    CONSTRAINT FK_products_categories
        FOREIGN KEY (category_id) REFERENCES dbo.categories(id),
    CONSTRAINT CK_products_price CHECK (price >= 0),
    CONSTRAINT CK_products_stock CHECK (stock >= 0),
    CONSTRAINT CK_products_reserved CHECK (reserved >= 0 AND reserved <= stock),
    CONSTRAINT CK_products_minimum CHECK (minimum_stock >= 0),
    CONSTRAINT CK_products_length CHECK (length_mm IS NULL OR length_mm > 0),
    CONSTRAINT CK_products_code_nonempty CHECK (LEN(LTRIM(RTRIM(code))) > 0),
    CONSTRAINT CK_products_name_nonempty CHECK (LEN(LTRIM(RTRIM(name))) > 0)
);

CREATE TABLE dbo.orders (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_orders PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    status NVARCHAR(20) NOT NULL
        CONSTRAINT DF_orders_status DEFAULT (N''Solicitado''),
    fulfillment NVARCHAR(10) NOT NULL
        CONSTRAINT DF_orders_fulfillment DEFAULT (N''Recoger''),
    delivery_address NVARCHAR(500) NULL,
    notes NVARCHAR(MAX) NULL,
    created_at DATETIME2(0) NOT NULL
        CONSTRAINT DF_orders_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NOT NULL
        CONSTRAINT DF_orders_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_orders_customers
        FOREIGN KEY (customer_id) REFERENCES dbo.customers(id),
    CONSTRAINT CK_orders_status CHECK (
        status IN (
            N''Solicitado'', N''Cotizado'', N''Confirmado'', N''Preparando'',
            N''Listo'', N''Entregado'', N''Cancelado''
        )
    ),
    CONSTRAINT CK_orders_fulfillment
        CHECK (fulfillment IN (N''Recoger'', N''Entrega'')),
    CONSTRAINT CK_orders_delivery_address CHECK (
        fulfillment <> N''Entrega''
        OR (
            delivery_address IS NOT NULL
            AND LEN(LTRIM(RTRIM(delivery_address))) > 0
        )
    )
);

CREATE INDEX IX_orders_status_created_at
    ON dbo.orders(status, created_at);

CREATE TABLE dbo.order_items (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_order_items PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    finish NVARCHAR(60) NOT NULL,
    cut_length_mm INT NULL,
    CONSTRAINT FK_order_items_orders
        FOREIGN KEY (order_id) REFERENCES dbo.orders(id),
    CONSTRAINT FK_order_items_products
        FOREIGN KEY (product_id) REFERENCES dbo.products(id),
    CONSTRAINT CK_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT CK_order_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT CK_order_items_cut_length
        CHECK (cut_length_mm IS NULL OR cut_length_mm > 0)
);

CREATE TABLE dbo.quotes (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_quotes PRIMARY KEY,
    order_id BIGINT NOT NULL,
    subtotal DECIMAL(14,2) NOT NULL,
    tax_rate DECIMAL(5,4) NOT NULL
        CONSTRAINT DF_quotes_tax_rate DEFAULT (0.1600),
    tax DECIMAL(14,2) NOT NULL,
    shipping DECIMAL(12,2) NOT NULL
        CONSTRAINT DF_quotes_shipping DEFAULT (0),
    total DECIMAL(14,2) NOT NULL,
    status NVARCHAR(10) NOT NULL
        CONSTRAINT DF_quotes_status DEFAULT (N''Borrador''),
    created_at DATETIME2(0) NOT NULL
        CONSTRAINT DF_quotes_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_quotes_order_id UNIQUE (order_id),
    CONSTRAINT FK_quotes_orders
        FOREIGN KEY (order_id) REFERENCES dbo.orders(id),
    CONSTRAINT CK_quotes_amounts CHECK (
        subtotal >= 0 AND tax >= 0 AND shipping >= 0 AND total >= 0
    ),
    CONSTRAINT CK_quotes_tax_rate CHECK (tax_rate BETWEEN 0 AND 1),
    CONSTRAINT CK_quotes_status CHECK (
        status IN (N''Borrador'', N''Enviada'', N''Aceptada'', N''Rechazada'')
    ),
    CONSTRAINT CK_quotes_total CHECK (total = subtotal + tax + shipping)
);

CREATE TABLE dbo.payments (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_payments PRIMARY KEY,
    quote_id BIGINT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reference NVARCHAR(120) NULL,
    recorded_by BIGINT NOT NULL,
    created_at DATETIME2(0) NOT NULL
        CONSTRAINT DF_payments_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_payments_quotes
        FOREIGN KEY (quote_id) REFERENCES dbo.quotes(id),
    CONSTRAINT FK_payments_users
        FOREIGN KEY (recorded_by) REFERENCES dbo.users(id),
    CONSTRAINT CK_payments_amount CHECK (amount > 0)
);

CREATE TABLE dbo.inventory_movements (
    id BIGINT IDENTITY(1,1) NOT NULL
        CONSTRAINT PK_inventory_movements PRIMARY KEY,
    product_id BIGINT NOT NULL,
    order_id BIGINT NULL,
    user_id BIGINT NOT NULL,
    type NVARCHAR(12) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    reason NVARCHAR(255) NOT NULL,
    created_at DATETIME2(0) NOT NULL
        CONSTRAINT DF_inventory_movements_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_inventory_movements_products
        FOREIGN KEY (product_id) REFERENCES dbo.products(id),
    CONSTRAINT FK_inventory_movements_orders
        FOREIGN KEY (order_id) REFERENCES dbo.orders(id),
    CONSTRAINT FK_inventory_movements_users
        FOREIGN KEY (user_id) REFERENCES dbo.users(id),
    CONSTRAINT CK_inventory_movements_type CHECK (
        type IN (N''Entrada'', N''Ajuste'', N''Reserva'', N''Liberacion'', N''Entrega'')
    ),
    CONSTRAINT CK_inventory_movements_quantity CHECK (quantity <> 0)
);

CREATE INDEX IX_inventory_movements_product_created_at
    ON dbo.inventory_movements(product_id, created_at);

CREATE TABLE dbo.order_history (
    id BIGINT IDENTITY(1,1) NOT NULL
        CONSTRAINT PK_order_history PRIMARY KEY,
    order_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    status NVARCHAR(30) NOT NULL,
    note NVARCHAR(500) NULL,
    created_at DATETIME2(0) NOT NULL
        CONSTRAINT DF_order_history_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_order_history_orders
        FOREIGN KEY (order_id) REFERENCES dbo.orders(id),
    CONSTRAINT FK_order_history_users
        FOREIGN KEY (user_id) REFERENCES dbo.users(id)
);

CREATE TABLE dbo.notifications (
    id BIGINT IDENTITY(1,1) NOT NULL
        CONSTRAINT PK_notifications PRIMARY KEY,
    user_id BIGINT NOT NULL,
    order_id BIGINT NULL,
    message NVARCHAR(500) NOT NULL,
    read_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL
        CONSTRAINT DF_notifications_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_notifications_users
        FOREIGN KEY (user_id) REFERENCES dbo.users(id),
    CONSTRAINT FK_notifications_orders
        FOREIGN KEY (order_id) REFERENCES dbo.orders(id)
);

CREATE TABLE dbo.auth_sessions (
    id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_auth_sessions PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash CHAR(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
    created_at DATETIME2(6) NOT NULL
        CONSTRAINT DF_auth_sessions_created_at DEFAULT (SYSUTCDATETIME()),
    expires_at DATETIME2(6) NOT NULL,
    revoked_at DATETIME2(6) NULL,
    CONSTRAINT UQ_auth_sessions_token_hash UNIQUE (token_hash),
    CONSTRAINT FK_auth_sessions_users
        FOREIGN KEY (user_id) REFERENCES dbo.users(id)
);

CREATE INDEX IX_auth_sessions_user
    ON dbo.auth_sessions(user_id);

CREATE TABLE dbo.password_reset_tokens (
    id BIGINT IDENTITY(1,1) NOT NULL
        CONSTRAINT PK_password_reset_tokens PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash CHAR(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
    expires_at DATETIME2(6) NOT NULL,
    used_at DATETIME2(6) NULL,
    CONSTRAINT UQ_password_reset_tokens_hash UNIQUE (token_hash),
    CONSTRAINT FK_password_reset_tokens_users
        FOREIGN KEY (user_id) REFERENCES dbo.users(id)
);

CREATE INDEX IX_password_reset_tokens_user
    ON dbo.password_reset_tokens(user_id);

INSERT INTO dbo.schema_versions (version)
VALUES (1), (2), (3);

PRINT N''Base Aluformix creada correctamente.'';

SELECT MAX(version) AS schema_version
FROM dbo.schema_versions;

SELECT COUNT(*) AS table_count
FROM sys.tables
WHERE schema_id = SCHEMA_ID(N''dbo'');

SELECT id, name
FROM dbo.roles
ORDER BY id;
';
GO