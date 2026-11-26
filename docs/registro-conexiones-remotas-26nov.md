# Conexiones y recuperación: 26 de noviembre de 2026

## Corrección de esperas

`packages/client/src/readDeadline.js` limita a 12 segundos las lecturas puntuales de Firestore de Cliente y Empresa. `firebaseClient.js` y `enterpriseFirebase.js` lo usan para getDoc/getDocs. Ante un plazo vencido, el adaptador offline puede recuperar la copia propia descargada. Un rechazo de permisos conserva su código y no se oculta como desconexión. No se aplica este mecanismo a escrituras, transacciones o listeners: vencer un plazo no demuestra que una escritura no se haya guardado.

El SDK no permite cancelar estas lecturas con AbortSignal: una petición puede terminar en segundo plano después del plazo. Su resultado tardío no se usa para sobrescribir la caché del adaptador. Se prueban bloqueo, recuperación, permisos y resultado tardío.

## Ejecución fuera de la laptop

`.github/workflows/conexiones.yml` ejecuta la suite JavaScript en un runner Linux de GitHub y realiza comprobaciones HTTPS reales con `scripts/probar-conexion-remota.mjs`. El flujo es manual, con permisos de repositorio de solo lectura y acciones fijadas por SHA. Las configuraciones Firebase de las apps se suministran mediante secretos de Actions, nunca se imprimen. No necesita un servidor de la laptop ni claves administrativas de Firebase.

Las comprobaciones remotas no crean cuentas ni escriben en producción: Firebase Authentication debe responder a credenciales sintéticas inexistentes con un rechazo de acceso reconocido; Firestore debe rechazar una lectura anónima; Expo debe entregar un manifiesto compatible y un bundle con hash correcto para las dos apps.

Estas comprobaciones prueban disponibilidad desde GitHub, no un inicio de sesión real, permisos de un usuario concreto, Play Integrity/App Check del APK, el Wi-Fi de la universidad ni rendimiento físico de cámara/IA. Las simulaciones de fallos y recuperación se ejecutan en el runner, no en un teléfono. No se afirma que se haya probado un dispositivo Android remoto.

Revisión de distribución prevista: 26 nov · 2. Los resultados de la ejecución y la publicación se registran al verificarlos.
