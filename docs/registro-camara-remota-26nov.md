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

## Resultado real del motor ML Kit

En el segundo intento, el informe JUnit registra 4 pruebas ejecutadas, 0 fallos y 0 errores en Android 11/API 30 x86_64. ML Kit 16.0.1 leyó tanto en la hoja recta como en la inclinada:

```
2 pzas Adaptador mosquitero
Cabezal de 1750
Cabezal y zoclo
Codigo 07333
```

La hoja vacía produjo texto vacío y la prueba confirmó que el paquete no tenía permiso INTERNET. Los informes y logcat se descargaron y revisaron. El flujo fue marcado fallido después de aprobar las pruebas por intentar extraer imágenes privadas que Gradle había eliminado al desinstalar el paquete. Se retiró solo esa extracción y se conserva el informe/logcat de Gradle. No se rebajaron expectativas de reconocimiento. Nueva ejecución completa: https://github.com/tstshwva/app-aluminero-/actions/runs/45828118127.

Esto demuestra reconocimiento de estas imágenes impresas sintéticas; no de escritura manuscrita, cámara física ni captura mediante el puente Expo.

## Cierre verificado

La ejecución corregida https://github.com/tstshwva/app-aluminero-/actions/runs/45828118127 terminó con éxito completo: 4 pruebas Android, 0 fallos y 0 errores, con informes y logcat publicados en el artefacto `mlkit-android-evidence` (retención 7 días). Se descargó y revisó el XML final. No se cambiaron imágenes ni expectativas entre ambas ejecuciones.

La revisión 26 nov · 4 se distribuyó por OTA para los siete runtimes Android conocidos. Se verificaron desde la herramienta local HTTP 200, revisión correcta y SHA-256 de los bundles actuales. Las pruebas de conexión y del motor se ejecutaron fuera de la laptop; la comprobación final de distribución se hizo localmente. No se abrió el APK de producción en un teléfono físico.

- Cliente actual: grupo f7bb31d3-9167-4dee-b8ce-e253017d5050, update 01a217ff-33ff-7249-a569-5c749406344a.
- Empresa actual: grupo 874f7641-649b-46cd-ac59-7fda15ae655a, update 01a21800-16a6-787f-bf56-caa6f4ba4f79.
- Cliente anteriores: 83d9f86f-59f8-41ba-a455-83e5cfed4a5a, cc6359e1-5720-40d7-a934-ae106154049c, 509886df-0d09-4672-bf8d-91b8fa7da292.
- Empresa anteriores: 46de9505-6fff-469f-ae4c-ca5f0531a657, beead01d-3d25-4df6-ba54-cf856b6004f9.
