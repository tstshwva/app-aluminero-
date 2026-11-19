# Avance 30 Fondo de almacén y animaciones

Fecha 19 de noviembre de 2026.

La pantalla de Inicio muestra una foto del almacén de perfiles de aluminio solo en la parte superior, detrás del encabezado, el saludo y el banner. La imagen se prepara con un difuminado ligero y la parte inferior se desvanece a transparente (900 px de ancho, unos 30 KB, `packages/mobile/assets/fondo-almacen.webp`), así que no consume procesamiento en el teléfono y se funde con el color del tema. Encima lleva un velo semitransparente, claro en modo claro y negro en modo oscuro. El fondo sube junto con el contenido al desplazarse, de modo que la zona de "Materiales para tu taller" siempre queda sobre el color liso del tema. Las demás secciones no llevan foto.

Al cambiar de apartado, cada pantalla entra con un desvanecido, un deslizamiento leve hacia arriba y una escala sutil durante 320 ms. En Android la animación usa el driver nativo.

Se revisó en la vista previa web de Cliente en modo demostración, en modo claro y oscuro, y se midió la transición de opacidad de 0 a 1. Pasaron las 40 pruebas JavaScript.
