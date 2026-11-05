param([string]$Instance='lpc:.\ALUFORMIX')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$node=Join-Path (Split-Path $root -Parent) 'Aluformix-herramientas/node.exe'
$testName='alu_test_'+[guid]::NewGuid().ToString('N')
$login='alu_test_'+[guid]::NewGuid().ToString('N').Substring(0,12)
if($testName -notmatch '^alu_test_[a-f0-9]{32}$' -or $login -notmatch '^alu_test_[a-f0-9]{12}$'){throw 'Nombre de prueba inválido.'}
$artifact=Join-Path $root ('.test-artifacts/'+$testName)
New-Item -ItemType Directory -Path $artifact -Force | Out-Null
$saved=@{};foreach($key in @('DB_PROVIDER','DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD','DB_SSL_CA','TEST_TLS_KEY','TEST_TLS_CERT')){$saved[$key]=[Environment]::GetEnvironmentVariable($key,'Process')}
$connection=$null;$rsa=$null;$cert=$null
function Query([string]$Sql){$command=$connection.CreateCommand();$command.CommandText=$Sql;$command.CommandTimeout=60;try{return $command.ExecuteNonQuery()}finally{$command.Dispose()}}
try{
 Add-Type -AssemblyName System.Data
 $connection=[Data.SqlClient.SqlConnection]::new("Server=$Instance;Database=master;Integrated Security=true;Encrypt=false;Connect Timeout=10")
 $connection.Open()
 foreach($batch in [regex]::Split((Get-Content (Join-Path $root 'database/sqlserver/001_schema.sql') -Raw).Replace('aluformix',$testName),'(?im)^\s*GO\s*$')){if($batch.Trim()){$null=Query $batch}}
 $null=Query "USE [$testName]; INSERT INTO dbo.categories(name) VALUES(N'Migracion aislada'); INSERT INTO dbo.customers(name,phone) VALUES(N'Migracion aislada',N'9991234567'); INSERT INTO dbo.products(category_id,code,name,unit,price,stock,reserved) SELECT id,N'MIGRATION-OLD',N'Material anterior',N'barra',125.50,5.000,1.000 FROM dbo.categories WHERE name=N'Migracion aislada'; INSERT INTO dbo.orders(customer_id,status) SELECT id,N'Confirmado' FROM dbo.customers WHERE name=N'Migracion aislada'; INSERT INTO dbo.order_items(order_id,product_id,quantity,unit_price,finish) SELECT o.id,p.id,1.000,p.price,p.finish FROM dbo.orders o JOIN dbo.customers c ON c.id=o.customer_id CROSS JOIN dbo.products p WHERE c.name=N'Migracion aislada' AND p.code=N'MIGRATION-OLD';"
 foreach($batch in [regex]::Split((Get-Content (Join-Path $root 'database/sqlserver/005_business.sql') -Raw).Replace('aluformix',$testName),'(?im)^\s*GO\s*$')){if($batch.Trim()){$null=Query $batch}}
 $password='Aa!'+[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
 $command=$connection.CreateCommand();$command.CommandText="USE master; DECLARE @sql NVARCHAR(MAX)=N'CREATE LOGIN '+QUOTENAME(@login)+N' WITH PASSWORD='+QUOTENAME(@password,CHAR(39))+N',CHECK_POLICY=ON;'; EXEC(@sql); USE [$testName]; SET @sql=N'CREATE USER '+QUOTENAME(@login)+N' FOR LOGIN '+QUOTENAME(@login)+N' WITH DEFAULT_SCHEMA=dbo; GRANT SELECT,INSERT,UPDATE,DELETE ON SCHEMA::dbo TO '+QUOTENAME(@login); EXEC(@sql);"
 $null=$command.Parameters.Add('@login',[Data.SqlDbType]::NVarChar,128);$command.Parameters['@login'].Value=$login
 $null=$command.Parameters.Add('@password',[Data.SqlDbType]::NVarChar,128);$command.Parameters['@password'].Value=$password
 $null=$command.ExecuteNonQuery();$command.Dispose()
 $env:DB_PROVIDER='sqlserver';$env:DB_HOST='localhost';$env:DB_PORT='14330';$env:DB_NAME=$testName;$env:DB_USER=$login;$env:DB_PASSWORD=$password;$env:DB_SSL_CA=Join-Path $root '.local/sqlserver-localhost-ca.pem'
 $rsa=[Security.Cryptography.RSA]::Create(2048)
 $request=[Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=localhost',$rsa,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
 $san=[Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new();$san.AddDnsName('localhost');$san.AddIpAddress([Net.IPAddress]::Loopback);$request.CertificateExtensions.Add($san.Build())
 $cert=$request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-1),[DateTimeOffset]::UtcNow.AddHours(1))
 $env:TEST_TLS_KEY=Join-Path $artifact 'test-only-key.pem';$env:TEST_TLS_CERT=Join-Path $artifact 'test-only-cert.pem'
 [IO.File]::WriteAllText($env:TEST_TLS_KEY,$rsa.ExportPkcs8PrivateKeyPem());[IO.File]::WriteAllText($env:TEST_TLS_CERT,$cert.ExportCertificatePem())
 Push-Location $root
 try{& $node (Join-Path $PSScriptRoot 'javascript/integration.js') | Tee-Object -FilePath (Join-Path $artifact 'result.txt');if($LASTEXITCODE -ne 0){throw 'Falló la integración real SQL Server.'}}finally{Pop-Location}
}finally{
 if($cert){$cert.Dispose()};if($rsa){$rsa.Dispose()}
 foreach($name in @('test-only-key.pem','test-only-cert.pem')){$path=Join-Path $artifact $name;if(Test-Path -LiteralPath $path){Remove-Item -LiteralPath $path}}
 if($connection -and $connection.State -eq 'Open'){
  $null=Query "USE master; IF DB_ID(N'$testName') IS NOT NULL BEGIN ALTER DATABASE [$testName] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$testName]; END; IF SUSER_ID(N'$login') IS NOT NULL DROP LOGIN [$login];"
  $connection.Dispose()
 }
 foreach($key in $saved.Keys){[Environment]::SetEnvironmentVariable($key,$saved[$key],'Process')}
 $password=$null
 Write-Output "Evidencia SQL Server: $artifact"
}
