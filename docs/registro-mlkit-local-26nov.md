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
