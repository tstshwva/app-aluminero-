# Ejecutar en PowerShell 7 desde la carpeta del proyecto.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$name = Read-Host 'Nombre del primer administrador'
$email = Read-Host 'Correo del primer administrador'
$password = Read-Host 'Contraseña de 12 a 128 caracteres' -AsSecureString
$priorEncoding = $OutputEncoding
Push-Location $root
try {
    $OutputEncoding = [Text.UTF8Encoding]::new($false)
    @{
        name = $name
        email = $email
        password = [System.Net.NetworkCredential]::new('', $password).Password
    } | ConvertTo-Json -Compress | & node.exe --env-file=.env scripts/crear-primer-admin.js
    if ($LASTEXITCODE -ne 0) { throw 'No se creó la cuenta administradora.' }
} finally {
    $OutputEncoding = $priorEncoding
    $password.Dispose()
    Pop-Location
}
