# Liga o Mercadinho do João com Docker: monta o sistema e o banco, cria o dono
# na primeira vez e abre o navegador. Chamado pelo INICIAR.bat.
Set-Location (Split-Path $PSScriptRoot -Parent)
$endereco = 'http://localhost:3100'

function Stop-ComErro($mensagem) {
    Write-Host ''
    Write-Host "ERRO: $mensagem" -ForegroundColor Red
    exit 1
}
function Test-Motor {
    cmd /c 'docker info >nul 2>&1'
    return $LASTEXITCODE -eq 0
}
function Test-PortaOcupada($porta) {
    $ouvindo = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    return [bool]($ouvindo | Where-Object { $_.Port -eq $porta })
}
function Read-Senha($texto) {
    $segura = Read-Host $texto -AsSecureString
    return (New-Object System.Net.NetworkCredential('', $segura)).Password
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Stop-ComErro 'O Docker Desktop não está instalado. Baixe em https://www.docker.com/products/docker-desktop, instale e rode este arquivo de novo.'
}

if (-not (Test-Motor)) {
    Write-Host 'Abrindo o Docker Desktop (pode levar alguns minutos)...'
    $app = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if (Test-Path $app) { Start-Process $app }
    $limite = (Get-Date).AddMinutes(4)
    while (-not (Test-Motor)) {
        if ((Get-Date) -gt $limite) { Stop-ComErro 'O Docker não respondeu. Abra o Docker Desktop, espere ficar "Running" e rode de novo.' }
        Start-Sleep -Seconds 5
    }
}

# Primeira vez: cria o .env com um segredo próprio deste computador.
if (-not (Test-Path .env)) {
    $bytes = New-Object byte[] 48
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $linhas = "# Criado pelo INICIAR.bat. Não envie este arquivo para ninguém.`r`nJWT_SECRET=$([Convert]::ToBase64String($bytes))`r`n"
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $linhas, (New-Object System.Text.UTF8Encoding($false)))
}

# Portas. Se o sistema já está de pé, elas estão ocupadas por ele mesmo.
$ligados = @(docker compose ps -q)
if (-not $ligados -and (Test-PortaOcupada 3100)) {
    Stop-ComErro 'A porta 3100 já está em uso por outro programa. Feche-o e rode de novo.'
}
if (-not $env:DB_PORT) {
    $atual = $null
    if ($ligados) { $atual = docker compose port db 5432 }
    if ($atual) { $env:DB_PORT = ($atual -split ':')[-1] }
    else {
        $porta = 5433
        while (Test-PortaOcupada $porta) { $porta++ }
        $env:DB_PORT = "$porta"
    }
}

Write-Host 'Montando e ligando o sistema (a primeira vez demora alguns minutos)...'
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Stop-ComErro 'O Docker não conseguiu ligar o sistema. Veja a mensagem acima.' }

Write-Host 'Esperando o sistema responder...'
$limite = (Get-Date).AddMinutes(3)
while ($true) {
    try { if ((Invoke-WebRequest $endereco -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200) { break } } catch { }
    if ((Get-Date) -gt $limite) {
        docker compose logs --tail 40 app
        Stop-ComErro 'O sistema não respondeu. As últimas linhas do registro estão acima.'
    }
    Start-Sleep -Seconds 3
}

# Cria o dono só se ainda não existir nenhum.
$js = "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count({where:{role:'ADMIN'}}).then(n=>console.log(n)).finally(()=>p.`$disconnect())"
$donos = (docker compose exec -T app node -e $js | Select-Object -Last 1)
if ($LASTEXITCODE -ne 0) { Stop-ComErro 'Não consegui consultar o banco.' }
if ("$donos".Trim() -eq '0') {
    Write-Host ''
    Write-Host 'Primeiro acesso: crie a conta do dono.' -ForegroundColor Cyan
    do { $nome = "$(Read-Host 'Seu nome')".Trim() } while (-not $nome)
    do { $email = "$(Read-Host 'Seu e-mail')".Trim() } while ($email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$')
    while ($true) {
        $senha = Read-Senha 'Crie uma senha (mínimo 8 caracteres)'
        if ($senha.Length -lt 8) { Write-Host 'Senha curta demais.'; continue }
        if ($senha -ceq (Read-Senha 'Repita a senha')) { break }
        Write-Host 'As senhas não são iguais.'
    }
    $env:ADMIN_NAME = $nome; $env:ADMIN_EMAIL = $email; $env:ADMIN_PASSWORD = $senha
    docker compose exec -T -e ADMIN_NAME -e ADMIN_EMAIL -e ADMIN_PASSWORD app npm run seed
    $criou = $LASTEXITCODE
    Remove-Item Env:ADMIN_NAME, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
    if ($criou -ne 0) { Stop-ComErro 'A conta do dono não foi criada. Veja a mensagem acima e rode de novo.' }
}

Write-Host ''
Write-Host "Pronto! O sistema está em $endereco" -ForegroundColor Green
Write-Host 'Para desligar, use o PARAR.bat.'
if (-not $env:MJ_SEM_NAVEGADOR) { Start-Process $endereco }
