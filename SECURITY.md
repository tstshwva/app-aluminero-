# Seguridad de Aluformix — JavaScript

- HTTPS obligatorio. No aceptar certificados inválidos ni habilitar tráfico HTTP. La API usa node:https y escucha localmente hasta preparar el despliegue.
- Las apps usan expo/fetch con redirect:error y una URL base HTTPS validada. No introducir claves privadas en EXPO_PUBLIC_*.
- Tokens solo en Expo SecureStore. No guardarlos en AsyncStorage ni en archivos comunes. El indicador de primera instalación no contiene secretos.
- Contraseñas nuevas protegidas con scrypt; hashes de tokens SHA-256; compatibilidad con el formato Identity V3 anterior y actualización al acceder.
- Credenciales MySQL/SMTP solo en configuración externa de servidor. MySQL remoto requiere CA y validación de certificado; consultas con execute y parámetros, sin multipleStatements.
- Validar entradas, roles y pertenencia de los datos en cada endpoint. Usar transacciones para altas y cambios relacionados.
- Registro público solo de compradores. La app empresa no autoriza por ocultar botones: el servidor comprueba los permisos.
- Errores genéricos sin trazas ni SQL; límites de cuerpo, frecuencia y concurrencia de hashes; caducidad y revocación de sesiones.
- No importar ejemplos del prototipo a la base real. Las pruebas MySQL usan directorio propio, puertos aleatorios y certificados efímeros eliminados al finalizar; nunca deshabilitan validación TLS de la app.
- Revisar npm audit y cambios de dependencias antes de entregar. Cero avisos no equivale a certificación OWASP.

Pendientes: prueba nativa y física de ambas apps, certificados del despliegue, verificación de correo, respaldo/restauración y revisión integral antes de publicar. No se ha desplegado ni publicado.

## Módulos de negocio — versión 4

Las consultas de encargos y favoritos están limitadas al propietario. Cotizar, registrar pagos y operar inventario exige personal; ajustes y configuración de empresa exigen administrador. Cada transición de estado se valida en la API. Se bloquean filas y se usan transacciones para aceptar, reservar, cancelar, entregar y registrar pagos. Las cotizaciones tienen revisión y los envíos/pagos tienen clave y huella de contenido para evitar repeticiones accidentales.

Los importes se calculan con enteros BigInt y se transportan como cadenas decimales. Se conserva el precio/nombre/código de la partida. No se confía en precios proporcionados por el comprador.

Las claves de Gemini y Expo permanecen en variables del servidor. IA no tiene herramientas que ejecuten cambios. Solo recibe pregunta y un catálogo limitado; la interfaz informa al usuario de ese envío. Push usa avisos genéricos y comprueba usuario activo y sesión vigente antes de enviar; desactiva tokens no registrados por el proveedor. Los avisos ya enviados no pueden recuperarse al cerrar sesión.

La base real no fue migrada en este avance. El script de migración genera un respaldo antes del DDL; ese respaldo contiene información sensible y debe permanecer local/protegido. Su hash comprueba integridad del archivo, no sustituye una prueba de restauración. No se afirma seguridad total ni preparación para producción: faltan revisión de despliegue, secretos reales, políticas de datos/retención, verificación de correo y pruebas nativas.
