# Avance 30 Fondo de almacén y animaciones

Fecha 19 de noviembre de 2026.

Las apps Cliente y Empresa muestran como fondo una foto del almacén de perfiles de aluminio. La imagen se difumina al prepararla (900 px de ancho, unos 33 KB, `packages/mobile/assets/fondo-almacen.jpg`), así que no consume procesamiento en el teléfono. Encima lleva un velo semitransparente, claro en modo claro y negro en modo oscuro, para que el texto y las tarjetas se lean bien.

Al cambiar de apartado, cada pantalla entra con un desvanecido, un deslizamiento leve hacia arriba y una escala sutil durante 320 ms. En Android la animación usa el driver nativo.

Se revisó en la vista previa web de Cliente en modo demostración, en modo claro y oscuro, y se midió la transición de opacidad de 0 a 1. Pasaron las 40 pruebas JavaScript.
