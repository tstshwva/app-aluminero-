# Registro 04 — Diseño aprobado y datos de la aplicación real

Fecha: 28 de octubre de 2026.

## Referencia visual vigente

Se revisaron las imágenes de `pantallas-prototipo-aluformix (1).zip` (20 pantallas de empresa) y `aluformix-pantallas (1).zip` (14 pantallas de comprador). Son referencias de presentación y navegación; no contienen código MAUI ni son una fuente de datos del negocio. Los originales se conservan sin modificación.

## Regla de implementación

La aplicación inicia sin productos, clientes, encargos, pagos ni notificaciones inventados. Cada registro procede de una acción autorizada del usuario o de una importación real validada. No habrá valores ficticios de respaldo si la API falla: se mostrará el error y la opción de reintentar. Los estados sin registros mostrarán mensajes como «Aún no hay productos» y «Registrar producto», según el permiso del usuario.

Se conserva la identidad visual y la distribución de las pantallas. Los nombres Dayana/Luis, fotos de personas, talleres, folios ENC-024, precios, cantidades, fechas y saldos de las imágenes no se copian como valores iniciales. Los saludos usarán el nombre de la cuenta que inició sesión. Las imágenes de materiales deberán corresponder al catálogo real autorizado.

Se eliminan del alcance de interfaz real los accesos «Simular encargo», «Usar lista de ejemplo», el cambio libre de rol, las cotizaciones de ejemplo y los avisos sobre navegador/prototipo/demostración. No se mostrarán confirmaciones de acciones que la API no haya guardado correctamente.

| Módulo | Fuente real de información / comportamiento |
|---|---|
| Inicio empresa | Conteos e indicadores calculados a partir de encargos e inventario reales. |
| Inventario y stock bajo | Materiales registrados por la distribuidora; precios y mínimos configurados por ella. |
| Movimientos | Entradas, ajustes, reservas y entregas efectivamente realizadas, con usuario y fecha. |
| Encargos y entregas | Solicitudes reales; cambios de estado validados por permisos y reglas de inventario. |
| Cotizaciones | Partidas del encargo, precios vigentes acordados, impuesto y envío configurados por el negocio. No asumir política fiscal a partir de la imagen. |
| Clientes y perfil | Datos proporcionados por los usuarios y acceso según rol y propietario. |
| Catálogo y carrito | Productos publicados por la distribuidora y selección del comprador. No precargar el carrito. |
| Confirmación | Se muestra únicamente después de una respuesta correcta de la API, con folio real. |
| Notificaciones y actividad | Eventos reales persistidos; no preinsertar mensajes para llenar pantallas. |
| Cámara / lista | Foto o texto introducido por el usuario; solo indicar reconocimiento si existe integración real y exigir revisión antes de crear un encargo. |
| Usuarios y permisos | Autenticación y autorización del servidor; no selector de roles de demostración. |
| Respaldos y ayuda | Recuperación controlada y guía de funciones implementadas; no importar JSON del prototipo como datos reales. |

Login, registro del comprador, recuperación y cierre de sesión siguen siendo requisitos, aunque no aparezcan en estas imágenes. Las tablas actuales no implementan todavía favoritos, múltiples direcciones, adjuntos o recuperación de contraseña; se definirán con migraciones al desarrollar esos módulos. No se declara el diseño completo implementado.

## Corrección realizada en el proyecto

Los datos ficticios se movieron de `database/002_demo.sql` a `tests/fixtures/demo.sql`. La instalación normal del README y el archivo combinado para Workbench ahora incluyen exclusivamente esquema y restricciones; ya no insertan productos ni clientes. Las pruebas aisladas conservan sus datos ficticios para verificar comportamientos sin utilizar información de la empresa. Los roles y la versión del esquema son configuración del sistema, no datos comerciales de demostración.

## Datos cargados previamente en el servidor permanente

En el avance anterior se cargaron cuatro productos, tres categorías y un cliente ficticio. Esa carga fue un error de separación entre evidencia y aplicación real. Su presencia está registrada en las capturas anteriores y no debe presentarse como catálogo del negocio. Se preparará una limpieza controlada; no se afirmará que fueron retirados hasta verificar su ejecución. No se eliminarán registros reales ni se reemplazará toda la base.

Las evidencias anteriores se conservan como histórico identificado de pruebas. Las futuras evidencias de la aplicación real mostrarán estados vacíos o información auténtica autorizada. No hay aún pantallas MAUI implementadas a partir del nuevo diseño.

## Ejecución de limpieza autorizada y verificación final

El usuario autorizó expresamente retirar la carga ficticia. Antes de ejecutar la limpieza se consultó y guardó un respaldo JSON completo de los cuatro productos, el cliente y las tres categorías en `database/backups/demo-antes-limpieza.json`, excluido de Git.

Se ejecutó `database/manual_remove_demo.sql` en Workbench. El procedimiento verificó contenido y ausencia de operaciones, retiró solo los registros originales y fue eliminado al terminar. La consulta final devolvió **0 productos, 0 clientes, 0 categorías, 3 roles y 13 tablas**. La captura real y su registro están en `evidencia-base-datos/07-workbench-base-sin-datos-ficticios.png` y `.txt`. No se borraron las tablas ni los roles. No se reiniciaron los contadores de identificadores.

La nueva ejecución de integración completó **32 comprobaciones**, incluidas instalación comercial vacía, limpieza rechazada cuando cambia un registro, conservación de registros tras rechazo, limpieza de la carga original y conservación de roles. Evidencia aislada: `.test-artifacts/2fad28fe2dba4e148bd0c60ad8c11357/result.txt`.

Las pantallas suministradas se adoptan como referencia vigente. Esta revisión no implementó todavía las vistas MAUI. No se modificó el prototipo HTML ni el archivo de Figma, que conservan su función de referencia histórica. Los mensajes técnicos y registros de prueba no se incorporarán a las pantallas de la app real.
