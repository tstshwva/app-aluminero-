USE [aluformix];
GO
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
BEGIN TRY
BEGIN TRANSACTION;
DECLARE @lock INT;
EXEC @lock=sys.sp_getapplock @Resource=N'aluformix_schema',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=5000;
IF @lock<0 THROW 51000,N'No se pudo bloquear la migración.',1;
IF (SELECT MAX(version) FROM dbo.schema_versions)=4 BEGIN COMMIT; RETURN; END;
IF (SELECT MAX(version) FROM dbo.schema_versions)<>3 THROW 51001,N'Se esperaba el esquema versión 3.',1;
IF EXISTS(SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.customers') AND name=N'UQ_customers_user_id')
 ALTER TABLE dbo.customers DROP CONSTRAINT UQ_customers_user_id;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.customers') AND name=N'UQ_customers_user_id')
 CREATE UNIQUE INDEX UQ_customers_user_id ON dbo.customers(user_id) WHERE user_id IS NOT NULL;
ALTER TABLE dbo.products ADD image_url NVARCHAR(1000) NULL;
ALTER TABLE dbo.orders ADD request_key CHAR(36) COLLATE Latin1_General_100_BIN2 NULL,request_hash CHAR(64) COLLATE Latin1_General_100_BIN2 NULL;
EXEC sys.sp_executesql N'CREATE UNIQUE INDEX UQ_order_request ON dbo.orders(customer_id,request_key) WHERE request_key IS NOT NULL';
ALTER TABLE dbo.order_items ADD product_name NVARCHAR(150) NULL,product_code NVARCHAR(40) NULL;
EXEC sys.sp_executesql N'UPDATE i SET product_name=p.name,product_code=p.code FROM dbo.order_items i JOIN dbo.products p ON p.id=i.product_id';
ALTER TABLE dbo.order_items ALTER COLUMN product_name NVARCHAR(150) NOT NULL;
ALTER TABLE dbo.order_items ALTER COLUMN product_code NVARCHAR(40) NOT NULL;
ALTER TABLE dbo.payments ADD request_key CHAR(36) COLLATE Latin1_General_100_BIN2 NULL,request_hash CHAR(64) COLLATE Latin1_General_100_BIN2 NULL;
EXEC sys.sp_executesql N'CREATE UNIQUE INDEX UQ_payment_request ON dbo.payments(quote_id,request_key) WHERE request_key IS NOT NULL';
ALTER TABLE dbo.quotes ADD revision INT NOT NULL CONSTRAINT DF_quotes_revision DEFAULT(1),CONSTRAINT CK_quotes_revision CHECK(revision>0);
CREATE TABLE dbo.favorites(
 user_id BIGINT NOT NULL,product_id BIGINT NOT NULL,created_at DATETIME2(0) NOT NULL DEFAULT(SYSUTCDATETIME()),
 CONSTRAINT PK_favorites PRIMARY KEY(user_id,product_id),
 FOREIGN KEY(user_id) REFERENCES dbo.users(id),FOREIGN KEY(product_id) REFERENCES dbo.products(id)
);
CREATE TABLE dbo.company_settings(
 id TINYINT NOT NULL PRIMARY KEY,name NVARCHAR(160) NULL,phone NVARCHAR(25) NULL,address NVARCHAR(500) NULL,
 tax_rate DECIMAL(5,4) NOT NULL DEFAULT(0.1600),updated_at DATETIME2(0) NOT NULL DEFAULT(SYSUTCDATETIME()),
 CHECK(id=1),CHECK(tax_rate BETWEEN 0 AND 1)
);
CREATE INDEX IX_notifications_user ON dbo.notifications(user_id,id);
ALTER TABLE dbo.notifications ADD event_key CHAR(36) COLLATE Latin1_General_100_BIN2 NULL;
EXEC sys.sp_executesql N'CREATE INDEX IX_notifications_event ON dbo.notifications(event_key)';
CREATE TABLE dbo.push_devices(
 id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,user_id BIGINT NOT NULL,
 push_token VARCHAR(200) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE,
 session_hash CHAR(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
 active BIT NOT NULL DEFAULT(1),updated_at DATETIME2(0) NOT NULL DEFAULT(SYSUTCDATETIME()),
 FOREIGN KEY(user_id) REFERENCES dbo.users(id)
);
CREATE INDEX IX_push_devices_user ON dbo.push_devices(user_id,active);
CREATE TABLE dbo.push_outbox(
 id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,notification_id BIGINT NOT NULL,device_id BIGINT NOT NULL,
 status NVARCHAR(10) NOT NULL DEFAULT(N'Pendiente'),attempts TINYINT NOT NULL DEFAULT(0),
 ticket_id NVARCHAR(100) NULL,next_attempt_at DATETIME2(0) NOT NULL DEFAULT(SYSUTCDATETIME()),
 created_at DATETIME2(0) NOT NULL DEFAULT(SYSUTCDATETIME()),
 UNIQUE(notification_id,device_id),
 CHECK(status IN(N'Pendiente',N'Ticket',N'Entregada',N'Fallida',N'Omitida')),
 FOREIGN KEY(notification_id) REFERENCES dbo.notifications(id),FOREIGN KEY(device_id) REFERENCES dbo.push_devices(id)
);
CREATE INDEX IX_push_pending ON dbo.push_outbox(status,next_attempt_at);
CREATE INDEX IX_orders_customer ON dbo.orders(customer_id,id);
EXEC sys.sp_executesql N'CREATE TRIGGER dbo.TR_orders_updated ON dbo.orders AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL()>1 RETURN; UPDATE o SET updated_at=SYSUTCDATETIME() FROM dbo.orders o JOIN inserted i ON i.id=o.id; END;';
EXEC sys.sp_executesql N'CREATE TRIGGER dbo.TR_company_updated ON dbo.company_settings AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL()>1 RETURN; UPDATE o SET updated_at=SYSUTCDATETIME() FROM dbo.company_settings o JOIN inserted i ON i.id=o.id; END;';
EXEC sys.sp_executesql N'CREATE TRIGGER dbo.TR_devices_updated ON dbo.push_devices AFTER UPDATE AS BEGIN SET NOCOUNT ON; IF TRIGGER_NESTLEVEL()>1 RETURN; UPDATE o SET updated_at=SYSUTCDATETIME() FROM dbo.push_devices o JOIN inserted i ON i.id=o.id; END;';
INSERT INTO dbo.schema_versions(version) VALUES(4);
COMMIT TRANSACTION;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;
GO
