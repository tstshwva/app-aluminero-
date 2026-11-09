# Aluformix — JavaScript

**Actualización del 5 de noviembre de 2026.** El proveedor actual es SQL Server. La base recibida y sus ampliaciones están en database/sqlserver. La conexión local se verifica con scripts/verificar-sqlserver.js. Los apartados anteriores sobre MySQL se conservan como referencia de la implementación previa y de su compatibilidad. La revisión de seguridad está en docs/registro-16-revision-seguridad.md.

Dos aplicaciones independientes: **Cliente** (comprador) y **Empresa** (administrador/operador). React Native + Expo SDK 58, JavaScript/JSX, Node.js 24 + Express 5 y MySQL 8.4. El proyecto está fuera de Codex y utiliza las herramientas portátiles de la carpeta hermana Aluformix-herramientas.

## Funciones implementadas

**Cliente:** registro y acceso, recuperación y cambio de contraseña, perfil y datos del taller, búsqueda y categorías del catálogo, detalle e imagen HTTPS de productos, favoritos, carrito en memoria, solicitud de recogida o entrega, cotización con impuestos y envío, aceptación con reserva de material, historial y seguimiento, cancelación antes de confirmar, repetición del encargo, compartir detalle, avisos internos y ayuda.

**Empresa:** acceso con roles, clientes y alta básica, alta/edición/desactivación de productos y categorías nuevas, precios, imágenes por URL HTTPS, entradas y movimientos de inventario, ajustes solo para administrador, alertas de existencias bajas, encargos de clientes, cotizaciones por partida, preparación y entrega, registro de pagos recibidos, configuración de sucursal e impuesto y creación de cuentas de personal por administrador. Puede registrar solicitudes y la aceptación comunicada por clientes sin cuenta; los compradores con cuenta aceptan desde su propia app.

**Cámara:** permiso explícito y lectura de QR/código de barras para buscar el código del material. No calcula medidas ni extrae listas de una fotografía.

**IA:** consulta a Gemini desde el servidor con pregunta y hasta 50 productos del catálogo. Solo orienta; no cambia compras, inventario ni precios. Necesita GEMINI_API_KEY y GEMINI_MODEL configurados externamente. Sin servicio responde como no disponible.

**Notificaciones del teléfono:** registro voluntario del dispositivo, cola persistida, envío por Expo, reintentos, consulta de recibos y descarte de sesiones no vigentes. Faltan configurar proyectos/credenciales y probar entrega física. Los avisos internos funcionan mediante consultas autenticadas y actualización manual.

## Archivos principales

- apps/cliente y apps/empresa: entradas y configuración nativa independiente.
- packages/mobile/src/App.js: acceso y sesiones.
- packages/mobile/src/BusinessApp.js: pantallas y acciones de los módulos del negocio.
- packages/mobile/src/Scanner.js: cámara para códigos.
- packages/mobile/src/push.js: permisos y registro de notificaciones.
- packages/mobile/src/storage.js: sesión en SecureStore, sin contraseña persistida.
- packages/client/src/index.js: cliente HTTPS compartido.
- server/src/app.js: autenticación, permisos y rutas base.
- server/src/business.js: operaciones del negocio y transacciones.
- server/src/amounts.js: cálculo decimal exacto con BigInt y redondeo a centavos.
- server/src/auth.js y crypto.js: cuentas, hashes y sesiones.
- server/src/database.js: MySQL y transacciones con consultas preparadas.
- server/src/assistant.js: conexión de IA, sin claves en la app.
- server/src/push.js: cola de envío y recibos de notificaciones.
- database/005_business.sql: migración nueva de versión 3 a 4.

## Ejecución

```powershell
./scripts/configurar.ps1 -Preparar
./iniciar.ps1 -Accion test
./iniciar.ps1 -Accion api
./iniciar.ps1 -Accion cliente
./iniciar.ps1 -Accion empresa
```

Cada app necesita su propio proceso de Metro. En otra computadora con Node.js compatible se puede usar npm ci y npm run api/cliente/empresa. npm run config:check revisa la configuración sin mostrar secretos. Los archivos .env están excluidos de Git.

## Ver las apps en el teléfono sin servidor (modo demostración)

Escribe `EXPO_PUBLIC_DEMO=1` en `apps/cliente/.env` y en `apps/empresa/.env`. Ejecuta `./iniciar.ps1 -Accion cliente` o `empresa` y abre el código QR con Expo Go. En la pantalla de acceso sirve cualquier correo y contraseña. La app usa datos de ejemplo en memoria y muestra un aviso de «Modo demostración». Para uso real deja la variable vacía; `npm run config:check` lo comprueba. Detalles en docs/registro-19-modo-demostracion.md.

## Base de datos

**La API nueva exige esquema versión 4.** La base local real todavía no se migró durante este avance: falta ejecutar la migración con acceso autorizado a MySQL. No ejecutar 001_schema.sql sobre una base existente.

Base nueva: 001_schema.sql → 003_integrity.sql → 004_authentication.sql → 005_business.sql. manual_remove_demo.sql es histórico y no forma parte de la instalación.

Base existente versión 3: utilizar scripts/migrar-base.ps1 con la ruta de mysql.exe y mysqldump.exe. Sin -Aplicar solo comprueba compatibilidad. Con -Aplicar genera primero un respaldo local en database/backups y su SHA-256, aplica exclusivamente 005 y verifica la versión. La contraseña se introduce en el equipo, no en el chat. MySQL confirma DDL automáticamente: ante un fallo parcial no volver a ejecutar sin revisar y recuperar el respaldo.

La cuenta de la API requiere SELECT, INSERT, UPDATE y DELETE sobre aluformix.*. No utilizar root en la API. El esquema nuevo conserva datos previos y añade favoritos, configuración de empresa, dispositivos y cola de notificaciones: 19 tablas en total. Añade imágenes de productos, claves de reintento, revisión de cotización y nombres/códigos históricos de las partidas.

## Reglas de encargos e inventario

Solicitado → Cotizado → Confirmado → Preparando → Listo → Entregado. La API valida cada transición. La cotización se acepta indicando su revisión; si cambió, el comprador debe actualizarla. Al aceptar se bloquean y reservan existencias dentro de una transacción. Al entregar se descuentan y se libera la reserva. Al cancelar un encargo confirmado sin pagos se libera la reserva. No se cancela un encargo entregado ni uno con pagos pendientes de resolver. Reembolsos no forman parte de esta implementación.

Enviar solicitud y registrar pagos usan identificadores de operación para que un reintento no duplique el movimiento. Los precios se toman del servidor; la empresa cotiza las partidas. Los nombres y códigos históricos se conservan aunque luego se edite el catálogo.

Los pagos son registros de dinero ya recibido fuera de la app. No existe una pasarela de cobro. Cantidades representan la presentación vendida (barra/pieza/etc.); el corte opcional en mm es una indicación y no recalcula automáticamente el consumo ni las tarifas de fabricación.

## Servicios externos y teléfono

API .env: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL_CA si MySQL es remoto, TLS_KEY_PATH, TLS_CERT_PATH y PORT. Escucha en 127.0.0.1 y exige HTTPS; se necesita una publicación HTTPS confiable y accesible para el teléfono. No hay alternativa HTTP ni excepción a la verificación TLS.

Correo: SMTP_HOST, SMTP_PORT 587/465, SMTP_USER, SMTP_PASSWORD y SMTP_FROM. Sin proveedor la recuperación no se simula. Primer administrador: SETUP_ADMIN_KEY aleatoria de al menos 32 caracteres y SETUP_ADMIN_NAME; retirar la clave al terminar la configuración protegida.

Cada app tiene su propio .env: EXPO_PUBLIC_API_URL (URL pública HTTPS terminada en /) y EXPO_PUBLIC_EAS_PROJECT_ID (proyecto Expo de esa app). Son valores públicos; ninguna contraseña o clave de API debe usar el prefijo EXPO_PUBLIC_.

Push requiere proyectos Expo y credenciales FCM/APNs, una compilación propia, permisos del teléfono y PUSH_ENABLED=true en el servidor. Si el proyecto activa seguridad de Expo Push, configurar EXPO_ACCESS_TOKEN solo en el servidor. Un recibo de proveedor exitoso no demuestra que la persona haya visto el aviso. Mensajes de pantalla bloqueada son genéricos, sin nombres, domicilios ni importes.

## Validación y límites

Pruebas de autenticación, cantidades, IA con proveedor simulado, componentes de las dos interfaces y API HTTPS contra MySQL aislado. Los usuarios/productos de estas pruebas solo existen en la instancia temporal. Se comprueba conservación de datos versión 3 y concurrencia de reservas. Los paquetes JavaScript de Android/iOS no equivalen a un APK ni a una instalación probada.

Los listados muestran hasta 100 registros por consulta; falta paginación para volúmenes mayores. Carrito en memoria: no persiste al cerrar o reinstanciar la pantalla de negocio. Las imágenes se cargan desde URL HTTPS, no hay carga de fotos al servidor. No hay facturación fiscal, pasarela, reembolsos, verificación del correo ni medición automática/OCR de listas. Estas extensiones requieren definir reglas adicionales.

Pendiente para uso real: migrar MySQL local con respaldo, configurar credenciales/certificados y dirección HTTPS, habilitar correo/IA/push, crear el primer administrador real, instalar y comprobar ambas apps en teléfonos y respaldar la versión actual en GitHub. Registros históricos C# y sus imágenes se conservan como evidencia anterior, no como código vigente.

## Conectar primero en esta computadora

Abrir PowerShell local y ejecutar `./scripts/conectar-local.ps1` desde el proyecto. Aparece un formulario: introducir la contraseña de root de MySQL únicamente allí y pulsar **Respaldar y conectar**. Se respalda/migra, configura una cuenta limitada, prepara certificado localhost sin instalar confianza y comprueba la API. El archivo `.local/conexion-estado.json` registra el resultado sin secretos. Si un navegador advierte de ese certificado, no saltar la advertencia: todavía falta preparar una URL/certificado adecuados para el teléfono. Este paso no configura proveedores externos ni crea un administrador ficticio.
