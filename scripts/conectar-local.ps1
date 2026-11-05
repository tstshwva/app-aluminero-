Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
if((Get-Content -LiteralPath (Join-Path $projectRoot '.env') -Raw) -match '(?m)^DB_PROVIDER=["'']?sqlserver'){
 throw 'El proyecto usa SQL Server. Utiliza scripts/preparar-sqlserver.ps1 y scripts/verificar-sqlserver.js.'
}
$toolRoot=Join-Path (Split-Path $projectRoot -Parent) 'Aluformix-herramientas'
$node=Join-Path $toolRoot 'node.exe'
$mysqlBin='C:\Program Files\MySQL\MySQL Server 8.4\bin'
$localRoot=Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Path $localRoot -Force | Out-Null
function Restrict-LocalFile([string]$Path){
    $acl=Get-Acl -LiteralPath $Path
    $acl.SetAccessRuleProtection($true,$false)
    $inherit=if((Get-Item -LiteralPath $Path).PSIsContainer){[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'}else{[Security.AccessControl.InheritanceFlags]::None}
    foreach($sid in @([Security.Principal.WindowsIdentity]::GetCurrent().User,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'),[Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))){
        $rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::FullControl,$inherit,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow)
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}
Restrict-LocalFile $localRoot
function Status([string]$Stage,[string]$Message){
    @{stage=$Stage;message=$Message;updatedAt=[DateTimeOffset]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $localRoot 'conexion-estado.json') -Encoding utf8
}
function Helper([string]$Action,[string]$Payload=''){
    $info=[Diagnostics.ProcessStartInfo]::new()
    $info.FileName=$node;$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WorkingDirectory=$projectRoot
    $info.RedirectStandardInput=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
    $info.ArgumentList.Add((Join-Path $PSScriptRoot 'conexion-local.js'));$info.ArgumentList.Add($Action)
    $process=[Diagnostics.Process]::Start($info)
    try{
        if($Payload){$process.StandardInput.Write($Payload)}
        $process.StandardInput.Close()
        $output=$process.StandardOutput.ReadToEnd();$null=$process.StandardError.ReadToEnd()
        $process.WaitForExit()
        if($process.ExitCode -ne 0){throw 'No se pudo validar la conexión. Revisa la configuración local; no se mostraron secretos.'}
        return $output | ConvertFrom-Json
    }finally{$process.Dispose()}
}
function Prepare-Certificate {
    $certRoot=Join-Path $localRoot 'certificados'
    New-Item -ItemType Directory -Path $certRoot -Force | Out-Null
    $keyPath=Join-Path $certRoot 'localhost-key.pem';$certPath=Join-Path $certRoot 'localhost-cert.pem'
    if(!(Test-Path -LiteralPath $keyPath) -and !(Test-Path -LiteralPath $certPath)){
        $rsa=[Security.Cryptography.RSA]::Create(3072)
        $certificate=$null
        try{
            $request=[Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=localhost',$rsa,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
            $san=[Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new();$san.AddDnsName('localhost');$san.AddIpAddress([Net.IPAddress]::Loopback)
            $request.CertificateExtensions.Add($san.Build())
            $oids=[Security.Cryptography.OidCollection]::new();$null=$oids.Add([Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.1'))
            $request.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($oids,$true))
            $certificate=$request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-5),[DateTimeOffset]::UtcNow.AddDays(90))
            [IO.File]::WriteAllText($keyPath,$rsa.ExportPkcs8PrivateKeyPem())
            [IO.File]::WriteAllText($certPath,$certificate.ExportCertificatePem())
        }finally{if($certificate){$certificate.Dispose()};$rsa.Dispose()}
    }
    return @{keyPath=$keyPath;certPath=$certPath}
}
[System.Windows.Forms.Application]::EnableVisualStyles()
$form=[Windows.Forms.Form]::new();$form.Text='Aluformix — Conexión local';$form.ClientSize=[Drawing.Size]::new(640,400);$form.StartPosition='CenterScreen';$form.FormBorderStyle='FixedDialog';$form.MaximizeBox=$false;$form.BackColor=[Drawing.Color]::FromArgb(244,248,255)
$font=[Drawing.Font]::new('Segoe UI',10)
$form.Font=$font
$title=[Windows.Forms.Label]::new();$title.Text='Conectar Aluformix en esta computadora';$title.Location=[Drawing.Point]::new(24,20);$title.Size=[Drawing.Size]::new(590,32);$title.Font=[Drawing.Font]::new('Segoe UI',15,[Drawing.FontStyle]::Bold);$form.Controls.Add($title)
$description=[Windows.Forms.Label]::new();$description.Text="Se guardará un respaldo antes de actualizar la base. Se creará una cuenta limitada para la API y HTTPS local. No se agregarán datos de ejemplo ni se cambiará tu contraseña de MySQL.";$description.Location=[Drawing.Point]::new(24,65);$description.Size=[Drawing.Size]::new(585,72);$form.Controls.Add($description)
$label=[Windows.Forms.Label]::new();$label.Text='Contraseña de root de MySQL (solo se usará en este equipo)';$label.Location=[Drawing.Point]::new(24,145);$label.Size=[Drawing.Size]::new(585,24);$form.Controls.Add($label)
$password=[Windows.Forms.TextBox]::new();$password.UseSystemPasswordChar=$true;$password.Location=[Drawing.Point]::new(24,175);$password.Size=[Drawing.Size]::new(585,30);$form.Controls.Add($password)
$button=[Windows.Forms.Button]::new();$button.Text='Respaldar y conectar';$button.Location=[Drawing.Point]::new(24,220);$button.Size=[Drawing.Size]::new(270,40);$button.BackColor=[Drawing.Color]::FromArgb(0,123,255);$button.ForeColor=[Drawing.Color]::White;$form.Controls.Add($button)
$message=[Windows.Forms.Label]::new();$message.Text='Escribe aquí la contraseña; no la envíes al chat. El certificado local no se instalará en Windows ni en el teléfono.';$message.Location=[Drawing.Point]::new(24,280);$message.Size=[Drawing.Size]::new(585,100);$form.Controls.Add($message)
$form.AcceptButton=$button
$button.Add_Click({
    if(!$password.Text){$message.Text='Escribe la contraseña de root que utilizaste en MySQL.';return}
    $button.Enabled=$false;$password.Enabled=$false;$secure=$null
    try{
        Status 'working' 'Respaldo y migración local en proceso.'
        $message.Text='Respaldando y comprobando la base...';$form.Refresh()
        $secure=ConvertTo-SecureString $password.Text -AsPlainText -Force
        $migration=& (Join-Path $PSScriptRoot 'migrar-base.ps1') -MySqlBin $mysqlBin -Aplicar -Password $secure
        $message.Text='Configurando la cuenta limitada y HTTPS local...';$form.Refresh()
        $paths=Prepare-Certificate
        $payload=@{password=$password.Text;keyPath=$paths.keyPath;certPath=$paths.certPath} | ConvertTo-Json -Compress
        $result=Helper 'preparar' $payload
        $payload=$null;$password.Clear()
        Restrict-LocalFile (Join-Path $projectRoot '.env')
        try{$health=Helper 'verificar'}catch{
            $listener=[Net.Sockets.TcpClient]::new()
            try{$listener.Connect('127.0.0.1',5180);throw 'El puerto 5180 está ocupado por otro proceso. No se detuvo ningún programa.'}catch [Net.Sockets.SocketException]{}finally{$listener.Dispose()}
            $api=Start-Process -FilePath $node -ArgumentList @("--env-file=`"$(Join-Path $projectRoot '.env')`"","`"$(Join-Path $projectRoot 'server/src/start.js')`"") -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $localRoot 'api-salida.log') -RedirectStandardError (Join-Path $localRoot 'api-error.log')
            $api.Id | Set-Content -LiteralPath (Join-Path $localRoot 'api.pid')
            $health=$null
            for($i=0;$i -lt 15;$i++){Start-Sleep -Milliseconds 500;try{$health=Helper 'verificar';break}catch{if($api.HasExited){break}}}
            if(!$health){throw 'MySQL quedó configurado, pero no se pudo iniciar HTTPS. Revisa el registro local antes de reintentar.'}
        }
        $message.Text="Conexión verificada: MySQL versión $($result.schemaVersion), $($result.tables) tablas y API $($health.url). Falta crear el administrador real y preparar la conexión del teléfono."
        Status 'ready' $message.Text
        $button.Text='Conexión completada';$form.Refresh()
    }catch{
        $message.Text=$_.Exception.Message
        Status 'attention' $message.Text
        $button.Enabled=$true;$password.Enabled=$true
    }finally{if($secure){$secure.Dispose()};$payload=$null;$password.Clear()}
})
Status 'waiting' 'Esperando que la persona introduzca la contraseña de MySQL en la ventana local.'
$form.Add_Shown({$password.Focus()})
[void]$form.ShowDialog()
$form.Dispose();$font.Dispose()
