# Registro 03 — Instalación y evidencias en Workbench

Fecha: 28 de octubre de 2026.

El usuario instaló MySQL Workbench 26.10.0 y completó personalmente la autenticación con MySQL Community Server 8.4.13. Se verificó el estado Connected para root@localhost:3306.

Antes de crear tablas, se consultó information_schema.SCHEMATA y no se encontró aluformix. Se ejecutó una sola vez la combinación de 001_schema.sql, 003_integrity.sql y 002_demo.sql. Workbench confirmó 30 sentencias correctas. No se eliminaron ni modificaron los otros esquemas de la instalación.

Validaciones observadas: consulta de tablas devuelve 13 registros; consulta de productos devuelve 4 materiales ficticios; consulta de claves foráneas devuelve 16 relaciones. Se guardaron las capturas y su texto de accesibilidad bajo outputs/Aluformix/evidencia-base-datos, archivos 03 a 06. La explicación por captura está en explicacion-workbench.md.

Pendiente: configurar la API contra esta instalación con una cuenta de aplicación y permisos limitados. Las pruebas de integración previas usaron instancias aisladas; la conexión actual de Workbench no prueba por sí sola la conexión de la app móvil o de la API al servidor permanente. No se manejó ni registró la contraseña del usuario. No se ha confirmado respaldo de este avance en GitHub.
