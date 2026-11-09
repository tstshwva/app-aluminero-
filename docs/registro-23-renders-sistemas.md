# Avance 23 Renders de sistemas a partir de los planos

Fecha 8 de noviembre de 2026.

## Planos revisados

Se renderizaron localmente y se revisaron las páginas de material de: mosquiteros 9.pdf (pág. 2), VENTANA corediza 1380.pdf (pág. 2), ventana corediza 1500 7.pdf (pág. 2), ventana fija 6.pdf (pág. 2), puerta ventana corediza 5.pdf (pág. 2), ventana fija 4.pdf (pág. 2), ventana corediza 3.pdf (pág. 2–4), productos ex 2.pdf (pág. 2–6) y SerieC-100MID15Dec.pdf (pág. 3–7). Con el avance 22, ya se revisaron todas las páginas de material de los 18 PDF; de la guía C-100 MID quedan sin revisar visualmente las páginas 9–26 (cortes, vistas, combinaciones, armado y gráficas), que no se usan para las imágenes.

## Resultado

- 73 secciones nuevas en scripts/catalogo/secciones-sistemas.js: mosquiteros, corredizas 1380/1500/2000/3000, fijas 2000/3000 (familias bolsa, bolsa lisa, escalonado, tapa y junquillo), C-80 (rieles con pistas en «J», cercos, aletas, escalonados) y C-100 MID (rieles con pistas huecas, adaptadores de vidrio de 12/15/18 mm, porta felpas, OXXO central y refuerzo).
- Empaques E-126/6.5 y 195-15 PENS, felpa FN-110 y vinil 319-4.0 se representan en material oscuro; la escuadra GN-608 y la tapa de dren GN-554 como piezas planas. Su nota indica que la forma es ilustrativa porque el manual no las acota.
- Total: 110 de 125 registros con render (estado «ilustrativa» en database/catalogo/image-manifest.json), más 8 ilustraciones de sistema.
- Pendientes (15): carros 45/30.03-A, GT45/40.03A y T26/9X, cierres F-306E y F306, uñeros UN-305T y F305, M.P. / F-608, contra y gancho GYC-100MID, candado GN-623, escuadra de botón GN-481, tapa de traslape GN-622TT, cortavientos GN-622CV, tela mosquitera TE y la calza de neopreno sin código. Son mecanismos o piezas que no se deben representar como perfiles extruidos; requieren fotografía autorizada o un modelo 3D de la pieza real.
- Los perfiles 78410 y 18409 se dibujan según su plano y conservan su nombre provisional.

## Criterio

Las siluetas respetan las cotas impresas, la disposición de paredes, canales, pistas, ganchos y retenes de vidrio. Se omiten dentados, radios menores y puertos de tornillo finos, y el espesor de pared es ilustrativo. No se copian los dibujos ni las páginas del proveedor; los renders son modelos independientes.

## Verificación

- npm test: 35 pruebas aprobadas (incluye que cada ruta del manifiesto exista y sea única).
- Navegador: 116 imágenes cargadas en el catálogo de la vista previa (110 renders del catálogo y 6 genéricas de productos de demostración) y 14 avisos de imagen pendiente, que corresponden a los mecanismos y a la tela mosquitera.
