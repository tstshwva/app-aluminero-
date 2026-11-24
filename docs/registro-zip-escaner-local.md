# Integración del ZIP de escáner local

24 de noviembre de 2026.

Se incorporó origin/main (8e59125), que añadió Aluformix-Cliente-offline-actualizado.zip. Se revisó el contenido antes de integrarlo; no se ejecutó el código del archivo ni se reemplazó el proyecto completo.

Se integraron offlineProducts y offlineCategories, la búsqueda local de showSheet y sus equivalentes en demostración. La búsqueda consulta solo la copia cifrada de la cuenta actual, admite la clave antigua del catálogo y verifica que no cambie la identidad durante la lectura. Si falta descargar los datos, explica cómo hacerlo. No hay peticiones de red en esta operación.

Se conservan las correcciones recientes de conectividad, actualizador, agrupación de renglones, búsqueda aproximada y relectura remota opcional con consentimiento. No se adopta el mensaje del ZIP que afirmaba que un producto no está disponible en una sucursal: una lectura sin coincidencia no permite concluir eso. Se mantiene la captura con compresión existente para evitar aumentar innecesariamente el procesamiento de la foto.

La revisión visible de Cliente pasa a 24 nov · 3. La empresa mantiene las funciones administrativas; no se añaden funciones de compra o escáner a Empresa.

Por instrucción del usuario se deja el trabajo de precios para después: no se modificaron importes, reglas de precio ni productos de Firebase.

Validación: 81 pruebas JavaScript correctas. Las regresiones nuevas comprueban que la búsqueda local no llama a la red, que no inventa datos cuando falta la copia y que no mezcla cuentas. Pendiente verificar la experiencia en un teléfono físico.
