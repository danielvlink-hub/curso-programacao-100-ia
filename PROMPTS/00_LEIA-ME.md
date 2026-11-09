# PROMPTS — como usar

Prompts prontos para o Claude Code construir cada tela do FastPousada no padrão do curso.
Cada prompt já vem preenchido com o projeto: é só copiar o bloco ```` ``` ```` e colar no Claude Code aberto na pasta do curso.

## Ordem sugerida (segue o `FASTPOUSADA-ORGANOGRAMA.md`)

| # | Arquivo | Tela |
|---|---|---|
| 01 | `01_PADRAO_BROWSE_UPDATE.md` | Nossa tela padrão (ler primeiro): Browse + Update + Rpt, com o prompt completo de Hóspedes |
| 02 | `02_CADASTRO_HOSPEDES.md` | Hóspedes — prompt final da aula: Browse, Update, Rpt e Empresa por CNPJ |
| 03 | `03_CADASTRO_TIPOS_E_QUARTOS.md` | Tipos de quarto e Quartos |
| 04 | `04_CADASTRO_TARIFAS.md` | Tarifas |
| 05 | `05_CADASTRO_SERVICOS_E_PRODUTOS.md` | Serviços e produtos |
| 06 | `06_CADASTRO_FORMAS_PAGAMENTO.md` | Formas de pagamento |
| 07 | `07_OPERACAO_RESERVAS.md` | Reservas |
| 08 | `08_OPERACAO_MAPA_OCUPACAO.md` | Mapa de ocupação |
| 09 | `09_OPERACAO_CHECKIN.md` | Check-in |
| 10 | `10_OPERACAO_ESTADIA_CONSUMOS.md` | Estadia e consumos |
| 11 | `11_OPERACAO_CHECKOUT.md` | Check-out |
| 12 | `12_FINANCEIRO_CAIXA_RECEBIMENTOS.md` | Caixa e Recebimentos |
| 13 | `13_RELATORIOS.md` | Relatórios de Ocupação e Faturamento |
| 14 | `14_PAINEL_INICIAL.md` | Painel inicial (dashboard de abertura) |
| 15 | `15_ADMINISTRACAO_CONFIGURACOES.md` | Configurações |
| 90 | `90_TREINAMENTO_E_BOTAO_IA.md` | Treinamento guiado "?" e Botão IA em qualquer tela |
| 101 | `101_EXE_EMBUTIDO_E_APK_GERADO.md` | **EXE e APK** — o FastPousada.exe em C# com as telas embutidas (só o config.js fora) e o APK conferido por dentro |
| 100 | `100_CELULAR_E_APK_ANDROID.md` | **Celular e APK** — telas e CSS para qualquer celular e o APK Android 5+ com tudo embutido |
| 99 | `99_BLOCOS_4_E_5_CAIXA_E_GESTAO.md` | **Blocos 4 e 5 num só** — Caixa, Recebimentos, Relatórios, Configurações e Painel de Hoje (= 97 + 98) |
| 98 | `98_BLOCO5_RELATORIOS_CONFIGURACOES_E_HOJE.md` | **Bloco 5** — Ocupação (ADR, RevPAR), Faturamento, Configurações e Painel de Hoje (substitui o 13, 14 e 15) |
| 97 | `97_BLOCO4_CAIXA_E_RECEBIMENTOS.md` | **Bloco 4** — Caixa por usuário e Recebimentos (substitui o 12) |
| 96 | `96_BLOCO3_CHECKIN_ESTADIA_CHECKOUT.md` | **Bloco 3** — Check-in, Estadia e consumos, Check-out (substitui o 09, 10 e 11) |
| 95 | `95_BLOCO2_RESERVAS_E_MAPA.md` | **Bloco 2** — motor de reservas, Reservas e Mapa com arrastar (substitui o 07 e 08) |
| 94 | `94_BLOCO1_CADASTROS_HOSPEDAGEM.md` | **Bloco 1** — Tipos de quarto, Quartos, Tarifas, Serviços e produtos, Formas de pagamento (substitui o 03 a 06) |
| 93 | `93_BOTAO_VOZ_LUNINHA_FALA.md` | Botão VOZ: a Luninha fala — prompt final da aula (conversa ao vivo, confirmação falada, anti-eco, 30 s) |
| 92 | `92_BOTAO_IA_LUNINHA.md` | Botão IA: a Luninha — prompt final da aula (chave, conversa, tempo, internet, logs) |
| 91 | `91_HELP_COM_VOZ_PASSO_A_PASSO.md` | Help "?" com voz (Francisca): o passo a passo para o aluno, com o prompt pronto |

## Nome dos arquivos das telas

| Tipo de tela | Nome | Exemplo |
|---|---|---|
| Lista (Tabulator) | `Browse<Nome>.html` | `BrowseHospedes.html`, `BrowseReservas.html` |
| Formulário (janela central) | `Update<Nome>.html` | `UpdateHospedes.html`, `UpdateConsumos.html` |
| Relatório | `Rpt<Nome>.html` | `RptHospedes.html`, `RptOcupacao.html` |

Telas de operação que não são lista nem relatório (Mapa de ocupação, Check-in, Check-out, Estadia, Caixa, Painel,
Configurações) mantêm o nome da própria função (`mapa_ocupacao.html`, `checkin.html`...).

## Modelos de tela (abrir e copiar)

- `HTML\modelo_browse.html` — browse (lista) no padrão Gourmet/FacilApp.
- `HTML\modelo_browse_update.html` — update SEPARADO, aberto numa janela flutuante centralizada.
- `HTML\usuarios.html` e `HTML\acessos.html` + `acessos_update.html` — telas reais já ligadas na FacilApp API SQL.

## Como trabalhar com cada prompt

1. Abra o Claude Code na pasta do curso (ele lê o `CLAUDE.md` sozinho).
2. Cole o prompt. Ele vai mostrar um plano curto: leia e responda "pode".
3. Ao terminar, faça você mesmo o teste do checklist do prompt. Só passe para a próxima tela com tudo ✅.
4. Deu errado? Diga exatamente o que viu ("ao gravar sem telefone, gravou mesmo assim") — não recomece do zero.

## Regras que valem para todos

- Backend primeiro (tabela + rotas na FacilApp API SQL + funções no `ApiCurso.js`), tela depois.
- A regra de verdade fica na API; a tela só ajuda o usuário (mensagem perto do campo).
- Nenhuma senha, token ou chave em HTML/JS.
- Toda tela nova entra no menu pelo `acessos.html` (Administração → Acessos).
- Provar, não supor: chamar a rota no Swagger (`http://127.0.0.1:7777/swagger`), conferir no banco, testar na tela.
