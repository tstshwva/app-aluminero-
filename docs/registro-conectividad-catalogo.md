# Aviso de conexión y catálogo

24 de noviembre de 2026.

La comprobación de alcance de expo-network podía impedir consultar Firebase aunque existiera un enlace Wi-Fi o móvil. Ahora solo una desconexión explícita (isConnected false o tipo NONE) activa el bloqueo previo. Tener enlace no asegura acceso a Firebase: si la consulta falla se conserva su código y causa, y se usa la copia cifrada disponible. Sin copia se explica que no fue posible actualizar desde el servicio, sin afirmar que el usuario no tiene internet.

El catálogo completo comparte clave de caché para products() y products(""). Se mantienen la separación por cuenta y las claves antiguas como respaldo. No se vacía ni modifica el catálogo de Firebase ni se borran datos del teléfono. Las reglas y el control de permisos no cambian.

El comprobador de actualizaciones usa el mismo criterio. La descarga con datos móviles sigue pidiendo confirmación. La preferencia de sincronización de pedidos solo por Wi-Fi se conserva.

Pruebas de regresión: enlace activo con alcance negativo en Wi-Fi y datos, desconexión explícita, estado desconocido, caché entre inicio y catálogo, error remoto sin copia, permisos, separación de cuentas y descarga de actualizaciones con consentimiento. Pendiente verificar la red específica del teléfono: esta corrección no elimina restricciones de red ni interrupciones de Firebase.
