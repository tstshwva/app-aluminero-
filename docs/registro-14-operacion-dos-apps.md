# Registro 14 — Encargos y operación de las dos apps

Fecha de trabajo: 1 de noviembre de 2026, zona America/Mexico_City.

## Resultado

Se implementó el flujo Cliente → solicitud → cotización de Empresa → aceptación y reserva → preparación → listo → entrega, con lectura de historial y pagos. Las dos apps comparten componentes pero conservan identificadores y roles independientes. El código continúa en C:\Users\Reyca\Documents\Aluformix, fuera de Codex.

## Cambios de base de datos

Archivo database/005_business.sql, migración de versión 3 a 4. Se mantienen todas las tablas anteriores y los datos. Se añaden favorites, company_settings, push_devices y push_outbox: 19 tablas en total. Se amplían productos con imagen HTTPS, encargos/pagos con identificador y huella para reintentos, cotizaciones con revisión y partidas con nombre/código históricos. La migración rellena las partidas anteriores usando el catálogo existente. No puede reconstruir un nombre que ya hubiera cambiado antes de esta migración.

Scripts/migrar-base.ps1 revisa compatibilidad y, con -Aplicar, crea primero un respaldo SQL local con SHA-256. No inicia DDL si falla el respaldo. MySQL confirma DDL automáticamente: no se presenta como una migración atómica ni como un respaldo cuya restauración ya se haya probado.

**La base MySQL real todavía no fue migrada.** No se conoce ni se extrajo la contraseña de root; la persona responsable debe introducirla localmente. No se crearon cuentas ni productos de demostración en esa base. El SQL se probó sobre MySQL temporal aislado, incluyendo datos anteriores a versión 4 para verificar conservación de importes, existencias, reservas y partidas.

## App Cliente

Catálogo y categorías, detalle de material con imagen, presentación, acabado, precio y medida; favoritos; carrito con cantidad/corte y eliminación; revisión de solicitud y datos de contacto; recogida o dirección de entrega; envío y confirmación; listado por estado; detalle, historial y actualización de seguimiento; revisión y aceptación de cotización; cancelación antes de confirmar; repetición y compartir texto del detalle; perfil, contraseña, avisos internos, ayuda y datos de sucursal.

## App Empresa

Resumen de encargos y existencias bajas; alta básica de clientes; solicitud para cliente sin cuenta; alta/edición/desactivación de productos; categorías nuevas; imagen por URL HTTPS; entradas e historial de inventario; ajuste de existencia para administrador; cotización de cada partida con impuesto y envío; registro de aceptación de cliente sin cuenta; estados de preparación y entrega; pagos ya recibidos con referencia; configuración de sucursal e impuesto; creación de personal para administrador.

Los compradores con cuenta aceptan desde su propia app: el personal no puede sustituirlos. No se implementó una pasarela bancaria ni facturación fiscal.

## Reglas y seguridad

- Los encargos se consultan por propietario o por personal autorizado.
- La API controla estados; no acepta saltos de Solicitado a Entregado.
- Aceptar exige la revisión actual de cotización para no aprobar un precio que cambió.
- Reservar, entregar, liberar y pagar usan transacciones y bloqueos de filas. Los productos se bloquean en orden de identificador.
- Dos aceptaciones simultáneas no pueden reservar más de la existencia disponible.
- Repetir una solicitud o pago con la misma clave no duplica datos; si cambia su contenido, se rechaza.
- Ajustar inventario no permite retirar reservas existentes.
- No se cancela un encargo entregado ni uno con pagos: reembolsos requieren otra operación aún no implementada.
- BigInt calcula importes exactos; se redondea cada partida a centavos y luego el impuesto. Los datos decimales viajan como cadenas.
- Continúan HTTPS, consultas preparadas, permisos, sesiones con hash y SecureStore.

## Cámara, IA y avisos al teléfono

Scanner.js solicita permiso y busca un código de barras/QR en el catálogo. No se afirma medición automática, OCR de listas ni identificación de perfiles por foto. No se probó todavía en cámara física.

assistant.js consulta Gemini desde el servidor. Clave/modelo externos; límite de frecuencia y tiempo; el cliente ve un mensaje de indisponibilidad si no está configurado. No ejecuta cambios ni recibe automáticamente datos personales de los encargos. La app avisa de que pregunta y catálogo se envían al proveedor. Los ensayos de respuestas y errores usan proveedor simulado, no un servicio real configurado.

push.js registra dispositivos con sesión, guarda una cola transaccional, envía por Expo con reintentos, consulta recibos, desactiva tokens no registrados y omite sesiones inexistentes/revocadas/vencidas. El aviso de pantalla bloqueada no contiene nombre, dirección o importe. Un recibo exitoso solo indica entrega al servicio de plataforma, no lectura humana. PUSH_ENABLED permanece false. Faltan EAS_PROJECT_ID independiente por app, credenciales FCM/APNs, permisos, compilación propia y prueba física. No se enviaron notificaciones reales durante las pruebas.

## Comprobaciones

1. npm test: 17 pruebas correctas. Incluyen cálculos, validación, sesiones, compatibilidad de hashes, cliente HTTPS, IA simulada, sintaxis y configuración nativa; dos pruebas ejecutan componentes de las pantallas con primitivas nativas simuladas. No son pruebas en teléfono. react-test-renderer emite su aviso de obsolescencia; el resultado no se presenta como certificación nativa.
2. Integración real HTTPS + MySQL aislado: 127 comprobaciones correctas. Incluye migración con datos previos, propiedad, persistencia, cotización, revisión, concurrencia de reservas, pagos y duplicados, cancelación/entrega, permisos y cola push con proveedor simulado.
3. Expo export generó cuatro paquetes Hermes: Cliente Android/iOS y Empresa Android/iOS. No son APK/IPA ni compilaciones nativas.
4. npm install reportó cero vulnerabilidades conocidas; revisión final de npm audit se guarda en .test-artifacts/npm-audit-business.json.
5. Se comprobó la sintaxis PowerShell del migrador. No se ejecutó la migración sobre la base local real.

Evidencia de integración: .test-artifacts/js-a7ab59861e7d4980b3422bf929a7423d/result.txt.
Paquetes: .test-artifacts/export-cliente-v4/metadata.json y export-empresa-v4/metadata.json.

## Activación pendiente y alcance

Completar la configuración real de MySQL y el usuario limitado; ejecutar respaldo/migración local; preparar URL HTTPS/certificado accesible al teléfono; configurar correo y probar recuperación real; configurar proveedor de IA y proyectos push; crear primer administrador real; instalar y probar ambas apps en dispositivos. El cambio aún no está respaldado en GitHub.

Límites actuales: listas de hasta 100 registros sin paginación adicional; carrito en memoria; imágenes por URL (sin subida de foto); sin reembolsos, pasarela, facturación fiscal, verificación de correo o borrado de cuenta desde interfaz. No se afirma que el sistema ya esté terminado ni listo para producción.

## Referencias de implementación

- Cámara Expo SDK 58: https://docs.expo.dev/versions/v58.0.0/sdk/camera/
- Notificaciones Expo SDK 58: https://docs.expo.dev/versions/v58.0.0/sdk/notifications/
- Tickets y recibos Expo: https://docs.expo.dev/push-notifications/sending-notifications/
- Endpoint Gemini: https://ai.google.dev/api/generate-content
