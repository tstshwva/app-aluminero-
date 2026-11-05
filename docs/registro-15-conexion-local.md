# Registro 15 — Preparación de conexión local

Se eligió primero MySQL en esta computadora. Se encontró MySQL Server 8.4 en C:\Program Files\MySQL\MySQL Server 8.4.

scripts/conectar-local.ps1 abre un formulario local para que la persona escriba su contraseña de root. No se introduce ni se pide en el chat. El formulario ejecuta scripts/migrar-base.ps1 con una copia SecureString, respalda antes del DDL, prepara un certificado autofirmado solo para localhost y una cuenta MySQL aleatoria con SELECT/INSERT/UPDATE/DELETE, y guarda la conexión en .env. No se cambia la contraseña de root ni se instala confianza de certificados en Windows. Los archivos privados y claves están excluidos de Git. Se restringen permisos de .local y .env al usuario actual, SYSTEM y Administradores.

scripts/conexion-local.js conserva una cuenta de aplicación existente si es válida; no reemplaza silenciosamente credenciales incompletas o cuentas root. Comprueba certificado/clave coincidentes, vigencia y nombre localhost. El diagnóstico usa confianza explícita en ese certificado y mantiene la verificación HTTPS. No hace confiable ese certificado para un navegador ni para un teléfono.

El formulario intenta arrancar la API en segundo plano y verificar /health/live. No detiene procesos ajenos si el puerto está ocupado. .local/conexion-estado.json informa del avance sin credenciales. La conexión queda pendiente hasta que la persona complete el formulario y se verifique el estado ready.

Validación: 17 pruebas de JavaScript/componentes correctas y 131 comprobaciones HTTPS/MySQL aisladas correctas. Cuatro comprobaciones nuevas ejecutan el configurador con una base temporal: cuenta limitada, contraseña distinta de root, reutilización sin cambios y diagnóstico HTTPS. Evidencia: .test-artifacts/js-32dde6a8319a4259a9233a6b0bf5dccf/result.txt. El primer intento de arrancar MySQL aislado no pudo verificar la instancia por la restricción de red; se repitió con permiso de red y pasó completo.

Pendientes después de conectar: primer administrador real, dirección HTTPS accesible y confiable para el teléfono, correo y proveedores IA/push. No se presentan pruebas aisladas como evidencia de que la base real ya esté migrada.
