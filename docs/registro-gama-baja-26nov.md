# Optimización para gama baja — 26 nov · 5

## Cambios

`BusinessApp.js` y `catalogPage.js`: catálogo, favoritos e inventario montan un máximo de 12 tarjetas por página. Anterior/siguiente permite acceder a todos los productos sin acumular imágenes y vistas. Filtros y búsqueda se aplican a la colección completa, antes de paginar. La búsqueda usa `useDeferredValue`; grupos, subcategorías y listas filtradas no se recalculan cuando cambian datos ajenos. Se elimina la animación de entrada de cada apartado y se reduce la frecuencia de eventos de desplazamiento enviados a JavaScript (64 ms); se conserva el desplazamiento nativo.

`generar-miniaturas.mjs` genera 145 miniaturas de las mismas ilustraciones, con un máximo de 320 × 240 y 316418 bytes en total. El número total de píxeles pasa de 156600000 a 11136000 (92.89 % menos). Esto es reducción de dimensiones, no una medición de RAM real. Las fichas conservan imágenes originales de 1200 × 900 y las URLs registradas por la empresa conservan prioridad. `ProductImage` está memoizado y solicita reducción de resolución al decodificador Android.

No se alteran precios, cuentas, permisos, datos de producción ni separación entre Cliente y Empresa. La paginación sustituye «Mostrar más», no elimina productos. Pruebas de UI recorren el catálogo completo y verifican búsqueda, filtros, favoritos y encargos.

## Verificación prevista

- Suite JavaScript y reglas Firestore en GitHub.
- UI y catálogo ejecutados con un límite de heap Node de 128 MB. Este límite prueba el código de UI en Node; no representa la RAM del APK ni su velocidad de cuadros.
- Emulador Android API 30 x86_64 con 1536 MB de RAM, heap Java de 256 MB y dos núcleos. Usa el APK completo en modo demostración, sin cuentas reales ni backend. Automatiza entrada, catálogo, búsqueda, ficha, paginación y pestañas, registra tiempos de interacción y memoria. Es virtual y usa la CPU del runner: no se equipara a un teléfono económico físico ni prueba latencia de internet.

El APK de prueba se aloja temporalmente en una publicación borrador y no se entrega como app real. Las compilaciones de distribución se hacen después con Firebase y actualizaciones habilitados. Los resultados se registran cuando se verifican.

Referencias: https://reactnative.dev/docs/optimizing-flatlist-configuration y https://reactnative.dev/docs/image.html
