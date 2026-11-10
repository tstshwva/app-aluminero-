# Avance 24 Registro real y acceso de demostración

Fecha 9 de noviembre de 2026.

La vista de demostración respondía como si hubiera creado una cuenta de comprador aunque su método de registro no guardaba datos. La consulta de conteo a la base local no encontró cuentas. Se comprobó en una base aislada que la API real guarda la cuenta y la ficha del comprador en la misma transacción, conserva el hash de la contraseña y permite iniciar sesión posteriormente.

- La demo abre una cuenta de ejemplo con un botón y mantiene visible el aviso de que los cambios se reinician al recargar. Sus métodos rechazan el alta y la recuperación de cuentas. También se retiró la pantalla de alta de personal de esta modalidad.
- El cliente HTTPS requiere una respuesta con el identificador y el rol de comprador para confirmar el alta. Una página HTML o una respuesta de otro rol deja el registro sin confirmación.
- Al volver del segundo plano, el formulario de registro o de recuperación permanece abierto. Los campos sensibles se limpian al pasar a segundo plano.
- El script de APK firmado desactiva el modo demostración durante la compilación. El catálogo de ejemplo calcula los identificadores nuevos después de los ya cargados.
- La aplicación real mantiene el guardado en SQL Server. La vista web local se usa para demostración y el APK real puede conectarse por USB a la API HTTPS de la computadora.

Pasaron 40 pruebas de código y 134 comprobaciones de integración HTTPS con SQL Server. Las comprobaciones crearon sus cuentas exclusivamente en una base aislada.

## APK actualizados

La revisión previa a publicar detectó que Gradle reutilizaba el bundle al cambiar únicamente el código compartido. El generador ahora ejecuta nuevamente la tarea del bundle en cada compilación firmada. Se verificaron en ambos APK la corrección de registro, el modo oscuro, la URL HTTPS local y la firma.
