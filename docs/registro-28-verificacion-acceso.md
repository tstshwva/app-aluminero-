# Avance 28 Comprobación de inicio de sesión

Fecha 10 de noviembre de 2026.

El cliente de ambas apps se probó contra la API HTTPS y SQL Server aislado. Empresa inició con un administrador y Cliente con un comprador registrado. Cada cliente recuperó la sesión desde una segunda instancia usando el mismo adaptador de almacenamiento. El cliente limpió su sesión cuando el servidor la revocó.

Pasaron 40 pruebas de código y 138 comprobaciones de integración. Los dos APK de la publicación android-encargos-2026-11-10 contienen el certificado HTTPS vigente. La instancia local respondió y su consulta de solo lectura encontró cero cuentas activas. Queda por crear el administrador real, registrar al comprador, configurar recuperación por correo y verificar el almacenamiento cifrado en un Android físico.
