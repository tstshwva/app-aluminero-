# SQL Server de Aluformix

El esquema proviene del archivo entregado el 5 de noviembre de 2026. El motor activo de la API se selecciona con DB_PROVIDER=sqlserver.

- 000_original_recibido.sql conserva exactamente el archivo recibido para comparar las adaptaciones.
- 001_schema.sql instala las 15 tablas iniciales y las versiones 1, 2 y 3. Añade una transacción de instalación y corrige la unicidad de customers.user_id mediante un índice filtrado para admitir varios clientes sin cuenta.
- 005_business.sql amplía a versión 4 y 19 tablas. Conserva datos anteriores, completa nombres/códigos históricos de partidas y agrega las funciones comerciales que utiliza la app.

Para una base nueva se ejecutan 001 y después 005. El archivo original se conserva como referencia. Las migraciones incluyen control de versión y la ampliación usa un bloqueo de aplicación para coordinar ejecuciones simultáneas. Las columnas nuevas que se usan en índices y actualizaciones se resuelven mediante lotes dinámicos controlados dentro de la transacción de migración.

La instancia local se llama ALUFORMIX y utiliza localhost, puerto 14330. La aplicación usa una cuenta SQL independiente con permisos de lectura y operaciones sobre las tablas comerciales. Los roles y las versiones del esquema quedan protegidos frente a modificaciones de esa cuenta. La eliminación se concede solo para favoritos.

scripts/preparar-sqlserver.ps1 configura el certificado del motor, el permiso del servicio sobre su clave, escucha loopback, autenticación de la cuenta de aplicación y la instalación de tablas. La administración local usa autenticación de Windows mediante memoria compartida. La API usa TCP cifrado y valida el certificado con la CA pública local indicada en DB_SSL_CA. La clave y la contraseña se guardan en configuración local protegida.

scripts/verificar-sqlserver.js comprueba conexión, versión 4, 19 tablas y ausencia de permisos de administrador, ALTER de base y modificación de roles. El controlador exige encrypt=true y trustServerCertificate=false.

Pruebas completas con tests/SqlServer-Integration.ps1. Crean una base y un login temporales con nombres aleatorios, aplican migraciones y ejecutan el recorrido de API por HTTPS. Al terminar se eliminan exclusivamente esa base y ese login.

La migración de datos desde una base MySQL existente necesita un proceso de exportación y conciliación propio. La API conserva el proveedor mysql para compatibilidad y pruebas del trabajo anterior.
