# Registro 16 — Revisión de seguridad

Fecha de revisión 5 de noviembre de 2026.

Se revisaron autenticación, control de permisos, consultas parametrizadas, transacciones, sesiones móviles, HTTPS, almacenamiento seguro, notificaciones, configuración y dependencias. Durante la revisión se incorporó la nueva base SQL Server solicitada por el usuario.

## Hallazgos corregidos

1. El contador de intentos de autenticación usaba la ruta sin normalizar. Express aceptaba variantes de mayúsculas y barra final que creaban contadores distintos. Se normalizaron las rutas y se agruparon las desconocidas. Las variantes conservan el mismo límite de 20 intentos por minuto e IP.
2. Las rutas de negocio carecían de un límite general. Se añadieron límites de 300 solicitudes por minuto e IP, 300 lecturas por usuario y 120 operaciones de escritura por usuario. Los mapas de contadores tienen capacidad máxima y caducidad. La configuración conserva trust proxy=false para impedir suplantación mediante X-Forwarded-For.
3. Una respuesta 401 atrasada, un acceso anterior o un cierre de sesión pendiente podían borrar una sesión nueva en el cliente. Se serializaron las operaciones del almacenamiento y se comprueba qué generación y token se pueden limpiar. Los accesos reemplazados revocan su propio token.
4. La recuperación dependía del límite de IP. Se añadió una espera de un minuto por cuenta dentro de una transacción con bloqueo y se limitó el trabajo simultáneo de recuperación. Se mantiene la respuesta genérica.
5. En el SQL recibido, la restricción UNIQUE de customers.user_id admite un solo NULL en SQL Server. Se reemplazó por un índice único filtrado para clientes con cuenta. La instalación y la ampliación se coordinan y usan transacciones.

## Protecciones comprobadas

Contraseñas con scrypt y compatibilidad del hash anterior, tokens aleatorios de 256 bits almacenados como huella en el servidor, revocación y caducidad, validación de campos, comprobación de propietario, permisos de Cliente/Operador/Administrador, consultas con parámetros, control de importes y bloqueo de reservas y pagos. Las apps conservan SecureStore y políticas nativas para restringir HTTP.

El nuevo controlador SQL Server obliga a cifrar y validar el certificado. Rechaza sa/root como cuenta de aplicación. Los identificadores respetan BIGINT con signo y se normalizan a texto. Los decimales se devuelven con su escala y se rechazan resultados que superarían la precisión recuperable. Las operaciones comerciales usan parámetros y bloqueos SQL Server, incluyendo sp_getapplock para operaciones coordinadas.

## Evidencia disponible

25 pruebas de JavaScript y componentes correctas. Incluyen tres regresiones de sesiones concurrentes, límites de solicitudes, configuración TLS del controlador y estructura SQL Server.

137 comprobaciones HTTPS con MySQL aislado correctas en .test-artifacts/js-170fe2b3327d43209697a748a3ce3c32/result.txt. Verifican permisos, inyección tratada como datos, cuotas y estados, duplicados, códigos de un uso, revocación, bloqueo, variantes de rutas, encabezados de IP y espera de recuperación.

npm audit reportó cero avisos conocidos para las dependencias instaladas. El resultado se conserva en .test-artifacts/npm-audit-security-sqlserver.json. Las pruebas con SQL Server y la versión final del motor se registran en el avance 17.

## Límites de la revisión

La comprobación de dispositivos físicos y almacenamiento nativo sigue pendiente. Faltan proveedores reales para correo, IA y notificaciones. Las cuentas todavía carecen de verificación de correo y segundo factor. La publicación para teléfonos requiere una URL HTTPS confiable y una revisión del despliegue. La revisión es de código y pruebas locales, con pruebas de proveedores simulados donde corresponde.

Las imágenes de código entregadas el 4 de noviembre corresponden a la revisión anterior a estas correcciones.

## Referencias consultadas

OWASP Authentication Cheat Sheet, https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
OWASP MASVS, https://mas.owasp.org/MASVS/
Controlador node-mssql, https://github.com/tediousjs/node-mssql
Índices filtrados SQL Server, https://learn.microsoft.com/en-us/sql/relational-databases/tables/create-unique-constraints
Certificados SQL Server, https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/certificate-requirements
