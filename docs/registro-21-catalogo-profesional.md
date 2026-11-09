# Avance 21 Catálogo profesional de perfiles, accesorios y herrajes

Fecha 8 de noviembre de 2026.

## Fuentes y datos

- Los dos JSON recibidos se conservan sin cambios en database/catalogo/fuentes.
- scripts/catalogo/normalizar-catalogo.js los combina por código y genera packages/catalog/src/data.js y docs/catalogo-revision.md. El resultado es determinista y una prueba comprueba que data.js coincide con las fuentes.
- Resultado: 37 productos únicos (33 perfiles y 4 accesorios). Las fuentes no incluyen herrajes. Cada ficha conserva los registros originales de ambas fuentes en el campo fuentes.
- Reglas aplicadas: no se crearon códigos, medidas, precios ni acabados. precio_estimado = 0.0 se interpreta como precio pendiente y la app muestra «Consultar precio». Las barras sin longitud muestran «Longitud por confirmar». La barra de 6 m se conserva cuando una fuente la indica. Las medidas de la ficha se copian literalmente de la descripción original.
- Marcados para validación: #92046/#9204 (Cerco puerta de 1750, una sola ficha con #92046 y #9204 como código alterno buscable) y #6370, #7014 y #7013 (Accesorios en el catálogo principal, Perfiles en el adicional). El detalle y 73 diferencias menores con el criterio aplicado están en docs/catalogo-revision.md.

## Base de datos

- No cambia el esquema (sigue en versión 4). La subcategoría se expresa en el nombre de la categoría con el formato «Grupo / Subcategoría», por ejemplo «Perfiles / Cancel de baño». Una categoría nueva como «Herrajes / Bisagras» aparece automáticamente en el filtro HERRAJES.
- scripts/catalogo/importar-catalogo.js registra los productos que faltan. Sin argumentos solo simula. Con --aplicar trabaja en una transacción. Se puede repetir sin duplicar: el código (y el código alterno) identifica al producto y los registros existentes no se modifican.
- Se guarda price 0.00 para los precios pendientes, unit «Barra», «Barra de 6 m» o «Pieza (por confirmar)», y los acabados separados por comas. No se guardan imágenes en la base.
- Desde Empresa, Editar producto permite capturar el precio, la descripción, los acabados (separados por comas), la categoría y una URL HTTPS de imagen sin modificar el código.

## Imágenes

- scripts/catalogo/generar-imagenes.js produce una imagen WebP de 1024 × 1024 por producto, con aluminio cepillado, iluminación de estudio y sombra de contacto, en packages/mobile/assets/catalogo/perfiles y accesorios (herrajes queda preparada). Se nombran con el código, por ejemplo 2488-tubo-cuadrado-1-pulgada.webp, y se asocian por código en packages/mobile/src/catalogImages.js.
- Son ilustraciones vectoriales generadas por código, no fotografías. Tubos, ángulos, Tee y tubos rectangulares usan las medidas exteriores de la fuente con un espesor de pared ilustrativo. Los perfiles especiales (zoclos, serie 35, cancel de baño, línea 1750, Zeta y accesorios) son siluetas ilustrativas. La ficha lo indica como «Imagen ilustrativa».
- Los tubos ornamentales #82521 y #9613 se dibujan igual que sus versiones normales porque la fuente no define el detalle ornamental.
- Si el producto tiene una URL HTTPS registrada, la app la usa en lugar de la ilustración. Si no carga, vuelve a la ilustración o a un marcador neutro.

## App

- Catálogo: búsqueda inmediata por nombre, código, código alterno, medida, categoría, subcategoría y nombre de la otra fuente, sin distinguir mayúsculas ni acentos. Filtros TODOS | PERFILES | ACCESORIOS | HERRAJES con subcategorías, acceso rápido Vidrio, solo favoritos y orden por nombre o código, combinables. Incluye contador de resultados, estado de carga y estado vacío con «Limpiar filtros».
- Tarjetas con imagen, subcategoría, nombre, código, unidad, precio o «Consultar precio», favorito y acceso al detalle. Lista compacta en teléfono y cuadrícula de 2 o 3 columnas desde 720 px.
- Ficha con imagen ampliada, categoría, subcategoría, descripción, unidad, longitud, dimensiones, acabados, selector de acabado y botón AGREGAR A ENCARGO conectado al carrito existente.
- Encargos: la partida guarda el acabado elegido. La API valida que esté entre los acabados del producto y lo exige cuando hay varios. Un precio pendiente no genera importes estimados.
- Empresa: Más → Catálogo por validar lista las discrepancias de origen y los productos con precio pendiente. La ficha muestra las notas de validación al personal.

## Verificación

- npm test: 34 pruebas aprobadas. Las nuevas cubren registro completo sin duplicados, códigos de las fuentes, discrepancias marcadas, precios, unidades y acabados sin inventar, una imagen por producto, importación idempotente con reversión ante error, filtros, búsqueda, favoritos, ficha y encargo con acabado.
- tests/javascript/business-integration.js agrega el rechazo de un acabado no listado. Necesita SQL Server y no se ejecutó en este equipo.
- Revisión visual en el navegador con datos de demostración a 375 × 812 (lista) y 1280 × 860 (cuadrícula).
- Pendiente: ejecutar la importación con --aplicar contra la base real, capturar precios, validar los cuatro registros marcados y sustituir las ilustraciones por fotografías o dibujos técnicos cuando existan.
