# Registro 13 — Configuración local de JavaScript

Fecha: 1 de noviembre de 2026.

Se prepararon los archivos .env de la API, Cliente y Empresa a partir de las plantillas. No contienen credenciales inventadas. scripts/configurar.ps1 -Preparar crea únicamente los archivos ausentes y conserva los existentes.

scripts/revisar-configuracion.js comprueba presencia de valores, puertos, usuario de aplicación distinto de root, certificado y clave coincidentes, vigencia, correo y URL HTTPS de cada app. Se ejecuta con npm run config:check. No imprime secretos, conecta a MySQL ni envía correo. La revisión de certificado no demuestra confianza del teléfono, nombre de host ni cadena completa.

Resultado inicial: siete pendientes: usuario MySQL, contraseña, usuario distinto de root, certificado HTTPS, correo y las dos URL móviles. Correo puede prepararse después, pero la recuperación seguirá deshabilitada hasta configurarlo.

No se modificó la base de datos, no se crearon usuarios ni se cambió la red. Falta elegir alojamiento HTTPS accesible para ambos dispositivos y configurar el usuario MySQL con permisos limitados. No compartir contraseñas en el chat; introducirlas localmente.
