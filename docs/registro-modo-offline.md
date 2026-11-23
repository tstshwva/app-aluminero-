# Modo sin conexión

La aplicación conserva datos descargados por cuenta en `offlineClient.js`. El adaptador comprueba la conectividad antes de consultar Firebase. Sin internet usa únicamente la copia de esa cuenta. No oculta rechazos de permisos con datos guardados. La sesión offline solo se recupera si Firebase conserva al mismo usuario y existe una sesión previamente verificada. Crear una cuenta, cambiar de usuario y el primer acceso requieren internet.

`offlineStorage.js` guarda la caché y los borradores en archivos cifrados con AES-GCM. La clave de 256 bits se genera en el dispositivo y permanece en SecureStore. Se conservan dos copias alternas para recuperar la última escritura válida. No se almacenan contraseñas en esta caché. La edición web conserva una caché temporal en memoria.

Se puede consultar el catálogo, productos, perfil, encargos y panel descargados. Una sección nunca descargada necesita conexión antes de quedar disponible offline. Los datos offline pueden estar desactualizados y la pantalla muestra un aviso sin conexión.

Los carritos del comprador se recuperan al reabrir la app. Los encargos enviados sin red permanecen en una cola cifrada, con identificador estable para que los reintentos no creen duplicados. Se migran los pedidos pendientes del almacenamiento anterior después de confirmar su guardado cifrado. La cola respeta la preferencia de sincronizar pedidos solo por Wi-Fi.

Las ediciones del perfil se guardan localmente y se reintentan al recuperar conexión o regresar a la app. Si el usuario vuelve a editar mientras se sincroniza, esa edición permanece pendiente. La sincronización se ejecuta mientras la app está abierta o al volver a ella. No se promete ejecución con la app cerrada por Android.

La IA de chat requiere internet. El escáner de texto local requiere el APK con su módulo y modelo incluidos. La confirmación real de inventario, precios, pagos y cambios de estado de Empresa requiere al servidor. No se presentan operaciones financieras o de inventario offline como confirmadas.

Pruebas automatizadas: 56. Cubren reapertura de sesión, separación entre cuentas, filtrado de catálogo sin red, recuperación ante fallos de red, propagación de permisos denegados y sincronización de perfiles sin duplicar envíos. Queda pendiente probar modo avión y reconexión en teléfonos físicos de Cliente y Empresa.
