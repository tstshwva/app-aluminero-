# Escáner de hojas: renglones y coincidencias aproximadas

El lector anterior concatenaba bloques en el orden devuelto por ML Kit. Un bloque podía contener la mitad izquierda de varios renglones y otro la mitad derecha, mezclando materiales de filas distintas. Además, la búsqueda exigía palabras completas y rechazaba errores pequeños de la lectura manuscrita.

`plugins/native/ExpoTextExtractorModule.kt` conserva el método anterior y agrega `extractTextLinesFromImage`, que devuelve texto y coordenadas de cada línea. El plugin copia este adaptador de manera reproducible al módulo Android y mantiene el modelo incluido en el APK. El reconocedor se cierra al terminar para liberar recursos.

`packages/mobile/src/ocrLines.js` agrupa fragmentos por posición vertical y los ordena de izquierda a derecha. No intenta adivinar la posición de los bloques antiguos que solo contienen texto. `localTextReader.android.js` utiliza las coordenadas cuando el APK dispone del método nuevo y mantiene compatibilidad con las instalaciones anteriores.

`packages/catalog/src/index.js` agrega sugerencias para listas OCR con errores pequeños y fragmentos de una palabra. Conserva el texto original, cantidades, códigos y medidas. Las aproximaciones solo proponen productos existentes y se marcan para revisión. No se eliminan números para forzar una coincidencia. El caso Adaptado mo>qu le propone Adaptador mosquitero, C.bezul de1750 propone Cabezal de 1750 y Cabezul y Zo cio propone opciones de Cabezal y zoclo. Las etiquetas Permanent y Mark no se convierten en materiales.

`Scanner.js` permite releer explícitamente la misma foto con internet si la letra salió mal. En la lectura local no se envía la imagen automáticamente. El aviso distingue las instalaciones que usan lectura remota. Si la relectura falla o queda vacía, conserva el texto local. La búsqueda se inicia únicamente al pulsar Buscar materiales de la lista. La transcripción remota pide ignorar marcas impresas y objetos del fondo sin inventar lo ilegible.

El resultado indica cuántos materiales tienen coincidencias en el catálogo, en lugar de presentar esa cifra como precisión del reconocimiento de texto. La persona conserva la edición manual y la confirmación de cada material.

Las pruebas cubren posiciones desordenadas, ejemplos de las capturas, fragmentos de palabras, medidas distintas, texto ajeno al catálogo, cantidades y consentimiento para relectura remota. No sustituyen una prueba de cámara con una hoja real en Android. La letra poco legible puede requerir una nueva foto o corrección manual.

El orden por coordenadas requiere instalar el APK que incorpora el nuevo método nativo. Las mejoras de búsqueda y la relectura opcional también son compatibles con el APK anterior mediante actualización de Expo.
