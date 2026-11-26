# Cambio a lectura ML Kit y guía local — revisión 26 nov · 3

## Qué cambió

En Android, el lector de fotografías utiliza Google ML Kit Text Recognition Latin incluido en el APK. No se añadió otra dependencia nativa: el módulo y el modelo ya estaban presentes en los APK compatibles. La actualización modifica JavaScript y puede distribuirse por OTA en esos APK. Una instalación sin el módulo debe actualizar el APK; una OTA no puede instalar un módulo nativo ausente.

`packages/mobile/src/App.js` coloca `withMaterialGuide` por encima del adaptador offline. Este sustituye el método de ayuda generativa por una guía local. Ya no se entrega el proveedor App Check del asistente a la app. No se cambiaron Authentication, reglas ni Firestore para cuentas, catálogo y encargos. El cliente compartido conserva su interfaz generativa por compatibilidad y pruebas, pero la app normal no la usa para estas consultas ni puede obtener su proveedor App Check desde App.js.

`materialGuide.js` contesta guías de uso, busca materiales en la copia descargada de la cuenta y orienta sobre apertura y medidas. Reutiliza el comparador aproximado JavaScript del catálogo, limita contexto, usa solo productos activos y exige revisar candidatos dudosos. No hace fetch, no descarga el catálogo automáticamente, no altera pedidos y no usa claves ni fotos base64. Rechaza resultados si cambió la cuenta y permite detener la consulta.

`AssistantChat.js` conserva el formato de conversación y muestra «Guía de materiales». La cámara fotografía a calidad 0.8 y ejecuta el lector local; permite corregir el texto antes de consultar. El método de guía recibe únicamente ese texto, nunca base64. Después de responder se descarta la foto del estado de la pantalla. Los archivos temporales de la cámara los gestiona su caché; no se promete borrado físico inmediato. Si falta el lector o no hay texto legible se ofrece entrada manual.

`BusinessApp.js` desactiva la relectura con Gemini en el escáner de la app normal. `ocrLines.js` conserva orden y correcciones de inclinación, elimina duplicados con el mismo texto y recuadro sin borrar renglones repetidos en posiciones distintas. Rechaza más de 400 fragmentos o 4000 caracteres para evitar procesar hojas excesivas en la UI; solicita fotografiar una parte. La empresa sigue administrando productos y encargos, sin agregarle el flujo de cámara del cliente.

## Alcance real

Es OCR más búsqueda y orientación determinista, no un reemplazo equivalente de un modelo conversacional general. ML Kit también ofrece GenAI con Gemini Nano en dispositivos compatibles; no se añadió porque seguiría usando un modelo Gemini y no está disponible en todos los teléfonos. Esta guía no describe fotografías de ventanas sin texto, no responde cualquier tema, no determina medidas a partir de fotos y no garantiza precisión manuscrita. La UI explica estas limitaciones. En iOS se conserva el lector local Apple Vision ya preparado, sin afirmar que use ML Kit ni que exista un IPA publicado. En web se mantiene la entrada manual si no hay lector nativo.

La ayuda y lectura no requieren internet tras descargar el catálogo con conexión una vez. El primer acceso, la descarga inicial, la sincronización con la empresa y las actualizaciones siguen requiriendo internet. No se activó facturación ni un servidor de laptop.

## Verificación

130 pruebas JavaScript aprobadas localmente antes de publicación. Incluyen guía sin red/modelo, búsqueda aproximada, renglones ilegibles, tamaños máximos, cuenta cambiada, cancelación, memoria de medidas, corrección de OCR en conversación y ausencia de foto base64 en la consulta. La ejecución remota y la distribución OTA se registran cuando terminan. La precisión en fotografías y latencia real siguen pendientes de dispositivo físico.

Fuentes oficiales consultadas:

- https://developers.google.com/ml-kit/vision/text-recognition/v2/android
- https://developers.google.com/ml-kit/genai

## Evidencia remota

Ejecución aprobada: https://github.com/tstshwva/app-aluminero-/actions/runs/45824277600, commit 7d41bfa. En GitHub pasaron las 130 pruebas JavaScript, 8 de Firestore aislado y las 5 sondas HTTPS de Auth/Firestore/Expo. No se crearon cuentas ni pedidos reales. Es una comprobación de código, reglas y servicios desde un runner, no una prueba de precisión ML Kit en un teléfono. Los modelos de cámara se simulan en las pruebas de UI.

## Publicación completada

La revisión 26 nov · 3 se publicó para siete runtimes Android conocidos (cuatro Cliente, tres Empresa). Se verificaron HTTP 200, SHA-256 y presencia del modo local y la revisión en los dos bundles más recientes. La verificación de distribución se hizo desde la herramienta local, separada de las pruebas remotas. No se generó un APK nuevo ni se afirmó instalación física.

- Cliente actual: grupo 2f017e3f-beeb-4c64-a2bf-7334afab6340, update 01a217ef-5435-784a-b13a-d398dbd66463.
- Empresa actual: grupo cbdc3730-d620-4470-87b6-25319fb74eff, update 01a217f0-21da-7e36-ac17-4be2c5ecce2b.
- Cliente anteriores: 077deca6-8c5f-4e9a-903a-e99d835a7d99, 0e686414-4feb-4cd6-8324-28741b65113d, db203d76-4f98-422d-9634-aeeea5063a8f.
- Empresa anteriores: ef8fbad9-1bd9-45d1-a1dc-db3c9e5afd63, dd7b0ad8-6357-49b0-9497-ed3c81d63b03.
