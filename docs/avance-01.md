# Avance 01 — Base de datos y conexiones

Fecha: 28 de octubre de 2026. Proyecto: Aluformix, distribuidora de aluminio.

## Qué quedó implementado

Se creó una API ASP.NET Core con .NET 10, conexión mediante MySql.Data y una biblioteca HTTP que se podrá utilizar desde MAUI. El prototipo HTML/Figma no se cambió. Esta entrega todavía no es una aplicación móvil completa.

## Tablas y función

| Tabla | Función y relación |
|---|---|
| schema_versions | Identifica la versión instalada; la conexión exige versión 1. |
| roles | Catálogo de Administrador, Operador y Cliente. |
| users | Nombre, correo único, hash de contraseña, rol y estado activo. No incluye usuarios de prueba ni contraseñas. |
| customers | Contacto, taller, RFC y dirección; opcionalmente enlaza una cuenta de usuario. |
| categories | Clasifica perfiles, herrajes y accesorios. |
| products | Código único, presentación, acabado, longitud en milímetros, precio, stock físico, reserva y mínimo. |
| orders | Encargo del cliente, estado, recogida/entrega, dirección y notas. |
| order_items | Productos y cantidades del encargo; conserva el precio y acabado de ese momento y longitud de corte opcional. |
| quotes | Importes, impuesto, envío y estado de la cotización; una por encargo en esta primera versión. |
| payments | Registra abonos a una cotización y quién los registró. No procesa pagos bancarios. |
| inventory_movements | Historial de entradas, ajustes, reservas, liberaciones y entregas por producto. |
| order_history | Cambios del encargo, fecha, usuario y observación. |
| notifications | Aviso vinculado a un usuario, opcionalmente a un encargo, y fecha de lectura. |

## Explicación de los archivos de código

Estos textos se utilizarán debajo de las capturas de código cuando preparemos el Word final.

### database/001_schema.sql

Crea la base con caracteres Unicode y sus trece tablas. Las claves foráneas impiden crear relaciones con clientes o productos inexistentes. Los importes usan DECIMAL para evitar errores de representación de dinero. Las restricciones rechazan stock negativo, reservas negativas o superiores al stock, y cantidades de encargo iguales a cero. No elimina registros existentes. Se ejecuta una vez sobre una base nueva; las siguientes modificaciones deberán entregarse como migraciones nuevas.

La existencia disponible se calcula como `stock - reserved`. Las tablas aún no reservan ni descuentan automáticamente: esa lógica deberá implementarse en transacciones al confirmar, cancelar y entregar. Los totales y saldos también se deberán calcular y validar en la API, nunca confiar en valores enviados desde la app.

### database/002_demo.sql

Inserta categorías, cuatro materiales y un cliente ficticio para probar consultas. No representa el inventario ni los precios reales del negocio. Debe usarse únicamente en desarrollo.

### src/Aluformix.Api/Program.cs

Configura el servidor local y obtiene la cadena de conexión de configuración externa. Rechaza el inicio si faltan los valores necesarios o si se intenta ejecutar fuera de Development. La clave de pruebas se compara mediante hashes de longitud fija; no equivale a inicio de sesión ni autoriza por rol.

`/health/live` comprueba que la API esté encendida; `/health/db` abre MySQL y verifica la versión del esquema. `/api/products` busca por nombre o código y calcula disponible. GET `/api/customers` lista clientes; POST valida nombre y teléfono, inserta con parámetros y devuelve el identificador. Cada conexión se cierra al terminar la solicitud. Las consultas usan parámetros para separar los datos del código SQL.

### src/Aluformix.Connection/AluformixClient.cs

Centraliza las llamadas HTTP, convierte las respuestas JSON en objetos C# y propaga errores HTTP. Permite comprobar la base, consultar materiales y listar o crear clientes. La URL y credencial se configuran externamente en HttpClient; la contraseña de MySQL nunca viaja en esta biblioteca. Todavía falta registrarla en MAUI y conectar las vistas XAML.

### Archivos de configuración

El proyecto fija .NET 10 y MySql.Data 26.10.0. appsettings.json deja vacía la cadena de conexión. .gitignore excluye compilaciones y archivos locales de configuración; las claves deben configurarse mediante User Secrets o variables de entorno. NuGet.Config apunta al repositorio oficial de paquetes.

## Verificación ejecutada

Entorno temporal: SDK .NET 10.0.403 y MySQL Community 8.4.13, descargados de sus sitios oficiales. MySQL se ejecutó en una instancia local aislada para pruebas en el puerto 3307; se detuvo al terminar. La API de prueba también quedó detenida. La conexión normal del README utiliza el puerto 3306, ajustable según instalación.

Ambos proyectos compilaron con **0 errores y 0 advertencias**. Pasaron **12 comprobaciones de integración**:

1. MySQL acepta conexiones locales.
2. Se crean las trece tablas.
3. La API inicia.
4. La API conecta con un usuario limitado a SELECT e INSERT.
5. Buscar riel devuelve el producto 61088 desde MySQL.
6. POST de cliente devuelve identificador nuevo.
7. El registro existe realmente en MySQL después de la solicitud.
8. Acceso sin clave: HTTP 401.
9. Cliente inválido: HTTP 400.
10. Stock negativo: rechazado por MySQL.
11. Reserva superior al stock: rechazada por MySQL.
12. Encargo con cliente inexistente: rechazado por clave foránea.

La biblioteca HTTP compiló; no se probó dentro de un teléfono o emulador. Las pruebas HTTP se realizaron directamente contra la API. Se resolvió el aislamiento de conexiones entre procesos de prueba iniciando MySQL y API en el mismo entorno de ejecución.

## Trabajo siguiente

Implementar hashing de contraseñas con una herramienta estándar, registro controlado, login, recuperación, tokens y autorización por rol y propietario. Después: conectar pantallas MAUI y desarrollar encargos, cotizaciones y movimientos con transacciones, pruebas de concurrencia y manejo de errores. Antes de usar datos reales, acordar catálogo, unidades, impuestos, sucursales y reglas de negocio con la empresa.

No se ha publicado ni subido este avance a GitHub. El documento Word final y sus capturas se prepararán al terminar, conforme al acuerdo; este archivo conserva las explicaciones del avance.
