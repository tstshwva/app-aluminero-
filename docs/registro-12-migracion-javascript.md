# Registro 12 — Migración a JavaScript
Fecha: 1 de noviembre de 2026.

## Motivo y alcance
El usuario indicó que la profesora requiere cambiar de C# a JavaScript. Se sustituye el código activo MAUI/XAML y ASP.NET Core por React Native/Expo y Node.js/Express. C# es técnicamente válido para MAUI; el cambio sigue el requisito del curso, no una imposibilidad del lenguaje. Las pantallas usan JSX y todos los módulos propios son JavaScript, sin TypeScript ni Java.

## Dos apps
apps/empresa y apps/cliente tienen entradas e identificadores independientes. Comparten componentes y conexión para evitar duplicar lógica. La empresa no muestra registro público y rechaza cuentas de comprador; la app cliente rechaza personal. El servidor continúa validando roles independientemente de la interfaz. Se migró todo el alcance implementado de acceso, catálogo y operaciones básicas de clientes; no se presenta como terminado el alcance comercial pendiente.

## Conservación
Se movieron 145 archivos del proyecto C# y sus herramientas de solución/pruebas a C:\Users\Reyca\Documents\Aluformix-respaldo-CSharp-2026-11-01. Se verificó el SHA-256 antes y después. No se borraron la base ni cuentas reales; no se ejecutaron migraciones sobre MySQL real. Los documentos e imágenes anteriores quedan como evidencia histórica, no como capturas del nuevo JavaScript.

## Seguridad
Se conserva HTTPS obligatorio; Android declara tráfico claro deshabilitado mediante expo-build-properties e iOS sin excepciones ATS. Expo SecureStore protege tokens; un marcador no secreto en el directorio de documentos permite quitar claves heredadas de una instalación anterior. Se eligió expo/fetch después de revisar las limitaciones de redirect del fetch de React Native; el transporte nativo de Expo soporta redirect:error. Falta probar estas garantías en un binario propio y dispositivos.

La API usa sentencias preparadas mysql2, transacciones, tokens aleatorios de 256 bits y hashes de tokens. Scrypt usa N=131072, r=8 y p=1, con límite de concurrencia. Se reconoce el formato de contraseña Identity V3 utilizado antes y se actualiza a scrypt al acceder. Un fallo inicial de la prueba reveló que mysql2 entrega algunas expresiones numéricas como texto; se convirtió explícitamente el indicador de bloqueo para evitar rechazar cuentas cuando vence el bloqueo. La prueba de desbloqueo quedó incluida.

## Dependencias y herramientas
Se fijaron versiones compatibles con la plantilla JavaScript oficial de Expo: SDK 58, React 19.3.0 y React Native 0.88.1. Node 24.22.1 y npm 12.2.1 se dejaron en una carpeta hermana portátil para no depender del runtime dentro de Codex. No se cambió el PATH global ni se publicaron proyectos en Expo.

La instalación inicial de pnpm falló por enlaces en Windows. Se utilizó npm workspaces y package-lock.json. La instalación restringida también encontró un bloqueo de carpetas; se completó mediante la ejecución autorizada de la instalación. Se detectaron 11 avisos moderados indirectos en glob/minimatch; se aplicaron overrides a glob 14.0.3 y minimatch 11.0.3, se actualizaron los paquetes y npm audit final devolvió cero avisos.

## Verificación
- 11 pruebas JavaScript: URL, roles, protección del token, almacenamiento fallido, cierre local, hashes, compatibilidad de contraseña, sintaxis JSX y configuración separada de las apps.
- 56 comprobaciones contra HTTPS y MySQL aislado: altas, persistencia, permisos, inyección SQL, sesiones, recuperación con correo de prueba, cambio de contraseña, compatibilidad de hashes, bloqueo/desbloqueo y límites.
- Expo export generó Android e iOS para Cliente y Empresa (4 paquetes de plataforma). Se usó la configuración de release del empaquetador, no un APK o binario nativo.
- npm audit final: 0 vulnerabilidades conocidas según el registro consultado.
- Resultados de integración: .test-artifacts/js-cc3e8befc2c941c787bf55485a8afece/result.txt.

## Pendientes honestos
No hay todavía APK, instalación en teléfono ni build nativo iOS. La API necesita configuración de MySQL y certificados antes de arrancar de forma habitual. Falta correo real y verificación de propiedad del correo, módulos comerciales restantes y nuevo respaldo en GitHub. No se creó una falsa evidencia de ejecución móvil ni se añadieron productos/usuarios ficticios a la base local.

## Fuentes técnicas
https://docs.expo.dev/get-started/create-a-project/
https://docs.expo.dev/workflow/overview/
https://github.com/sidorares/node-mysql2/blob/master/website/docs/documentation/prepared-statements.mdx
https://reactnative.dev/docs/network
