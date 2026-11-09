<#
  compilar.ps1 — gera o C:\CURSO\EXE\FastPousada.exe com TODAS as telas embutidas (só o config.js fica fora).
  Daniel, 08/11/2026: "o exe que você vai gerar em C#, chamando e embutindo os html, deixando só a js config fora do exe".

  O QUE FAZ
    1. Copia as telas de C:\CURSO\HTML para Fonte\Conteudo (sem os arquivos de teste _teste_*).
    2. Copia o ícone (HTML\icon_facilapp_ambar.ico) para a Fonte.
    3. Publica em Release: um arquivo só, self-contained (não precisa instalar .NET), Windows x64.
    4. Deixa C:\CURSO\EXE\FastPousada.exe ao lado do config.js (que NÃO é sobrescrito: é a configuração do usuário).
  FERRAMENTAS: o .NET portátil (o mesmo da API e do APK) e os pacotes que já estão no cache do PC (WebView2).
  Uso: .\compilar.ps1
#>
param([string]$Dotnet = 'C:\Users\Daniel\Documents\ChatGPT\GOURMET\APK\tools\dotnet\dotnet.exe')
$ErrorActionPreference = 'Stop'
$env:DOTNET_ROOT = Split-Path -Parent $Dotnet
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$fonte = Join-Path $PSScriptRoot 'Fonte'
$html = Join-Path (Split-Path -Parent $PSScriptRoot) 'HTML'

# 1) telas para dentro do exe
$conteudo = Join-Path $fonte 'Conteudo'
New-Item -ItemType Directory -Force -Path $conteudo | Out-Null
robocopy $html $conteudo /MIR /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XF '_teste_*' 'Thumbs.db' 'desktop.ini' | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Falha ao copiar as telas ($LASTEXITCODE)." }

# 2) ícone
Copy-Item -LiteralPath (Join-Path $html 'icon_facilapp_ambar.ico') -Destination (Join-Path $fonte 'icon_facilapp_ambar.ico') -Force

# 3) publicar
$saida = Join-Path $fonte 'saida'
& $Dotnet publish (Join-Path $fonte 'FastPousada.Desktop.csproj') -c Release -o $saida -nologo -v q
if ($LASTEXITCODE -ne 0) { throw 'Falha na compilação do FastPousada.exe.' }

# 4) o exe ao lado do config.js
Copy-Item -LiteralPath (Join-Path $saida 'FastPousada.exe') -Destination (Join-Path $PSScriptRoot 'FastPousada.exe') -Force
if (-not (Test-Path (Join-Path $PSScriptRoot 'config.js'))) { throw 'Falta o config.js ao lado do exe.' }
$exe = Get-Item (Join-Path $PSScriptRoot 'FastPousada.exe')
"EXE: $($exe.FullName)  ($([math]::Round($exe.Length / 1MB, 1)) MB)"
"Telas embutidas: $((Get-ChildItem $conteudo -Recurse -File).Count) arquivos"
