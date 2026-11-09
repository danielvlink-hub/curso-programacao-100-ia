# 98 — Bloco 5: Relatórios de Ocupação e Faturamento, Configurações e Painel de Hoje (prompt final da aula)

Construído ao vivo na aula de 08/11/2026, depois do Bloco 4 (prompt 97). Substitui os prompts 13, 14 e 15 (mantidos só
como referência). A visão do dono: como está o dia, quanto a pousada ocupa e fatura, e as regras da casa.

**O que você vai ter no fim:** a gestão na API (configurações, ocupação com ADR e RevPAR, faturamento, painel de hoje,
liberar quarto), os relatórios gerenciais com gráfico, o Painel de Hoje, a tela de Configurações e a Luninha da gestão.

| Arquivo | O que é |
|---|---|
| `API FACILAPP SQLite\Gestao.cs` | IGestaoRepository/GestaoSqlite, configurações, ocupação, faturamento, painel, liberar quarto e /api/publico/pousada |
| `API FACILAPP SQLite\Reservas.cs` | o prazo da pré-reserva passa a vir das Configurações |
| `HTML\assets\js\RelatoriosGestao.js` + `RptOcupacao.html` + `RptFaturamento.html` | o motor dos relatórios gerenciais (cartões, gráfico SVG, tabela, CSV/XLSX, imprimir) |
| `HTML\painel.html` | o Painel de Hoje |
| `HTML\configuracoes.html` | as configurações da pousada |
| `HTML\assets\js\IAGestao.js` | a Luninha da gestão |

## O prompt

```
Crie o Bloco 5 do FastPousada: relatórios de Ocupação e Faturamento, Configurações da pousada e o Painel de Hoje.
Use SOMENTE a FacilApp API SQL do curso (7777). UX minimalista. Mostre um plano curto e espere o "pode". Comente cada
função como um prompt e indente para humanos.

=== PARTE 1 — API: a gestão (Gestao.cs) ===
1. Tabela configuracoes (chave, valor, alterado_em, alterado_por). Chaves com padrão: nome_pousada, documento,
   telefone, email, cep, endereco, cidade, uf, horario_checkin (14:00), horario_checkout (12:00), sinal_percentual
   (30), prazo_pre_reserva_horas (24), politica_cancelamento, texto_rodape_extrato. GET /api/configuracoes (qualquer
   logado); PUT (só administrador, 403 para os outros; numa transação; recusa chave desconhecida; HH:MM; % 0–100;
   prazo 1–168 h; UF 2 letras). O prazo da pré-reserva passa a valer nas Reservas. Pública sem login:
   GET /api/publico/pousada (nome, contato, cidade, horários, % do sinal, política) para o motor on-line.
2. GET /api/relatorios/ocupacao?de&ate&id_tipo — por dia: disponíveis (quartos ativos não bloqueados), ocupados,
   taxa %, receita de diárias (cada noite = total da reserva ÷ noites), ADR e RevPAR; totais do período (taxa média,
   ADR = receita ÷ quartos-noite vendidos, RevPAR = receita ÷ quartos-noite disponíveis). Contam como venda:
   confirmada, hospedado e encerrada (pré-reserva ainda não é venda).
3. GET /api/relatorios/faturamento?de&ate — diárias por competência (noite a noite), consumos (GROUP BY dia e
   categoria, sem estornados), recebido (GROUP BY dia e forma, sem estornados), série por dia, por tipo de quarto,
   ticket médio. Período de no máximo 1 ano.
4. GET /api/painel — numa chamada: pousada e horários, chegadas, atrasadas, saídas, hospedados, cada quarto (situação,
   ocupado, hóspede, saída), ocupação dos próximos 7 dias, recebido hoje por forma, caixa do usuário aberto ou não.
   POST /api/quartos/{id}/liberar — governança: SUJO → LIVRE.
5. CORS (RotasDasTelas: /api/configuracoes, /api/relatorios, /api/painel) e menu: rel_ocupacao → RptOcupacao.html,
   rel_faturamento → RptFaturamento.html, adm_config → configuracoes.html; novos op_hoje (Operação) e na barra de cima
   sup_hoje (today), sup_rel_ocupacao (analytics) e sup_rel_faturamento (bar_chart).
6. Teste numa cópia: config padrão, chave errada, horário ruim, gravar, pública sem login, ocupação, período invertido,
   faturamento, painel, liberar (e liberar de novo → recusa), pré-reserva vencendo no prazo novo, sem login → 401. Publique.

=== PARTE 2 — Telas ===
7. Motor RelatoriosGestao.js (modo ocupacao | faturamento): atalhos 7 dias, Este mês, Mês passado, Próximos 30; de/até;
   tipo de quarto (ocupação); cartões (ocupação: taxa média, ADR, RevPAR, receita, quartos-noite; faturamento:
   faturamento, diárias, consumos, recebido, ticket médio); gráfico de barras por dia em SVG (empilhado diárias +
   consumos no faturamento); quadros por tipo, categoria e forma (faturamento); tabela por dia com total; CSV e XLSX
   (SheetJS) e Imprimir (@media print sem a barra). RptOcupacao.html e RptFaturamento.html só chamam o motor.
8. painel.html: cartões Chegadas, Saídas, Na casa, Ocupação hoje, Recebido hoje (o clique abre Check-in, Check-out,
   Estadia, Mapa, Recebimentos); quadro dos quartos com cor por situação, hóspede e saída, e "Liberar" no sujo;
   próximos 7 dias em barras; chegadas de hoje; recebido por forma; aviso amarelo se o caixa estiver fechado; atualiza
   a cada 60 s sem piscar.
9. configuracoes.html: 3 seções (Dados da pousada com CEP que preenche o endereço; Regras da hospedagem; Textos),
   Gravar e Ctrl+Enter; usuário comum vê só leitura.
10. Luninha (IA e VOZ) com IAGestao.js: resumo_hoje, ocupacao, faturamento (com a tela aberta, mostra o período nela),
    liberar_quarto (pelo número), ver_configuracoes, alterar_configuracoes (só admin). Explica ADR e RevPAR em
    palavras simples.
11. Confira com print o painel, os dois relatórios e as configurações.
```

## Conferir no fim
- [ ] Menu e barra de cima: Hoje, Ocupação, Faturamento e Configurações ativos (sair e entrar de novo).
- [ ] Painel: os números batem com Check-in, Check-out e Mapa; "Liberar" no 104 → fica verde.
- [ ] Ocupação "Este mês": a taxa de um dia confere à mão (ocupados ÷ disponíveis).
- [ ] Faturamento: o "Recebido por forma" bate com a lista de Recebimentos do mesmo período.
- [ ] Configurações: prazo da pré-reserva 48 h → uma pré-reserva nova vence em 2 dias.
- [ ] Luninha: "como está hoje?", "qual o RevPAR deste mês?" e "libera o 102".
