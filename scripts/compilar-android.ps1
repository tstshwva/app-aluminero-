[CmdletBinding(DefaultParameterSetName = 'Usb')]
param(
    [Parameter(Mandatory, ParameterSetName = 'Usb')][switch]$Usb,
    [Parameter(Mandatory, ParameterSetName = 'Publica')][uri]$ApiUrl,
    [ValidateSet('cliente','empresa')][string[]]$Apps = @('cliente','empresa'),
    [string]$Output = (Join-Path $PSScriptRoot '../.local/apk'),
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

if ($Usb) {
    $certPath = Join-Path $root '.local/api-localhost-cert.pem'
    if (!(Test-Path $certPath)) { throw 'Falta el certificado público de la API local.' }
    $cert = [IO.File]::ReadAllText($certPath)
    if ($cert -notmatch '\A\s*-----BEGIN CERTIFICATE-----[\sA-Za-z0-9+/=]+-----END CERTIFICATE-----\s*\z') {
        throw 'Se esperaba exclusivamente el certificado público PEM.'
    }
    $port = & $node --input-type=module -e "import {readFileSync} from 'node:fs'; import {parseEnv} from 'node:util'; const p=Number(parseEnv(readFileSync(process.argv[1],'utf8')).PORT || 5180); if (!Number.isInteger(p)||p<1024||p>65535) process.exit(1); console.log(p);" (Join-Path $root '.env')
    Confirmar-Codigo 'Lectura del puerto local'
    $url = "https://localhost:$port/"
    $suffix = 'usb'
} else {
    if (!$ApiUrl.IsAbsoluteUri -or $ApiUrl.Scheme -ne 'https' -or $ApiUrl.UserInfo -or $ApiUrl.Query -or $ApiUrl.Fragment -or $ApiUrl.IsLoopback) {
        throw 'La URL de la API debe ser HTTPS pública, sin credenciales, consulta ni fragmento.'
    }
    $url = $ApiUrl.AbsoluteUri.TrimEnd('/') + '/'
    $suffix = 'https'
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
$priorUrl = $env:EXPO_PUBLIC_API_URL
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
    $env:EXPO_PUBLIC_API_URL = $url
    $env:EXPO_PUBLIC_DEMO = '0'
    $env:CI = '1'
    $expo = Join-Path $root 'node_modules/expo/bin/cli'
    foreach ($app in $Apps) {
        Push-Location (Join-Path $root "apps/$app")
        try {
            & $node $expo prebuild --platform android --no-install --clean
            Confirmar-Codigo "Generación nativa de $app"

            # Evita rutas largas en los objetos generados por Ninja en Windows.
            $gradleFile = Join-Path $PWD 'android/app/build.gradle'
            $nativeRoot = if ($env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME } else { Join-Path $env:USERPROFILE '.gradle' }
            $nativeDir = Join-Path $nativeRoot "af/$app"
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
            if ($Usb) {
                $main = 'android/app/src/main'
                New-Item -ItemType Directory -Path "$main/res/raw","$main/res/xml" -Force | Out-Null
                [IO.File]::WriteAllText((Join-Path $PWD "$main/res/raw/aluformix_usb_cert.pem"), $cert.Trim() + "`n")
                @"
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="false">localhost</domain>
        <trust-anchors><certificates src="@raw/aluformix_usb_cert" /></trust-anchors>
    </domain-config>
</network-security-config>
"@ | Set-Content "$main/res/xml/aluformix_network_security.xml" -Encoding utf8
                $manifest = Join-Path $PWD "$main/AndroidManifest.xml"
                $xml = [xml][IO.File]::ReadAllText($manifest)
                $xml.manifest.application.SetAttribute('networkSecurityConfig', 'http://schemas.android.com/apk/res/android', '@xml/aluformix_network_security')
                $xml.Save($manifest)
            }
            Push-Location android
            try {
                # Fuerza el bundle porque incluye código compartido fuera del directorio de la app.
                & .\gradlew.bat :app:createBundleReleaseJsAndAssets --rerun :app:assembleRelease --console=plain --max-workers=3 '-PreactNativeArchitectures=arm64-v8a,x86_64' "-PaluformixNativeDir=$nativeDir"
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
    $env:EXPO_PUBLIC_API_URL = $priorUrl
    $env:EXPO_PUBLIC_DEMO = $priorDemo
    $env:CI = $priorCi
}
