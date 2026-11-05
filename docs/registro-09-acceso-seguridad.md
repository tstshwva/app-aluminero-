# Registro 09 — Acceso y seguridad
Fecha: 29 de octubre de 2026.
Proyecto: C:\Users\Reyca\Documents\Aluformix.

## Corrección de la pantalla inicial
La aplicación abre el formulario de inicio de sesión aunque falte la dirección del servidor. Antes sustituía el formulario por una pantalla de servicio no disponible. No se utiliza una dirección inventada: si falta configuración, la operación muestra un mensaje y no envía credenciales.

## Información que se guarda
El registro de comprador guarda el usuario y su ficha de cliente dentro de una transacción: ambos registros se confirman juntos. La contraseña se guarda como hash con sal, nunca como texto legible. Las sesiones se guardan en auth_sessions como hash del token, con fecha de caducidad y revocación. El teléfono utiliza almacenamiento seguro para el token; no conserva la contraseña.

## Mejoras implementadas
- Cambio de contraseña desde Mi cuenta, con campos ocultos y confirmación. El servidor exige la contraseña actual y una nueva distinta de 12 a 128 caracteres.
- Contraseña, revocación de sesiones e invalidación de códigos de recuperación se guardan en una sola transacción. Así, un error no deja un cambio a medias.
- Cierre de todas las sesiones desde Mi cuenta. El servidor revoca todos los tokens del usuario autenticado, sin aceptar un identificador ajeno desde el formulario.
- PasswordHasher de ASP.NET Core con 220000 iteraciones; los hashes anteriores se actualizan al iniciar sesión correctamente.
- Se mantienen bloqueo temporal por cinco intentos fallidos, límite de solicitudes, autorización por roles, consultas parametrizadas y errores sin detalles internos.

Referencia de almacenamiento de contraseñas: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

## Validación
API y biblioteca de conexión compiladas sin errores ni advertencias. Pruebas HTTP contra MySQL aislado verifican registro, persistencia, inicio y cierre de sesión, permisos, recuperación, bloqueo, cambio de contraseña y revocación. No se cargaron usuarios ni productos de prueba en la base real. Revisión de sintaxis C# y XML de los 22 archivos móviles correcta; no equivale a compilar ni ejecutar MAUI.

## Pendientes para entregar y desplegar
- Configurar la dirección real de la API y su conexión permanente a MySQL mediante secretos externos.
- Crear la cuenta real del administrador mediante la configuración inicial protegida. No existen contraseñas predeterminadas.
- Configurar correo y probar envío/recepción reales para recuperación. La API responde servicio no disponible si falta el proveedor.
- Implementar y verificar confirmación del correo antes de habilitar registro público en producción. Actualmente no se verifica la propiedad del correo.
- Compilar y probar en Android e iOS: faltan herramientas MAUI/Android; iOS requiere el entorno Apple correspondiente.
- Configurar despliegue HTTPS, respaldo/restauración, monitoreo y revisión de seguridad antes de abrir el sistema al público. La API actual permanece restringida al desarrollo local.
- El resto de módulos comerciales aún necesita completar pantallas y operaciones; esta revisión cubre el acceso.

Este avance no constituye una auditoría integral ni una aplicación lista para producción.
