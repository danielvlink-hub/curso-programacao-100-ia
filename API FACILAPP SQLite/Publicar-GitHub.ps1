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
        "$api\Mcp\bin", "$api\Mcp\obj", "$api\Tray\bin", "$api\Tray\obj", '.git', '.claude',
        "$curso\APK\signing", "$curso\APK\bin", "$curso\APK\obj", "$curso\APK\Assets",
        "$curso\EXE\Fonte\Conteudo", "$curso\EXE\Fonte\saida", "$curso\EXE\Fonte\bin", "$curso\EXE\Fonte\obj",
        "$curso\LINUX\_build")   # LINUX: vai só o FastPousada-Linux-x64.tar.gz e o LEIA-ME   # APK: a chave de assinatura é SECRETA
# Os *.db de dentro do C:\CURSO não vão (backups antigos). O banco do curso vai à parte, logo abaixo (BANCO\usuarios.db).
# Os *.dpapi (chave da OpenAI e chave dos logins) NUNCA vão.
$xf = @("$curso\CLAUDE.md", "$curso\README.md", '*.pdb', '*.db', '*.dpapi', '*.segredo', '*.zip',   # .zip: cópias/backups locais (ex.: HTML.zip de 927 MB)
        'Thumbs.db', 'desktop.ini',
        "$curso\HTML\DASHBOARDS\js\facilflow.js", "$curso\HTML\DASHBOARDS\js\db_pedidos.js")
robocopy $curso $Destino /MIR /R:1 /W:1 /NFL /NDL /NJH /NP /XD @xd /XF @xf | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy falhou ($LASTEXITCODE)" }
Copy-Item -LiteralPath (Join-Path $project 'Installers\CLAUDE-publico.md') -Destination (Join-Path $Destino 'CLAUDE.md') -Force
Copy-Item -LiteralPath (Join-Path $project 'Installers\README-publico.md') -Destination (Join-Path $Destino 'README.md') -Force

<#
  BANCO DO CURSO NO GIT — Daniel, 08/11/2026: "o db que vai para o git: o token OpenAI deve ser zerado; só ficará zerado o
  token, o resto vai tudo".
  O QUE FAZ: copia o usuarios.db da API (ProgramData) para BANCO\usuarios.db com TODOS os dados (cadastros, reservas,
    caixa, configurações, menu). A chave da OpenAI não está no banco: fica em ia.config.dpapi, que nunca é copiado.
  CONFERE antes de publicar: é um SQLite de verdade e não tem chave nenhuma ("sk-...", "Bearer ...", "eyJ..."). Se tiver,
    PARA tudo e não publica.
  CUIDADO: a cópia é feita com a API rodando (leitura compartilhada); o banco do curso usa journal normal, sem -wal.
#>
$bancoOrigem = Join-Path $env:ProgramData 'FacilApp\CursoApiSqlite\usuarios.db'
$pastaBanco = Join-Path $Destino 'BANCO'
New-Item -ItemType Directory -Force -Path $pastaBanco | Out-Null
$bancoDestino = Join-Path $pastaBanco 'usuarios.db'
if (Test-Path -LiteralPath "$bancoOrigem-wal") { throw "O banco está em modo WAL ($bancoOrigem-wal): pare a API antes de publicar." }
$leitura = [IO.File]::Open($bancoOrigem, 'Open', 'Read', 'ReadWrite')
try { $bytes = New-Object byte[] $leitura.Length; [void]$leitura.Read($bytes, 0, $bytes.Length) } finally { $leitura.Close() }
$texto = [Text.Encoding]::ASCII.GetString($bytes)
if (-not $texto.StartsWith('SQLite format 3')) { throw "O $bancoOrigem não parece um banco SQLite." }
$achados = [regex]::Matches($texto, 'sk-[A-Za-z0-9_\-]{20,}|Bearer [A-Za-z0-9_\-\.]{16,}|eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}').Count
if ($achados -gt 0) { throw "PARADO: o banco tem $achados trecho(s) que parecem chave/token. Nada foi publicado." }
[IO.File]::WriteAllBytes($bancoDestino, $bytes)
@'
BANCO DO CURSO (usuarios.db) — os dados de exemplo das aulas: cadastros, reservas, operação, caixa, configurações e menu.
A chave da OpenAI NÃO vem junto: cadastre a sua na tela de Configurações da IA (ou no console da API, 127.0.0.1:7777).

Para usar este banco no seu computador:
  1. Pare o serviço da API do curso (FacilAppCursoSqlite).
  2. Copie este usuarios.db para C:\ProgramData\FacilApp\CursoApiSqlite\ (substituindo o que estiver lá).
  3. Inicie o serviço de novo e entre com o usuário do curso.
'@ | Set-Content -LiteralPath (Join-Path $pastaBanco 'LEIA-ME.txt') -Encoding UTF8
"banco copiado: $([math]::Round($bytes.Length / 1KB)) KB, sem chave"
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
!BANCO/usuarios.db
*.dpapi
APK/signing/
APK/bin/
APK/obj/
APK/Assets/
EXE/Fonte/Conteudo/
EXE/Fonte/saida/
EXE/Fonte/bin/
EXE/Fonte/obj/
LINUX/_build/
*.segredo
*.zip
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
