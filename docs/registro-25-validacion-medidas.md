# Avance 25 Validación, medidas y escáner

Fecha 10 de noviembre de 2026.

- Cliente, Empresa y web muestran errores en un aviso fijo debajo del contenido. Los campos identificables marcan el borde rojo y explican cómo corregir el valor. Los fallos de acceso conservan el aviso al volver del segundo plano.
- Empresa captura la longitud de la presentación. Cliente y Empresa pueden elegir el corte o solicitar la presentación completa. Los selectores aceptan cm, m o mm y coma o punto decimal. La API conserva el contrato en milímetros enteros y limita el corte al largo registrado.
- La calculadora C-100 MID acepta las mismas unidades. Las fórmulas y sus resultados técnicos se mantienen en milímetros.
- El escáner de códigos queda disponible en ambas apps, con alternativa manual y reintento si falla el inicio de cámara. El asistente se presenta como ayuda para elegir materiales. El proveedor se configura en el servidor y las consultas fallidas tienen acceso al catálogo.
- La demostración permite precio cero como el sistema real, donde aparece «Consultar precio». La revisión usó datos de demostración o bases aisladas.
- Pasaron 40 pruebas JavaScript y 134 comprobaciones de integración HTTPS con SQL Server. El proveedor del asistente requiere configuración. La lectura con el sensor físico requiere prueba en un dispositivo.
