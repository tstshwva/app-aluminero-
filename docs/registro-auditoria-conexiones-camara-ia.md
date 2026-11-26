# Auditoría de conexiones, cámara y asistente

25 de noviembre de 2026.

## Firebase y red real

Se incorporó origin/main 98b4f9c, que corrige hojas inclinadas y letras confundidas del escáner. La consulta administrativa de solo lectura encontró 124 productos activos. Authentication rechazó correctamente unas credenciales sintéticas inexistentes (INVALID_LOGIN_CREDENTIALS): no se crearon cuentas ni se usaron contraseñas de usuarios. Esto verifica acceso al servicio, no un inicio de sesión real en el teléfono.

Las reglas publicadas coinciden con firestore.rules (SHA256 0a508d3f20ffec7bf95b05a95db3c82fb449a20e4ee2d7671ecf7b665a1c1a9c). El certificado SHA256 del APK está registrado. Los canales de actualización respondieron HTTP 200 y los bundles coincidieron con sus hashes.

La cola de pedidos todavía bloqueaba sincronización con isInternetReachable false aunque hubiera un enlace activo. Usa ahora canAttemptNetwork, como el resto de la app. Se conserva la preferencia de enviar pedidos solo con Wi-Fi y la cola local si una petición falla.

## Asistente y App Check

El servicio Firebase AI Logic está habilitado y gemini-3.5-flash-lite sigue en la lista oficial de modelos compatibles. No se cambiaron modelo, cuotas, facturación ni claves.

Se detectó que App Check de Cliente exigía una versión reconocida por Play, incompatible con la distribución fuera de Play. La revisión automática rechazó el primer intento porque modifica un control de producción. Se solicitó la autorización explícita y el usuario aprobó permitir APK fuera de Google Play. Después se cambió únicamente appIntegrity.allowUnrecognizedVersion a true y se verificó su lectura posterior. Se conservaron MEETS_DEVICE_INTEGRITY, tokenTtl 3600s y el resto de opciones. No se desactivó App Check ni se modificaron reglas o configuración de Empresa.

Documentación del ajuste: https://firebase.google.com/docs/reference/appcheck/rest/v1beta/projects.apps.playIntegrityConfig y https://firebase.google.com/docs/app-check/android/play-integrity-provider . Modelo: https://firebase.google.com/docs/ai-logic/models .

Este ajuste elimina un requisito de reconocimiento de Play, pero reduce esa comprobación concreta; las instalaciones siguen necesitando satisfacer la integridad del dispositivo. No garantiza acceso desde dispositivos modificados o sin servicios de Google.

## Cámara y fluidez

Escáner y cámara del chat esperan onCameraReady y evitan capturas simultáneas. El escáner conserva su entrada manual, lectura local, linterna, revisión de coincidencias y relectura remota opcional. Una respuesta que llega después de cerrar el chat ya no modifica la conversación. La foto del chat se libera tras una respuesta correcta o al iniciar otra conversación, evitando reenviarla y consumir datos repetidamente. Si el envío falla se conserva para reintentar.

Revisión visible de las dos apps: 25 nov · 1. No se tocaron precios ni datos comerciales.

## Comprobaciones y límites

92 pruebas JavaScript y 8 pruebas de reglas/transacciones de Firestore correctas. Estas últimas se ejecutaron en un emulador aislado con Java 21 portátil; no se escribieron pedidos, productos o cuentas ficticias en Firebase real. Cubren permisos de Cliente/Operador/Administrador, invitaciones de un solo uso, cotizaciones, existencias y protección de roles. El emulador tuvo inicialmente un fallo de recursos de idioma; al ejecutarlo en inglés las ocho pruebas terminaron correctamente. Se detuvo al finalizar.

No había un teléfono Android conectado. Queda pendiente confirmar en hardware: enfoque y calidad de la hoja real, linterna física, inicio de sesión de una cuenta real, recepción cruzada de un pedido y respuesta de Gemini con Play Integrity del dispositivo, tanto en Wi-Fi como en datos. Las pruebas desde esta computadora no certifican la red de la universidad, todos los teléfonos ni disponibilidad permanente de servicios externos. No se declara funcionalidad al 100% sin esa validación.
