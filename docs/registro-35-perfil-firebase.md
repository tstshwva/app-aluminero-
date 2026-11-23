# Avance 35 Guardar perfil con Firebase

Fecha 23 de noviembre de 2026.

`saveProfile` guarda en `usuarios/{uid}` solo `phone`, `business_name`, `tax_id` y `address`, y el nombre en la cuenta de acceso. La regla nueva permite a cada usuario escribir únicamente esos campos en su propio documento. El rol sigue en `aluf_staff` y no cambia.

El encargo no depende de esto: el contacto sigue viajando en las indicaciones. Mientras la regla no se publique, «Guardar perfil» muestra un aviso claro.

## Publicar la regla (administrador de Firebase)

1. Revisar `firestore.rules` y comprobar que coincida con lo publicado en la consola, para no perder cambios hechos allí.
2. Probarla en el simulador de reglas de la consola o en el emulador.
3. Ejecutar `npx firebase-tools deploy --only firestore:rules --project alumineroapp-9244c`.

Casos por probar: crear y actualizar el perfil propio (permitido); escribir el de otra persona, agregar un campo como `role` o un teléfono inválido (denegado).

Pasaron 43 pruebas JavaScript. La regla no se publicó ni se ejecutó en un emulador.
