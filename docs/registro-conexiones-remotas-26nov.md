# Conexiones y recuperación: 26 de noviembre de 2026

## Corrección de esperas

`packages/client/src/readDeadline.js` limita a 12 segundos las lecturas puntuales de Firestore de Cliente y Empresa. `firebaseClient.js` y `enterpriseFirebase.js` lo usan para getDoc/getDocs. Ante un plazo vencido, el adaptador offline puede recuperar la copia propia descargada. Un rechazo de permisos conserva su código y no se oculta como desconexión. No se aplica este mecanismo a escrituras, transacciones o listeners: vencer un plazo no demuestra que una escritura no se haya guardado.

El SDK no permite cancelar estas lecturas con AbortSignal: una petición puede terminar en segundo plano después del plazo. Su resultado tardío no se usa para sobrescribir la caché del adaptador. Se prueban bloqueo, recuperación, permisos y resultado tardío.

## Ejecución fuera de la laptop

`.github/workflows/conexiones.yml` ejecuta la suite JavaScript en un runner Linux de GitHub y realiza comprobaciones HTTPS reales con `scripts/probar-conexion-remota.mjs`. El flujo es manual, con permisos de repositorio de solo lectura y acciones fijadas por SHA. Las configuraciones Firebase de las apps se suministran mediante secretos de Actions, nunca se imprimen. No necesita un servidor de la laptop ni claves administrativas de Firebase.

Las comprobaciones remotas no crean cuentas ni escriben en producción: Firebase Authentication debe responder a credenciales sintéticas inexistentes con un rechazo de acceso reconocido; Firestore debe rechazar una lectura anónima; Expo debe entregar un manifiesto compatible y un bundle con hash correcto para las dos apps.

Estas comprobaciones prueban disponibilidad desde GitHub, no un inicio de sesión real, permisos de un usuario concreto, Play Integrity/App Check del APK, el Wi-Fi de la universidad ni rendimiento físico de cámara/IA. Las simulaciones de fallos y recuperación se ejecutan en el runner, no en un teléfono. No se afirma que se haya probado un dispositivo Android remoto.

Revisión de distribución prevista: 26 nov · 2. Los resultados de la ejecución y la publicación se registran al verificarlos.

## Resultado remoto verificado

Ejecución aprobada: https://github.com/tstshwva/app-aluminero-/actions/runs/45768003844 (commit 1ecf3f4).

- 121 pruebas JavaScript aprobadas en Linux de GitHub, incluyendo desconexión, plazos, reconexión, caché, UI y actualizaciones.
- 8 pruebas Firestore aprobadas en el emulador aislado del runner: roles, operaciones de empresa, cotización/aceptación/reserva/pago/entrega, invitación de un solo uso y protección de inventario. Proyecto demo-aluformix; ninguna escritura a producción.
- 5 comprobaciones HTTPS reales aprobadas: Auth Cliente y Empresa accesibles (rechazo esperado de cuenta inexistente), Firestore anónimo rechazado con 403 PERMISSION_DENIED y paquetes Expo de las dos apps con HTTP 200/hash correcto.

Las dos primeras ejecuciones remotas fallaron por una sonda incorrecta: se usó un ID de documento reservado `__connection_probe__`, que Firestore rechaza como INVALID_ARGUMENT. Se corrigió a un ID permitido y se repitió todo; no se relajaron reglas para hacer pasar la prueba. Esto no fue un error de conexión de la app.

## Publicación verificada

La revisión 26 nov · 2 se publicó para las siete variantes Android conocidas (cuatro Cliente y tres Empresa). Los manifiestos y bundles actuales devolvieron HTTP 200, incluyeron la revisión correcta y coincidieron con su SHA-256. Esta comprobación de distribución se hizo desde la herramienta local; la suite y las cinco sondas anteriores sí corrieron en GitHub. No se reinstaló ni se abrió el APK en un dispositivo físico.

- Cliente actual: grupo 260e0b79-db41-4d9a-b8fc-4aa6601c43b1, update 01a21689-9c9d-702f-ae1d-119345bfceee.
- Empresa actual: grupo d2358dbc-0873-4782-8825-71d267350771, update 01a2168a-9b38-750c-aaae-af5d5ab4083e.
- Cliente anteriores: 856a42e7-a057-4a16-a249-970c7c7adaa3, a6b8071a-ae91-4ebf-a6a6-644039ebc28d, 4081b543-5c1f-47cc-a63d-998ae41b720f.
- Empresa anteriores: ba4e4585-ccf5-4a7c-ba6d-3eba4cbdacf5, 4b167d1c-5cb2-45ac-8fb2-ff873f2b1440.
