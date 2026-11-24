# Reparación del actualizador

24 de noviembre de 2026.

El flujo anterior ignoraba el resultado de fetchUpdateAsync: una promesa resuelta con isNew false también mostraba «Actualización lista». Tampoco ofrecía un control persistente para aplicar una descarga pendiente. Esto es un defecto comprobado del código, aunque no confirma por sí solo la causa en el teléfono reportado.

useAppUpdates verifica isNew, las indicaciones de rollback y el estado nativo isUpdatePending. Mantiene la descarga pendiente disponible incluso sin internet, evita descargas y reinicios duplicados, permite reintentar sin esperar cinco minutos y vuelve a pedir consentimiento si Wi-Fi cambia a datos. Si el reinicio falla conserva Aplicar. Un arranque de emergencia se muestra como versión de respaldo, sin reinicios automáticos en bucle.

UpdateStatus muestra el estado de descarga, progreso cuando Android lo entrega, Aplicar/Reintentar y la revisión instalada 24 nov · 2 junto con el identificador abreviado de la actualización activa. No afirma haber aplicado la versión hasta que realmente arranca ese código. AppContent se memoriza para que los eventos de progreso no vuelvan a renderizar las pantallas del negocio. Los formularios no se reinician automáticamente: el usuario decide cuándo aplicar.

Validación: 78 pruebas JavaScript correctas; diez cubren el actualizador, incluyendo descarga sin versión nueva, descarga fallida, modo sin conexión con actualización pendiente, cambio de red, eventos concurrentes, reinicio fallido y cierre durante la descarga.

Comprobación remota: el manifiesto y el bundle de Cliente respondieron HTTP 200, y el SHA256 del bundle coincidió con el manifiesto. Se enviaron las cabeceras assetRequestHeaders que exige el protocolo oficial de Expo. Una petición aislada al CDN sin esas cabeceras devuelve 403; eso no demuestra un fallo en la app nativa, que gestiona dichas cabeceras.

Referencias: https://docs.expo.dev/versions/latest/sdk/updates/ y https://docs.expo.dev/technical-specs/expo-updates-1/ . Pendiente comprobar instalación, descarga y reinicio en un teléfono físico. No se borran datos ni se cambian permisos de Firebase.
