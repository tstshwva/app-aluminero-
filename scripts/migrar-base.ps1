param(
    [Parameter(Mandatory)][string]$MySqlBin,
    [ValidateRange(1,65535)][int]$Port=3306,
    [switch]$Aplicar,
    [Security.SecureString]$Password
)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
if((Get-Content -LiteralPath (Join-Path $projectRoot '.env') -Raw) -match '(?m)^DB_PROVIDER=["'']?sqlserver'){
 throw 'Este migrador corresponde a MySQL. Para la base actual usa database/sqlserver.'
}
$mysql=Join-Path (Resolve-Path -LiteralPath $MySqlBin).Path 'mysql.exe'
$dump=Join-Path (Resolve-Path -LiteralPath $MySqlBin).Path 'mysqldump.exe'
if(!(Test-Path -LiteralPath $mysql) -or !(Test-Path -LiteralPath $dump)){throw 'Faltan mysql.exe o mysqldump.exe.'}
$secret=if($Password){$Password.Copy()}else{Read-Host 'Contraseña local de root de MySQL (no se guardará)' -AsSecureString}
$previousPassword=$env:MYSQL_PWD
$pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
    $env:MYSQL_PWD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $connection=@('--no-defaults','--host=127.0.0.1',"--port=$Port",'--user=root','--connect-timeout=5')
    $version=& $mysql @connection --database=aluformix --batch --skip-column-names --execute='SELECT MAX(version) FROM schema_versions' 2>$null
    if($LASTEXITCODE -ne 0){throw 'No fue posible consultar la base local. Revisa el servicio y la contraseña.'}
    if([string]$version -eq '4'){Write-Output 'La base ya está en versión 4. No se realizaron cambios.';return}
    if([string]$version -ne '3'){throw 'Se esperaba la base Aluformix versión 3. No se realizaron cambios.'}
    $partial=& $mysql @connection --database=aluformix --batch --skip-column-names --execute="SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='aluformix' AND table_name IN ('favorites','company_settings','push_devices','push_outbox'))+(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='aluformix' AND ((table_name='products' AND column_name='image_url') OR (table_name='orders' AND column_name='request_key')))" 2>$null
    if($LASTEXITCODE -ne 0 -or [int]$partial -ne 0){throw 'Se detectó una migración parcial o una estructura diferente. Revisar antes de continuar.'}
    if(!$Aplicar){Write-Output 'Base versión 3 compatible. Para respaldar y migrar, ejecutar de nuevo con -Aplicar.';return}
    $backupRoot=Join-Path $projectRoot 'database/backups'
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $backup=Join-Path $backupRoot ('aluformix-v3-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N')+'.sql')
    & $dump @connection --single-transaction --routines --triggers --events --no-tablespaces --set-gtid-purged=OFF --databases aluformix "--result-file=$backup" 2>$null
    if($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $backup) -or (Get-Item -LiteralPath $backup).Length -lt 100){throw 'No se pudo completar el respaldo. No se inició la migración.'}
    (Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash | Set-Content -LiteralPath ($backup+'.sha256')
    Write-Output "Respaldo local completado: $backup"
    Get-Content -LiteralPath (Join-Path $projectRoot 'database/005_business.sql') -Raw | & $mysql @connection --default-character-set=utf8mb4 2>$null
    if($LASTEXITCODE -ne 0){throw 'La migración no terminó. MySQL confirma DDL automáticamente: no repetirla; revisar el respaldo y la estructura parcial.'}
    $after=& $mysql @connection --database=aluformix --batch --skip-column-names --execute='SELECT MAX(version) FROM schema_versions' 2>$null
    if($LASTEXITCODE -ne 0 -or [string]$after -ne '4'){throw 'No se pudo verificar la versión final. Revisar antes de iniciar la API.'}
    Write-Output 'Base actualizada a versión 4. No se insertaron productos, clientes ni cuentas de ejemplo.'
    Write-Output 'La cuenta de la API requiere SELECT, INSERT, UPDATE y DELETE sobre aluformix.*. No usar root en la app.'
} finally {
    $env:MYSQL_PWD=$previousPassword
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $secret.Dispose()
}
