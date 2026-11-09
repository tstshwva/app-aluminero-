# Avance 20 Diseño aprobado para Cliente y Empresa

Fecha 8 de noviembre de 2026.

La referencia vigente son las 14 pantallas de aluformix-pantallas (1).zip y las 20 pantallas de pantallas-prototipo-aluformix (1).zip. Se compararon con la estructura de la app y se adaptó el código nativo compartido, con contenidos y accesos diferenciados por rol.

## Diseño aplicado

- Logotipo de la referencia e iconos lineales en las dos apps. Cabecera fija con acciones de acuerdo al rol y barra inferior fija con margen automático del sistema.
- Cliente conserva Inicio, Catálogo, Encargos y Perfil como pestañas. Inicio incluye saludo, bloque de catálogo, búsqueda y materiales. Catálogo y carrito muestran filas con miniaturas. El carrito mantiene cantidades decimales y muestra importes estimados cuando los datos son válidos. La confirmación se muestra después de guardar un encargo real.
- Empresa conserva Inicio, Inventario, Encargos y Más. Inicio muestra indicadores y encargos recientes. Inventario incluye la lista de productos por agotarse y separa ficha, movimientos, entrada y ajuste. Más organiza clientes, entregas, actividad de encargos, configuración, permisos y ayuda.
- El comprador puede abrir seguimiento, detalle y cotización. Se conservan los controles reales de aceptación, cancelación, inventario y pagos.
- Se actualizó el aspecto del lector. La cámara sigue leyendo QR y códigos de barras. Las capturas de referencia incluyen acciones simuladas de listas y respaldos que requieren servicios independientes. Las apps siguen usando fotos y registros reales de la API.

## Verificación

La comparación visual de Inicio y Catálogo de Cliente, Inicio e Inventario de Empresa, carrito, seguimiento, cotización y Más se realizó en una vista local de los componentes a ancho de teléfono con datos aislados de prueba. Las fotos de productos se muestran cuando están registradas en el catálogo. Las pruebas automatizadas cubren navegación, carrito, solicitud, cotización y permisos. Se mantiene pendiente una comparación en un teléfono físico.

## APK de esta revisión

Se aprobaron las 26 pruebas. Ambos APK firmados se verificaron por identificador, firma Android, permisos, bloqueo de HTTP, alineación y presencia de las pantallas nuevas en el bundle. Se usan con el puente USB a la API local.

- Aluformix-cliente-usb.apk · SHA-256 AA887C9ECB3A11E3E8E41BA90968C07A31ECA453EC9A81742E22F58F7F0C02A0
- Aluformix-empresa-usb.apk · SHA-256 709F1A48A4A9311DBEE31EF8BA0D4930B4CE7C428B0DD205942D1FC47125433F
