<#
  compilar.ps1 — gera o APK do FastPousada (Android 5.0 ou superior) assinado e conferido.
  Daniel, 08/11/2026: "C:\CURSO\APK gere aqui o apk para android 5 ou superior".

  O QUE FAZ
    1. Copia as telas do curso (C:\CURSO\HTML) para Assets\html — sem os arquivos de teste (_teste_*).
    2. Cria a chave de assinatura na 1ª vez (signing\fastpousada.keystore + senha aleatória em signing\senha-chave.txt).
    3. Compila em Release (.NET para Android, ARM 32/64 e x86_64), assina e confere a assinatura (apksigner).
    4. Deixa o resultado em C:\CURSO\APK\FastPousada.apk e mostra o SHA-256.
  FERRAMENTAS: as portáteis do APK do Gourmet (dotnet com o workload android, JDK e SDK Android) — nada é instalado.
  CUIDADO: a pasta signing é SECRETA (sem ela não dá para atualizar o app instalado). Nunca vai para o GitHub.
  Uso: .\compilar.ps1   (ou .\compilar.ps1 -ToolsDirectory 'outra\pasta\tools')
#>
param([string]$ToolsDirectory = 'C:\Users\Daniel\Documents\ChatGPT\GOURMET\APK\tools')
$ErrorActionPreference = 'Stop'
$dotnet = Join-Path $ToolsDirectory 'dotnet\dotnet.exe'
$java = Join-Path $ToolsDirectory 'jdk'
$sdk = Join-Path $ToolsDirectory 'android-sdk'
if (-not (Test-Path -LiteralPath $dotnet)) { throw 'Informe -ToolsDirectory com a pasta que contém dotnet, jdk e android-sdk.' }
$env:DOTNET_CLI_HOME = Join-Path $ToolsDirectory 'cli-home'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:JAVA_HOME = $java

# 1) telas do curso dentro do APK
$html = Join-Path (Split-Path -Parent $PSScriptRoot) 'HTML'
$assets = Join-Path $PSScriptRoot 'Assets\html'
New-Item -ItemType Directory -Force -Path $assets | Out-Null
robocopy $html $assets /MIR /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XF '_teste_*' 'Thumbs.db' 'desktop.ini' | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Falha ao copiar as telas ($LASTEXITCODE)." }

# 2) chave de assinatura (só na 1ª vez)
$signing = Join-Path $PSScriptRoot 'signing'
$keystore = Join-Path $signing 'fastpousada.keystore'
$passwordFile = Join-Path $signing 'senha-chave.txt'
New-Item -ItemType Directory -Path $signing -Force | Out-Null
if (-not (Test-Path -LiteralPath $keystore)) {
  if (-not (Test-Path -LiteralPath $passwordFile)) {
    $bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
    [IO.File]::WriteAllText($passwordFile, [Convert]::ToBase64String($bytes))
  }
  $env:FP_SIGN_PASSWORD = [IO.File]::ReadAllText($passwordFile)
  & (Join-Path $java 'bin\keytool.exe') -genkeypair -keystore $keystore -alias fastpousada -keyalg RSA -keysize 3072 -validity 10000 `
    -storepass:env FP_SIGN_PASSWORD -keypass:env FP_SIGN_PASSWORD -dname 'CN=FacilApp FastPousada, O=FacilApp, C=BR'
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar a chave de assinatura.' }
}

# 3) compilar, assinar e conferir
$env:FP_SIGN_PASSWORD = [IO.File]::ReadAllText($passwordFile)
try {
  & $dotnet publish (Join-Path $PSScriptRoot 'FastPousada.Android.csproj') -c Release '-p:RestoreSources=https://api.nuget.org/v3/index.json' `
    "-p:AndroidSdkDirectory=$sdk" "-p:JavaSdkDirectory=$java" -p:AndroidKeyStore=true "-p:AndroidSigningKeyStore=$keystore" `
    -p:AndroidSigningKeyAlias=fastpousada -p:AndroidSigningStorePass=env:FP_SIGN_PASSWORD -p:AndroidSigningKeyPass=env:FP_SIGN_PASSWORD
  if ($LASTEXITCODE -ne 0) { throw 'Falha na compilação do APK.' }
  $apk = Get-ChildItem (Join-Path $PSScriptRoot 'bin\Release') -Filter '*-Signed.apk' -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $apk) { throw 'APK assinado não encontrado.' }
  $final = Join-Path $PSScriptRoot 'FastPousada.apk'
  Copy-Item -LiteralPath $apk.FullName -Destination $final -Force
  & (Join-Path $sdk 'build-tools\36.0.0\apksigner.bat') verify --min-sdk-version 21 $final
  if ($LASTEXITCODE -ne 0) { throw 'Falha na verificação da assinatura.' }
  "APK: $final  ($([math]::Round((Get-Item $final).Length / 1MB, 1)) MB)"
  Get-FileHash -LiteralPath $final -Algorithm SHA256
} finally {
  Remove-Item Env:\FP_SIGN_PASSWORD -ErrorAction SilentlyContinue
}
