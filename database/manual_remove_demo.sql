-- NO es una migración ni parte de la instalación normal.
-- Ejecutar solo con aprobación explícita, después de comprobar y respaldar datos.
-- Si cambió cualquier dato comercial o existen operaciones, se detiene sin borrar.
USE aluformix;
DELIMITER $$
CREATE PROCEDURE remove_original_demo_guarded()
BEGIN
 DECLARE EXIT HANDLER FOR SQLEXCEPTION
 BEGIN
   ROLLBACK;
   RESIGNAL;
 END;
 START TRANSACTION;
 -- Bloquear registros comerciales originales mientras se comprueba su contenido.
 SELECT id FROM categories ORDER BY id FOR UPDATE;
 SELECT id FROM products ORDER BY id FOR UPDATE;
 SELECT id FROM customers ORDER BY id FOR UPDATE;
 IF (SELECT COUNT(*) FROM products) <> 4
 OR (SELECT COUNT(*) FROM customers) <> 1
 OR (SELECT COUNT(*) FROM categories) <> 3
 OR (SELECT COUNT(*) FROM users) <> 0
 OR (SELECT COUNT(*) FROM orders) <> 0
 OR (SELECT COUNT(*) FROM inventory_movements) <> 0
 OR (SELECT COUNT(*) FROM customers WHERE id=1 AND user_id IS NULL
     AND name='Cliente de prueba' AND phone='0000000000' AND business_name='Taller de demostración'
     AND email IS NULL AND tax_id IS NULL AND address IS NULL) <> 1
 OR (SELECT COUNT(*) FROM categories WHERE (id=1 AND name='Perfiles')
     OR (id=2 AND name='Herrajes') OR (id=3 AND name='Accesorios')) <> 3
 OR (SELECT COUNT(*) FROM products WHERE reserved=0 AND active=1 AND finish='Natural'
     AND description IS NULL AND (
       (id=1 AND category_id=1 AND code='61088' AND name='Riel de aluminio' AND unit='barra' AND price=400 AND stock=30 AND minimum_stock=5 AND length_mm=6000)
       OR (id=2 AND category_id=1 AND code='611037' AND name='Contramarco de aluminio' AND unit='barra' AND price=450 AND stock=20 AND minimum_stock=5 AND length_mm=6000)
       OR (id=3 AND category_id=2 AND code='CR-02' AND name='Carretilla para corrediza' AND unit='pieza' AND price=50 AND stock=100 AND minimum_stock=20 AND length_mm IS NULL)
       OR (id=4 AND category_id=3 AND code='TOR-08' AND name='Tornillo 8 x 1/2' AND unit='pieza' AND price=2 AND stock=500 AND minimum_stock=100 AND length_mm IS NULL)
     )) <> 4
 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Limpieza cancelada: los datos difieren de la carga ficticia original. Revisar manualmente.';
 END IF;
 DELETE FROM products WHERE id IN (1,2,3,4);
 DELETE FROM customers WHERE id=1;
 DELETE FROM categories WHERE id IN (1,2,3);
 COMMIT;
END$$
DELIMITER ;
CALL remove_original_demo_guarded();
DROP PROCEDURE remove_original_demo_guarded;
SELECT (SELECT COUNT(*) FROM products) AS productos,
       (SELECT COUNT(*) FROM customers) AS clientes,
       (SELECT COUNT(*) FROM categories) AS categorias;
