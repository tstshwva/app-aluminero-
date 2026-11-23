# Avance 34 Datos de contacto en el encargo

Fecha 23 de noviembre de 2026.

En «Revisa tu encargo» el comprador escribe ahí mismo nombre, teléfono y taller (opcional), sin ir al perfil. Nombre y teléfono son obligatorios y se proponen en el siguiente encargo.

* Con la API o en la demostración, los datos se guardan en el perfil.
* Con Firebase no existe `saveProfile` y `firestore.rules` no permite escribir en `usuarios`. Por eso los datos viajan al inicio de las indicaciones del pedido, que la empresa ve en el detalle, y se recuerdan cifrados en el teléfono.

Pasaron las pruebas JavaScript y se hizo un encargo completo en la demostración de Cliente. Falta probarlo con Firebase en un teléfono.

Pendiente: «Guardar perfil» de la pantalla Perfil no funciona con Firebase. Requiere agregar `saveProfile` y publicar una regla que permita a cada usuario guardar solo sus datos de contacto.
