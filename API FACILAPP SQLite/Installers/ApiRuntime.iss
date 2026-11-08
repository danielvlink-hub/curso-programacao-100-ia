#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif
#ifndef SourceRoot
  #error SourceRoot is required
#endif
#ifndef OutputRoot
  #error OutputRoot is required
#endif
#ifndef IconFile
  #error IconFile is required
#endif
[Setup]
AppId={{E5C63F4D-31B9-4B4E-8CB8-889E1819D6A0}
AppName=API SQLite FacilApp
AppVersion={#AppVersion}
DefaultDirName={autopf}\FacilApp\CursoApiSqlite
DefaultGroupName=API SQLite FacilApp
OutputDir={#OutputRoot}
OutputBaseFilename=FacilApp-SQLite-API-Setup-{#AppVersion}-x64
SetupIconFile={#IconFile}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
Compression=lzma2
SolidCompression=yes
UninstallDisplayIcon={app}\FacilApp.Sqlite.Api.exe
DisableProgramGroupPage=yes

[Files]
Source: "{#SourceRoot}\*"; DestDir: "{app}"; Excludes: "MCP\bin\*,MCP\obj\*,Tray\bin\*,Tray\obj\*,*.pdb"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\API SQLite FacilApp"; Filename: "{app}\FacilApp.Sqlite.Api.exe"
Name: "{group}\FastPousada - Bandeja"; Filename: "{app}\Tray\FacilApp.Curso.Tray.exe"
Name: "{commonstartup}\FastPousada API"; Filename: "{app}\Tray\FacilApp.Curso.Tray.exe"

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

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

function InitializeSetup(): Boolean;
begin
  Result := True;
end;

procedure InitializeWizard();
var
  ExistingPort: AnsiString;
begin
  PortPage := CreateInputQueryPage(wpSelectDir, 'Porta da API',
    'Escolha a porta HTTP local do FastPousada',
    'A API escuta somente em 127.0.0.1. Para mudar depois, edite porta.txt em ProgramData e reinicie o serviço.');
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
  Params: String;
begin
  if CurStep <> ssPostInstall then Exit;
  if not ForceDirectories(ExtractFileDir(PortFile())) then
    RaiseException('Não foi possível preparar a pasta de dados da API.');
  if not SaveStringToFile(PortFile(), Trim(PortPage.Values[0]), False) then
    RaiseException('Não foi possível gravar a porta da API.');
  if ServiceInstalled() then
    Params := 'config FacilAppCursoSqlite binPath= "' + ExpandConstant('{app}\FacilApp.Sqlite.Api.exe') + '" start= auto'
  else
    Params := 'create FacilAppCursoSqlite binPath= "' + ExpandConstant('{app}\FacilApp.Sqlite.Api.exe') + '" start= auto DisplayName= "FastPousada API SQLite"';
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
