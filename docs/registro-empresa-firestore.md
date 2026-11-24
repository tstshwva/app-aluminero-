# Empresa conectada a Firestore

## Problema corregido

El adaptador de Firebase solo ofrecía lectura de catálogo, sesiones y encargos. Los botones de Empresa invocaban operaciones que no existían. Las reglas anteriores tampoco permitían escribir categorías, productos ni actualizar encargos. La app ya tenía credenciales de Firebase; faltaba completar su lógica de negocio y sus permisos.

## Implementación

- `packages/client/src/enterpriseFirebase.js` implementa categorías, productos, clientes, configuración, movimientos de inventario, cotizaciones, aceptación, estados, pagos y avisos dentro de la app. Comprueba el rol contra Firestore antes de cada operación de personal. Las cotizaciones, reservas y pagos utilizan transacciones.
- `packages/client/src/enterpriseDomain.js` valida textos, decimales, importes y cambios de estado. Calcula cotizaciones redondeando a centavos, con precios por renglón, impuesto y envío.
- `packages/client/src/firebaseClient.js` conecta esas operaciones al contrato que ya usan las pantallas. Completa nombres y precios en el detalle de los encargos y permite registrar encargos de mostrador para clientes seleccionados.
- `firestore.rules` permite consultar y operar únicamente con los roles correspondientes. Los compradores siguen limitados a sus propios encargos y perfiles. No pueden cambiar precios, existencias, importes al aceptar una cotización ni asignarse roles.
- El inventario se reserva cuando Empresa empieza a preparar un encargo confirmado. Se libera al cancelar y se descuenta al entregar. Se requiere registrar el saldo antes de entregar. La aceptación del comprador por sí sola no reserva inventario.
- Los pagos usan un identificador estable para evitar duplicados al repetir una solicitud. Son registros de pagos ya recibidos; la app no procesa cobros bancarios.
- El inicio de Empresa escucha los encargos en tiempo real, además de la lista de encargos. Las operaciones de escritura requieren conexión. La consulta offline conserva los datos descargados.
- La creación de personal usa una sesión temporal de Firebase Authentication, separada de la sesión del administrador. Las contraseñas no se guardan en Firestore ni en la caché. Solo un administrador puede asignar el rol. El registro por invitación continúa disponible para Operador.

## Verificación

59 pruebas generales y 8 pruebas contra el emulador de Firestore con las reglas reales. El flujo de integración cotiza un pedido, acepta la cotización como comprador, reserva como operador, registra un pago dos veces con el mismo identificador y entrega sin duplicar el pago ni el descuento de existencias. También verifica cancelación, permisos por rol, invitaciones de un solo uso e inventario insuficiente. Los rechazos PERMISSION_DENIED en los casos negativos son esperados.

Para repetir las pruebas de integración se requiere Java 21 y Firebase CLI 15.36.0:

```
npx firebase-tools@15.36.0 emulators:exec --only firestore --project demo-aluformix --config firebase.test.json "node tests/firebase/empresa.test.mjs"
```

`firebase.test.json` solo configura el emulador de pruebas. Las apps siguen conectándose al proyecto real `alumineroapp-9244c` y no utilizan ese archivo ni sus puertos.

Las pruebas del emulador no prueban un teléfono físico ni el acceso a la red de la universidad. Quedan pendientes la comprobación visual en Android, la creación real de una cuenta de personal y la lectura de fotos en la instalación de Empresa. El registro de un dispositivo para avisos no incluye un servicio automático de entrega de notificaciones push; los avisos de encargos están disponibles dentro de la app. El asistente requiere conexión y App Check válido.

## Separación de las aplicaciones

Se retiraron de Empresa los accesos al carrito, creación de compras, selección de acabados y cortes para comprar, repetición de encargos, escaneo de cotizaciones del comprador y chat de orientación de materiales. Esas funciones permanecen en Cliente. Las pantallas de compra no se renderizan para Empresa y sus accesos programáticos también se bloquean.

Empresa conserva inventario, registro y edición de productos para Administrador, clientes, solicitudes recibidas, cotizaciones, pagos, seguimiento, entregas, configuración y permisos. El inicio ofrece Registrar producto en lugar de Nuevo encargo y Entregas en lugar de Escanear cotización. El Operador ve atención de encargos; los controles de edición de productos se reservan al Administrador. La ayuda y el aviso sin conexión también distinguen las dos apps.

Verificación: 60 pruebas generales. La prueba de navegación renderiza la interfaz de Empresa, entra al inventario y al detalle de un producto, y comprueba que no estén los botones de compra, cámara, chat o favoritos, conservando la edición de productos y la entrada de inventario. Las pruebas existentes del Cliente siguen verificando su carrito y solicitud de encargos.
