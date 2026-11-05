# Avance 17: SQL Server y conexión local

Fecha: 5 de noviembre de 2026.
Proyecto: C:\Users\Reyca\Documents\Aluformix.

## Resultado comprobado

Se instaló SQL Server 2022 Express, instancia ALUFORMIX, como servicio automático de Windows. La versión comprobada es 16.0.4295.3 (CU27). La base aluformix tiene 19 tablas y esquema versión 4. La API responde en https://localhost:5180 y usa la nueva base.

La actualización CU27 terminó con código 3010, que solicita reinicio. El parche posterior KB5126934 está descargado y firmado por Microsoft, pero su instalador se detuvo porque Windows requiere reiniciarse antes de continuar. Ese parche todavía NO está aplicado. No se forzó el reinicio ni se omitieron las comprobaciones del instalador.

## Archivos y función

- database/sqlserver/000_original_recibido.sql: copia del documento SQL recibido, conservada para comparación. SHA256: 5153EC5FA328960C7349FE2E32987DB2D53F21FE5DFAE1A3E73E0EB796CA378D.
- database/sqlserver/001_schema.sql: instalación del esquema recibido, con manejo transaccional de errores y unicidad filtrada para campos opcionales.
- database/sqlserver/005_business.sql: adapta ese esquema a las funciones existentes. Añade favoritos, configuración de empresa, dispositivos y cola de notificaciones; conserva revisiones de cotizaciones, datos históricos de artículos y claves para evitar encargos duplicados. La instalación final tiene 19 tablas.
- server/src/sqlserver.js: controlador con parámetros, transacciones, bloqueos y validación TLS. Convierte las consultas internas compatibles al dialecto SQL Server sin concatenar valores del usuario.
- server/src/database.js: selecciona el proveedor y coordina conexiones y bloqueos. MySQL permanece como compatibilidad; la configuración real selecciona SQL Server.
- scripts/preparar-sqlserver.ps1: configura la instancia local, certificado, permisos limitados y esquema. Guarda los secretos fuera del código y restringe permisos de los archivos locales.
- scripts/verificar-sqlserver.js: comprueba versión del esquema, número de tablas, conexión cifrada y que la cuenta de API no pueda administrar el servidor ni modificar roles.
- tests/SqlServer-Integration.ps1: crea una base temporal independiente para las pruebas y elimina exclusivamente esos recursos temporales al terminar.

## Seguridad de la conexión

TCP está configurado únicamente para las direcciones de retorno local y el puerto 14330. No se abrió acceso remoto ni se añadió una regla de firewall pública. El controlador exige cifrado y valida el certificado; no utiliza trustServerCertificate como excepción. La API usa una cuenta SQL de permisos limitados, distinta de sa y del administrador de Windows.

Las contraseñas y claves quedan en .env y .local con permisos restringidos; no se incluyen aquí ni en imágenes o repositorios. La API solo escucha en 127.0.0.1 y utiliza HTTPS. Esta configuración todavía no permite conectar un teléfono externo directamente.

No se cargaron productos, clientes o encargos ficticios en la base real. Las pruebas utilizan bases aisladas. Los datos existentes de MySQL no se eliminaron ni se transfirieron automáticamente: cualquier traslado de información real requiere revisar los datos y planificar su migración.

## Validación

- 133 comprobaciones HTTPS y SQL Server correctas: .test-artifacts/alu_test_a3992ce5bb614676aca8dc93389c5d29/result.txt.
- 137 comprobaciones con MySQL aislado correctas para conservar compatibilidad: .test-artifacts/js-170fe2b3327d43209697a748a3ce3c32/result.txt.
- 25 pruebas de JavaScript, componentes y configuración correctas.
- npm audit: cero avisos conocidos en el resultado conservado en .test-artifacts/npm-audit-security-sqlserver.json. Esto no garantiza ausencia de vulnerabilidades.
- Exportaciones Hermes de Cliente y Empresa para Android e iOS completadas. Se revisaron seis archivos exportados y no se encontraron las credenciales reales del servidor.
- Verificación local final: proveedor sqlserver, esquema 4, 19 tablas, cifrado activo; API HTTPS en ejecución.

Las exportaciones son paquetes JavaScript, no aplicaciones instaladas ni pruebas en teléfonos físicos. Las pruebas de correo, IA y notificaciones que requieren proveedor utilizan simulaciones cuando corresponde.

## Pendiente para continuar

1. Guardar el trabajo y reiniciar Windows manualmente. Después aplicar KB5126934 y volver a comprobar versión y conexión.
2. Crear la primera cuenta administradora real mediante el flujo de configuración protegido.
3. Configurar correo, IA y notificaciones con proveedores reales y comprobarlos.
4. Preparar una dirección HTTPS confiable para dispositivos y probar ambas apps en teléfonos. Añadir verificación de correo y evaluar segundo factor antes de publicar.

El servicio SQL arranca automáticamente. La API Node iniciada para la verificación es un proceso local de desarrollo y deberá iniciarse nuevamente después del reinicio.
