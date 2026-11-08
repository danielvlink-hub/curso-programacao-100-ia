# atualizar_servico_7777.ps1
# O QUE FAZ: troca o executável do serviço FacilAppCursoSqlite (API do curso, porta 7777) pela versão publicada em
#            saida\publish-0.2.0 (cadastro de menus igual ao Gourmet, rotas de catálogo/permissões/usuários, usuário facilapp).
# COMO:      1) confere se está como administrador; 2) faz backup do executável instalado e do banco em C:\CURSO\Backup_Chat;
#            3) para o serviço; 4) copia os arquivos novos; 5) inicia o serviço; 6) testa GET /status e GET /api/menu (401 sem token).
# ENTRADAS:  nenhuma. Rodar com PowerShell como ADMINISTRADOR (botão direito > Executar como administrador).
# SAÍDAS:    mensagens na tela; backups em C:\CURSO\Backup_Chat\*.bkp_<data>_servico_0.2.0.
# EFEITOS:   API fora do ar por alguns segundos. Na 1ª subida a API migra o menu: tabelas antigas viram *_v1 (nada apagado)
#            e cria o usuário facilapp (senha 1) se não existir.
# CUIDADOS:  não restaura nada sozinho. Se der erro, o script mostra o comando para voltar o backup.
# Daniel, 03/11/2026: "deve pegar o menu do Gourmet e adaptar para o curso" / "usar a API 7777 para criar o cadastro de menus".

$ErrorActionPreference = 'Stop'
$servico  = 'FacilAppCursoSqlite'
$destino  = 'C:\Program Files\FacilApp\CursoApiSqlite'
$origem   = Join-Path (Split-Path $PSScriptRoot -Parent) 'saida\publish-0.2.0'
$dados    = Join-Path $env:ProgramData 'FacilApp\CursoApiSqlite'
$backup   = 'C:\CURSO\Backup_Chat'
$marca    = (Get-Date -Format 'yyyyMMdd_HHmmss') + '_servico_0.2.0'

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { Write-Host 'Rode este script como ADMINISTRADOR.' -ForegroundColor Red; pause; exit 1 }
if (-not (Test-Path "$origem\FacilApp.Sqlite.Api.exe")) { Write-Host "Versão nova não encontrada em $origem" -ForegroundColor Red; pause; exit 1 }

Write-Host '1/5 Backup do executável e do banco...'
New-Item -ItemType Directory -Force $backup | Out-Null
Copy-Item "$destino\FacilApp.Sqlite.Api.exe" "$backup\FacilApp.Sqlite.Api.exe.bkp_$marca"
Copy-Item "$destino\wwwroot" "$backup\wwwroot_instalado.bkp_$marca" -Recurse
Copy-Item "$dados\usuarios.db" "$backup\usuarios.db.bkp_$marca"

Write-Host '2/5 Parando o serviço...'
Stop-Service $servico
(Get-Service $servico).WaitForStatus('Stopped', '00:00:30')

Write-Host '3/5 Copiando a versão nova...'
foreach ($f in 'FacilApp.Sqlite.Api.exe', 'e_sqlite3.dll', 'aspnetcorev2_inprocess.dll', 'FacilApp.Sqlite.Api.staticwebassets.endpoints.json', 'web.config') {
    if (Test-Path "$origem\$f") { Copy-Item "$origem\$f" "$destino\$f" -Force }
}
Copy-Item "$origem\wwwroot\*" "$destino\wwwroot" -Recurse -Force

Write-Host '4/5 Iniciando o serviço...'
Start-Service $servico
Start-Sleep -Seconds 3

Write-Host '5/5 Testando...'
$ok = $false
try {
    $st = Invoke-RestMethod 'http://127.0.0.1:7777/status' -TimeoutSec 10
    try { Invoke-WebRequest 'http://127.0.0.1:7777/api/menu' -UseBasicParsing -TimeoutSec 10 | Out-Null; $menu = 'respondeu sem token (ERRADO)' }
    catch { $menu = if ($_.Exception.Response.StatusCode.value__ -eq 401) { '401 sem token (certo)' } else { "erro $($_.Exception.Message)" } }
    Write-Host "   status: ok=$($st.ok)   /api/menu: $menu"
    $ok = $st.ok -eq $true
} catch { Write-Host "   A API não respondeu: $($_.Exception.Message)" -ForegroundColor Red }

if ($ok) { Write-Host "`nPRONTO. Serviço atualizado. Backups com a marca $marca em $backup" -ForegroundColor Green }
else {
    Write-Host "`nALGO DEU ERRADO. Nada foi restaurado automaticamente. Para voltar a versão anterior, como administrador:" -ForegroundColor Yellow
    Write-Host "   Stop-Service $servico; Copy-Item '$backup\FacilApp.Sqlite.Api.exe.bkp_$marca' '$destino\FacilApp.Sqlite.Api.exe' -Force; Copy-Item '$backup\usuarios.db.bkp_$marca' '$dados\usuarios.db' -Force; Start-Service $servico"
}
pause
