# Avance 19 Android y verificación de entrega

Fecha 8 de noviembre de 2026.

Los dos APK de prueba USB son compilaciones release firmadas para arm64-v8a y x86_64, con mínimo Android 7.0 y destino API 36. Incorporan el bundle de JavaScript. La API local sigue disponible por HTTPS y el puente ADB mantiene el acceso en localhost.

## Instaladores y huellas

* Aluformix-cliente-usb.apk · 48.9 MiB · SHA-256 3F8FA608D680E378A685247B63ED1FEC2F7F9FA958038E60FCEE4EBCE96FA80D
* Aluformix-empresa-usb.apk · 48.9 MiB · SHA-256 49500E397A920D2E28567CBAECD5321A4CE0581F37874C027E31E23E31615F11

## Cambios

* scripts/compilar-android.ps1 genera, firma y verifica ambos APK. Usa la misma clave de firma guardada localmente y protegida por DPAPI. El perfil USB confía en el certificado público local únicamente para localhost, con subdominios desactivados.
* Las dos apps bloquean HTTP, copias de seguridad y permisos innecesarios de micrófono, superposición y almacenamiento. La cámara rechaza códigos inválidos, evita lecturas duplicadas y ofrece ajustes o búsqueda manual.
* scripts/crear-primer-admin.ps1 y su entrada JavaScript permiten crear la primera cuenta sin contraseña en argumentos ni registro visible. Se reutiliza el bloqueo y la validación del servicio de autenticación.
* scripts/configurar-gemini.ps1 solicita una clave oculta, comprueba el proveedor con datos de prueba y actualiza el archivo de configuración del servidor solo si la comprobación funciona. La clave usada para la prueba se mantuvo en memoria.
* La compilación de Windows requirió una caché Gradle corta por el límite de ruta de Ninja.

## Comprobaciones

* 26 pruebas JavaScript y de componentes aprobadas, incluida la cámara con módulos nativos simulados.
* 133 comprobaciones HTTPS y SQL Server en una base aislada. Evidencia local en .test-artifacts/alu_test_37850bf2d88048108133b18d304d006e/result.txt.
* Conexión cifrada con esquema 4 y 19 tablas. SQL Server activo en 16.0.4305.5 con KB5126934. El instalador devolvió 3010 y solicita reinicio de Windows.
* Firmas Android v2 y v3, alineación 16 KiB, política HTTPS y permisos revisados directamente en ambos APK. El contenido del bundle no coincidió con los secretos configurados del servidor.
* Gemini respondió realmente con gemini-3.1-flash-lite. npm audit reportó cero avisos conocidos en las dependencias instaladas.

Queda pendiente instalar y validar los APK en un teléfono, incluida la lectura de una etiqueta física. La activación permanente de Gemini requiere una clave nueva y reiniciar la API. Para la operación por Internet se requiere URL HTTPS, credenciales de correo y notificaciones, y una cuenta administradora real.
