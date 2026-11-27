# Trabajo en Aluformix

Repositorio autorizado: https://github.com/tstshwva/app-aluminero-.git

Por solicitud del propietario, al terminar cambios del proyecto:
- Revisar el código y ejecutar las comprobaciones apropiadas.
- Registrar el avance en docs cuando corresponda.
- Revisar los archivos que se van a publicar y excluir credenciales, claves privadas, datos personales y copias de bases reales.
- Crear un commit descriptivo y subirlo al repositorio autorizado.
- Si no se puede subir, conservar el trabajo e informar el motivo; no afirmar que se publicó.

No añadir contraseñas o tokens al código, documentación o commits. Mantener .env, .local, node_modules y artefactos temporales fuera de Git.

Por solicitud del propietario, cada actualización y entrega de APK debe revisar rendimiento en gama baja:
- Ejecutar la suite y la prueba de catálogo/compra con heap Node limitado de 128 MB, además de los controles de seguridad y conexiones pertinentes.
- Mantener listas de productos acotadas o virtualizadas y usar miniaturas en tarjetas; conservar originales para fichas.
- Para entregar APK, verificar firma de distribución, paquete, Firebase, revisión incorporada y modelo OCR. Nunca entregar una compilación de demostración como app real.
- Al medir Android remoto, registrar RAM, núcleos, datos de prueba y qué pantallas se recorrieron. No afirmar fluidez de un teléfono físico a partir de mocks, Node o un emulador.
- Cada prueba de APK debe usar el instalador recién compilado y su SHA-256, no reutilizar una demostración de otra revisión como evidencia del código nuevo.
