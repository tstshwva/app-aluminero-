param([switch]$Preparar)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$templates = @('.env', 'apps/cliente/.env', 'apps/empresa/.env')
foreach ($relative in $templates) {
    $target = Join-Path $projectRoot $relative
    if ($Preparar -and !(Test-Path -LiteralPath $target)) {
        Copy-Item -LiteralPath ($target + '.example') -Destination $target
        Write-Output "CREADO: $relative (completar valores locales)"
    } elseif (Test-Path -LiteralPath $target) {
        Write-Output "EXISTENTE: $relative (conservado)"
    } else {
        Write-Output "PENDIENTE: $relative"
    }
}
Write-Output 'No se modificó MySQL ni se crearon cuentas. Los archivos .env no deben compartirse.'
