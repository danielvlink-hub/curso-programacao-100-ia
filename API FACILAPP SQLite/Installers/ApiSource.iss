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
AppId={{6CEBA1F4-A6B2-4C97-9039-5367F615933F}
AppName=API SQLite FacilApp — Código-fonte
AppVersion={#AppVersion}
DefaultDirName={autopf}\FacilApp\CursoApiSqlite-Fonte
DefaultGroupName=API SQLite FacilApp
OutputDir={#OutputRoot}
OutputBaseFilename=FacilApp-SQLite-API-Fonte-Setup-{#AppVersion}
SetupIconFile={#IconFile}
PrivilegesRequired=admin
Compression=lzma2
SolidCompression=yes
DisableProgramGroupPage=yes

[Files]
Source: "{#SourceRoot}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\Código-fonte FacilApp SQLite API"; Filename: "{app}\README.md"

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
