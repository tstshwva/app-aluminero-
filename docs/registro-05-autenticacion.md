# Registro 05 Inicio de sesión de Aluformix

Fecha de registro: 28 de octubre de 2026.

## Resultado y alcance

Se implementaron registro de compradores, login, identificación de la cuenta, permisos de administrador y operador, cierre de sesión y recuperación con código. La API y el cliente HTTP compilan. Las pantallas MAUI están escritas; su compilación y prueba en dispositivo siguen pendientes por falta de maui-android y del entorno móvil. No hay APK generado ni despliegue público.

No se crearon usuarios comerciales de ejemplo en el servidor permanente. La migración 004 se aplicó en Workbench y dejó la versión 3; la base pasa de 13 a 15 tablas. La contraseña de MySQL del responsable no fue solicitada ni incluida en código.

## Archivos y explicación para colocar debajo de sus capturas

### database/004_authentication.sql

Agrega a users el conteo de intentos fallidos y la fecha de bloqueo. Crea auth_sessions para vincular sesiones con usuarios, almacenar el hash del token y registrar vencimiento o revocación. Crea password_reset_tokens con hash, vencimiento y fecha de uso. No agrega cuentas ni datos comerciales. La versión del esquema cambia a 3 y la migración se ejecuta una sola vez.

### src/Aluformix.Api/Auth.cs

Centraliza validaciones, registro transaccional de usuario y ficha de comprador, verificación de contraseña, bloqueo temporal y creación de sesiones. Usa PasswordHasher de ASP.NET Core Identity, con sal aleatoria incluida en su formato. Los tokens tienen 32 bytes aleatorios y solo su hash SHA256 se conserva en MySQL. La contraseña no se cifra para recuperarla: se verifica mediante el hash.

SessionAuthentication valida en cada solicitud que la sesión no esté vencida o revocada y que el usuario esté activo. Obtiene del servidor la identidad y el rol. El rol que envíe el móvil nunca se utiliza para autorizar un registro público.

### src/Aluformix.Api/AuthEndpoints.cs

Define registro, login, consulta de cuenta, logout y alta de personal. El registro público asigna Cliente. Solo Administrador puede crear personal. La configuración del primer administrador exige una clave externa aleatoria y se bloquea al existir una cuenta administrativa. No hay usuario ni contraseña predeterminados.

### src/Aluformix.Api/PasswordRecovery.cs

Solicita un código por correo, guarda únicamente su hash y lo limita a quince minutos. Al confirmar, bloquea la fila del usuario, consume el código dentro de una transacción, cambia el hash de contraseña y revoca todas las sesiones y los otros códigos. Un código usado o vencido se rechaza. Sin proveedor de correo configurado devuelve 503; no anuncia que envió un mensaje. No se probó SMTP real; el ensayo de confirmación usa un token de prueba insertado únicamente en la base aislada.

### src/Aluformix.Api/Program.cs

Sustituye la clave compartida de desarrollo por autenticación Bearer y políticas de permisos. Protege el catálogo, limita el listado y alta de clientes al personal, y permite al comprador consultar únicamente su ficha. Añade límites de solicitudes y tamaño del cuerpo. Rechaza campos JSON desconocidos para impedir solicitudes de registro con roles añadidos. Mantiene errores genéricos y un identificador de seguimiento.

### src/Aluformix.Connection/AuthClient.cs

Conecta las pantallas C# con los endpoints reales. SessionTokenHandler adjunta la sesión a las solicitudes. Las respuestas inválidas se traducen en mensajes para el usuario. El cierre de sesión borra el token local incluso sin red; la pantalla avisa cuando no se confirmó la revocación remota. Si el guardado seguro de un nuevo token falla, se intenta revocar esa sesión.

### src/Aluformix.Mobile/Views/AccessPage.xaml y AccessPage.xaml.cs

Implementan los formularios de login, registro de comprador y recuperación con correo y código. Validan confirmación de contraseña, bloquean envíos duplicados y muestran actividad o errores. Al autenticar, muestran nombre, correo y rol procedentes de la API. No incorporan nombres, saldos, materiales o cuentas del prototipo. La vista de cuenta actual permite cerrar sesión; las pantallas de negocio del nuevo diseño se desarrollarán después.

### src/Aluformix.Mobile/SessionStorage.cs y MauiProgram.cs

Guardan el token mediante SecureStorage del dispositivo y configuran la conexión HTTP sin contraseña de MySQL ni secreto de administrador. ApiBaseUrl queda vacía hasta configurar el servicio real. Release exige HTTPS y no se desactiva la validación de certificados. El respaldo automático Android se deshabilita para evitar restaurar material de sesión del dispositivo. La app elimina una sesión anterior en el primer arranque de una instalación.

## Validaciones realizadas

API y biblioteca HTTP compiladas sin errores ni advertencias. Suite principal: 66 comprobaciones correctas, incluidas las pruebas de autenticación y el ensayo del cliente C#. Dentro del ensayo del cliente se verifican ocho comportamientos específicos; el resultado principal lo resume como una comprobación, por lo que no se presentan como 74 comprobaciones independientes del mismo nivel.

Se verificaron registro y transacción de ficha de cliente, correo duplicado, contraseña insuficiente, rechazo de rol en registro, contraseña almacenada como hash, token almacenado como hash, identidad del usuario, acceso propio, aislamiento de otros clientes, permisos administrativos y de operación, logout, caducidad, usuario inactivo, falta de correo configurado, recuperación de contraseña, código de un solo uso, revocación de sesiones anteriores, rechazo de contraseña vieja, acceso con la nueva, bloqueo tras cinco fallos y límite HTTP 429. También se conservaron las comprobaciones de integridad, búsquedas y limpieza controlada anteriores.

Evidencia local de ejecución: `.test-artifacts/24c94b63d5724afc92a5951d6cdce13f/result.txt`. Los procesos de prueba quedaron detenidos. Todas las cuentas usadas en los ensayos pertenecen a instancias aisladas, no a la base del negocio.

Sintaxis C# y XML revisada mediante Roslyn y análisis XML. El intento de compilación Android produjo NETSDK1147 por falta de maui-android; no se verificaron todavía generación XAML, dependencias de plataforma, navegación visual ni SecureStorage en dispositivo. Esta comprobación estática no sustituye una compilación completa.

## Pendientes concretos

Instalar las herramientas móviles; compilar y probar Android; preparar el entorno iOS; configurar URL y HTTPS del servicio; conectar la API permanente con una cuenta de base de permisos limitados; registrar el administrador real con los datos que elija el responsable; configurar y probar el proveedor de correo. La verificación de correo al registrar cuentas todavía no está implementada. El despliegue público sigue deshabilitado.

Las cuentas de personal se crean por el administrador; aún no hay pantallas de alta de personal ni endpoints para editar o desactivar cuentas. Los pedidos, inventario y cotizaciones completos siguen siendo módulos posteriores. El nuevo diseño aprobado se conserva como referencia, sin datos ficticios.

El registro y el código se guardan localmente; todavía no se confirmó commit ni sincronización con GitHub.

Referencias técnicas: https://learn.microsoft.com/aspnet/core/security/authentication/ ; https://learn.microsoft.com/aspnet/core/performance/rate-limit ; https://learn.microsoft.com/dotnet/maui/platform-integration/storage/secure-storage

## Evidencia del servidor permanente

Se guardó `evidencia-base-datos/08-workbench-autenticacion.png` junto con el registro de la consulta. El resultado observado fue **versión 3, 15 tablas, 0 cuentas, 0 sesiones, 0 productos y 0 clientes**. La migración solo agregó estructura; no realizó el alta de un administrador ni configuró credenciales de la API permanente.

Se agregó `Aluformix.slnx` para reunir API, biblioteca de conexión, proyecto móvil y ensayo del cliente. La revisión estática final validó sintaxis C# y XML en 22 archivos del proyecto móvil. Sigue pendiente la compilación específica de plataforma.
