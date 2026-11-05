# Registro de revisión 02 — Aluformix

Fecha: 28 de octubre de 2026. Alcance: código de API, biblioteca HTTP, esquema MySQL y pruebas de la fase 1. Revisión realizada por el asistente de desarrollo; no constituye una auditoría externa ni aprobación para producción.

## Hallazgos y decisiones

| ID | Prioridad | Hallazgo | Corrección / estado |
|---|---|---|---|
| R02-01 | Media | El alta devolvía Location de la colección completa. | Corregido: devuelve `/api/customers/{id}` y se implementó GET del cliente individual, con 404 si no existe. |
| R02-02 | Media | MAX(version) vacío podía provocar error de conversión. | Corregido: esquema vacío o incompatible devuelve 503; la versión requerida ahora es 2. |
| R02-03 | Alta | Faltaban restricciones sobre mínimo de stock, longitudes y total cotizado. | Corregido con migración 003: mínimo no negativo, longitudes positivas, texto requerido, dirección útil y total igual a subtotal + impuesto + envío. Se conserva el esquema original para trazabilidad. |
| R02-04 | Media | La validación de teléfono aceptaba dígitos Unicode y cantidades excesivas. | Corregido: 10 a 15 dígitos ASCII y caracteres de presentación permitidos; conserva límite de 25 caracteres. |
| R02-05 | Alta | El manejo de errores no hacía explícita la respuesta genérica en Development. | Corregido: respuesta ProblemDetails genérica con identificador de seguimiento; prueba provoca un error real y verifica que no incluya consulta ni traza. |
| R02-06 | Media | La clave temporal admitía valores demasiado cortos. | Corregido: exige al menos 32 caracteres. Sigue siendo una clave de desarrollo, no autenticación de usuarios. |
| R02-07 | Alta | La prueba anterior no se podía repetir sin reutilizar una base existente. | Corregido: nuevo directorio por ejecución, puertos disponibles, verifica directorio de MySQL antes de aplicar SQL, credenciales efímeras y limpieza de procesos en finally. No borra bases ni directorios. |
| R02-08 | Alta | Faltan login y autorización por usuario/rol. | Pendiente, bloquea publicación. Se mantiene enlace exclusivo a loopback y ejecución solo Development. |
| R02-09 | Alta | Reservas, entregas y pagos todavía no tienen servicios transaccionales. | Pendiente antes de habilitar estos módulos. Las tablas por sí solas no reservan existencias ni validan saldos entre solicitudes concurrentes. |
| R02-10 | Media | Listados limitados a 100 sin paginación. | Pendiente antes de uso con catálogos grandes. No se afirma que los listados actuales muestren todos los registros. |
| R02-11 | Media | Biblioteca HTTP aún no integrada en MAUI. | Pendiente: compila, pero no fue probada dentro de un teléfono/emulador. |

## Archivos modificados y explicación para el Word

- **Program.cs:** añade consulta individual de cliente y corrige la ubicación del recurso creado; refuerza teléfono, configuración y tratamiento de errores; permite puerto de desarrollo configurable sin abrir acceso fuera de la computadora.
- **AluformixClient.cs:** exige versión 2 al comprobar la conexión. No contiene contraseñas de MySQL.
- **003_integrity.sql:** aplica restricciones adicionales mediante ALTER TABLE y registra versión 2. Debe aplicarse una sola vez; MySQL confirma DDL automáticamente, por lo que una migración parcialmente fallida requiere revisión, no reintento ciego.
- **Integration.ps1:** prueba la API y MySQL reales en un entorno aislado. Protege la cuenta administrativa temporal tras iniciar, usa cuenta limitada para la API y restaura las variables del proceso al salir. No imprime ni guarda claves en archivos.
- **README.md / .gitignore:** instrucciones actualizadas y exclusión de datos y registros de prueba.

Estos párrafos servirán como explicación debajo de las capturas de código del documento Word final; todavía no se ha generado ese documento.

## Validación

Ambos proyectos compilados: **0 errores y 0 advertencias**. SDK .NET 10.0.403; MySQL 8.4.13; esquema versión 2.

La prueba de integración cubre 26 comprobaciones: instancia aislada, trece tablas, versión del esquema, inicio de API, conexión con usuario limitado, búsqueda, alta y persistencia, Location/Unicode, 404, 401 sin clave y con clave errónea, tres entradas inválidas, texto con sintaxis SQL, longitud de búsqueda, siete restricciones de integridad, esquema vacío y respuesta genérica ante fallo real de consulta.

Durante la preparación de pruebas se corrigió el tratamiento de rutas de Windows y se habilitó la conexión local requerida por el entorno. Los intentos fallidos no se cuentan como verificaciones aprobadas. Los registros temporales se conservan bajo `.test-artifacts`, excluidos del control de versiones.

## Criterio para los próximos avances

Registrar el problema, cambio realizado, archivos afectados, propósito del código, migración de datos si aplica, pruebas ejecutadas con resultado y limitaciones. No editar migraciones ya aplicadas para introducir cambios nuevos. No guardar claves en código ni declarar completa una función que solo tenga tablas o una pantalla de demostración.

La revisión queda registrada localmente. No hay commit ni respaldo remoto confirmado: falta configurar la identidad de Git y completar el acceso al repositorio antes de registrar un commit y sincronizarlo. No se modificó GitHub en esta revisión.

Repetibilidad confirmada: dos ejecuciones consecutivas finalizaron correctamente, con 26 comprobaciones cada una, usando directorios de datos distintos. Instancias: `5a52ab18058c4beb9c213664d5faa221` y `e83af35a8af94931a1686e3eeae5342b`. Los procesos de prueba quedaron detenidos. El manifiesto `revision-02-sha256.csv` identifica el contenido revisado; es evidencia local, no sustituye un commit de Git.
