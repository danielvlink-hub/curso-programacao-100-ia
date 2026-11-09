# 01 — Nossa tela padrão: Browse (Tabulator) + Update (janela central) + Rpt (relatório)

Todo cadastro do FastPousada é feito de **3 arquivos**, sempre com o mesmo nome base:

| Arquivo | O que é | Exemplo (Hóspedes) |
|---|---|---|
| `Browse<Nome>.html` | a **lista**: Tabulator com busca, filtro, paginação, CSV, XLSX, editar/excluir na linha | `HTML/BrowseHospedes.html` |
| `Update<Nome>.html` | o **formulário** de incluir/alterar, em arquivo separado, aberto numa **janela flutuante no centro** da lista | `HTML/UpdateHospedes.html` |
| `Rpt<Nome>.html` | o **relatório**: filtros, prévia da folha A4 e botão Gerar PDF | `HTML/RptHospedes.html` |

E por trás, na **FacilApp API SQL** (pasta `API FACILAPP SQLite`): a tabela no SQLite, as rotas e as regras.
**A regra de verdade fica sempre na API**; a tela só ajuda o usuário.

Modelos prontos para abrir e copiar: `HTML/modelo_browse.html` e `HTML/modelo_browse_update.html` (com dados de
demonstração no navegador). O prompt abaixo transforma o modelo na tela real de Hóspedes, ligada à API.

---

## Como usar

1. Abra o Claude Code na pasta do curso (`C:\CURSO`).
2. Copie o prompt inteiro abaixo e cole.
3. A IA mostra o plano → você confere → ela faz → você testa com a lista "Conferir no fim".
4. Para outro cadastro (Quartos, Tarifas...), troque só o bloco **DADOS DA TELA**.

---

## O prompt

```
Crie o cadastro de HÓSPEDES do FastPousada na nossa tela padrão:
BrowseHospedes.html (lista) + UpdateHospedes.html (formulário em janela central) + RptHospedes.html (relatório),
ligados à FacilApp API SQL. Leia antes o CLAUDE.md do curso e os modelos HTML/modelo_browse.html e
HTML/modelo_browse_update.html: copie o visual e o jeito de funcionar deles.

=== DADOS DA TELA ===
Tabela: hospedes
Campos: id_hospede (chave, automático), nome (obrigatório, 3+ letras), documento (CPF/RG/passaporte, não repete),
  telefone (obrigatório, com DDD, 10+ dígitos), email (válido quando informado), data_nascimento, cidade, uf (2 letras),
  observacao, ativo (padrão 1), criado_em, alterado_em.
Rota: /api/hospedes
Colunas da lista: Nome, Documento, Telefone, Cidade/UF, Situação (Ativo/Inativo), Ações.
Busca: nome, documento, telefone ou cidade. Filtro: Situação (todas / ativos / inativos).
Formulário: Nome*, Ativo, Documento, Telefone*, E-mail, Nascimento, Cidade, UF, Observação.
Relatório: "Relação de Hóspedes" — filtros Situação, Cidade e UF; colunas Nome, Documento, Telefone, Cidade/UF,
  Situação; total de hóspedes no fim.
Menu: módulo Cadastros → "Hóspedes" (ícone person) e módulo Relatórios → "Relação de Hóspedes" (ícone print).
Regra extra: hóspede que já tem reserva não pode ser excluído (responder "inative em vez de excluir").
=====================

PARTE 1 — API (pasta "API FACILAPP SQLite")
1. Crie a tabela na inicialização se ainda não existir (nunca apague dados existentes).
2. Rotas autenticadas com o Bearer da sessão:
   GET /api/hospedes (aceita ?busca=&ativo=), GET /api/hospedes/{id}, POST /api/hospedes,
   PUT /api/hospedes/{id}, DELETE /api/hospedes/{id}.
   Queries sempre parametrizadas. Nada de rota que recebe SQL.
3. Todas as regras da tela validadas também aqui. Erro responde {ok:false, erro:"mensagem clara para o usuário"}.
4. CORS: as telas abrem como arquivo (file://, Origin "null"). No Program.cs, no bloco que libera o Origin "null"
   (hoje só /auth, /api/menu e /users), inclua o caminho /api/hospedes. Sem isso o Swagger funciona, mas a tela dá
   "Failed to fetch". Documente as rotas no Swagger.
5. Compile e publique o executável único em saida\publish-0.2.0 (precisa do .NET 10 SDK — se `dotnet --list-sdks` não mostrar 10.x, pare e me diga
   como instalar, conforme "O que precisa estar instalado" no CLAUDE.md):
   dotnet publish FacilApp.Sqlite.Api.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o saida\publish-0.2.0
   Backup de arquivo .cs nunca dentro da pasta da API (o build compila tudo): use C:\CURSO\Backup_Chat.
   NÃO tente parar ou iniciar o serviço do Windows (precisa de administrador): quando a publicação terminar, me peça
   para rodar PS1\atualizar_servico_7777.ps1 como administrador e espere eu responder "rodei".
6. Depois que eu rodar o script, teste cada rota no Swagger (incluir, alterar, excluir, um erro de validação)
   ANTES de começar as telas. Me mostre o resultado dos testes.

PARTE 2 — ApiCurso.js
7. Em HTML/assets/js/ApiCurso.js crie listarHospedes(filtros), obterHospede(id), incluirHospede(dados),
   alterarHospede(id, dados), excluirHospede(id), no mesmo padrão de listarUsuarios. As telas só falam com a API
   por essas funções (nunca fetch solto na tela).

PARTE 3 — BrowseHospedes.html (a lista)
8. Copie o modelo_browse.html e troque título, ícone, colunas, busca e filtro pelos DADOS DA TELA.
   Mantém: Tabulator (HTML/dependencias/tabulator-6.5.0) carregando os dados só depois do evento tableBuilt;
   cabeçalho de 35px com ✕ à direita; botão "Novo Hóspede"; busca; filtro; CSV; XLSX; recarregar; botão
   Relatório (abre RptHospedes.html); total de registros no rodapé; lápis e lixeira na linha; duplo clique altera.
9. Excluir pergunta com FacilAppConfirmar e, se a API recusar, mostra a mensagem dela com FacilAppAviso.

PARTE 4 — UpdateHospedes.html (o formulário)
10. Copie o modelo_browse_update.html e troque os campos pelos DADOS DA TELA.
   Abre DENTRO do BrowseHospedes, num iframe, numa janela flutuante NO CENTRO da tela (fundo escuro, arrastável
   pela barra, ✕ e Esc fecham). ?id=<id> = alterar; ?novo=1 = incluir.
11. Valida antes de gravar (marca o campo em vermelho e põe o foco nele), grava pelo ApiCurso e SÓ DEPOIS que a API
    respondeu ok avisa o browse com postMessage {origem:'FACILAPP_MODELO_GRAVADO'}; Cancelar ou Esc mandam
    {origem:'FACILAPP_MODELO_CANCELADO'}. Se a API recusar, a janela continua aberta com o que foi digitado.
    Ctrl+Enter grava.

PARTE 5 — RptHospedes.html (o relatório)
12. Tela no mesmo visual (cabeçalho 35px, ✕ à direita). Em cima, os filtros do relatório e o botão "Gerar".
13. Embaixo, a PRÉVIA da folha A4 (retrato), igual ao PDF: cabeçalho com "FastPousada", título, filtros usados,
    data e hora; tabela com as colunas do relatório e linhas zebradas; total no fim; rodapé "Página X de Y".
14. Botões: "Gerar PDF" (monta o PDF com o jsPDF — copie C:\CURSO\Dependencias\jspdf-2.5.1 para
    HTML/dependencias/jspdf-2.5.1; desenhe a tabela com o próprio jsPDF, quebrando página e repetindo o cabeçalho
    da tabela), "Imprimir" (abre o PDF gerado para imprimir), CSV e XLSX dos mesmos dados.
    Os dados vêm do ApiCurso.listarHospedes com os filtros; nada de SQL na tela.

PARTE 6 — Menu (tela Acessos)
15. O item "Hóspedes" JÁ EXISTE no menu (cinza, desabilitado, sem arquivo). Não crie outro: me diga para ALTERAR
    esse item em Acessos — arquivo BrowseHospedes.html e desmarcar "desabilitado".
16. O item do relatório ainda não existe: me diga para CRIAR em Acessos, dentro do módulo Relatórios,
    "Relação de Hóspedes", arquivo RptHospedes.html, ícone print.

PADRÃO OBRIGATÓRIO (vale para as 3 telas)
- HTML e JavaScript puros, sem framework e sem pacote novo.
- Cores só pelas variáveis --fa-* do TemaFacilApp.css (a tela segue o tema escolhido no menu).
- Cabeçalho 35px; campos, botões e linhas da grade com 22px; ✕ sempre no canto direito.
- Nunca alert, confirm ou prompt do navegador: use FacilAppAviso, FacilAppConfirmar e FacilAppPerguntar (avisos.js).
- Comentário em cada função: O QUE FAZ · ENTRADAS · SAÍDAS · REGRAS · CUIDADOS.

Antes de começar, me mostre um plano curto (o que vai criar em cada parte). Depois de cada parte, diga o que
fez e como eu testo.
```

---

## Conferir no fim

**API (no Swagger)**
- [ ] Incluir "Maria da Silva", telefone (15) 99700-1234 → responde ok com o id.
- [ ] Incluir outro com o mesmo documento → recusa com mensagem clara.
- [ ] Sem telefone → recusa, nada gravado.

**BrowseHospedes.html**
- [ ] Abre pelo menu e lista os hóspedes da API.
- [ ] Busca "maria" e parte do telefone funcionam; filtro de situação funciona.
- [ ] CSV e XLSX baixam a lista do jeito que está filtrada.

**UpdateHospedes.html**
- [ ] Novo e Alterar abrem a janela NO CENTRO; dá para arrastar; Esc e ✕ fecham.
- [ ] Gravar sem obrigatório: campo em vermelho, mensagem, nada gravado.
- [ ] Depois de gravar, a janela fecha, a lista recarrega sozinha e o hóspede aparece.

**Excluir**
- [ ] Pergunta antes (FacilAppConfirmar) e some da lista.
- [ ] Usuário sem permissão de Excluir (Usuários → Permissões) não consegue excluir.

**RptHospedes.html**
- [ ] A prévia mostra a folha com cabeçalho, filtros, tabela e total.
- [ ] Gerar PDF abre o PDF igual à prévia; com muitos hóspedes, quebra página e repete o cabeçalho da tabela.
- [ ] Filtro "Inativos" muda a prévia e o PDF.

## Depois
- Help "?" com voz desta tela: `91_HELP_COM_VOZ_PASSO_A_PASSO.md`.
- Botão IA: `90_TREINAMENTO_E_BOTAO_IA.md`, Parte 2.
