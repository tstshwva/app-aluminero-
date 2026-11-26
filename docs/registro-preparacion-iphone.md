# Preparación de Cliente y Empresa para iPhone

25 de noviembre de 2026.

## Estado real

El proyecto tiene ahora configuración de compilación iOS para Cliente y Empresa, adaptadores de lectura local y protección del asistente. No hay todavía un IPA firmado ni una publicación de TestFlight. Las 96 pruebas JavaScript pasaron y los dos bundles iOS se exportaron correctamente, con el ID y la clave pública de Firebase de su propia variante. Esto no valida compilación Swift, firma, cámara física o App Check real de un iPhone.

No se generó ni se publicó una actualización Android en este cambio. Sus APK existentes conservan la revisión publicada anteriormente; el selector de Firebase mantiene la rama Android con sus variables originales.

## Preparado

- Registradas en Firebase com.aluformix.cliente y com.aluformix.empresa, sin eliminar ni cambiar com.aluformix.app ni los registros Android.
- GoogleService-Info.plist de cada variante guardado localmente y excluido de Git. .easignore permite incluir esa configuración pública dentro del build remoto; claves de firma, .p8, .p12, perfiles, .env y datos locales siguen excluidos.
- Variables EXPO_PUBLIC_FIREBASE_IOS_API_KEY y EXPO_PUBLIC_FIREBASE_IOS_APP_ID creadas por separado en los proyectos Expo de Cliente y Empresa, en production y con visibilidad sensitive. También se guardaron en .env.local ignorados para exportación local. Los nombres EXPO_PUBLIC implican que estos valores se incluyen en la app: son configuración pública de Firebase, no credenciales administrativas. Las reglas y App Check protegen los servicios.
- Selector firebaseConfiguration impide usar el appId Android en iOS. No se insertaron claves en el código fuente.
- Perfiles ios-production (store) e ios-simulator en eas.json. Cada app usa su propio proyecto Expo y su canal existente; plataforma y runtime separan actualizaciones iOS y Android.
- Firebase nativo con frameworks estáticos; plugin de App Check para el arranque iOS; App Attest con entorno production y fallback DeviceCheck en el adaptador. No se habilitó un proveedor debug ni se desactivó App Check.
- Permiso de cámara localizado y micrófono desactivado. Se mantienen HTTPS y almacenamiento en Keychain/copia local cifrada.
- Lector Swift con Apple Vision, procesamiento fuera del hilo principal y coordenadas de líneas normalizadas de arriba abajo. El plugin copia el archivo en el módulo durante prebuild iOS. El adaptador conserva file:// y mantiene compatibilidad con la API antigua.
- Tests independientes de credenciales reales verifican selección de plataforma, configuración de las variantes y lectura/orden de líneas iOS. La regresión total fue de 96 pruebas correctas.

## Pendiente antes de entregar a un iPhone

1. Confirmar membresía Apple Developer y Team ID. Ningún registro iOS del proyecto tiene actualmente Team ID en Firebase.
2. Configurar el Team ID correcto y registrar App Attest de Cliente en Firebase. Si se necesita el fallback DeviceCheck, configurar sus credenciales de Apple de forma privada. La IA iOS sigue pendiente de esta configuración y de una prueba en dispositivo; la modificación de Play Integrity de Android no se aplica a iOS.
3. Generar certificados, identificadores y perfiles de Apple, comprobar que los bundle identifiers estén disponibles, completar los requisitos de distribución y compilar en macOS/EAS. No se contrataron ni pagaron membresías.
4. Probar en iPhone real login, roles, sincronización offline, pedidos entre variantes, cámara, linterna, OCR y respuesta del asistente.
5. Distribuir por TestFlight y registrar el runtime real antes de publicar actualizaciones iOS.

Se intentó prebuild iOS sin instalación en Windows; Expo lo omitió expresamente por plataforma no compatible. La exportación de JavaScript iOS sí terminó para ambas apps. No se afirma que el nuevo módulo Swift haya compilado: esa validación requiere el build de macOS.

Una vez confirmada la cuenta, los comandos de compilación son, desde apps/cliente y apps/empresa respectivamente:

```powershell
npx.cmd eas-cli@latest build --platform ios --profile ios-production
```

Las credenciales de Apple se introducen en el flujo seguro de Apple/Expo, no se guardan en el repositorio. Para otro checkout se deben recuperar los GoogleService-Info.plist correctos desde Firebase antes de compilar. Las variables remotas ya están creadas en cada proyecto Expo.

## Referencias

- TestFlight y cuenta requerida: https://docs.expo.dev/build-reference/npx-testflight/
- Localizar Team ID: https://developer.apple.com/help/glossary/team-id
- App Attest requiere el Team ID registrado: https://firebase.google.com/docs/reference/appcheck/rest/v1beta/projects.apps.appAttestConfig
- App Attest en Apple: https://firebase.google.com/docs/app-check/ios/app-attest-provider
- Firebase nativo/Expo: https://rnfirebase.io/ y https://rnfirebase.io/app-check/usage
- Vision: https://developer.apple.com/documentation/vision/recognizing-text-in-images
