# Reparación del actualizador

24 de noviembre de 2026.

El flujo anterior ignoraba el resultado de fetchUpdateAsync: una promesa resuelta con isNew false también mostraba «Actualización lista». Tampoco ofrecía un control persistente para aplicar una descarga pendiente. Esto es un defecto comprobado del código, aunque no confirma por sí solo la causa en el teléfono reportado.

useAppUpdates verifica isNew, las indicaciones de rollback y el estado nativo isUpdatePending. Mantiene la descarga pendiente disponible incluso sin internet, evita descargas y reinicios duplicados, permite reintentar sin esperar cinco minutos y vuelve a pedir consentimiento si Wi-Fi cambia a datos. Si el reinicio falla conserva Aplicar. Un arranque de emergencia se muestra como versión de respaldo, sin reinicios automáticos en bucle.

UpdateStatus muestra el estado de descarga, progreso cuando Android lo entrega, Aplicar/Reintentar y la revisión instalada 24 nov · 2 junto con el identificador abreviado de la actualización activa. No afirma haber aplicado la versión hasta que realmente arranca ese código. AppContent se memoriza para que los eventos de progreso no vuelvan a renderizar las pantallas del negocio. Los formularios no se reinician automáticamente: el usuario decide cuándo aplicar.

Validación: 78 pruebas JavaScript correctas; diez cubren el actualizador, incluyendo descarga sin versión nueva, descarga fallida, modo sin conexión con actualización pendiente, cambio de red, eventos concurrentes, reinicio fallido y cierre durante la descarga.

Comprobación remota: el manifiesto y el bundle de Cliente respondieron HTTP 200, y el SHA256 del bundle coincidió con el manifiesto. Se enviaron las cabeceras assetRequestHeaders que exige el protocolo oficial de Expo. Una petición aislada al CDN sin esas cabeceras devuelve 403; eso no demuestra un fallo en la app nativa, que gestiona dichas cabeceras.

Referencias: https://docs.expo.dev/versions/latest/sdk/updates/ y https://docs.expo.dev/technical-specs/expo-updates-1/ . Pendiente comprobar instalación, descarga y reinicio en un teléfono físico. No se borran datos ni se cambian permisos de Firebase.

Distribución verificada: APK Cliente SHA256 7D27E2EE08F397EA1AB99AD233F9ED928E2289597CB992945E1B577BF698C2A8; APK Empresa SHA256 4D52E98E92E6E346CE0293435357BA36B80BFB4121D4671B42907D60C44142BB. Ambos compilaron, conservaron la firma de distribución y pasaron las comprobaciones de Firebase, modelo local y marcadores del actualizador en el bundle. Sus hashes coinciden con los publicados por GitHub.

Instaladores: https://github.com/tstshwva/app-aluminero-/releases/tag/android-actualizador-2026-11-24 . La primera subida conjunta agotó el tiempo; la subida por archivos separados terminó y la publicación es pública con ambos APK completos.

Actualización OTA completada para cuatro versiones nativas de Cliente y tres de Empresa. Grupos actuales: ce807ec1-3494-4fb4-94fa-410e581dcc45 y 1d92be25-6775-47a0-a954-783becb39fbd. La comprobación remota posterior descargó el bundle de cada canal con HTTP 200, hash válido y marcador de revisión 24 nov. Publicar no confirma que un dispositivo lo haya instalado.

Para salir de un actualizador anterior que no logra descargar o reiniciar, instalar el APK de la misma aplicación sobre la instalación actual, sin borrar sus datos. Al abrir debe verse Revisión 24 nov · 2. No había un teléfono conectado para comprobar arranque físico o la red reportada.
