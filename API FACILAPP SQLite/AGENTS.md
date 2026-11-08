# API FACILAPP SQLite — Curso Programação 100% IA

Projeto independente das APIs FacilApp existentes. Não alterar serviços ou instaladores existentes.

## Contrato inicial

- `GET /status`: saúde.
- `GET /` e `GET /TesteDaApi.html`: console de testes e primeiro administrador. O menu principal do curso fica em `C:\CURSO\HTML`, separado da API.
- `GET /auth/setup-status` e `POST /auth/setup`: bootstrap único; escrita apenas via loopback e banco vazio.
- `POST /users` e `GET /users`: cadastro/listagem de usuários comuns, somente com Bearer de administrador. Cadastro com Nome, Login e Senha.
- `GET /api/cnpj/{cnpj}`, `GET /api/cnpj/{cnpj}/completo`, `GET /api/cep/{cep}`: mesmo contrato público `{ok,dados}` da API Services 7070, sem gravar consultas no SQLite.
- Porta padrão: `7777`, com escuta em `127.0.0.1`. `FACILAPP_PORT` ou `porta.txt` em ProgramData permite mudar a porta; reiniciar o serviço após mudança. Exposição em rede requer configuração explícita e proteção TLS.
- `POST /auth/login`: recebe `usuario` e `senha`; devolve `accessToken`, `tokenType` e `expiresIn` após validação.
- `GET /auth/me`: requer Bearer válido.
- Usuários persistidos em SQLite; senha com hash PBKDF2 e salt individual.
- EXCEÇÃO DECIDIDA PELO DANIEL (03/11/2026): o usuário dos alunos `facilapp` / senha `1` é criado como administrador sempre
  que não existir (`CursoUsuarioPadrao` em Program.cs). Vale só para este banco local de estudo; não copiar para API de cliente.
- `PUT /users/{id}` e `DELETE /users/{id}`: alterar/excluir usuário, só administrador. Senha vazia mantém a atual. Ninguém se
  desativa, tira o próprio administrador ou se exclui; sempre resta um administrador ativo.
- Cadastro de menus com a MESMA ESTRUTURA DO GOURMET (`MenuCatalog.cs`): `menu_catalogo_itens` (id_item, tipo_menu, id_pai,
  codigo, rotulo, icone, icone_tipo, coluna, ordem, arquivo_destino, button_id, ativo_padrao, desabilitado_padrao) e
  `menu_usuarios` (exceção por usuário: incluir, alterar, excluir, ativo, oculto, desabilitado; só grava o que foge do padrão).
  Rotas, só administrador: `GET/POST /api/menu/catalogo`, `PUT/DELETE /api/menu/catalogo/{id}`,
  `GET/PUT /api/menu/usuarios/{idUsuario}`. Qualquer logado: `GET /api/menu` (formato do index do Gourmet: módulos com
  submenu, flags hide/disable/ativo) e `GET /api/menu/minhas-permissoes`. A estrutura 0.1.x foi preservada como `*_v1`.
- O menu FastPousada fica em `C:\CURSO\HTML` e usa `GET /api/menu` autenticado. A carga inicial do catálogo roda só com a
  tabela vazia (depois o catálogo é do administrador), segue o organograma do curso e marca telas não implementadas com
  `desabilitado_padrao=1`.
- CORS `Origin: null` (telas abertas do disco) vale para `/auth/*`, `/api/menu*` e `/users*`, métodos GET/POST/PUT/DELETE.
- Bootstrap do primeiro administrador por variáveis de ambiente, só se a tabela estiver vazia.

## Arquitetura

`IUserRepository` isola persistência. Apenas `SqliteUserRepository` implementado agora; outros bancos exigem implementações e testes próprios. A assinatura de token usa chave externa de ao menos 32 bytes. Não expor chave, banco, senha ou token em logs. Queries parametrizadas. Não criar rota SQL arbitrária.

MCP local em `Mcp/`, transporte stdio. Ferramentas iniciais: `ApiStatus` e `UsuarioAtual`. Ele chama a API HTTP, sem abrir o SQLite diretamente. `FACILAPP_MCP_API_URL` padrão `http://127.0.0.1:7777/`; `FACILAPP_MCP_BEARER` opcional é configuração de processo, nunca parte do instalador nem resposta de ferramenta.

## Instalação e dados

Dois instaladores Inno: runtime da API e fonte completo. O runtime registra/inicia somente o serviço `FacilAppCursoSqlite` e inclui Tray próprio; banco, porta e chave DPAPI ficam em ProgramData e são preservados em atualização/desinstalação. Nenhuma senha ou chave é embutida no instalador. O primeiro administrador é criado no console local. O instalador de fonte não inicia serviço.
O instalador runtime inclui `MCP/FacilApp.Sqlite.Mcp.exe`; o instalador de fonte inclui o projeto `Mcp/`.

## Compilar nesta máquina

.NET 10 SDK portátil (fora do PATH): `C:\Users\Daniel\Documents\ChatGPT\GOURMET\APK\tools\dotnet\dotnet.exe`; definir
`DOTNET_ROOT` para essa pasta ao rodar o build. O NuGet.Config da máquina não tem fontes: usar
`--source https://api.nuget.org/v3/index.json` no restore/publish. Backups e cópias `.cs` NUNCA dentro desta pasta (o
build compila tudo): usar `C:\CURSO\Backup_Chat`. Troca do serviço instalado: `PS1\atualizar_servico_7777.ps1` (o Daniel
roda como administrador).

## Validação mínima

Build, login correto/incorreto, Bearer ausente/inválido, persistência após reinício, instaladores com payload correto, instalação limpa e upgrade. Não declarar pronta a publicação ou suporte a outros bancos sem testes.
