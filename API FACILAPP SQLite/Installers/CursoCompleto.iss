; Instalador completo do Curso Programação 100% IA (FastPousada).
; Daniel (08/11/2026): "vai a pasta toda menos a pasta Telas da raiz do curso". Projeto público (GitHub):
; Daniel: "100% do curso menos a pasta Telas e o CLAUDE.md; ao publicar o CLAUDE.md precisa ir, porém só com o curso"
; -> o CLAUDE.md interno fica fora e entra o Installers\CLAUDE-publico.md. Limite de 100 MB do GitHub.
; Copia C:\CURSO inteiro (sem Telas e sem artefatos de build da API) e instala/atualiza o serviço da API na porta escolhida (7777).
; Nenhuma senha, token ou chave vai no instalador; banco, porta e chave DPAPI ficam em ProgramData e são preservados.
#ifndef AppVersion
  #define AppVersion "0.2.0"
#endif
#ifndef CursoRoot
  #error CursoRoot is required
#endif
#ifndef RuntimeRoot
  #error RuntimeRoot is required
#endif
#ifndef OutputRoot
  #error OutputRoot is required
#endif
#ifndef IconFile
  #error IconFile is required
#endif
#define ApiDir "{commonpf64}\FacilApp\CursoApiSqlite"

[Setup]
AppId={{9B2E4C71-5D3A-4F0E-A8C6-1E7F2D90B354}
AppName=Curso Programação 100% IA — FastPousada
AppVersion={#AppVersion}
AppPublisher=FacilApp
DefaultDirName=C:\CURSO
DisableProgramGroupPage=yes
OutputDir={#OutputRoot}
OutputBaseFilename=FacilApp-Curso-Programacao-100-IA-Setup-{#AppVersion}-x64
SetupIconFile={#IconFile}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
Compression=lzma2/max
SolidCompression=yes
UninstallDisplayIcon={#ApiDir}\FacilApp.Sqlite.Api.exe

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
; Pasta do curso, sem Telas e sem o que é gerado na compilação da API
Source: "{#CursoRoot}\*"; DestDir: "{app}"; \
  Excludes: "\Telas,\CLAUDE.md,\README.md,.claude,.git,\HTML\DASHBOARDS\js\facilflow.js,\HTML\DASHBOARDS\js\db_pedidos.js,\API FACILAPP SQLite\bin,\API FACILAPP SQLite\obj,\API FACILAPP SQLite\staging,\API FACILAPP SQLite\saida,\API FACILAPP SQLite\Backups,\API FACILAPP SQLite\Mcp\bin,\API FACILAPP SQLite\Mcp\obj,\API FACILAPP SQLite\Tray\bin,\API FACILAPP SQLite\Tray\obj,*.pdb,Thumbs.db,desktop.ini"; \
  Flags: recursesubdirs createallsubdirs ignoreversion
; CLAUDE.md e README.md públicos (só o conteúdo do curso; o CLAUDE.md interno da raiz não vai)
Source: "{#SourcePath}CLAUDE-publico.md"; DestDir: "{app}"; DestName: "CLAUDE.md"; Flags: ignoreversion
Source: "{#SourcePath}README-publico.md"; DestDir: "{app}"; DestName: "README.md"; Flags: ignoreversion
; API já compilada (serviço FacilAppCursoSqlite), Tray e MCP
Source: "{#RuntimeRoot}\*"; DestDir: "{#ApiDir}"; Excludes: "*.pdb"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autoprograms}\FastPousada\Menu do Curso (FastPousada)"; Filename: "{app}\HTML\index.html"
Name: "{autoprograms}\FastPousada\Pasta do Curso"; Filename: "{app}"
Name: "{autoprograms}\FastPousada\FastPousada - Bandeja"; Filename: "{#ApiDir}\Tray\FacilApp.Curso.Tray.exe"
Name: "{commonstartup}\FastPousada API"; Filename: "{#ApiDir}\Tray\FacilApp.Curso.Tray.exe"
Name: "{autodesktop}\FastPousada - Curso"; Filename: "{app}\HTML\index.html"; Tasks: atalho

[Tasks]
Name: "atalho"; Description: "Criar atalho do menu do curso na Área de Trabalho"

[Run]
Filename: "{app}\HTML\index.html"; Description: "Abrir o menu do curso"; Flags: postinstall shellexec skipifsilent nowait

[UninstallDelete]
Type: dirifempty; Name: "{#ApiDir}"

[Code]
var
  PortPage: TInputQueryWizardPage;

function ServiceInstalled(): Boolean;
begin
  Result := RegKeyExists(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Services\FacilAppCursoSqlite');
end;

function PortFile(): String;
begin
  Result := ExpandConstant('{commonappdata}\FacilApp\CursoApiSqlite\porta.txt');
end;

procedure InitializeWizard();
var
  ExistingPort: AnsiString;
begin
  PortPage := CreateInputQueryPage(wpSelectDir, 'Porta da API',
    'Escolha a porta HTTP local da FacilApp API SQL',
    'A API escuta somente em 127.0.0.1. O curso usa a porta 7777. Para mudar depois, edite porta.txt em ProgramData e reinicie o serviço.');
  PortPage.Add('Porta:', False);
  if LoadStringFromFile(PortFile(), ExistingPort) then
    PortPage.Values[0] := Trim(ExistingPort)
  else
    PortPage.Values[0] := '7777';
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  PortNumber: Integer;
begin
  Result := True;
  if CurPageID <> PortPage.ID then Exit;
  PortNumber := StrToIntDef(Trim(PortPage.Values[0]), 0);
  if (PortNumber < 1) or (PortNumber > 65535) then
  begin
    MsgBox('Informe uma porta entre 1 e 65535.', mbError, MB_OK);
    Result := False;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Code: Integer;
begin
  Result := '';
  if not ServiceInstalled() then Exit;
  if not Exec(ExpandConstant('{sys}\net.exe'), 'stop FacilAppCursoSqlite', '', SW_HIDE, ewWaitUntilTerminated, Code) then
    Result := 'Não foi possível parar o serviço FastPousada antes da atualização.'
  else if (Code <> 0) and (Code <> 2) then
    Result := 'O serviço FastPousada não parou. A instalação foi cancelada para preservar os binários.';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Code: Integer;
  Params, Exe: String;
begin
  if CurStep <> ssPostInstall then Exit;
  Exe := ExpandConstant('{#ApiDir}\FacilApp.Sqlite.Api.exe');
  if not ForceDirectories(ExtractFileDir(PortFile())) then
    RaiseException('Não foi possível preparar a pasta de dados da API.');
  if not SaveStringToFile(PortFile(), Trim(PortPage.Values[0]), False) then
    RaiseException('Não foi possível gravar a porta da API.');
  if ServiceInstalled() then
    Params := 'config FacilAppCursoSqlite binPath= "' + Exe + '" start= auto'
  else
    Params := 'create FacilAppCursoSqlite binPath= "' + Exe + '" start= auto DisplayName= "FastPousada API SQLite"';
  if (not Exec(ExpandConstant('{sys}\sc.exe'), Params, '', SW_HIDE, ewWaitUntilTerminated, Code)) or (Code <> 0) then
    RaiseException('Não foi possível registrar o serviço FastPousada.');
  if (not Exec(ExpandConstant('{sys}\sc.exe'), 'start FacilAppCursoSqlite', '', SW_HIDE, ewWaitUntilTerminated, Code)) or (Code <> 0) then
    RaiseException('O serviço FastPousada foi registrado, mas não iniciou. Verifique o Visualizador de Eventos.');
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Code: Integer;
begin
  if (CurUninstallStep <> usUninstall) or (not ServiceInstalled()) then Exit;
  Exec(ExpandConstant('{sys}\net.exe'), 'stop FacilAppCursoSqlite', '', SW_HIDE, ewWaitUntilTerminated, Code);
  Exec(ExpandConstant('{sys}\sc.exe'), 'delete FacilAppCursoSqlite', '', SW_HIDE, ewWaitUntilTerminated, Code);
end;
