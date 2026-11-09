# Avance 19: modo demostración para ver las apps en el teléfono

Fecha: 8 de noviembre de 2026.

## Motivo

El propietario necesita ver las dos apps en su teléfono para revisar el diseño. Sin una API HTTPS accesible desde el teléfono, la app real solo llega a la pantalla de acceso. La publicación HTTPS sigue pendiente. El modo demostración permite recorrer todas las pantallas mientras tanto.

## Cambios

- `packages/mobile/src/demoClient.js`: cliente con la misma interfaz que `@aluformix/client`. Usa datos de ejemplo en memoria (catálogo, clientes, encargos en distintos estados, avisos) y aplica las mismas reglas principales que la API: estados de encargo, revisión de la cotización, reserva al aceptar, descuento al entregar, saldo de pagos y permisos de personal y administrador.
- `packages/mobile/src/App.js`: si `EXPO_PUBLIC_DEMO=1`, usa el cliente de demostración y muestra un aviso visible. Sin esa variable, el comportamiento no cambia.
- `apps/cliente/.env.example` y `apps/empresa/.env.example`: documentan `EXPO_PUBLIC_DEMO`.
- `scripts/revisar-configuracion.js`: marca como pendiente cualquier app que tenga el modo demostración activo, para evitar publicarla así por error.
- `tests/javascript/demo-client.test.js`: dos pruebas del recorrido de Cliente y de Empresa.

## Cómo usarlo

1. En `apps/cliente/.env` y en `apps/empresa/.env`, escribir `EXPO_PUBLIC_DEMO=1`.
2. Ejecutar `./iniciar.ps1 -Accion cliente` (o `empresa`) y escanear el código QR con Expo Go, con el teléfono y la computadora en la misma red Wi-Fi.
3. En la pantalla de acceso, escribir cualquier correo y contraseña.

## Límites

- Los datos viven en memoria. Se reinician al recargar la app y no se comparten entre Cliente y Empresa, porque son apps separadas.
- No contacta la API ni la base de datos, no envía correos y no usa IA ni notificaciones del teléfono. Esas acciones responden «no disponible».
- No sustituye las pruebas de integración contra la API ni la prueba en el teléfono con el servidor real.
- Antes de compilar una versión real, dejar `EXPO_PUBLIC_DEMO` vacío. `npm run config:check` lo comprueba.

## Comprobaciones

- `node --test tests/javascript/demo-client.test.js`: 2 de 2 correctas.
- `npm test` en un entorno sin dependencias instaladas: 19 de 22 correctas. Las 3 que fallan (`business-ui`, `sqlserver` y `syntax`) no encuentran módulos que no están instalados y fallaban igual antes de este cambio. Falta correrlas con `npm ci` en la computadora del proyecto.
- Revisión de sintaxis JSX de `App.js` y `demoClient.js` con el compilador de TypeScript: sin errores.
- No se probó todavía en un teléfono físico desde este entorno.
