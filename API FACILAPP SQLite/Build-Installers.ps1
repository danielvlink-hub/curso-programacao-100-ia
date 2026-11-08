param([string]$Version = '0.1.0')
$ErrorActionPreference = 'Stop'
$project = $PSScriptRoot
# Inno Setup 7 se existir; nesta máquina do curso só há o Inno Setup 6 (x86), que compila os mesmos .iss.
$compiler = @('C:\Program Files\Inno Setup 7\ISCC.exe', "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $compiler) { throw 'Inno Setup (7 ou 6) nao encontrado' }
$staging = Join-Path (Join-Path $project 'staging') $Version
$runtime = Join-Path $staging 'runtime'
$mcpRuntime = Join-Path $runtime 'MCP'
$trayRuntime = Join-Path $runtime 'Tray'
$source = Join-Path $staging 'source'
$output = Join-Path $project 'saida'
New-Item -ItemType Directory -Force -Path $runtime, $mcpRuntime, $trayRuntime, $source, $output | Out-Null

dotnet publish (Join-Path $project 'FacilApp.Sqlite.Api.csproj') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o $runtime
if ($LASTEXITCODE -ne 0) { throw 'Falha no publish da API' }
dotnet publish (Join-Path $project 'Mcp\FacilApp.Sqlite.Mcp.csproj') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o $mcpRuntime
if ($LASTEXITCODE -ne 0) { throw 'Falha no publish do MCP' }
dotnet publish (Join-Path $project 'Tray\FacilApp.Curso.Tray.csproj') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o $trayRuntime
if ($LASTEXITCODE -ne 0) { throw 'Falha no publish do Tray' }

$sourceFiles = @('AGENTS.md', 'README.md', 'FacilApp.Sqlite.Api.csproj', 'Program.cs', 'MenuCatalog.cs', 'PublicLookupService.cs', 'Build-Installers.ps1')
foreach ($file in $sourceFiles) { Copy-Item -LiteralPath (Join-Path $project $file) -Destination (Join-Path $source $file) -Force }
New-Item -ItemType Directory -Force -Path (Join-Path $source 'Installers') | Out-Null
Copy-Item -LiteralPath (Join-Path $project 'Installers\ApiRuntime.iss') -Destination (Join-Path $source 'Installers\ApiRuntime.iss') -Force
Copy-Item -LiteralPath (Join-Path $project 'Installers\ApiSource.iss') -Destination (Join-Path $source 'Installers\ApiSource.iss') -Force
New-Item -ItemType Directory -Force -Path (Join-Path $source 'Assets') | Out-Null
Copy-Item -LiteralPath (Join-Path $project 'Assets\facilapp.ico') -Destination (Join-Path $source 'Assets\facilapp.ico') -Force
New-Item -ItemType Directory -Force -Path (Join-Path $source 'Mcp') | Out-Null
Copy-Item -LiteralPath (Join-Path $project 'Mcp\FacilApp.Sqlite.Mcp.csproj') -Destination (Join-Path $source 'Mcp\FacilApp.Sqlite.Mcp.csproj') -Force
Copy-Item -LiteralPath (Join-Path $project 'Mcp\Program.cs') -Destination (Join-Path $source 'Mcp\Program.cs') -Force
New-Item -ItemType Directory -Force -Path (Join-Path $source 'Tray') | Out-Null
Copy-Item -LiteralPath (Join-Path $project 'Tray\FacilApp.Curso.Tray.csproj') -Destination (Join-Path $source 'Tray\FacilApp.Curso.Tray.csproj') -Force
Copy-Item -LiteralPath (Join-Path $project 'Tray\Program.cs') -Destination (Join-Path $source 'Tray\Program.cs') -Force
New-Item -ItemType Directory -Force -Path (Join-Path $source 'wwwroot') | Out-Null
Copy-Item -LiteralPath (Join-Path $project 'wwwroot\index.html') -Destination (Join-Path $source 'wwwroot\index.html') -Force
Copy-Item -LiteralPath (Join-Path $project 'wwwroot\TesteDaApi.html') -Destination (Join-Path $source 'wwwroot\TesteDaApi.html') -Force

& $compiler "/DAppVersion=$Version" "/DSourceRoot=$runtime" "/DOutputRoot=$output" "/DIconFile=$(Join-Path $project 'Assets\facilapp.ico')" (Join-Path $project 'Installers\ApiRuntime.iss')
if ($LASTEXITCODE -ne 0) { throw 'Falha no Inno runtime' }
& $compiler "/DAppVersion=$Version" "/DSourceRoot=$source" "/DOutputRoot=$output" "/DIconFile=$(Join-Path $project 'Assets\facilapp.ico')" (Join-Path $project 'Installers\ApiSource.iss')
if ($LASTEXITCODE -ne 0) { throw 'Falha no Inno fonte' }
Get-ChildItem -LiteralPath $output -File -Filter "*${Version}*.exe" | Get-FileHash -Algorithm SHA256 | Select-Object Path, Hash
