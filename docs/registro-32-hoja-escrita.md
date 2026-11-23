# Avance 32 Escaneo de cotización escrita en hoja

Fecha 23 de noviembre de 2026.

Antes, la foto de una hoja solo llenaba un cuadro de texto y la búsqueda posterior exigía texto idéntico. Ahora, al terminar la lectura, se abre «Materiales de tu hoja», que muestra únicamente los productos escritos, uno por renglón, con su cantidad. Las coincidencias dudosas se marcan y se pueden cambiar, y los renglones sin coincidencia se avisan. Al volver de la ficha de un producto se conserva la lista.

Con foto, la IA recibe solo la instrucción de transcribir, sin el catálogo ni las indicaciones del asistente. La comparación con el catálogo se hace en la app (`matchList`).

En la demostración hay un botón «Probar con una hoja de ejemplo», porque no hay servicio de IA. Pasaron las 41 pruebas JavaScript y se revisó la hoja de ejemplo en la vista previa de Cliente. Queda pendiente probar una foto real en un teléfono con Firebase y App Check.

La lista se muestra numerada y agrupada en Reconocidos, Por revisar y No encontrados. Cada renglón tiene un botón rojo con borde para eliminarlo, con opción de deshacer la última eliminación. Al corregir la lista, los renglones eliminados ya no aparecen.
