# Avance 31 Verificación y correcciones

Fecha 22 de noviembre de 2026.

Se verificaron las apps Cliente y Empresa en modo demostración, a tamaño de teléfono: 24 comprobaciones manuales, las pruebas automáticas, una búsqueda de credenciales en el repositorio, `npm audit` y la revisión de configuración. Se encontraron 2 hallazgos de gravedad alta, 6 de gravedad media y 8 de gravedad baja. Esta entrega corrige los altos y los medios.

## Gravedad alta

* El botón − del encargo bajaba de 1 a 0.001 barras ($0.39), y ese encargo se podía enviar. Ahora no baja de 1, y una cantidad escrita menor que 1 (por ejemplo 0.5 m²) se conserva.
* En modo oscuro, las líneas de la cotización eran texto negro sobre `#121212` (contraste 1.1:1). Ahora usan el color de texto del tema.

## Gravedad media

* La búsqueda por lista contaba todo el catálogo (130) en lugar de los productos mostrados. Ahora cuenta la lista filtrada y muestra los términos separados por comas.
* Al elegir «Solicitar entrega» se propone la dirección guardada en el perfil. Sigue siendo editable.
* En modo claro, el velo del fondo de Inicio subió del 55 % al 72 % para que el saludo se lea sobre la foto.
* Avisos muestra el estado («activados» o «desactivados») y un solo botón. El estado se guarda en el teléfono junto a la preferencia de tema.
* En la demostración, el Asistente propone hasta 3 materiales del catálogo de ejemplo que coinciden con la pregunta, en lugar de fallar con «Revisa los datos».
* Dependencias: `overrides` fuerza `@grpc/grpc-js` 1.13.7 (llega por Firebase, que pide 1.9) y `node-forge` 1.4.3 (llega por la CLI de Expo). `sharp`, que solo se usa en desarrollo, pasa a 0.35.5. `npm audit` reporta 0 vulnerabilidades.

## Comprobaciones

Pasaron las 40 pruebas JavaScript. La prueba de interfaz cubre ahora la cantidad mínima, el color de la cotización, la dirección prellenada y el contador de la lista; cada comprobación nueva falla con el código anterior. La prueba del cliente de demostración cubre las respuestas del Asistente. Todo se revisó en la vista previa web de Cliente.

## Gravedad baja

* Escáner: el ejemplo de la lista muestra dos renglones (antes se veía el texto `\n`), el campo tiene etiqueta para lectores de pantalla, y la nota y el botón «Volver sin escanear» se adaptan al modo oscuro.
* El mensaje de error bajo cada campo usa colores oscuros en modo oscuro.
* Cuando aparece el aviso inferior, el contenido se desplaza para que el botón pulsado siga a la vista.
* Las cantidades enteras se muestran sin decimales («6 ×» en lugar de «6.000 ×») en el resumen, la cotización y el texto para compartir.
* Empresa captura el impuesto como porcentaje («Impuesto (%)», 16) y lo envía como tasa (0.1600), igual que antes.
* En la demostración, el catálogo maestro tiene existencias de ejemplo (mínimo 5) y «Stock bajo» muestra 9 productos en lugar de 126. Los productos sin ficha técnica muestran «Dimensiones: Por confirmar con la distribuidora». Los 4 productos de ejemplo con precio (PERF-3, TUB-1X1, ANG-3/4 y VID-6CL) se mantienen porque los encargos de ejemplo dependen de ellos.
* La tarjeta del perfil y la fila «Dirección de entrega» muestran los datos guardados, no lo que se está editando.

Queda pendiente la configuración de producción (12 elementos de `npm run config:check`). Las 134 comprobaciones de integración no se ejecutaron porque requieren SQL Server.
