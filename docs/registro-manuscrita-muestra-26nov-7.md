# Relectura manuscrita — 26 nov · 7

## Problema y alcance

La muestra enviada contiene cuatro entradas: Adaptador mosquitero, Adaptador OXXO, Adaptador XX y Aleta. El OCR original de ML Kit devuelve «Adupluda Mogu.» y «Adu plador Ox0» en Android remoto, omitiendo filas. La revisión 6 solo mejoraba la agrupación de fragmentos ya detectados; no recuperaba estas letras. Se mantienen en pausa las alertas de inventario.

## Implementación

`plugins/native/HandwrittenImage.java` atenúa cuadrícula azul con el canal azul y contraste local, detecta bandas de tinta y decodifica con reducción previa hasta un lado máximo de 1280 píxeles. Respeta orientación EXIF. Solo abre archivos locales o URI content; no descarga ni sube fotografías. Está pensado para lápiz gris/negro; la tinta azul puede perderse y se conserva la lectura original como alternativa.

`HandwrittenReader.java` relee hasta ocho bandas, una por vez, con ML Kit 16.0.1 incluido en el APK. Amplía cada franja como máximo al doble y hasta 1600 píxeles de ancho. Reutiliza un reconocedor, recicla imágenes después de que el motor termina, y corta entre filas cuando supera el presupuesto de 12 segundos. El plazo JS sigue siendo 15 segundos: no cancela una tarea nativa ya iniciada; descarta su resultado tardío. El módulo Kotlin admite una sola mejora en curso, trabaja fuera del hilo de interfaz y comunica errores de memoria sin reemplazar la lista.

`plugins/withBundledTextRecognition.js` incluye las clases en compilaciones nuevas. `localTextReader.android.js` detecta la función nativa para no romper APK antiguos. No se anuncia esta nueva función como disponible en web o iOS.

`Scanner.js` ofrece «Leer por renglones (sin internet)» tras la foto cuando el APK incluye el módulo. La propuesta se muestra aparte. «Usar esta lectura» la acepta; «Conservar mi lista» mantiene el texto anterior. No se busca ni agrega un producto automáticamente. La cámara permanece desmontada durante la revisión.

`packages/catalog/src/index.js` permite sugerencias limitadas para letras repetidas omitidas, palabras largas deterioradas y palabras partidas que acompañan a una variante corta. Las aproximaciones usan únicamente productos activos existentes y exigen revisión. No cambian códigos, medidas ni cantidades; se conserva el texto de la hoja. Se incluyen pruebas negativas de etiquetas ajenas y códigos/medidas inexistentes.

## Evidencia sobre píxeles reales

Prueba inicial: https://github.com/tstshwva/app-aluminero-/actions/runs/45927184483 . Segunda comparación: https://github.com/tstshwva/app-aluminero-/actions/runs/45928033544 . Ambas pasan y ejecutan ML Kit real en un emulador Android 11 x86_64, no mocks. Se compara imagen original, ampliada, contraste local, binarización y franjas. La binarización y las franjas originales no resultan mejores y no se activan en producción.

La limpieza por franjas devuelve cuatro entradas: «Alatudo Mqu.tro», «Adu lado Ox», «Aduptudo Xx» y «Ale tu». El buscador actualizado ofrece los cuatro materiales correctos entre sus candidatos, siempre para confirmar. Esto es recuperación de renglones y orientación del catálogo; **no es una transcripción exacta**. No se codifican estos cuatro textos como respuestas del lector ni se entrena un modelo con la muestra.

La hoja recortada de prueba contiene únicamente materiales, cuadrícula y un encabezado vacío, verificados visualmente; se excluyó la interfaz de la captura. Se conserva en `tests/android-ocr/app/src/androidTest/assets/lista-manuscrita.png` para repetir la regresión. No contiene cuentas ni datos personales.

## Comprobaciones

140 pruebas JavaScript pasan. También pasan las seis pruebas de interfaz y catálogo con heap Node limitado a 128 MB. Comprueban que relectura local no envía fotos, necesita aceptación y conserva el texto ante resultados vacíos o errores. Esto no mide la velocidad de un teléfono físico. La prueba del mismo lector Java de producción pasa con los cuatro renglones y sus posiciones en https://github.com/tstshwva/app-aluminero-/actions/runs/45928378540 (cinco pruebas Android en total). El ensayo incluye lectura impresa, inclinación y página vacía. Los controles del APK se registran al terminar.

## Límite y distribución

No se garantiza «la peor letra» ni fotografías desenfocadas. La confirmación sigue siendo necesaria. No se activa un servicio de pago, un modelo remoto ni dependencias de la laptop. Este cambio nativo requiere instalar un APK nuevo de Cliente; una actualización OTA en un APK antiguo solo aporta la búsqueda mejorada, no la función nativa nueva. Empresa conserva sus funciones de administración.
