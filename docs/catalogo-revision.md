# Revisión del catálogo maestro

Archivo generado por scripts/catalogo/normalizar-catalogo.js a partir de database/catalogo/fuentes/catalogo_maestro_ALUFORMIX.json. No editar a mano.

- Registros: 125 (el maestro declara 125).
- Por categoría: Perfiles: 92 · Accesorios: 21 · Herrajes: 12.
- Por estado: verificado: 101 · requiere_validacion: 6 · requiere_revision_dimensional: 17 · requiere_codigo: 1.
- Sin código: 1. Con alias o lectura alternativa: 5.
- Precio pendiente: 125. Barra de 6 m respaldada por la fuente: 36. Unidad por confirmar: 72.

## Conflictos documentados en el maestro

| Tema | Referencias | Acción |
| --- | --- | --- |
| Código del cerco de puerta batiente 1750 | PDF Puerta Batiente13.pdf, pág. 2: el rótulo parece decir '9204 6'<br>JSON complementario anterior: #9204<br>JSON principal anterior: #92046 | Mantener una sola ficha provisional con código preferido #9204 y alias #92046; no publicar como definitivo hasta confirmación. |
| Código GN-481 | C-100 MID PDF, pág. 7: GN-481 Escuadra de botón 421<br>C-100 MID PDF, pág. 15-16: GN-481 Escuadra de botón<br>C-100 MID PDF, pág. 17: la tabla parece describir GN-481 como Escuadra de alineación | Mantener la discrepancia y pedir confirmación. No crear dos productos con el mismo código ni asumir que es GN-608. |
| Carro de 70 kg | C-100 MID PDF, pág. 6 y 16: GT45/40.03A<br>C-100 MID PDF, pág. 17: parece GT54/40.03A | Registrar como una ficha provisional con alias alternativo y solicitar validación de código. |
| Empaques | C-100 MID PDF, pág. 7: E-126/6.5 Empaque acristalar<br>C-100 MID PDF, pág. 16: E126 Empaque interior<br>C-100 MID PDF, pág. 7: 195-15 PENS Empaque cuña<br>C-100 MID PDF, pág. 16: 195-15 Cuña respaldo ext. | Conservar los nombres y códigos como referencias relacionadas, pero no fusionar hasta confirmar equivalencia. |
| Cierres y uñeros | C-100 MID PDF, pág. 6: F-306E Cierre embutido S/T y UN-305T Uñero metálico<br>C-100 MID PDF, pág. 16: F306 Cierre brio<br>C-100 MID PDF, pág. 17: F305 Uñero embutido | Tratar como claves distintas; no unificar por similitud del nombre. |
| M.P. / F-608 | C-100 MID PDF, pág. 6: M.P. M-PuntoP y F-608 Manilla<br>C-100 MID PDF, pág. 16: una fila combinada M.P. / F-608 | Mantener como referencia combinada provisional y confirmar si es un conjunto, una variante o dos productos. |
| Perfiles sin nombre | Ventana corediza 3.pdf, pág. 3: códigos 78410 y 18409 con sección dibujada, sin nombre legible | Crear ficha por código con nombre 'Perfil código ... (descripción pendiente)' y no inventar el nombre. |
| Componente sin clave | C-100 MID PDF, pág. 6: Calza de neopreno sin código visible | Crear ficha provisional con código nulo y estado requiere_codigo. |
| Cero inicial en códigos | Mosquiteros 9.pdf, pág. 2: 07333<br>Ventana corediza 3.pdf, pág. 3: 02082 | Guardar códigos como texto y conservar ceros iniciales. |
| Longitud de perfiles | JSON complementario anterior asigna barra de 6 m a 24 registros<br>Varios planos de perfil no especifican longitud<br>C-100 MID PDF, pág. 27 sí indica largo de 6.00 m para perfiles C-100 MID | Conservar 6 m cuando está indicado en el JSON previo o en la ficha técnica C-100 MID; en los demás dejar longitud no especificada y marcar para confirmar. |

## Registros con estado distinto de verificado o con notas

| Código | Producto | Estado | Notas | Fuente |
| --- | --- | --- | --- | --- |
| 9204 · alias 92046 | Cerco de puerta de 1750 | requiere_validacion | El plano muestra visualmente '9204 6'; el JSON complementario indica #9204 y el JSON principal anterior #92046. Confirmar el código comercial con el cliente/proveedor antes de publicar. | Puerta Batiente13.pdf pág. 2 |
| 07333 | Perfil mosquitero | verificado | El código se imprime con cero inicial: 07333. No normalizarlo como 7333. | mosquiteros 9.pdf pág. 2 |
| 11839 | Riel intermedio | requiere_revision_dimensional | — | ventana corediza 1500 7.pdf pág. 2 |
| 11838 | Riel | requiere_revision_dimensional | — | ventana corediza 1500 7.pdf pág. 2 |
| 9084 | Escalonado de 2 pulgadas | requiere_revision_dimensional | — | ventana fija 6.pdf pág. 2 |
| 9088 | Junquillo de 2 pulgadas | requiere_revision_dimensional | — | ventana fija 6.pdf pág. 2 |
| 4286 | Riel | requiere_revision_dimensional | — | puerta ventana corediza 5.pdf pág. 2 |
| 9955 | Traslape puerta | requiere_revision_dimensional | — | puerta ventana corediza 5.pdf pág. 2 |
| 9136 | Escalonado de 3 pulgadas | requiere_revision_dimensional | — | ventana fija 4.pdf pág. 2 |
| 9112 | Junquillo de 3 pulgadas | requiere_revision_dimensional | — | ventana fija 4.pdf pág. 2 |
| 9957 | Riel | requiere_revision_dimensional | — | ventana corediza 3.pdf pág. 2 |
| 7848 | Traslape puerta | requiere_revision_dimensional | — | ventana corediza 3.pdf pág. 2 |
| 78410 | Perfil código 78410 (descripción pendiente) | requiere_validacion | El plano muestra código y geometría, pero no un nombre legible. No inventar nombre comercial. | ventana corediza 3.pdf pág. 3 |
| 18409 | Perfil código 18409 (descripción pendiente) | requiere_validacion | El plano muestra código y geometría, pero no un nombre legible. No inventar nombre comercial. | ventana corediza 3.pdf pág. 3 |
| 02082 | Junquillo embellecedor | verificado | Conservar el código como texto para mantener el cero inicial. | ventana corediza 3.pdf pág. 3 |
| 62000 | Riel doble | requiere_revision_dimensional | — | productos ex 2.pdf pág. 2 |
| MXG62001 | Cerco 6 mm | requiere_revision_dimensional | — | productos ex 2.pdf pág. 3 |
| MXG64207 | Riel adaptador | requiere_revision_dimensional | — | productos ex 2.pdf pág. 3 |
| MXG62002 | Aleta traslape | requiere_revision_dimensional | — | productos ex 2.pdf pág. 4 |
| MXG62003 | Adaptador OXXO | requiere_revision_dimensional | — | productos ex 2.pdf pág. 4 |
| 62006 | Refuerzo interior | requiere_revision_dimensional | — | productos ex 2.pdf pág. 4 |
| 62020 | Escalonado doble | requiere_revision_dimensional | — | productos ex 2.pdf pág. 6 |
| (sin código) | Calza de neopreno | requiere_codigo | La página 6 muestra el componente, pero no se aprecia una clave o código asociado.<br>No asignar código comercial hasta que el cliente/proveedor lo confirme. | SerieC-100MID15Dec.pdf pág. 6 |
| F-306E | Cierre embutido S/T | verificado | No asumir que es igual al código F306 (cierre brio) que aparece en la tabla de armado. | SerieC-100MID15Dec.pdf pág. 6 |
| GYC-100MID · alias G y C | Contra y gancho | verificado | En la tabla de armado de marco aparece abreviado como 'G y C / Contra'. | SerieC-100MID15Dec.pdf pág. 6, 15, 16 |
| M.P. / F-608 | M-PuntoP / Manilla | requiere_validacion | La página 6 asocia M.P. / M-PuntoP y F-608 / Manilla; la tabla de armado los presenta juntos en una misma fila. Confirmar si es un producto combinado, un modelo y su código, o dos referencias. | SerieC-100MID15Dec.pdf pág. 6, 16 |
| GT45/40.03A · alias GT54/40.03A | Carro de 70 kg | requiere_validacion | La página 6 y la tabla de armado de hoja (PDF pág. 16) muestran GT45/40.03A; la tabla de hoja mosquitera (PDF pág. 17) parece mostrar GT54/40.03A. Confirmar clave exacta. | SerieC-100MID15Dec.pdf pág. 6, 16, 17 |
| GN-481 | Escuadra de botón | requiere_validacion | Las tablas de marco y hoja la describen como escuadra de botón; la tabla de hoja mosquitera (PDF pág. 17) parece asociar la misma clave GN-481 a 'escuadra de alineación'. Confirmar la descripción/código correcto antes de mostrarla. | SerieC-100MID15Dec.pdf pág. 7, 15, 16, 17 |
| E-126/6.5 · alias E126 | Empaque para acristalar | verificado | La tabla de armado de hoja abrevia la clave como E126 y la descripción como empaque interior. Confirmar si corresponde exactamente al E-126/6.5. | SerieC-100MID15Dec.pdf pág. 7, 16 |
| 195-15 PENS · alias 195-15 | Empaque cuña | verificado | La tabla de armado lo describe como cuña de respaldo exterior. Confirmar la correspondencia con 'empaque cuña'. | SerieC-100MID15Dec.pdf pág. 7, 16 |
| F306 | Cierre brio | verificado | Clave distinta de F-306E. No fusionar sin confirmación del proveedor. | SerieC-100MID15Dec.pdf pág. 16 |
| F305 | Uñero embutido | verificado | Clave distinta de UN-305T. No fusionar sin confirmación del proveedor. | SerieC-100MID15Dec.pdf pág. 17 |
