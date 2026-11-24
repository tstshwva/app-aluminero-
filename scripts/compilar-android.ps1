[CmdletBinding(DefaultParameterSetName = 'Firebase')]
param(
    [Parameter(ParameterSetName = 'Firebase')][switch]$Firebase,
    # Modo demostración: datos de ejemplo en memoria, sin API ni certificado.
    [Parameter(Mandatory, ParameterSetName = 'Demo')][switch]$Demo,
    [ValidateSet('cliente','empresa')][string[]]$Apps = @('cliente','empresa'),
    [string]$Output = (Join-Path $PSScriptRoot '../.local/apk'),
    [string]$NativeBuildRoot = (Join-Path $env:USERPROFILE 'g'),
    [string]$BuildToolsVersion = '37.0.0'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $env:ANDROID_HOME -or -not $env:JAVA_HOME) {
    throw 'Define ANDROID_HOME y JAVA_HOME antes de compilar.'
}
$env:PATH = (Join-Path $env:JAVA_HOME 'bin') + [IO.Path]::PathSeparator + $env:PATH
$tools = Join-Path $env:ANDROID_HOME "build-tools/$BuildToolsVersion"
$apksigner = Join-Path $tools 'apksigner.bat'
$zipalign = Join-Path $tools 'zipalign.exe'
$keytool = Join-Path $env:JAVA_HOME 'bin/keytool.exe'
$node = (Get-Command node.exe -ErrorAction Stop).Source
if (!(Test-Path $apksigner) -or !(Test-Path $zipalign) -or !(Test-Path $keytool)) {
    throw 'Faltan las herramientas de firma de Android o el JDK.'
}
function Confirmar-Codigo([string]$etapa) {
    if ($LASTEXITCODE -ne 0) { throw "$etapa falló ($LASTEXITCODE)." }
}

$suffix = if ($Demo) { 'demo' } else { 'firebase' }
$firebaseByApp = @{}
if (!$Demo) {
    foreach ($app in $Apps) {
        $configFile = Join-Path $root "apps/$app/google-services.json"
        if (!(Test-Path -LiteralPath $configFile)) { throw "Falta la configuración de Firebase de $app." }
        $config = Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json
        $selected = $config.client | Where-Object { $_.client_info.android_client_info.package_name -eq "com.aluformix.$app" } | Select-Object -First 1
        if ($config.project_info.project_id -ne 'alumineroapp-9244c' -or !$selected.api_key[0].current_key -or !$selected.client_info.mobilesdk_app_id) {
            throw "La configuración de Firebase no corresponde a $app."
        }
        $firebaseByApp[$app] = $selected
    }
}

$outputDir = (New-Item -Path $Output -ItemType Directory -Force).FullName
$signingDir = (New-Item -Path (Join-Path $root '.local/android-signing') -ItemType Directory -Force).FullName
$keystore = Join-Path $signingDir 'aluformix-distribucion.p12'
$encryptedPassword = Join-Path $signingDir 'password.dpapi'
$existingKey = Test-Path $keystore
$existingPassword = Test-Path $encryptedPassword
if ($existingKey -and !$existingPassword) {
    throw 'Falta la contraseña DPAPI de la firma existente. Recupera el respaldo antes de compilar.'
}
$priorPassword = $env:ALUFORMIX_APK_SIGNING_PASSWORD
$priorFirebaseKey = $env:EXPO_PUBLIC_FIREBASE_API_KEY
$priorFirebaseAppId = $env:EXPO_PUBLIC_FIREBASE_APP_ID
$priorDemo = $env:EXPO_PUBLIC_DEMO
$priorCi = $env:CI
try {
    if ($existingPassword) {
        $protected = (Get-Content -LiteralPath $encryptedPassword -Raw).Trim() | ConvertTo-SecureString
        $env:ALUFORMIX_APK_SIGNING_PASSWORD = [System.Net.NetworkCredential]::new('', $protected).Password
    } else {
        $secret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
        $secret | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString |
            Set-Content -LiteralPath $encryptedPassword
        $env:ALUFORMIX_APK_SIGNING_PASSWORD = $secret
    }
    if (!$existingKey) {
        & $keytool -genkeypair -storetype PKCS12 -keystore $keystore -storepass:env ALUFORMIX_APK_SIGNING_PASSWORD -alias aluformix -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Aluformix Android'
        Confirmar-Codigo 'Creación de la clave de firma'
    }
    $signingPassword = $env:ALUFORMIX_APK_SIGNING_PASSWORD
    Remove-Item Env:ALUFORMIX_APK_SIGNING_PASSWORD
    $env:EXPO_PUBLIC_DEMO = if ($Demo) { '1' } else { '0' }
    $env:CI = '1'
    $expo = Join-Path $root 'node_modules/expo/bin/cli'
    foreach ($app in $Apps) {
        if (!$Demo) {
            $env:EXPO_PUBLIC_FIREBASE_API_KEY = $firebaseByApp[$app].api_key[0].current_key
            $env:EXPO_PUBLIC_FIREBASE_APP_ID = $firebaseByApp[$app].client_info.mobilesdk_app_id
        }
        Push-Location (Join-Path $root "apps/$app")
        try {
            & $node $expo prebuild --platform android --no-install --clean
            Confirmar-Codigo "Generación nativa de $app"

            # Evita rutas largas en los objetos generados por Ninja en Windows.
            $gradleFile = Join-Path $PWD 'android/app/build.gradle'
            $nativeDir = Join-Path $NativeBuildRoot $app
            $gradle = [IO.File]::ReadAllText($gradleFile)
            $gradle = $gradle -replace '(?m)^android \{ defaultConfig \{ externalNativeBuild \{ cmake \{ arguments "-DCMAKE_OBJECT_PATH_MAX=240" \} \} \} \}\s*$', ''
            if (-not $gradle.Contains('aluformixNativeDir')) {
                $gradle += [char]10 + @"
if (project.hasProperty("aluformixNativeDir")) {
    android {
        externalNativeBuild {
            cmake {
                buildStagingDirectory = file(project.property("aluformixNativeDir"))
            }
        }
        defaultConfig {
            externalNativeBuild {
                cmake {
                    arguments "-DCMAKE_OBJECT_PATH_MAX=248"
                }
            }
        }
    }
}
"@
            }
            [IO.File]::WriteAllText($gradleFile, $gradle + [char]10)
            Push-Location android
            try {
                # Fuerza el bundle porque incluye código compartido fuera del directorio de la app.
                & .\gradlew.bat :app:createBundleReleaseJsAndAssets --rerun :app:assembleRelease --no-daemon --console=plain --max-workers=3 '-PreactNativeArchitectures=arm64-v8a,x86_64' "-PaluformixNativeDir=$nativeDir"
                Confirmar-Codigo "Compilación de $app"
                $source = (Resolve-Path 'app/build/outputs/apk/release/app-release.apk').Path
            } finally { Pop-Location }
            $target = Join-Path $outputDir "Aluformix-$app-$suffix.apk"
            $env:ALUFORMIX_APK_SIGNING_PASSWORD = $signingPassword
            try {
                & $apksigner sign --ks $keystore --ks-key-alias aluformix --ks-pass env:ALUFORMIX_APK_SIGNING_PASSWORD --out $target $source
                Confirmar-Codigo "Firma de $app"
            } finally { Remove-Item Env:ALUFORMIX_APK_SIGNING_PASSWORD }
            & $apksigner verify --verbose --print-certs $target
            Confirmar-Codigo "Verificación de firma de $app"
            & $zipalign -c -P 16 4 $target
            Confirmar-Codigo "Alineación de $app"
            Get-FileHash -Algorithm SHA256 -LiteralPath $target | Format-List
        } finally { Pop-Location }
    }
} finally {
    $env:ALUFORMIX_APK_SIGNING_PASSWORD = $priorPassword
    $env:EXPO_PUBLIC_FIREBASE_API_KEY = $priorFirebaseKey
    $env:EXPO_PUBLIC_FIREBASE_APP_ID = $priorFirebaseAppId
    $env:EXPO_PUBLIC_DEMO = $priorDemo
    $env:CI = $priorCi
}
