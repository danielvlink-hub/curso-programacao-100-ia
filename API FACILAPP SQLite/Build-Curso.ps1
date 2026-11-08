# Gera o instalador completo do curso (pasta C:\CURSO sem Telas + serviço da API), abaixo de 100 MB (limite do GitHub).
# Runtime único: API e Tray são publicados dependentes de framework e procuram o .NET na pasta "dotnet" ao lado
# (AppHostDotNetSearch=AppRelative). O runtime vem do SDK portátil (shared\ + host\), uma cópia só para todos.
# Uso: .\Build-Curso.ps1 -Version 0.2.0
param([string]$Version = '0.2.0',
      [string]$DotnetRoot = 'C:\Users\Daniel\Documents\ChatGPT\GOURMET\APK\tools\dotnet')
$ErrorActionPreference = 'Stop'
$project = $PSScriptRoot
$curso = Split-Path -Parent $project
$compiler = @('C:\Program Files\Inno Setup 7\ISCC.exe', "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $compiler) { throw 'Inno Setup (7 ou 6) nao encontrado' }
$dotnet = Join-Path $DotnetRoot 'dotnet.exe'
$env:DOTNET_ROOT = $DotnetRoot; $env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'

$runtime = Join-Path $project "staging\curso-$Version\runtime"
if (Test-Path -LiteralPath $runtime) { Remove-Item -LiteralPath $runtime -Recurse -Force }
New-Item -ItemType Directory -Force -Path $runtime | Out-Null

# 1) API (dependente de framework, .NET em .\dotnet)
& $dotnet publish (Join-Path $project 'FacilApp.Sqlite.Api.csproj') -c Release -r win-x64 --self-contained false `
  -p:AppHostDotNetSearch=AppRelative -p:AppHostRelativeDotNet=dotnet -o $runtime
if ($LASTEXITCODE -ne 0) { throw 'Falha no publish da API' }
# o glob de conteúdo do projeto arrasta pastas de saída/fonte: não fazem parte do runtime
foreach ($lixo in 'saida', 'Mcp', 'MCP', 'Tray', 'staging', 'Backups') { $p = Join-Path $runtime $lixo; if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Recurse -Force } }

# 2) Tray (WinForms, .NET em ..\dotnet)
$tray = Join-Path $runtime 'Tray'
& $dotnet publish (Join-Path $project 'Tray\FacilApp.Curso.Tray.csproj') -c Release -r win-x64 --self-contained false `
  -p:AppHostDotNetSearch=AppRelative -p:AppHostRelativeDotNet=..\dotnet -o $tray
if ($LASTEXITCODE -ne 0) { throw 'Falha no publish do Tray' }

# 3) Runtime único (só o que a API e o Tray usam)
$rt = Join-Path $runtime 'dotnet'
New-Item -ItemType Directory -Force -Path (Join-Path $rt 'shared') | Out-Null
Copy-Item -LiteralPath (Join-Path $DotnetRoot 'host') -Destination $rt -Recurse
foreach ($fw in 'Microsoft.NETCore.App', 'Microsoft.AspNetCore.App', 'Microsoft.WindowsDesktop.App') {
  Copy-Item -LiteralPath (Join-Path $DotnetRoot "shared\$fw") -Destination (Join-Path $rt 'shared') -Recurse
}
Copy-Item -LiteralPath (Join-Path $DotnetRoot 'LICENSE.txt'), (Join-Path $DotnetRoot 'ThirdPartyNotices.txt') -Destination $rt -ErrorAction SilentlyContinue

# 4) MCP (.NET em ..\dotnet). Pacotes baixados do nuget.org com ok do Daniel (08/11/2026).
$mcp = Join-Path $runtime 'MCP'
& $dotnet publish (Join-Path $project 'Mcp\FacilApp.Sqlite.Mcp.csproj') -c Release -r win-x64 --self-contained false `
  --source https://api.nuget.org/v3/index.json -p:AppHostDotNetSearch=AppRelative -p:AppHostRelativeDotNet=..\dotnet -o $mcp
if ($LASTEXITCODE -ne 0) { throw 'Falha no publish do MCP' }

Get-ChildItem -LiteralPath $runtime -Recurse -Filter *.pdb | Remove-Item -Force
'runtime: {0:N1} MB' -f ((Get-ChildItem -LiteralPath $runtime -Recurse -File | Measure-Object Length -Sum).Sum / 1MB)

$output = Join-Path $project 'saida'
& $compiler /Q "/DAppVersion=$Version" "/DCursoRoot=$curso" "/DRuntimeRoot=$runtime" "/DOutputRoot=$output" "/DIconFile=$(Join-Path $project 'Assets\facilapp.ico')" (Join-Path $project 'Installers\CursoCompleto.iss')
if ($LASTEXITCODE -ne 0) { throw 'Falha no Inno do curso' }
Get-ChildItem -LiteralPath $output -File -Filter "FacilApp-Curso-*$Version*.exe" | ForEach-Object { '{0}  {1:N1} MB' -f $_.FullName, ($_.Length / 1MB) }
