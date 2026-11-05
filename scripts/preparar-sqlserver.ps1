param([string]$ProjectRoot=(Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference='Stop'
$principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if(!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Ejecuta este configurador con permisos de administrador.'}
$ProjectRoot=(Resolve-Path -LiteralPath $ProjectRoot).Path
$node=Join-Path (Split-Path $ProjectRoot -Parent) 'Aluformix-herramientas/node.exe'
$localRoot=Join-Path $ProjectRoot '.local'
New-Item -ItemType Directory -Path $localRoot -Force | Out-Null
function Protect([string]$Path){
 $acl=Get-Acl -LiteralPath $Path;$acl.SetAccessRuleProtection($true,$false)
 $inherit=if((Get-Item -LiteralPath $Path).PSIsContainer){[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'}else{[Security.AccessControl.InheritanceFlags]::None}
 foreach($sid in @([Security.Principal.WindowsIdentity]::GetCurrent().User,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'),[Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl',$inherit,'None','Allow'))}
 Set-Acl -LiteralPath $Path -AclObject $acl
}
Protect $localRoot
$statusFile=Join-Path $localRoot 'sqlserver-estado.json'
function Status([string]$Stage,[string]$Message){@{stage=$Stage;message=$Message;updatedAt=[DateTimeOffset]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $statusFile -Encoding utf8}
$connection=$null
try{
 Status 'configuring' 'Configurando SQL Server local y certificado.'
 $instance=Get-ItemPropertyValue 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL' -Name 'ALUFORMIX'
 $network="HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instance\MSSQLServer\SuperSocketNetLib"
 $cert=Get-ChildItem Cert:\LocalMachine\My | Where-Object {$_.FriendlyName -eq 'Aluformix SQL localhost' -and $_.NotAfter -gt (Get-Date).AddDays(7)} | Select-Object -First 1
 if(!$cert){$cert=New-SelfSignedCertificate -Type SSLServerAuthentication -Subject 'CN=localhost' -DnsName 'localhost' -FriendlyName 'Aluformix SQL localhost' -CertStoreLocation 'Cert:\LocalMachine\My' -Provider 'Microsoft RSA SChannel Cryptographic Provider' -KeySpec KeyExchange -KeyAlgorithm RSA -KeyLength 3072 -HashAlgorithm SHA256 -NotAfter (Get-Date).AddMonths(6)}
 $rsaKey=[Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
 try{
  $keyName=if($rsaKey -is [Security.Cryptography.RSACng]){$rsaKey.Key.UniqueName}else{$rsaKey.CspKeyContainerInfo.UniqueKeyContainerName}
  if(!$keyName){throw 'No se pudo identificar la clave del certificado SQL.'}
  $privateKeyFile=@((Join-Path "$env:ProgramData\Microsoft\Crypto\RSA\MachineKeys" $keyName),(Join-Path "$env:ProgramData\Microsoft\Crypto\Keys" $keyName)) | Where-Object {Test-Path -LiteralPath $_ -PathType Leaf} | Select-Object -First 1
  if(!$privateKeyFile){throw 'No se encontró el archivo de clave privada SQL.'}
 }finally{$rsaKey.Dispose()}
 $keyDirectory="$env:ProgramData\Microsoft\Crypto\RSA\MachineKeys"
 $directoryAcl=Get-Acl -LiteralPath $keyDirectory
 $directoryAcl.RemoveAccessRuleSpecific([Security.AccessControl.FileSystemAccessRule]::new('NT SERVICE\MSSQL$ALUFORMIX','Read','Allow'))
 Set-Acl -LiteralPath $keyDirectory -AclObject $directoryAcl
 $acl=Get-Acl -LiteralPath $privateKeyFile;$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new('NT SERVICE\MSSQL$ALUFORMIX','Read','Allow'));Set-Acl -LiteralPath $privateKeyFile -AclObject $acl
 $caPath=Join-Path $localRoot 'sqlserver-localhost-ca.pem';[IO.File]::WriteAllText($caPath,$cert.ExportCertificatePem())
 Set-ItemProperty -LiteralPath $network -Name 'Certificate' -Value $cert.Thumbprint.ToLowerInvariant()
 Set-ItemProperty -LiteralPath $network -Name 'ForceEncryption' -Value 1
 Set-ItemProperty -LiteralPath "$network\Tcp" -Name 'ListenOnAllIPs' -Value 0
 Set-ItemProperty -LiteralPath "$network\Tcp" -Name 'Enabled' -Value 1
 $loopback=0
 foreach($key in (Get-ChildItem -LiteralPath "$network\Tcp" | Where-Object PSChildName -Match '^IP[0-9]+$')){
  $ip=Get-ItemProperty -LiteralPath $key.PSPath
  $enabled=if($ip.IpAddress -in @('127.0.0.1','::1')){1}else{0}
  Set-ItemProperty -LiteralPath $key.PSPath -Name 'Enabled' -Value $enabled
  Set-ItemProperty -LiteralPath $key.PSPath -Name 'TcpDynamicPorts' -Value ''
  Set-ItemProperty -LiteralPath $key.PSPath -Name 'TcpPort' -Value '14330'
  $loopback+=$enabled
 }
 if(!$loopback){throw 'No se encontró una dirección loopback para SQL Server.'}
 Set-ItemProperty -LiteralPath "$network\Tcp\IPAll" -Name 'TcpDynamicPorts' -Value ''
 Set-ItemProperty -LiteralPath "$network\Tcp\IPAll" -Name 'TcpPort' -Value '14330'
 Set-ItemProperty -LiteralPath "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instance\MSSQLServer" -Name 'LoginMode' -Value 2
 Restart-Service -Name 'MSSQL$ALUFORMIX'
 Add-Type -AssemblyName System.Data
 $connection=[System.Data.SqlClient.SqlConnection]::new('Server=lpc:.\ALUFORMIX;Database=master;Integrated Security=true;Encrypt=false;Connect Timeout=10')
 $connection.Open()
 foreach($file in @('001_schema.sql','005_business.sql')){
  $source=Get-Content -LiteralPath (Join-Path $ProjectRoot "database/sqlserver/$file") -Raw
  foreach($batch in [regex]::Split($source,'(?im)^\s*GO\s*$')){
   if(!$batch.Trim()){continue}
   $command=$connection.CreateCommand();$command.CommandText=$batch;$command.CommandTimeout=60;$null=$command.ExecuteNonQuery();$command.Dispose()
  }
 }
 $existing=if(Test-Path -LiteralPath (Join-Path $ProjectRoot '.env')){Get-Content -LiteralPath (Join-Path $ProjectRoot '.env') -Raw}else{''}
 if($existing -match '(?m)^DB_PROVIDER=["'']?sqlserver' -and $existing -match '(?m)^DB_USER=["'']?[^"''\s\r\n]+'){
  & $node (Join-Path $ProjectRoot 'scripts/verificar-sqlserver.js')
  if($LASTEXITCODE -ne 0){throw 'Existe una cuenta de aplicación. Revisa su configuración antes de crear otra.'}
  Status 'ready' 'SQL Server verificado. Se conservó la cuenta de aplicación existente.'
  return
 }
 $user='alu_api_'+[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(5)).ToLowerInvariant()
 $password='Aa!'+[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
 $command=$connection.CreateCommand()
 $command.CommandText="USE master; DECLARE @statement NVARCHAR(MAX)=N'CREATE LOGIN '+QUOTENAME(@login)+N' WITH PASSWORD='+QUOTENAME(@password,CHAR(39))+N',CHECK_POLICY=ON,CHECK_EXPIRATION=OFF;'; EXEC sys.sp_executesql @statement; USE aluformix; SET @statement=N'CREATE USER '+QUOTENAME(@login)+N' FOR LOGIN '+QUOTENAME(@login)+N' WITH DEFAULT_SCHEMA=dbo; GRANT SELECT ON SCHEMA::dbo TO '+QUOTENAME(@login)+N';'; EXEC sys.sp_executesql @statement;"
 $null=$command.Parameters.Add('@login',[Data.SqlDbType]::NVarChar,128);$command.Parameters['@login'].Value=$user
 $null=$command.Parameters.Add('@password',[Data.SqlDbType]::NVarChar,128);$command.Parameters['@password'].Value=$password
 $null=$command.ExecuteNonQuery();$command.Dispose()
 foreach($table in @('users','customers','categories','products','orders','order_items','quotes','payments','inventory_movements','order_history','notifications','auth_sessions','password_reset_tokens','favorites','company_settings','push_devices','push_outbox')){
  $grant=$connection.CreateCommand();$grant.CommandText="USE aluformix; GRANT INSERT,UPDATE ON dbo.[$table] TO [$user];";$null=$grant.ExecuteNonQuery();$grant.Dispose()
 }
 $grant=$connection.CreateCommand();$grant.CommandText="USE aluformix; GRANT DELETE ON dbo.favorites TO [$user];";$null=$grant.ExecuteNonQuery();$grant.Dispose()
 $apiKeyPath=Join-Path $localRoot 'api-localhost-key.pem';$apiCertPath=Join-Path $localRoot 'api-localhost-cert.pem'
 if(!(Test-Path -LiteralPath $apiKeyPath) -and !(Test-Path -LiteralPath $apiCertPath)){
  $rsa=[Security.Cryptography.RSA]::Create(3072)
  try{
   $request=[Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=localhost',$rsa,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
   $san=[Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new();$san.AddDnsName('localhost');$san.AddIpAddress([Net.IPAddress]::Loopback);$request.CertificateExtensions.Add($san.Build())
   $apiCert=$request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-5),[DateTimeOffset]::UtcNow.AddDays(90))
   try{[IO.File]::WriteAllText($apiKeyPath,$rsa.ExportPkcs8PrivateKeyPem());[IO.File]::WriteAllText($apiCertPath,$apiCert.ExportCertificatePem())}finally{$apiCert.Dispose()}
  }finally{$rsa.Dispose()}
 }
 $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$node;$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WorkingDirectory=$ProjectRoot;$info.RedirectStandardInput=$true
 $info.ArgumentList.Add((Join-Path $ProjectRoot 'scripts/configurar-sqlserver-env.js'))
 $process=[Diagnostics.Process]::Start($info);$process.StandardInput.Write((@{user=$user;password=$password;ca=$caPath;key=$apiKeyPath;cert=$apiCertPath} | ConvertTo-Json -Compress));$process.StandardInput.Close();$process.WaitForExit()
 if($process.ExitCode -ne 0){throw 'No se pudo guardar la configuración local.'}
 Protect (Join-Path $ProjectRoot '.env')
 & $node (Join-Path $ProjectRoot 'scripts/verificar-sqlserver.js')
 if($LASTEXITCODE -ne 0){throw 'No se pudo verificar la conexión cifrada de la aplicación.'}
 Status 'ready' 'SQL Server configurado en localhost:14330, esquema 4, 19 tablas y conexión cifrada.'
}catch{
 Status 'attention' 'La configuración SQL Server requiere revisión. No se imprimieron credenciales.'
 @{type=$_.Exception.GetType().FullName;detail=$_.Exception.Message;line=$_.InvocationInfo.ScriptLineNumber;code=$_.FullyQualifiedErrorId} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $localRoot 'sqlserver-config-error.json') -Encoding utf8
 throw
}
finally{if($connection){$connection.Dispose()};$password=$null}
