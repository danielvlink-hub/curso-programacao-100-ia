# Contexto do projeto — Curso "Programação 100% IA" (FastPousada)

Lido automaticamente pelo Claude Code quando você abre uma sessão nesta pasta. Ele diz à IA o que é o projeto,
onde está cada coisa e quais regras seguir. Mantenha este arquivo atualizado conforme o projeto crescer.

## O que é

- **FastPousada**: sistema de pousada/hotel construído ao longo das aulas. Organograma e ordem das aulas em
  `FASTPOUSADA-ORGANOGRAMA.md`. Não precisa de assinatura de API de IA: tudo roda no seu computador.
- **FacilApp API SQL** — pasta `API FACILAPP SQLite\` (.NET 10, ASP.NET Core, SQLite). Porta **7777**, só `127.0.0.1`,
  serviço Windows `FacilAppCursoSqlite`. Regras técnicas em `API FACILAPP SQLite\AGENTS.md` e `README.md` — ler antes de mexer.
  Documentação das rotas no Swagger: `http://127.0.0.1:7777/swagger`.
- **Telas** — `HTML\`: `login_Geral.html`, menu (`index.html`), cadastros e `DASHBOARDS\` (um dashboard por módulo).
  Abertas como arquivo local (`file://`).
- **Kits** — `FacilAppDoc\`, `FacilAppPlanilha\`; bibliotecas de terceiros em `Dependencias\`.
- **Prompts** — `PROMPTS\`: um prompt pronto por tela do FastPousada (ordem em `PROMPTS\00_LEIA-ME.md`), o padrão de
  browse/update e o padrão de treinamento "?" e botão IA.
- **Modelos de tela** — `HTML\modelo_browse.html` (lista) + `HTML\modelo_browse_update.html` (update separado em janela
  flutuante centralizada). Toda tela de cadastro nova começa copiando os dois.
- **Help "?" com voz** — peças em `HTML\assets\js\` (`AjudaTela.js`, `Treinamento.js`) e `HTML\TREINAMENTOS\`;
  passo a passo em `PROMPTS\91_HELP_COM_VOZ_PASSO_A_PASSO.md`. Exemplo pronto: `HTML\modelo_browse.html`.

## O que precisa estar instalado (confira no começo de cada sessão)

O instalador do curso já traz a pasta do curso e a FacilApp API SQL rodando como serviço, com o runtime do .NET.
Para **construir** as telas e a API nas aulas, o computador do aluno também precisa do que está abaixo. Antes da
primeira tarefa da sessão, confira com os comandos da coluna "Conferir". Se faltar algo, **pare, diga ao aluno o que
falta e mostre o comando de instalação** — não siga adiante sem ele confirmar que instalou.

| O quê | Para quê | Conferir | Instalar (PowerShell) |
|---|---|---|---|
| **.NET 10 SDK** | compilar e publicar a FacilApp API SQL (rotas e tabelas novas) | `dotnet --list-sdks` mostra uma linha `10.` | `winget install Microsoft.DotNet.SDK.10` (ou baixar em dotnet.microsoft.com) e abrir um terminal novo |
| **Python 3** | scripts do Help "?" (`HTML\TREINAMENTOS\*.py`) | `python --version` | `winget install Python.Python.3.12` e abrir um terminal novo |
| **edge-tts** | gerar a voz da Francisca do Help "?" | `python -m pip show edge-tts` | `python -m pip install edge-tts` |
| **Google Chrome** | abrir e testar as telas (`file:///C:/CURSO/HTML/index.html`) | — | chrome.com |
| **Git** (opcional) | guardar versões do projeto | `git --version` | `winget install Git.Git` |

Não precisa de assinatura de API de IA para nada disso. O `winget` já vem no Windows 10/11 atualizado.

## Como atualizar a API depois de mudar o código

1. Compile e publique o executável único (dentro de `API FACILAPP SQLite\`):
   `dotnet publish FacilApp.Sqlite.Api.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o saida\publish-0.2.0`
2. A IA **não** para nem inicia o serviço do Windows (precisa de administrador): ela pede ao aluno para rodar
   `API FACILAPP SQLite\PS1\atualizar_servico_7777.ps1` com o botão direito → **Executar com o PowerShell como
   administrador**. O script faz backup do executável e do banco em `C:\CURSO\Backup_Chat`, troca a versão e testa.
3. Depois que o aluno disser "rodei", testar as rotas no Swagger.

## Telas abertas como arquivo (CORS)

As telas abrem por `file://` (Origin `null`). No `Program.cs`, o bloco que libera o Origin `null` lista os caminhos
permitidos (`/auth`, `/api/menu`, `/users`). **Toda rota nova usada por uma tela precisa entrar nessa lista**
(ex.: `/api/hospedes`); senão o Swagger funciona e a tela mostra "Failed to fetch".

## Menu: alterar, não criar

As telas previstas do FastPousada já estão no menu, cinza (desabilitadas, sem arquivo). Ao terminar uma tela,
o aluno ALTERA o item existente em **Acessos** (arquivo da tela + desmarcar "desabilitado"). Só se cria item novo para
o que não existe no organograma (ex.: os relatórios de cadastro).

## Nome dos arquivos das telas

`Browse<Nome>.html` (lista), `Update<Nome>.html` (formulário em janela central) e `Rpt<Nome>.html` (relatório).
Detalhes e prompt completo em `PROMPTS\01_PADRAO_BROWSE_UPDATE.md`.

## Banco

- SQLite da API: `%ProgramData%\FacilApp\CursoApiSqlite\usuarios.db` (usuários, menu e os dados do FastPousada).
- Caminho planejado: SQLite (aulas) → SQL Server Express (rede local Windows) → PostgreSQL (nuvem/Ubuntu).
  Só declarar outro banco pronto com implementação e testes próprios.
- **Usuário de estudo: `facilapp` / senha `1`**, criado como administrador sempre que não existe.
  Exceção válida SÓ para este banco local de estudo. Em sistema de cliente, nunca deixe senha no código.

## Menu

- Vem do banco: `menu_catalogo_itens` (id_item, tipo_menu, id_pai, codigo, rotulo, icone, icone_tipo, coluna, ordem,
  arquivo_destino, button_id, ativo_padrao, desabilitado_padrao) + `menu_usuarios` (exceções por usuário: incluir,
  alterar, excluir, ativo, oculto, desabilitado). Só grava o que foge do padrão.
- Telas: `acessos.html` (cadastro do menu) e `usuarios.html` (usuários e permissões).
- Testar com um usuário administrador e um comum antes de dizer que está pronto.

## Regras de trabalho

1. Plano curto antes; implementar só depois do "pode". Mudar só o que foi pedido.
2. Backup antes de mudar, numa pasta FORA do projeto (a API compila tudo o que está na pasta dela).
   Formato: `<arquivo>.bkp_AAAAMMDD_HHMMSS_<motivo>`.
3. Nenhuma senha, token ou chave em código, comentário ou front-end (exceção: o usuário de estudo acima).
4. Configuração de sistema e segurança (firewall, serviços do Windows): escrever um `.ps1` e rodar como administrador,
   conferindo antes o que ele faz.
5. Sem `alert`/`confirm`/`prompt` do navegador: usar `FacilAppConfirmar`/`FacilAppPerguntar` do `avisos.js`.
6. Provar, não supor: consultar o banco, chamar a API, conferir o resultado na tela.
7. Toda função nova ou alterada com comentário: O QUE FAZ · COMO · ENTRADAS · SAÍDAS · DEPENDÊNCIAS · REGRAS ·
   EFEITOS · CUIDADOS.
8. Padrão de tela: HTML/JS puro, cores só pelas variáveis `--fa-*` do `TemaFacilApp.css`, cabeçalho 35px,
   campos e linhas de 22px, combo com `ComboBusca.js`, tabelas com Tabulator. Antes de inventar comportamento,
   copiar de uma tela que já funciona.

## Ecossistema do curso

C#/.NET 10, JavaScript, HTML e CSS, SQLite, SQL Server e PostgreSQL, APIs REST, Nginx e Linux (Ubuntu),
Windows Services (instalação por PowerShell), impressão térmica ESC/POS, Cloudflare e Git.
Desenvolvimento feito com o Claude Code. Exemplos e prompts sempre com o FastPousada.
