# Actualizaciones de Cliente y Empresa

Se corrigió el flujo compartido en `packages/mobile/src/useAppUpdates.js`.

- La búsqueda acepta conexiones con internet por Wi-Fi o datos móviles.
- Con datos móviles se informa del consumo antes de descargar y se requiere aceptar.
- Si la conexión cambia de Wi-Fi a datos antes de descargar, se cancela la descarga y se solicita confirmar de nuevo.
- Después de descargar aparece Aplicar ahora, que recarga la aplicación con expo-updates.
- Los fallos de descarga no bloquean la versión instalada. Se permite reintentar al regresar a la aplicación.
- Se conserva un intervalo de cinco minutos para las comprobaciones exitosas y se evitan consultas y avisos simultáneos.

Las pruebas verifican el consentimiento con datos, la descarga, el reinicio y la opción de posponer. La suite completa contiene 49 pruebas. No sustituye una prueba de entrega en un dispositivo físico.

Las actualizaciones se publican por canal y versión nativa compatible. Un commit de GitHub no publica una actualización de Expo. Los APK antiguos que solo comprueban por Wi-Fi deben conectarse a Wi-Fi para recibir esta primera corrección. El nuevo lector local de texto necesita instalar el APK que incluye su módulo y modelo. La publicación compatible para APK anteriores mantiene la lectura remota cuando el módulo local no existe.
