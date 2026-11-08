# API FACILAPP SQLite

API nova do curso Programação 100% IA. Requer .NET 10 para desenvolvimento; o instalador runtime publica executável Windows x64 autossuficiente.

## Configuração

Antes de iniciar, configure no ambiente do processo:

- `FACILAPP_AUTH_KEY` (opcional no Windows): segredo com pelo menos 32 bytes. Sem ele, a API cria chave local protegida pelo DPAPI da conta do processo.
- `FACILAPP_ADMIN_USER` e `FACILAPP_ADMIN_PASSWORD`: criam o primeiro usuário somente se o banco estiver vazio. A senha não pode ficar vazia. Remova estas variáveis após a primeira inicialização.
- `FACILAPP_DATA_DIR` (opcional): diretório de dados. Padrão: `%ProgramData%\FacilApp\CursoApiSqlite`.
- `ASPNETCORE_URLS` (opcional): endereço de escuta. Sem esta variável, a API usa `http://127.0.0.1:7777`; o instalador não abre porta pública automaticamente.
- `FACILAPP_PORT` (opcional): porta local. Sem ela, a API lê `%ProgramData%\FacilApp\CursoApiSqlite\porta.txt` ou usa 7777. Reinicie o serviço após mudar a porta.

Exemplo de desenvolvimento em PowerShell (use valores próprios, não grave segredos em scripts):

```powershell
$env:FACILAPP_AUTH_KEY = '<segredo-aleatorio-com-mais-de-32-bytes>'
$env:FACILAPP_ADMIN_USER = '<usuario-inicial>'
$env:FACILAPP_ADMIN_PASSWORD = '<senha-inicial-forte>'
$env:ASPNETCORE_URLS = 'http://127.0.0.1:7777'
dotnet run --project 'FacilApp.Sqlite.Api.csproj'
```

## Rotas

`GET /status` é pública. `POST /auth/login` recebe `{"usuario":"...","senha":"..."}` e retorna `accessToken` com validade de uma hora. `GET /auth/me` exige `Authorization: Bearer <accessToken>`.

O FastPousada usa `C:\CURSO\HTML\login_Geral.html` e `menu_curso.html`. O login chama diretamente `/auth/login` e `/auth/me`; a sessão fica somente na aba do navegador. `GET /api/menu` exige Bearer e devolve `{ok:true,dados:{lateral,superior,dashboards}}`. A API cria `menu_catalogo_itens` e `menu_usuarios` no mesmo SQLite de usuários. A carga inicial usa o organograma do curso; itens cujas telas ainda não existem ficam inativos. A carga é idempotente e não sobrescreve o catálogo editado. Para o HTML aberto como arquivo local, apenas `/auth/*` e `/api/menu` aceitam CORS com `Origin: null`; a API continua vinculada a `127.0.0.1`.

Acesse `http://127.0.0.1:7777/` (ou a porta escolhida) para abrir o console de teste. O Swagger fica em `/swagger`. Se o banco estiver vazio, cadastre o primeiro administrador no console (somente acesso local). Depois faça login; um administrador pode cadastrar outros usuários. O token não é mostrado nem persistido pelo console. A senha é escolhida pelo usuário, sem tamanho mínimo; não pode ficar vazia.

A tela também testa `GET /api/cnpj/{cnpj}`, `GET /api/cnpj/{cnpj}/completo` e `GET /api/cep/{cep}`. As respostas seguem `{ "ok": true, "dados": ... }`, como na API Services 7070. CNPJ usa BrasilAPI com fallback CNPJ.ws; CEP usa BrasilAPI. São consultas públicas de leitura, sem registro no SQLite e sem depender do Bearer.

## Cadastro de menus e usuários (0.2.0, 03/11/2026)

Mesma estrutura de menu do Gourmet (`menu_catalogo_itens` com módulos e itens por `id_pai`; `menu_usuarios` com a exceção de cada usuário). Rotas (Bearer):

| Rota | Quem | Para quê |
|---|---|---|
| `GET /api/menu` | logado | menu do usuário no formato do index do Gourmet |
| `GET /api/menu/minhas-permissoes` | logado | exceções do próprio usuário (incluir/alterar/excluir) |
| `GET/POST /api/menu/catalogo`, `PUT/DELETE /api/menu/catalogo/{id}` | administrador | tela Acessos |
| `GET/PUT /api/menu/usuarios/{idUsuario}` | administrador | permissões de menu na tela Usuários |
| `PUT/DELETE /users/{id}` | administrador | alterar (senha vazia mantém) e excluir usuário |

Usuário dos alunos: `facilapp`, senha `1`, administrador, criado sempre que não existir (decisão do Daniel para o curso; a API só escuta em 127.0.0.1).

## Instaladores

Execute `./Build-Installers.ps1` em uma máquina com .NET 10 SDK e Inno Setup 7. Os pacotes serão gerados em `saida`. O runtime instala em `C:\Program Files\FacilApp\CursoApiSqlite`, registra/inicia o serviço `FacilAppCursoSqlite` e inclui Tray com abrir console/Swagger e iniciar/parar/reiniciar. A porta é escolhida no instalador e armazenada em ProgramData. O instalador de fonte é separado. Atualizações preservam o banco e a chave em `%ProgramData%\FacilApp\CursoApiSqlite`.

O runtime também inclui `MCP\FacilApp.Sqlite.Mcp.exe`, servidor MCP local via stdio. Configure o cliente MCP para iniciar esse EXE. Ele usa `http://127.0.0.1:7777/` por padrão ou `FACILAPP_MCP_API_URL` e oferece `ApiStatus` e `UsuarioAtual`. Para a segunda ferramenta, forneça `FACILAPP_MCP_BEARER` no ambiente do processo MCP; não coloque token em arquivo versionado nem em argumentos da linha de comando.

Esta versão permite cadastrar usuários pelo administrador, mas ainda não tem recuperação de senha, rate limit, HTTPS próprio nem outros bancos. Não expor na Internet antes desses controles e de uma configuração TLS/reverse proxy revisada. .NET 10 não é compatível com Windows 8/8.1.
