# Avance 22 Catálogo maestro, sistemas y guía C-100 MID

Fecha 8 de noviembre de 2026.

## Fase 1 Auditoría

- Fuente de trabajo: database/catalogo/fuentes/catalogo_maestro_ALUFORMIX.json (125 registros: 92 perfiles, 21 accesorios y 12 herrajes; 101 verificados, 6 requieren validación, 17 requieren revisión dimensional y 1 requiere código).
- Los 18 PDF del cliente están en la carpeta de descargas del equipo (no se publican en el repositorio). Su número de páginas coincide con el maestro: 65 páginas en total, 28 de ellas de la guía C-100 MID.
- Los PDF son imágenes escaneadas, sin texto. Se renderizaron localmente para revisarlos. Se comprobaron contra el original: la tabla de descuentos C-100 MID (pág. 8, LF = L/2 − 138 y HF = H − 212), los datos técnicos (pág. 27: perfiles de 6.00 m, aleación 6063-T5, acabados Gris titanium, Negro anodizado y Madera texturizada), el aviso legal (pág. 28), el rótulo «9204 6» del cerco 1750 y los planos de las familias Tubos y barandales, Zoclos, Serie 35, Recubrimientos, Cancel de baño, Puerta batiente 1750, Ángulos y Tee, Tubos cuadrados y Tubos rectangulares.
- No se revisaron todavía, página por página, los planos de Mosquiteros, Ventanas 1380/1500, Fija y Corrediza 2000/3000, C-80 ni las páginas 3–7 y 9–26 de C-100 MID. Sus datos provienen de la transcripción del maestro.
- Los 37 registros importados antes están contenidos en el maestro. Los JSON históricos se movieron a database/catalogo/historicos como antecedente y ya no se importan.
- Conflictos: tabla completa en docs/catalogo-revision.md (generada). Se conservan sin resolver: 9204/92046, GN-481, GT45/GT54, empaques E-126/E126 y 195-15, F-306E/F306/F305/UN-305T, M.P./F-608, perfiles 78410 y 18409 sin nombre, calza de neopreno sin código y longitud de perfiles.

## Fase 2 Modelo de datos

- scripts/catalogo/normalizar-catalogo.js genera packages/catalog/src/data.js con los 125 registros, sistemas, fuentes y la guía C-100 MID. Los códigos se guardan como texto (07333 y 02082 conservan el cero inicial).
- Categoría comercial en la base: «Grupo / Subcategoría». Familia y sistemas se asocian por código desde data.js, así un junquillo sigue siendo accesorio y pertenece a su sistema.
- Unidad: solo 36 registros llevan «Barra de 6 m» (24 del JSON complementario y 12 de C-100 MID, pág. 27). Los demás quedan «Por confirmar» o «Pieza», sin longitud. La unidad textual de la fuente aparece en la ficha.
- Importación (scripts/catalogo/importar-catalogo.js): idempotente por código y alias; no modifica productos existentes; un registro sin código no se importa ni recibe un código inventado. Se importan 124 registros.
- La API devuelve hasta 1000 productos por consulta (antes 100) para que el catálogo completo esté disponible.

## Fase 3 Interfaz

- Accesos: Todos, Perfiles, Accesorios, Herrajes y Sistemas, con búsqueda global por nombre, código, alias, medidas, familia y sistema. Vidrio sigue como filtro contextual de accesorios para vidrio.
- Tarjetas: imagen, familia, nombre, código, unidad, medidas cuando existen, precio o «Consultar precio», favorito y «Ver ficha».
- Ficha: imagen, nombre, código y alias, familia, sistemas, unidad (con el texto de la fuente), longitud, dimensiones del plano, acabados, estado de validación, precio y AGREGAR A ENCARGO. El personal ve además la fuente PDF y página, y las notas de validación.
- Sistemas: ficha por sistema con ilustración del conjunto, componentes vinculados (los que no están en la base aparecen como no registrados) y documentos de origen.

## Fase 4 Imágenes

- database/catalogo/image-manifest.json registra código, nombre, ruta, tipo, fuente técnica y estado de cada registro y sistema.
- 37 renders modelados a partir de los planos revisados (estado «ilustrativa»). Se corrigieron las versiones anteriores: pasamanos con ranura y aletas, zoclos, celosía, duela, cancel de baño, puerta 1750 y ángulo de 37.5 mm. Los tubos ornamentales usan la misma sección que los normales porque así aparecen en el plano.
- 88 registros quedan «pendiente» con el aviso «Imagen técnica pendiente de validar»: perfiles de mosquiteros, ventanas y C-80/C-100 MID cuya sección no se ha modelado, y todos los herrajes y accesorios no extruidos, que requieren render o fotografía de la pieza real.
- 8 ilustraciones de sistema (conjunto armado, sin cotas).
- No se dispone de herramienta de generación de imágenes; todo se generó por código y no se presenta como fotografía.

## Fase 5 Sistemas técnicos

- C-80: componentes vinculados; se indica que no se entregó guía de armado.
- C-100 MID: índice de la guía por páginas, datos técnicos, calculadora de cortes solo para 2 hojas corredizas con mosquitero (tabla de la pág. 8), advertencia de compatibilidad de deflexión, nota de que las gráficas de viento (90, 120, 160 y 200 km/h, H/75) no son certificación estructural, y herramientas de armado como parte de la guía, no del inventario.
- La fila «Cerco 24 mm horizontal» se transcribe como «L / 2 + 3», tal como aparece impresa.

## Derechos de autor

Los documentos son de EXTRALUM y la pág. 28 prohíbe su reproducción. La app no incluye páginas, recortes, dibujos ni el logotipo o teléfono del proveedor. Los renders son modelos independientes etiquetados como ilustrativos. Antes de publicar dibujos o fotografías originales, el cliente debe confirmar la autorización del titular.

## Pendientes

- Modelar las secciones de los 55 perfiles restantes a partir de sus planos, por familia, y renderizar herrajes y accesorios no extruidos (o recibir fotografías autorizadas).
- Validar con el cliente los conflictos listados y los códigos sin confirmar.
- El estado de validación y la fuente se editan en el JSON maestro y se regeneran con el normalizador; todavía no hay pantalla para cambiarlos en la app. Precios, nombres, descripciones, acabados, unidad, longitud, imagen, activo y existencia sí se editan desde Empresa.
- Ejecutar la importación con --aplicar contra la base real.
- Las imágenes se mantienen en 4:3 (1200 × 900) según la indicación anterior; la tarjeta las muestra completas.

## Verificación

- npm test: 35 pruebas aprobadas (registros, códigos con cero inicial, conflictos, unidades, manifiesto, búsqueda, sistemas, calculadora, importación idempotente, favoritos y encargos).
- Navegador (vista previa con datos de demostración): 130 productos visibles, 43 imágenes cargadas, 87 con aviso de imagen pendiente, cuadrícula de sistemas y calculadora C-100 MID (1800 × 1200 → vidrio 762 × 988).
