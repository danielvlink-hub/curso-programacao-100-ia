# Espelha o curso para a pasta do repositório PÚBLICO do GitHub e faz o commit.
# Daniel (08/11/2026): "100% do curso menos a pasta Telas e o CLAUDE.md; ao publicar o CLAUDE.md precisa ir, porém só com o curso".
# -> vai tudo, menos Telas, o CLAUDE.md interno e o que é gerado no build; entram o CLAUDE.md e o README.md públicos.
# Uso: .\Publicar-GitHub.ps1 -Mensagem "texto do commit" [-Enviar]
param([string]$Mensagem = 'Atualiza o curso', [string]$Destino = 'C:\CURSO_GITHUB', [switch]$Enviar)
$ErrorActionPreference = 'Stop'
$project = $PSScriptRoot
$curso = Split-Path -Parent $project
$api = Join-Path $curso 'API FACILAPP SQLite'
New-Item -ItemType Directory -Force -Path $Destino | Out-Null

$xd = @("$curso\Telas", "$curso\Backup_Chat", "$curso\.claude", 'instalador', "$api\bin", "$api\obj", "$api\staging", "$api\saida", "$api\Backups",
        "$api\Mcp\bin", "$api\Mcp\obj", "$api\Tray\bin", "$api\Tray\obj", '.git', '.claude')
$xf = @("$curso\CLAUDE.md", "$curso\README.md", '*.pdb', '*.db', 'Thumbs.db', 'desktop.ini',
        "$curso\HTML\DASHBOARDS\js\facilflow.js", "$curso\HTML\DASHBOARDS\js\db_pedidos.js")
robocopy $curso $Destino /MIR /R:1 /W:1 /NFL /NDL /NJH /NP /XD @xd /XF @xf | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy falhou ($LASTEXITCODE)" }
Copy-Item -LiteralPath (Join-Path $project 'Installers\CLAUDE-publico.md') -Destination (Join-Path $Destino 'CLAUDE.md') -Force
Copy-Item -LiteralPath (Join-Path $project 'Installers\README-publico.md') -Destination (Join-Path $Destino 'README.md') -Force
# Instalador junto dos fontes (Daniel, 08/11/2026: "publica lá como os fontes"). Fica só o mais novo; limite do GitHub: 100 MB.
$inst = Join-Path $Destino 'instalador'; New-Item -ItemType Directory -Force -Path $inst | Out-Null
$exe = Get-ChildItem -LiteralPath (Join-Path $project 'saida') -Filter 'FacilApp-Curso-Programacao-100-IA-Setup-*.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($exe) {
  if ($exe.Length -ge 100MB) { throw "Instalador com $([math]::Round($exe.Length/1MB,1)) MB: passa do limite de 100 MB do GitHub" }
  Get-ChildItem -LiteralPath $inst -Filter '*.exe' | Where-Object Name -ne $exe.Name | Remove-Item -Force
  Copy-Item -LiteralPath $exe.FullName -Destination $inst -Force
}
@'
# gerados no build / dados locais (nunca publicar)
API FACILAPP SQLite/bin/
API FACILAPP SQLite/obj/
API FACILAPP SQLite/staging/
API FACILAPP SQLite/saida/
API FACILAPP SQLite/Backups/
API FACILAPP SQLite/Mcp/bin/
API FACILAPP SQLite/Mcp/obj/
API FACILAPP SQLite/Tray/bin/
API FACILAPP SQLite/Tray/obj/
Telas/
.claude/
*.pdb
*.db
Thumbs.db
desktop.ini
'@ | Set-Content -LiteralPath (Join-Path $Destino '.gitignore') -Encoding UTF8

Push-Location $Destino
try {
  if (-not (Test-Path '.git')) { git init -b main | Out-Null; git config user.name 'Daniel'; git config user.email 'daniel.vlink@gmail.com' }
  git add -A
  git diff --cached --quiet; if ($LASTEXITCODE -ne 0) { git commit -q -m $Mensagem } else { 'nada mudou' }
  git log --oneline -1
  if ($Enviar) { git push -u origin main }
} finally { Pop-Location }
