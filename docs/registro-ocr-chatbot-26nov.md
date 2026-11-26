# Lector y chatbot: 26 de noviembre de 2026

ML Kit continúa como OCR local Android con modelo incluido. La cámara captura la imagen; el OCR interpreta el texto. No se cambió el sensor ni se reemplazaron Firebase Authentication y Firestore.

## Lectura de hojas

`packages/mobile/src/Scanner.js` conserva la lista cuando una foto no produce texto. La relectura opcional en la nube ahora propone el resultado y ofrece «Usar esta lectura» o «Conservar mi lista». No sobrescribe correcciones sin aceptación. Buscar no se ejecuta durante una lectura.

`packages/client/src/assistantContext.js` utiliza Gemini 3.8 Flash también para la relectura manuscrita, en lugar del modelo Lite. El prompt conserva fragmentos legibles y señala [ilegible], mantiene códigos, cantidades y medidas y no interpreta instrucciones de la imagen. La captura local sigue sin enviar fotos; la relectura explícita sí requiere internet y cuota disponible.

## Chat y catálogo

El chat reutiliza `matchList` de `packages/catalog/src/index.js`: recuperación aproximada en JavaScript sobre productos activos, limitada a 12 renglones y cinco candidatos por renglón. Los candidatos aproximados llevan `requiereConfirmacion` en el contexto del modelo. No se altera el catálogo ni se asignan precios o existencias. La decisión del modelo sigue siendo probabilística: se pide confirmar cualquier lectura dudosa.

Se mantiene Flash con razonamiento LOW y respuestas progresivas para equilibrar latencia y orientación visual. No se afirma que sea el mejor modelo para todos los casos. RapidFuzz es un comparador de cadenas, no un OCR, y añadir un servicio Python no es necesario para el comparador JavaScript existente. Tesseract.js se orienta a navegador/Node; no sustituye el lector nativo de Android en este cambio. Cloud Vision y OpenAI no se activaron: no se autorizó facturación.

## Verificación y límites

Pruebas de regresión: búsqueda de nombres mal leídos, candidatos marcados para confirmar, catálogo inmutable, códigos numéricos, protección de lista corregida y aceptación de relectura. Se ejecuta además la suite JavaScript completa antes de publicar. Las pruebas del proveedor son simuladas; no demuestran precisión manuscrita real ni latencia en un teléfono. La escritura manuscrita requiere revisión del usuario. No se promete funcionamiento sin internet del modelo generativo. No se habilitaron pagos ni se modificaron reglas de acceso.

Referencias oficiales consultadas:

- https://developers.google.com/ml-kit/vision/text-recognition/v2/android
- https://firebase.google.com/docs/ai-logic/models
- https://rapidfuzz.github.io/RapidFuzz/index.html
- https://docs.cloud.google.com/vision/docs/handwriting
- https://github.com/naptha/tesseract.js

Distribución: revisión 26 nov · 1. La publicación OTA se verifica aparte; guardar código en Git no equivale a tenerlo instalado en el celular.
