# 02 — Cadastro de Hóspedes (prompt final da aula)

Primeira tela de verdade do FastPousada, construída ao vivo na aula de 08/11/2026. Base para Reservas, Check-in e
Check-out. Este prompt já traz tudo o que foi pedido e ajustado na gravação: copie, cole no Claude Code e acompanhe.

**O que você vai ter no fim:**

| Arquivo | O que é |
|---|---|
| `API FACILAPP SQLite\Hospedes.cs` | tabela, regras e rotas de hóspedes na FacilApp API SQL (porta 7777) |
| `HTML\BrowseHospedes.html` | a lista (Tabulator), com o botão **Empresa por CNPJ** |
| `HTML\UpdateHospedes.html` | o formulário, numa janela flutuante no centro da lista |
| `HTML\RptHospedes.html` | o relatório "Relação de Hóspedes", com PDF |

---

## Antes de colar

1. Claude Code aberto na pasta `C:\CURSO`.
2. .NET 10 SDK instalado (`dotnet --list-sdks` mostra uma linha `10.`). Se não tiver, o próprio Claude explica como instalar.
3. Sistema aberto no Chrome por `file:///C:/CURSO/HTML/index.html`, logado com `facilapp` / `1`.

---

## O prompt

```
Crie o cadastro de HÓSPEDES do FastPousada na nossa tela padrão: BrowseHospedes.html (lista) + UpdateHospedes.html
(formulário em janela central) + RptHospedes.html (relatório), com o botão "Empresa por CNPJ".
Use SOMENTE a FacilApp API SQL do curso (porta 7777, pasta "API FACILAPP SQLite") — nunca outra API.
Leia antes o CLAUDE.md e os modelos HTML/modelo_browse.html e HTML/modelo_browse_update.html.
Mostre um plano curto e espere o meu "pode".

=== PARTE 1 — API (arquivo novo Hospedes.cs, banco SQLite) ===
1. Tabela hospedes, criada na inicialização se não existir (nunca apagar dados):
   id_hospede (automático), tipo ('PF' pessoa | 'PJ' empresa), nome (razão social na empresa), nome_fantasia,
   documento (CPF/CNPJ), documento_chave (documento só com letras e números, em maiúsculas — é ele que não repete),
   inscricao_estadual, telefone, email, data_nascimento (AAAA-MM-DD), cep, logradouro, numero, complemento, bairro,
   cidade, uf, observacao, ativo (padrão 1), criado_em, alterado_em.
   Índice único em documento_chave quando não vazio.
2. Multibanco: a API vai aceitar SQL Server e PostgreSQL no futuro. Crie a interface IHospedesRepository
   (Initialize, Listar, Obter, PorDocumento, Incluir, Alterar, ContarReservas, Excluir) e a implementação
   HospedesSqlite com todo o SQL. As rotas só conhecem a interface; o Program.cs escolhe a implementação.
3. Regras (validadas na API, mensagens claras em português, resposta {ok:false, erro}):
   - nome com 3+ letras;
   - pessoa: telefone obrigatório com DDD (10+ números); empresa: telefone opcional;
   - empresa com documento: CNPJ válido (dígitos verificadores);
   - documento não repete entre hóspedes ("123.456.789-09" e "12345678909" são o mesmo) — dizer quem já usa;
   - e-mail válido quando informado; UF com 2 letras;
   - não excluir hóspede com reserva (quando a tabela reservas existir): "inative em vez de excluir".
4. Rotas com o Bearer da sessão:
   GET /api/hospedes (?busca=&ativo=&tipo=&cidade=&uf=), GET /api/hospedes/{id}, POST, PUT /{id}, DELETE /{id}.
   Permissão: administrador pode tudo; usuário comum segue as exceções do item de menu "cad_hospedes"
   (incluir/alterar/excluir da tela Usuários → Permissões).
5. POST /api/hospedes/empresa-por-cnpj {cnpj}: o usuário manda SÓ o CNPJ. A API confere os dígitos, avisa se a
   empresa já está cadastrada, busca os dados públicos com o PublicLookupService que já existe (o mesmo da rota
   /api/cnpj) e grava a empresa (razão social, fantasia, IE, e-mail, telefone, endereço, cidade, UF) como PJ ativo.
   Devolve o hóspede criado.
6. GET /api/hospedes/cep/{cep}: mesma consulta da rota /api/cep (PublicLookupService), dentro de /api/hospedes.
7. CORS: no Program.cs, inclua /api/hospedes no bloco que libera o Origin "null" (telas abertas como arquivo),
   senão a tela dá "Failed to fetch".
8. Menu (no MenuCatalog.cs, só uma vez e sem mexer no que o administrador já mudou): o item "cad_hospedes" ganha o
   arquivo BrowseHospedes.html e deixa de ser desabilitado; crie "sup_hospedes" (barra de cima, Hóspedes,
   BrowseHospedes.html) e "rel_hospedes" (módulo Relatórios, "Relação de Hóspedes", RptHospedes.html, ícone print).
9. Compile e teste numa cópia da API em outra porta com banco temporário: incluir, documento repetido, sem telefone,
   empresa por CNPJ (ex.: 00.000.000/0001-91), mesma empresa de novo, CNPJ inválido, CEP, listar, alterar, excluir,
   sem token. Mostre o resultado.
10. Publique o executável único em saida\publish-0.2.0 e me peça para rodar PS1\atualizar_servico_7777.ps1 como
    administrador (não pare o serviço sozinho). Depois confira /api/hospedes no 7777 (401 sem token = no ar).

=== PARTE 2 — ApiCurso.js ===
11. listarHospedes(filtros), obterHospede(id), incluirHospede(dados), alterarHospede(id, dados), excluirHospede(id),
    cadastrarEmpresaPorCnpj(cnpj), consultarCepHospede(cep). As telas só chamam estas funções.
    No avisos.js, a trava do modo treinamento também bloqueia funções que começam com "cadastrar".

=== PARTE 3 — BrowseHospedes.html (copie o modelo_browse.html) ===
12. Cabeçalho 35px com ícone person, "Hóspedes — Pessoas e empresas" e ✕ à direita.
13. Barra: Novo Hóspede, Empresa por CNPJ, busca (nome, fantasia, documento, telefone, cidade — também só pelos
    números), filtro de tipo (pessoas e empresas / só pessoas / só empresas), filtro de situação; à direita
    Relatório, CSV, XLSX e Recarregar.
14. Grade (Tabulator, dados só depois do tableBuilt): Tipo (etiqueta Pessoa/Empresa), Nome / Razão social (SÓ a razão
    social, uma linha), CPF / CNPJ, Telefone, Cidade / UF, Situação (etiqueta), Ações (lápis e lixeira).
    Fantasia e e-mail ficam ocultos na grade, mas vão no CSV/XLSX. Total no rodapé; duplo clique altera.
15. Empresa por CNPJ: pede só o CNPJ com FacilAppPerguntar, chama cadastrarEmpresaPorCnpj, recarrega e deixa a
    empresa nova selecionada; se a API recusar, mostra a mensagem dela.
16. Excluir pergunta com FacilAppConfirmar (botão vermelho) e mostra a recusa da API quando houver.
17. Relatório abre RptHospedes.html?de=browse (para o ✕ do relatório voltar para a lista).
18. A janela do update ajusta a altura ao formulário quando ele avisa FACILAPP_MODELO_ALTURA.

=== PARTE 4 — UpdateHospedes.html (copie o modelo_browse_update.html) ===
19. Linha 1: Pessoa | Empresa | Ativo (tudo na mesma linha, na frente dos campos).
20. Nome (razão social na empresa) na linha inteira. Empresa mostra Nome fantasia e Inscrição estadual.
21. CPF/Documento (vira "CNPJ" na empresa), Telefone e E-mail na mesma linha (e-mail logo depois do telefone);
    Nascimento só para pessoa. Depois CEP (ao sair do campo com 8 números, preenche endereço, bairro, cidade e UF
    pela API), Endereço, Número, Complemento, Bairro, Cidade, UF e Observação.
22. Valida antes de gravar (campo em vermelho e foco nele), grava pela API e SÓ DEPOIS avisa o browse
    (FACILAPP_MODELO_GRAVADO com o id); Cancelar/Esc avisam FACILAPP_MODELO_CANCELADO; Ctrl+Enter grava.
23. Altura: a janela tem o tamanho do conteúdo, SEM barra de rolagem (avise a altura ao browse ao abrir e sempre
    que o conteúdo mudar, com ResizeObserver). No máximo 3px de espaço: Observação → traço do rodapé 3px,
    traço → botões 3px, nenhum botão sobre o traço. Campos com display:block (sem folga embaixo).

=== PARTE 5 — RptHospedes.html (relatório) ===
24. Cabeçalho 35px "Relação de Hóspedes" com ✕. Filtros: Tipo, Situação (padrão Ativos), Cidade, UF e Gerar
    (gera sozinho ao abrir e ao trocar Tipo/Situação; Enter nos campos de texto).
25. Prévia em folha A4 de largura e altura do conteúdo (sem barra quando cabe): "FastPousada", título, filtros
    usados, data e hora; tabela Tipo, Nome / Razão social, CPF / CNPJ, Telefone, Cidade / UF, Situação, linhas
    zebradas; total no fim.
26. Gerar PDF com o jsPDF (copie C:\CURSO\Dependencias\jspdf-2.5.1 para HTML\dependencias\jspdf-2.5.1), desenhado
    pelo próprio jsPDF: quebra de página repetindo o cabeçalho da tabela e "Página X de Y" no rodapé. Imprimir abre
    o PDF e chama a impressão. CSV e XLSX com os mesmos dados (fantasia e e-mail incluídos).
27. ✕: se abriu com ?de=browse volta para o BrowseHospedes.html; se abriu pelo menu, fecha a tela.

PADRÃO OBRIGATÓRIO: HTML e JavaScript puros, sem pacote novo; cores só --fa-* do TemaFacilApp.css; cabeçalho 35px,
campos e linhas 22px; nunca alert/confirm/prompt (FacilAppAviso, FacilAppConfirmar, FacilAppPerguntar);
comentário em cada função (O QUE FAZ · ENTRADAS · SAÍDAS · REGRAS · CUIDADOS); backup fora da pasta da API.
Depois de cada parte, diga o que fez e como eu testo.
```

---

## Conferir no fim

**API (Swagger `http://127.0.0.1:7777/swagger`)**
- [ ] Incluir "Maria da Silva", telefone (15) 99700-1234 → ok com o id.
- [ ] Mesmo documento de novo (com ou sem pontuação) → recusado, dizendo quem já usa.
- [ ] Pessoa sem telefone → recusado. Empresa sem telefone → aceita.
- [ ] Empresa por CNPJ 00.000.000/0001-91 → cadastra o Banco do Brasil completo; de novo → "já cadastrada".

**Tela**
- [ ] Sair e entrar de novo: Cadastros → Hóspedes ativo; "Hóspedes" na barra de cima; "Relação de Hóspedes" em Relatórios.
- [ ] Novo Hóspede: janela no centro, sem barra de rolagem, Ativo na linha 1, e-mail depois do telefone.
- [ ] CEP 18035-000 → endereço, bairro, cidade e UF preenchidos sozinhos.
- [ ] Marcar Empresa → aparecem Fantasia e IE, o documento vira CNPJ, a janela cresce sozinha.
- [ ] Empresa por CNPJ → a empresa aparece selecionada na lista.
- [ ] CSV e XLSX baixam a lista filtrada.
- [ ] Relatório → prévia sem barra; Gerar PDF; ✕ volta para a lista.
- [ ] Usuário sem permissão de Excluir (Usuários → Permissões) não consegue excluir.

## Depois
- Help "?" com voz desta tela: `91_HELP_COM_VOZ_PASSO_A_PASSO.md`.
- Botão IA: `90_TREINAMENTO_E_BOTAO_IA.md`, Parte 2.
