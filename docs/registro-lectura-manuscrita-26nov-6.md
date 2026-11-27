# Lectura manuscrita — 26 nov · 6

Las alertas de inventario se pausan por solicitud del usuario. Esta revisión mejora la reconstrucción de renglones del OCR local, compartida por escáner y asistente. No sustituye ni reentrena ML Kit.

## Cambio

`packages/mobile/src/ocrLines.js`: además del centro de los recuadros, compara solapamiento vertical y línea inferior para palabras con alturas distintas (mayúsculas, números y letras pequeñas). La tolerancia adicional exige una proporción máxima de alturas, coincidencia amplia y compatibilidad con todos los fragmentos del renglón. Evita unir por cadena varias filas. Conserva texto reconocido, códigos, cantidades y medidas: no completa palabras inventadas. Se mantienen límites de 400 fragmentos y 4000 caracteres, corrección de inclinación y deduplicación geométrica.

`packages/mobile/src/Scanner.js`: guía para fotografiar pocos renglones cercanos y nítidos, y revisión explícita de nombres, cantidades y medidas antes de buscar. Se conserva lectura local sin enviar fotos, lista editable y confirmación de candidatos del catálogo.

## Verificación

137 pruebas JavaScript pasan, incluidas nuevas pruebas de alturas desiguales y separación de renglones. Las 6 pruebas de interfaz y catálogo pasan también con heap Node de 128 MB. No se modifican Firebase, permisos, conexiones ni código nativo. No se ha medido esta revisión en un teléfono físico ni probado una muestra nueva de manuscritos reales; las nuevas pruebas verifican posiciones de texto ya reconocido, no precisión del modelo sobre fotografías.

## Límite

No garantiza leer cualquier letra, fotos desenfocadas o caracteres ilegibles. La agrupación no recupera letras que el motor no detectó. Google recomienda texto de suficiente tamaño y reenfocar ante resultados deficientes: https://developers.google.com/ml-kit/vision/text-recognition/v2/android . Digital Ink reconoce trazos escritos sobre pantalla; no reemplaza el OCR de una foto. No se activa un servicio de pago ni se promete esa capacidad.

## Distribución

Revisión visible: `26 nov · 6`. Publicación OTA y verificación del manifiesto se registran al finalizar. Los APK descargados de la revisión 5 siguen requiriendo aplicar la actualización; no se recompila un APK en esta tarea.
