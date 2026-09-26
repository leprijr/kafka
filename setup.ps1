# Kafka — instalação automática (Windows, leigo)
# Uso no PC novo SEM o código: powershell -ExecutionPolicy Bypass -c "iwr https://raw.githubusercontent.com/leprijr/kafka/main/setup.ps1 -useb | iex"
# Uso COM o código: duplo clique em COMECE-AQUI.bat ou rode .\setup.ps1 na pasta KAFKA

$ErrorActionPreference = 'Stop'
$Repo = 'https://github.com/leprijr/kafka.git'

function Ok($m) { Write-Host "[OK] $m" -ForegroundColor Green }
function Info($m) { Write-Host "-- $m" }
function Fail($m) { Write-Host "[FALTA] $m" -ForegroundColor Yellow }

# 1) Checa git/node
try { git --version | Out-Null; Ok('Git instalado') } catch { Fail('Instale o Git em https://git-scm.com e rode de novo'); exit 1 }
try { node -v | Out-Null; Ok('Node instalado') } catch { Fail('Instale o Node 20 LTS em https://nodejs.org e rode de novo'); exit 1 }

# 2) Vai para a raiz do repo (clona se preciso)
$root = $PWD.Path
if (-not (Test-Path (Join-Path $root 'backend/package.json'))) {
  if (-not (Test-Path (Join-Path $root 'kafka'))) {
    Info("Clonando $Repo ...")
    git clone $Repo kafka
  }
  Set-Location (Join-Path $root 'kafka')
}
$root = $PWD.Path
Ok("Pasta: $root")

# 3) Atualiza código
if (Test-Path (Join-Path $root '.git')) {
  Info('Atualizando código (git pull)...')
  git pull --ff-only
}

# 4) Instala dependências
Info('Instalando backend (pode demorar)...')
Set-Location (Join-Path $root 'backend')
npm.cmd install

Info('Instalando frontend (pode demorar)...')
Set-Location (Join-Path $root 'frontend')
npm.cmd install

Set-Location $root
Ok('Instalado!')

# 5) Abre os 2 servidores em janelas separadas
Info('Abrindo backend e frontend...')
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root\backend'; npm.cmd run dev"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root\frontend'; npm.cmd run dev"

Write-Host ''
Ok('Pronto! Aguarde ~30s e abra http://localhost:5173 (login admin / 123456)')
Write-Host 'Para atualizar depois: git pull  |  Para publicar: git push + fly deploy'
