param([ValidateSet('cliente','empresa','api','test','instalar')][string]$Accion='cliente')
$ErrorActionPreference='Stop'
$projectRoot=$PSScriptRoot
$toolRoot=Join-Path (Split-Path $projectRoot -Parent) 'Aluformix-herramientas'
$nodePath=Join-Path $toolRoot 'node.exe'
$npmPath=Join-Path $toolRoot 'node_modules\npm\bin\npm-cli.js'
if(!(Test-Path -LiteralPath $nodePath) -or !(Test-Path -LiteralPath $npmPath)){
 throw 'No se encontraron las herramientas portátiles. Instala Node.js LTS y utiliza npm ci y los comandos del README.'
}
$env:PATH=$toolRoot+';'+$env:PATH
Push-Location $projectRoot
try{
 if($Accion -eq 'instalar'){& $nodePath $npmPath ci}
 else{& $nodePath $npmPath run $Accion}
 if($LASTEXITCODE -ne 0){throw 'El comando terminó con un error. Revisa el mensaje anterior.'}
}finally{Pop-Location}
