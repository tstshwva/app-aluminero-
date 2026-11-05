param([Parameter(Mandatory)][string]$Node,[Parameter(Mandatory)][string]$MySqlBin)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$Node=(Resolve-Path -LiteralPath $Node).Path
$MySqlBin=(Resolve-Path -LiteralPath $MySqlBin).Path
$artifactRoot=Join-Path $projectRoot ('.test-artifacts/js-'+[guid]::NewGuid().ToString('N'))
$data=Join-Path $artifactRoot 'data'
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
$listener.Start();$dbPort=$listener.LocalEndpoint.Port;$listener.Stop()
$saved=@{};foreach($key in @('DB_PROVIDER','MYSQL_PWD','DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD','DB_SSL_CA','TEST_TLS_KEY','TEST_TLS_CERT')){$saved[$key]=[Environment]::GetEnvironmentVariable($key,'Process')}
$server=$null;$testKey=$null;$certificate=$null
function Sql([string]$query){
 $result=$query | & (Join-Path $MySqlBin 'mysql.exe') --no-defaults --host=127.0.0.1 "--port=$dbPort" --user=root --connect-timeout=2 --batch --raw --skip-column-names 2>&1
 if($LASTEXITCODE -ne 0){throw "SQL de pruebas falló: $result"};return $result
}
try{
 $env:MYSQL_PWD=$null;$base=Split-Path $MySqlBin -Parent
 & (Join-Path $MySqlBin 'mysqld.exe') --no-defaults --initialize-insecure "--basedir=$base" "--datadir=$data" 2>&1 | Out-File (Join-Path $artifactRoot 'initialize.log')
 if($LASTEXITCODE -ne 0){throw 'No se pudo inicializar MySQL aislado.'}
 $server=Start-Process (Join-Path $MySqlBin 'mysqld.exe') -ArgumentList @('--no-defaults',"--basedir=`"$base`"","--datadir=`"$data`"",'--bind-address=127.0.0.1',"--port=$dbPort",'--mysqlx=OFF') -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $artifactRoot 'mysql.log')
 $ready=$false
 for($i=0;$i -lt 30;$i++){
  if($server.HasExited){throw 'MySQL aislado terminó.'}
  try{$actual=[string](Sql 'SELECT @@datadir');if([IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($actual)) -eq [IO.Path]::GetFullPath($data)){$ready=$true;break}}catch{}
  Start-Sleep -Milliseconds 500
 }
 if(!$ready){throw 'No se pudo verificar el directorio del MySQL aislado.'}
 $rootPassword=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
 $null=Sql "ALTER USER 'root'@'localhost' IDENTIFIED BY '$rootPassword'";$env:MYSQL_PWD=$rootPassword
 foreach($file in @('001_schema.sql','003_integrity.sql','004_authentication.sql')){$null=Sql (Get-Content -LiteralPath (Join-Path $projectRoot "database/$file") -Raw)}
 $null=Sql "USE aluformix; INSERT INTO categories(name) VALUES('Migracion aislada'); INSERT INTO customers(name,phone) VALUES('Migracion aislada','9991234567'); INSERT INTO products(category_id,code,name,unit,price,stock,reserved) SELECT id,'MIGRATION-OLD','Material anterior','barra',125.50,5.000,1.000 FROM categories WHERE name='Migracion aislada'; INSERT INTO orders(customer_id,status) SELECT id,'Confirmado' FROM customers WHERE name='Migracion aislada'; INSERT INTO order_items(order_id,product_id,quantity,unit_price,finish) SELECT o.id,p.id,1.000,p.price,p.finish FROM orders o JOIN customers c ON c.id=o.customer_id CROSS JOIN products p WHERE c.name='Migracion aislada' AND p.code='MIGRATION-OLD';"
 $null=Sql (Get-Content -LiteralPath (Join-Path $projectRoot 'database/005_business.sql') -Raw)
 $dbPassword=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
 $null=Sql "CREATE USER 'alu_js_test'@'localhost' IDENTIFIED BY '$dbPassword'; GRANT SELECT,INSERT,UPDATE,DELETE ON aluformix.* TO 'alu_js_test'@'localhost';"
 $env:DB_PROVIDER='mysql';$env:DB_HOST='127.0.0.1';$env:DB_PORT="$dbPort";$env:DB_NAME='aluformix';$env:DB_USER='alu_js_test';$env:DB_PASSWORD=$dbPassword;$env:DB_SSL_CA=$null
 $testKey=[Security.Cryptography.RSA]::Create(2048)
 $request=[Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=localhost',$testKey,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
 $san=[Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new();$san.AddDnsName('localhost');$san.AddIpAddress([Net.IPAddress]::Loopback);$request.CertificateExtensions.Add($san.Build())
 $certificate=$request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-1),[DateTimeOffset]::UtcNow.AddHours(1))
 $env:TEST_TLS_KEY=Join-Path $artifactRoot 'test-only-key.pem';$env:TEST_TLS_CERT=Join-Path $artifactRoot 'test-only-cert.pem'
 [IO.File]::WriteAllText($env:TEST_TLS_KEY,$testKey.ExportPkcs8PrivateKeyPem())
 [IO.File]::WriteAllText($env:TEST_TLS_CERT,$certificate.ExportCertificatePem())
 & $Node (Join-Path $PSScriptRoot 'javascript/integration.js') | Tee-Object -FilePath (Join-Path $artifactRoot 'result.txt')
 if($LASTEXITCODE -ne 0){throw 'Falló la integración JavaScript.'}
}finally{
 if($certificate){$certificate.Dispose()};if($testKey){$testKey.Dispose()}
 foreach($name in @('test-only-key.pem','test-only-cert.pem')){$target=Join-Path $artifactRoot $name;if(Test-Path -LiteralPath $target){Remove-Item -LiteralPath $target}}
 if($server -and !$server.HasExited){& (Join-Path $MySqlBin 'mysqladmin.exe') --no-defaults --host=127.0.0.1 "--port=$dbPort" --user=root --connect-timeout=2 shutdown 2>&1 | Out-Null;if(!$server.WaitForExit(5000)){Stop-Process -Id $server.Id}}
 foreach($key in $saved.Keys){[Environment]::SetEnvironmentVariable($key,$saved[$key],'Process')}
 Write-Output "Evidencia JavaScript: $artifactRoot"
}
