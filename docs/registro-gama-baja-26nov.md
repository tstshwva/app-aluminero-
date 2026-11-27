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

## Resultados verificados

https://github.com/tstshwva/app-aluminero-/actions/runs/45921021519: 135 pruebas JavaScript aprobadas, prueba de catálogo/compra con heap Node de 128 MB aprobada, 8 pruebas de Firestore aislado y 5 sondas HTTPS reales aprobadas.

Se compilaron y firmaron los dos APK Firebase con la misma identidad de distribución. Verificación: paquetes com.aluformix.cliente y com.aluformix.empresa, appId Firebase correcto por app, modelo ML Kit incluido, revisión 26 nov · 5 en el bytecode y 145 miniaturas verificadas contra sus SHA-256 originales.

- Cliente: 81402161 bytes, SHA-256 FA9DAB70085B179373866BFE9359940F805764ACF7365467C04E5B8654CA2D00.
- Empresa: 81402161 bytes, SHA-256 6C8865276DCC2222B686CA622F8FE4BE6D38F35158487A2CF40494FE1A0E40FD.

Las mediciones Android se ejecutan sobre el APK de demostración BC49E3B547CAB1CCE784D41BBB73A34B66DEE741DF85CC9D930C0FE1E9C92C3D (81393969 bytes), compilado del mismo código de UI de la revisión 5 y con actualizaciones remotas deshabilitadas para no cambiar de código durante la prueba. No se utiliza para probar autenticación o backend. El runner recibe un enlace temporal protegido a ese archivo en el borrador, sin permisos de escritura de repositorio. El enlace no se imprime ni se guarda en el código.

Los primeros intentos se detuvieron en el controlador: acceso al borrador, visibilidad de paquetes y uso de un contexto Android de otro UID. Se corrigieron sin relajar los requisitos ni atribuir esos fallos al rendimiento de la app. El resultado de navegación se añade al terminar.

## Navegación Android comprobada

Ejecución aprobada: https://github.com/tstshwva/app-aluminero-/actions/runs/45923838103. Se abrió el APK completo Cliente en modo demostración y se recorrieron catálogo, búsqueda del código 07333 con entrada de teclado, ficha, página siguiente y cuatro cambios entre Inicio/Catálogo. No hubo cierre de la app en ese recorrido. Se revisó la captura final y las imágenes de tarjetas se muestran correctamente.

Android reportó 2028632 kB de RAM total (aproximadamente 2 GB), dos núcleos y heap máximo de 512 MB. Aunque se habían solicitado 1536 MB/256 MB, el emulador impuso sus mínimos/defaults. La evidencia corresponde a 2 GB, no se presenta como prueba de 1.5 GB o 1 GB. La captura final de memoria de la app fue 106604 kB PSS (104.1 MiB) y 221968 kB RSS; es una muestra al terminar, no el pico ni una comparación A/B con la versión anterior.

Tiempos de automatización: inicio de demostración 1440 ms; abrir catálogo 158 ms; buscar código 3140 ms; abrir ficha 854 ms; cambiar página 682 ms; pestañas 46–805 ms. Incluyen esperas de UiAutomator; la búsqueda también incluye enfocar el campo, escribir y cerrar el teclado. No son mediciones aisladas de filtrado ni de latencia humana.

`gfxinfo` registró 450 cuadros, 83 janky (18.44 %), mediana 5 ms y percentil 95 de 57 ms. El renderer del emulador es software y hubo advertencias EGL. No se afirma fluidez perfecta ni 60 FPS; hay cuadros lentos en esta prueba y falta medir en un equipo físico. No se probó Empresa nativa en ese emulador: comparte las optimizaciones y pasó las pruebas de UI/Firestore, además de la verificación de su instalador.

Los APK reales requieren Android 7/API 24 o superior y un sistema de 64 bits (ARM64; incluyen x86_64 para pruebas). No se amplió soporte a ARM de 32 bits.

## Entrega

Se retiró del borrador el APK de demostración y se eliminó el secreto con su enlace temporal. La publicación final contiene únicamente Cliente y Empresa Firebase, con los SHA-256 anteriores: https://github.com/tstshwva/app-aluminero-/releases/tag/android-gama-baja-2026-11-26.

Ambos instaladores tienen actualizaciones habilitadas en su manifiesto binario y la firma anterior; pueden instalarse encima. Se copiaron a `C:/Users/Reyca/Downloads/Aluformix-APK` y se verificaron sus hashes. No se desinstaló ninguna app ni se borraron cuentas o datos.

La revisión 26 nov · 5 también se publicó por OTA para los siete runtimes Android compatibles. Se comprobaron HTTP 200, revisión, modo local y hashes de los bundles actuales; esa comprobación de distribución se hizo localmente, separada de las pruebas remotas. No se ha medido la fluidez de un teléfono físico.

Referencias: https://reactnative.dev/docs/optimizing-flatlist-configuration y https://reactnative.dev/docs/image.html
