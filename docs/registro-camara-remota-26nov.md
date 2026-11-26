# Revisión de cámara, OCR y conexiones — 26 nov · 4

## Correcciones de la app

`localOcrDeadline.js` limita a 15 segundos la espera del lector nativo. Android ML Kit y el lector iOS la utilizan. Si vence, se conserva la lista previa y se ofrece fotografiar una parte o escribir. El plazo solo libera la UI: no cancela una tarea nativa que no admite abortar. Un resultado tardío no se aplica. El lector antiguo por bloques también pasa por los límites de fragmentos y caracteres.

`Scanner.js` reemplaza la vista de cámara por la foto estática después de capturar, apaga la linterna y ofrece «Volver a enfocar». La lista corregida permanece al volver a fotografiar. El bloqueo inmediato evita que un código detectado durante una captura cambie de pantalla.

`AssistantChat.js` cierra la vista de cámara antes de procesar el texto. Bloquea envío y acciones incompatibles mientras el lector trabaja y muestra progreso. Evita que una pregunta se envíe sin la foto mientras la lectura sigue pendiente. Cerrar la pantalla descarta el resultado. No se envían preguntas/fotos a Gemini.

## Conexiones fuera de la laptop

Se repitió el flujo remoto de conexiones: https://github.com/tstshwva/app-aluminero-/actions/runs/45825956651, aprobado antes de estas correcciones. Incluye la suite de la revisión anterior, Firestore aislado y sondas reales de Auth, acceso anónimo rechazado y actualizaciones. La nueva revisión se verifica de nuevo al subir el código.

## Prueba Android real del motor OCR

`.github/workflows/ocr-android.yml` compila y ejecuta un proyecto de prueba independiente en un emulador Android API 30 x86_64 de GitHub. Usa exactamente `com.google.mlkit:text-recognition:16.0.1`, incluido por el plugin de la app. El paquete de prueba no tiene permiso de internet y no lleva configuración de Firebase, credenciales ni productos personales.

`tests/android-ocr` genera imágenes impresas sintéticas con nombres, cantidad y código con cero inicial; ejecuta ML Kit real sobre una hoja recta, otra inclinada y otra vacía. Comprueba que no haya permiso de internet y guarda texto reconocido e informes JUnit como evidencia temporal en Actions. Las imágenes se generan desde código dentro de Android; sus archivos privados no se exportan porque Gradle desinstala el paquete de prueba y elimina esos archivos al terminar.

No es una prueba de la app completa, del puente Expo, de una cámara física, del enfoque/lente del teléfono del usuario ni de escritura manuscrita. Una imagen tipográfica reconocida no demuestra que toda letra a mano se lea correctamente. El comportamiento de cámara y pantalla se prueba por separado con simulaciones de UI. No se publican fotos del usuario ni se cambian reglas de producción.

Los resultados y la distribución se añaden después de verificarlos.

## Conexiones y regresiones aprobadas

La revisión final de la UI pasó en https://github.com/tstshwva/app-aluminero-/actions/runs/45826984566: 133 pruebas JavaScript, 8 de Firestore aislado y 5 sondas HTTPS reales aprobadas. No se comprobó un inicio de sesión de una cuenta real en el Wi-Fi de la universidad.

La primera compilación del proyecto Android de prueba se detuvo porque `sdkmanager` no estaba en PATH del runner. Se corrigió su ruta, sin cambiar el motor OCR ni los criterios de reconocimiento. El segundo intento está en https://github.com/tstshwva/app-aluminero-/actions/runs/45827096492.
