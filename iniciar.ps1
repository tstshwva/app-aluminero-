param([ValidateSet('cliente','empresa','cliente-web','empresa-web','preparar-web','api','test','instalar')][string]$Accion='cliente')
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
 elseif($Accion -eq 'preparar-web'){
  # Instala, con las versiones compatibles con el SDK de Expo, lo necesario para ver las apps en el navegador.
  $expoCli=Join-Path $projectRoot 'node_modules\expo\bin\cli'
  if(!(Test-Path -LiteralPath $expoCli)){throw 'Primero ejecuta ./iniciar.ps1 -Accion instalar.'}
  foreach($app in 'cliente','empresa'){
   Push-Location (Join-Path $projectRoot "apps\$app")
   try{& $nodePath $expoCli install react-dom react-native-web '@expo/metro-runtime'}finally{Pop-Location}
   if($LASTEXITCODE -ne 0){throw "No se pudo preparar la vista web de $app."}
  }
 }
 elseif($Accion -eq 'cliente-web'){& $nodePath $npmPath run 'cliente:web'}
 elseif($Accion -eq 'empresa-web'){& $nodePath $npmPath run 'empresa:web'}
 else{& $nodePath $npmPath run $Accion}
 if($LASTEXITCODE -ne 0){throw 'El comando terminó con un error. Revisa el mensaje anterior.'}
}finally{Pop-Location}
