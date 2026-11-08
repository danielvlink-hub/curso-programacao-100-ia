# PROMPTS — como usar

Prompts prontos para o Claude Code construir cada tela do FastPousada no padrão do curso.
Cada prompt já vem preenchido com o projeto: é só copiar o bloco ```` ``` ```` e colar no Claude Code aberto na pasta do curso.

## Ordem sugerida (segue o `FASTPOUSADA-ORGANOGRAMA.md`)

| # | Arquivo | Tela |
|---|---|---|
| 01 | `01_PADRAO_BROWSE_UPDATE.md` | Padrão de toda tela de cadastro (ler primeiro) |
| 02 | `02_CADASTRO_HOSPEDES.md` | Hóspedes |
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
