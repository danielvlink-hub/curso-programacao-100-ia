# 99 — Blocos 4 e 5 num só: Caixa, Recebimentos, Relatórios, Configurações e Painel de Hoje

Versão em UM prompt dos prompts 97 (Bloco 4) e 98 (Bloco 5), gravados ao vivo na aula de 08/11/2026. Use este quando
quiser construir de uma vez a parte financeira e a gestão da pousada. Pré-requisito: Blocos 1, 2 e 3 prontos
(prompts 94, 95 e 96).

**O que você vai ter no fim:** o caixa por recepcionista (abrir, suprimento, sangria, fechar conferindo), os recebimentos
ligados ao caixa, a lista e o relatório de recebimentos, os relatórios de Ocupação (ADR, RevPAR) e Faturamento, as
Configurações da pousada, o Painel de Hoje e a Luninha (IA e VOZ) em todas essas telas.

| Arquivo | O que é |
|---|---|
| `API FACILAPP SQLite\Caixa.cs` | caixa por usuário, movimentos e a lista de recebimentos |
| `API FACILAPP SQLite\Gestao.cs` | configurações, ocupação, faturamento, painel e liberar quarto |
| `API FACILAPP SQLite\Operacao.cs` / `Reservas.cs` | receber exige caixa aberto; prazo da pré-reserva vem das Configurações |
| `HTML\caixa.html`, `BrowseRecebimentos.html`, `RptRecebimentos.html` | o caixa e os recebimentos |
| `HTML\RptOcupacao.html`, `RptFaturamento.html`, `painel.html`, `configuracoes.html` | a gestão |
| `HTML\assets\js\IACaixa.js`, `IAGestao.js`, `RelatoriosGestao.js` | a Luninha do caixa e da gestão; o motor dos relatórios |

## O prompt

``
Crie os Blocos 4 e 5 do FastPousada numa entrega só: Caixa e Recebimentos (Bloco 4) e depois Relatórios de Ocupação e
Faturamento, Configurações da pousada e Painel de Hoje (Bloco 5). Use SOMENTE a FacilApp API SQL do curso (7777).
UX minimalista. Mostre UM plano curto para os dois blocos e espere o "pode". Faça o Bloco 4 inteiro (API testada numa
cópia e publicada, telas conferidas com print) antes de começar o Bloco 5. Comente cada função como um prompt e
indente para humanos.

=== BLOCO 4 · PARTE 1 — API: o caixa (Caixa.cs) ===
1. Tabelas caixas (id, usuario, situacao ABERTO/FECHADO, aberto_em, saldo_inicial, fechado_em, esperado_dinheiro,
   informado, diferenca, observacao) e caixa_movimentos (id, id_caixa, tipo SUPRIMENTO/SANGRIA, valor, motivo,
   feito_em, usuario). Interface ICaixaRepository (multibanco) e CaixaSqlite. Nada se apaga.
2. Um caixa ABERTO por USUÁRIO (cada recepcionista com o seu). O caixa é sempre o do usuário logado.
3. Rotas: GET /api/caixa/atual (aberto? + resumo: total por forma, recebido em dinheiro, suprimentos, sangrias,
   ESPERADO na gaveta = inicial + dinheiro + suprimentos − sangrias, movimentos e recebimentos do caixa);
   POST /api/caixa/abrir {saldo_inicial}; POST /api/caixa/movimentos {tipo, valor, motivo obrigatório; sangria não
   passa do dinheiro da gaveta}; POST /api/caixa/fechar {saldo_informado, observacao — obrigatória se houver
   diferença} → esperado, informado, diferença ("Bateu certinho", "Falta", "Sobra"); GET /api/caixas (histórico:
   o administrador vê todos, o usuário os seus); GET /api/caixas/{id}; GET /api/recebimentos (?de&ate&id_forma&busca
   &situacao) com hóspede, quarto, forma e caixa.
4. Ligação com o Bloco 3: receber na conta EXIGE o caixa aberto de quem recebe ("Abra o caixa antes de receber") e
   grava o id_caixa; estorno de recebimento de caixa FECHADO é recusado.
5. Permissões fin_caixa e fin_recebimentos; CORS (RotasDasTelas: /api/caixa, /api/caixas); menu: fin_caixa e
   sup_caixa → caixa.html (point_of_sale); fin_recebimentos e sup_recebimentos → BrowseRecebimentos.html (paid).
6. Teste numa cópia: receber sem caixa (recusa), abrir, abrir de novo (recusa), receber dinheiro e Pix, suprimento,
   sangria sem motivo e acima da gaveta (recusa), resumo, fechar com diferença sem observação (recusa) e certo,
   estorno em caixa fechado (recusa), sem login → 401. Publique.

=== BLOCO 4 · PARTE 2 — Telas ===
7. caixa.html — FECHADO: "Seu caixa está fechado", troco inicial (100,00) e Abrir caixa; ao lado, os últimos caixas
   (nº, usuário, aberto, fechado, inicial, esperado, contado, diferença colorida). ABERTO: 3 números (troco inicial,
   recebido, dinheiro na gaveta), total por forma, extrato da gaveta (inicial, dinheiro recebido, suprimentos +,
   sangrias −, esperado), linha de movimento (sangria/suprimento, valor, motivo, Registrar), linha de fechamento
   (dinheiro contado com a diferença AO VIVO enquanto digita, observação, Fechar caixa com confirmação) e, à direita,
   os recebimentos deste caixa.
8. Motor de telas: opções somenteLeitura (sem Novo/Alterar), dicaRodape, listar(q) (a ficha busca e prepara os
   dados) e somar(linhas) (total no rodapé). Ficha Recebimentos: data/hora, hóspede, quarto, forma, valor, caixa,
   observação, situação (Recebido/Estornado); filtros mês, forma e situação; total recebido no rodapé (sem
   estornados); botão Caixa; lixeira = "Estornar" com motivo. RptRecebimentos com os mesmos filtros.
9. Nas telas Estadia e Check-out, um botão "Caixa" (receber exige o caixa aberto).
10. Luninha (IA e VOZ) com IACaixa.js: situacao_caixa, abrir_caixa, suprimento, sangria, fechar_caixa (PERGUNTA o
    dinheiro contado, nunca inventa), listar_recebimentos (total por forma/período), estornar_recebimento (motivo).
11. Dados de teste: um caixa fechado que bateu (com sangria) e um caixa aberto com recebimento e suprimento.
    Confira com print o caixa aberto, o caixa fechado e a lista de recebimentos.

=== BLOCO 5 · PARTE 1 — API: a gestão (Gestao.cs) ===
12. Tabela configuracoes (chave, valor, alterado_em, alterado_por). Chaves com padrão: nome_pousada, documento,
   telefone, email, cep, endereco, cidade, uf, horario_checkin (14:00), horario_checkout (12:00), sinal_percentual
   (30), prazo_pre_reserva_horas (24), politica_cancelamento, texto_rodape_extrato. GET /api/configuracoes (qualquer
   logado); PUT (só administrador, 403 para os outros; numa transação; recusa chave desconhecida; HH:MM; % 0–100;
   prazo 1–168 h; UF 2 letras). O prazo da pré-reserva passa a valer nas Reservas. Pública sem login:
   GET /api/publico/pousada (nome, contato, cidade, horários, % do sinal, política) para o motor on-line.
13. GET /api/relatorios/ocupacao?de&ate&id_tipo — por dia: disponíveis (quartos ativos não bloqueados), ocupados,
   taxa %, receita de diárias (cada noite = total da reserva ÷ noites), ADR e RevPAR; totais do período (taxa média,
   ADR = receita ÷ quartos-noite vendidos, RevPAR = receita ÷ quartos-noite disponíveis). Contam como venda:
   confirmada, hospedado e encerrada (pré-reserva ainda não é venda).
14. GET /api/relatorios/faturamento?de&ate — diárias por competência (noite a noite), consumos (GROUP BY dia e
   categoria, sem estornados), recebido (GROUP BY dia e forma, sem estornados), série por dia, por tipo de quarto,
   ticket médio. Período de no máximo 1 ano.
15. GET /api/painel — numa chamada: pousada e horários, chegadas, atrasadas, saídas, hospedados, cada quarto (situação,
   ocupado, hóspede, saída), ocupação dos próximos 7 dias, recebido hoje por forma, caixa do usuário aberto ou não.
   POST /api/quartos/{id}/liberar — governança: SUJO → LIVRE.
16. CORS (RotasDasTelas: /api/configuracoes, /api/relatorios, /api/painel) e menu: rel_ocupacao → RptOcupacao.html,
   rel_faturamento → RptFaturamento.html, adm_config → configuracoes.html; novos op_hoje (Operação) e na barra de cima
   sup_hoje (today), sup_rel_ocupacao (analytics) e sup_rel_faturamento (bar_chart).
17. Teste numa cópia: config padrão, chave errada, horário ruim, gravar, pública sem login, ocupação, período invertido,
   faturamento, painel, liberar (e liberar de novo → recusa), pré-reserva vencendo no prazo novo, sem login → 401. Publique.

=== BLOCO 5 · PARTE 2 — Telas ===
18. Motor RelatoriosGestao.js (modo ocupacao | faturamento): atalhos 7 dias, Este mês, Mês passado, Próximos 30; de/até;
   tipo de quarto (ocupação); cartões (ocupação: taxa média, ADR, RevPAR, receita, quartos-noite; faturamento:
   faturamento, diárias, consumos, recebido, ticket médio); gráfico de barras por dia em SVG (empilhado diárias +
   consumos no faturamento); quadros por tipo, categoria e forma (faturamento); tabela por dia com total; CSV e XLSX
   (SheetJS) e Imprimir (@media print sem a barra). RptOcupacao.html e RptFaturamento.html só chamam o motor.
19. painel.html: cartões Chegadas, Saídas, Na casa, Ocupação hoje, Recebido hoje (o clique abre Check-in, Check-out,
   Estadia, Mapa, Recebimentos); quadro dos quartos com cor por situação, hóspede e saída, e "Liberar" no sujo;
   próximos 7 dias em barras; chegadas de hoje; recebido por forma; aviso amarelo se o caixa estiver fechado; atualiza
   a cada 60 s sem piscar.
20. configuracoes.html: 3 seções (Dados da pousada com CEP que preenche o endereço; Regras da hospedagem; Textos),
   Gravar e Ctrl+Enter; usuário comum vê só leitura.
21. Luninha (IA e VOZ) com IAGestao.js: resumo_hoje, ocupacao, faturamento (com a tela aberta, mostra o período nela),
    liberar_quarto (pelo número), ver_configuracoes, alterar_configuracoes (só admin). Explica ADR e RevPAR em
    palavras simples.
22. Confira com print o painel, os dois relatórios e as configurações.
``

## Conferir no fim
**Bloco 4 — Caixa e Recebimentos**
- [ ] Menu e barra de cima: Caixa e Recebimentos ativos (sair e entrar de novo).
- [ ] Com o caixa fechado, tentar receber na Estadia → "Abra o caixa antes de receber".
- [ ] Abrir com R$ 100,00 → receber R$ 50,00 em dinheiro → a gaveta mostra R$ 150,00.
- [ ] Sangria de R$ 500,00 → recusada; sangria de R$ 50,00 "depósito" → gaveta R$ 100,00.
- [ ] Fechar digitando R$ 90,00 → "Falta R$ 10,00" ao vivo; sem observação → recusado; com observação → fechado.
- [ ] Recebimentos: filtro Pix, total no rodapé, Estornar de caixa fechado → recusado.
- [ ] Luninha: "como está o caixa?", "sangria de 50 para o banco" e "quanto entrou em Pix hoje?".

**Bloco 5 — Gestão**
- [ ] Menu e barra de cima: Hoje, Ocupação, Faturamento e Configurações ativos (sair e entrar de novo).
- [ ] Painel: os números batem com Check-in, Check-out e Mapa; "Liberar" no 104 → fica verde.
- [ ] Ocupação "Este mês": a taxa de um dia confere à mão (ocupados ÷ disponíveis).
- [ ] Faturamento: o "Recebido por forma" bate com a lista de Recebimentos do mesmo período.
- [ ] Configurações: prazo da pré-reserva 48 h → uma pré-reserva nova vence em 2 dias.
- [ ] Luninha: "como está hoje?", "qual o RevPAR deste mês?" e "libera o 102".