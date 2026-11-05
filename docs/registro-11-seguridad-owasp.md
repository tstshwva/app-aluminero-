# Registro 11 — Requisitos de seguridad de Aluformix
Fecha: 1 de noviembre de 2026.
Alcance: código actual de acceso, conexión HTTP, configuración Android/iOS, API, consultas y recuperación. Estos requisitos aplicarán a las apps de empresa y comprador cuando se separen.

## Requisitos permanentes
No incluir contraseñas, claves privadas, API keys ni tokens reales en el código, recursos móviles, imágenes o GitHub. Configurar secretos solo en el servidor mediante variables de entorno, User Secrets durante desarrollo o un gestor de secretos en despliegue. Las llamadas a servicios externos con claves privadas deben pasar por la API. La app aún no integra proveedores externos de IA.

Validar entradas y permisos en el servidor, usar parámetros SQL, establecer límites y no devolver trazas o consultas. No se deben prohibir arbitrariamente caracteres de un nombre como sustituto de parametrizar SQL. Las pantallas actuales usan controles nativos, no renderizan el nombre como HTML; cualquier futura superficie web necesitará codificación de salida según su contexto para prevenir XSS.

## Incumplimiento corregido
Antes había HTTP en el servidor local y excepciones para localhost/emulador en Debug y en la configuración Android. Se retiraron. La app y la API ahora exigen HTTPS. Kestrel necesita un certificado configurado; si falta, no debe ofrecer HTTP como alternativa.

EndpointSecurity centraliza la validación de URL base. El manejador de sesión bloquea HTTP, URLs con credenciales y solicitudes hacia otro origen antes de leer o transmitir el token. El transporte móvil tiene AllowAutoRedirect=false y conserva la validación de certificados de la plataforma. Android declara usesCleartextTraffic=false y base-config cleartextTrafficPermitted=false, sin excepciones. Los identificadores XML y la DTD de plist que empiezan por http no son conexiones de negocio y no se reemplazaron.

## Almacenamiento y contraseñas
SessionStorage usa SecureStorage de MAUI, no Preferences para el token. En Android MAUI proporciona almacenamiento cifrado y en iOS utiliza Keychain. La preferencia de primera instalación es solo un indicador booleano, no un secreto. Android tiene copias de seguridad de la app deshabilitadas. Las contraseñas no se guardan en el teléfono; el servidor guarda su hash con PasswordHasher. MySQL guarda hashes de tokens y fechas de caducidad/revocación.

## Validación de la revisión
Se revisaron los archivos principales de arranque, acceso, almacenamiento, conexión, autenticación, recuperación, permisos y consultas. Se añadieron pruebas para rechazo de HTTP, origen ajeno, credenciales y parámetros en URL base, y para rechazo predeterminado de un certificado no confiable. La integración usa HTTPS y un certificado efímero propio. ClientSmoke reconoce exclusivamente la huella SHA-256 de ese certificado mediante configuración en memoria. El cliente PowerShell de la prueba omite confianza de certificado únicamente para esa instancia local aislada; no es una configuración de la app ni de la API. La clave privada temporal PFX está cifrada, se elimina al finalizar y sus extensiones quedan fuera de Git. No se modifica el almacén de confianza del sistema.

## Lista de entrega: estado honesto
1. HTTPS: implementado en código y sujeto a pruebas de integración; la validación con certificados reales desde el teléfono y despliegue queda pendiente.
2. Sin secretos locales en texto plano: uso de SecureStorage revisado en código; falta comprobarlo en Android e iOS compilados, incluyendo reinstalación y restauración.
3. Entradas y permisos: validaciones y consultas parametrizadas revisadas en los módulos existentes; deben aplicarse a cada operación nueva. No hay todavía CRUD completo de todos los módulos.
4. Revisión del código generado: revisión focalizada y pruebas del acceso y transporte; no constituye auditoría integral, certificación OWASP ni revisión independiente de todo el proyecto y dependencias.

## Pendientes antes de publicar
Separar las dos apps; compilar y probar dispositivos; configurar certificado reconocido sin bypass; configurar correo real y verificación de propiedad del correo; revisar dependencias; respaldos y restauración; monitoreo; completar módulos con pruebas de autorización. Si MySQL se mueve a otro servidor, configurar TLS con verificación de identidad del servidor (VerifyFull y CA correspondiente), no SslMode=Preferred como garantía. El HTTPS de la API no configura por sí solo el cifrado entre API y MySQL. No se auditó la configuración del MySQL real mediante credenciales administrativas.

## Fuentes consultadas
- Microsoft SecureStorage: https://learn.microsoft.com/dotnet/maui/platform-integration/storage/secure-storage
- OWASP MASVS-NETWORK-1: https://mas.owasp.org/MASVS/controls/MASVS-NETWORK-1/

La cifra de «45 % de fallos» aportada por el usuario no se verificó ni se usa como resultado de esta revisión.

## Resultado de esta ejecución
API y cliente C# compilados con cero errores y cero advertencias. Pasaron 74 comprobaciones de integración y 15 comprobaciones internas de ClientSmoke, usando MySQL aislado y HTTPS. Resultado: .test-artifacts/9c274614ce5547a28ca06206a67c5da9/result.txt. La clave privada PFX temporal fue retirada al finalizar. La revisión sintáctica de los 17 archivos C#/XML móviles fue correcta; todavía no equivale a compilar MAUI ni probar un dispositivo.

Las imágenes anteriores del código y el ZIP entregado el 29 de octubre son evidencias históricas; no incluyen estos cambios del 1 de noviembre. No deben presentarse como captura del código actualizado.
