# 97 — Bloco 4: Caixa e Recebimentos (prompt final da aula)

Construído ao vivo na aula de 08/11/2026, depois do Bloco 3 (prompt 96). Substitui o prompt 12 (mantido só como
referência). O financeiro do dia a dia: cada recepcionista com o seu caixa, todo dinheiro passando por ele.

**O que você vai ter no fim:** o caixa na API (abrir, suprimento, sangria, fechar conferindo), os recebimentos do
Bloco 3 ligados ao caixa de quem recebeu, a tela do Caixa, a lista e o relatório de Recebimentos e a Luninha do caixa.

| Arquivo | O que é |
|---|---|
| `API FACILAPP SQLite\Caixa.cs` | ICaixaRepository/CaixaSqlite, tabelas caixas e caixa_movimentos, rotas do caixa e a lista de recebimentos |
| `API FACILAPP SQLite\Operacao.cs` | receber exige o caixa aberto e grava o id_caixa; estorno recusado em caixa fechado |
| `HTML\caixa.html` | a tela do caixa (fechado: abrir + últimos caixas; aberto: números, por forma, gaveta, sangria, fechar) |
| `HTML\BrowseRecebimentos.html` + `RptRecebimentos.html` + `assets\js\cadastros\Recebimentos.js` | lista e relatório pelo motor de telas (somente leitura; lixeira = "Estornar") |
| `HTML\assets\js\IACaixa.js` | a Luninha do caixa |
| `HTML\assets\js\CadastroPadrao.js` | opções novas do motor: somenteLeitura, dicaRodape, listar(q), somar(linhas) |

## O prompt

```
Crie o Bloco 4 do FastPousada: Caixa e Recebimentos. Use SOMENTE a FacilApp API SQL do curso (7777). UX minimalista.
Mostre um plano curto e espere o "pode". Comente cada função como um prompt e indente para humanos.

=== PARTE 1 — API: o caixa (Caixa.cs) ===
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

=== PARTE 2 — Telas ===
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
```

## Conferir no fim
- [ ] Menu e barra de cima: Caixa e Recebimentos ativos (sair e entrar de novo).
- [ ] Com o caixa fechado, tentar receber na Estadia → "Abra o caixa antes de receber".
- [ ] Abrir com R$ 100,00 → receber R$ 50,00 em dinheiro → a gaveta mostra R$ 150,00.
- [ ] Sangria de R$ 500,00 → recusada; sangria de R$ 50,00 "depósito" → gaveta R$ 100,00.
- [ ] Fechar digitando R$ 90,00 → "Falta R$ 10,00" ao vivo; sem observação → recusado; com observação → fechado.
- [ ] Recebimentos: filtro Pix, total no rodapé, Estornar de caixa fechado → recusado.
- [ ] Luninha: "como está o caixa?", "sangria de 50 para o banco" e "quanto entrou em Pix hoje?".
