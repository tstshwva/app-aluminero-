param([ValidatePattern('^[a-zA-Z0-9._-]{1,100}$')][string]$Modelo = 'gemini-3.1-flash-lite')

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envFile = Join-Path $root '.env'
$privateDir = Join-Path $root '.local'
if (!(Test-Path $envFile -PathType Leaf) -or !(Test-Path $privateDir -PathType Container)) {
    throw 'Configura primero el entorno local del servidor.'
}

$priorKey = $env:GEMINI_API_KEY
$priorModel = $env:GEMINI_MODEL
$secureKey = Read-Host 'Pega la nueva clave de Gemini (entrada oculta)' -AsSecureString
$tempFile = Join-Path $privateDir ([guid]::NewGuid().ToString('N') + '.env.tmp')
Push-Location $root
try {
    $key = [System.Net.NetworkCredential]::new('', $secureKey).Password.Trim()
    if ($key -notmatch '^[A-Za-z0-9._-]{20,512}$') {
        throw 'El valor no tiene formato de clave de Gemini.'
    }
    $env:GEMINI_API_KEY = $key
    $env:GEMINI_MODEL = $Modelo
    & node.exe scripts/verificar-gemini.js
    if ($LASTEXITCODE -ne 0) { throw 'Gemini no validó la clave. Conservé la configuración anterior.' }

    $otherSettings = [IO.File]::ReadAllLines($envFile) |
        Where-Object { $_ -notmatch '^\s*(?:export\s+)?GEMINI_(?:API_KEY|MODEL)\s*=' }
    $updated = @($otherSettings) + @("GEMINI_API_KEY=$key", "GEMINI_MODEL=$Modelo")
    [IO.File]::WriteAllLines($tempFile, [string[]]$updated, [Text.UTF8Encoding]::new($false))
    [IO.File]::Replace($tempFile, $envFile, [NullString]::Value)
    Write-Output 'Gemini configurado. Reinicia la API para activar el asistente en los APK.'
} finally {
    if (Test-Path -LiteralPath $tempFile) { Remove-Item -LiteralPath $tempFile -Force }
    $env:GEMINI_API_KEY = $priorKey
    $env:GEMINI_MODEL = $priorModel
    $secureKey.Dispose()
    Pop-Location
}
