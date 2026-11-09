# 96 — Bloco 3: Check-in, Estadia e consumos, Check-out (prompt final da aula)

Construído ao vivo na aula de 08/11/2026, depois do Bloco 2 (prompt 95). Substitui os prompts 09, 10 e 11 (mantidos só
como referência). A operação do dia da pousada, com UX minimalista: uma lista à esquerda, a conta à direita.

**O que você vai ter no fim:** a operação na API (entrada, conta do hóspede, consumos, recebimentos, estornos e saída),
três telas montadas por um único motor e a Luninha da operação (IA e VOZ).

| Arquivo | O que é |
|---|---|
| `API FACILAPP SQLite\Operacao.cs` | IOperacaoRepository/OperacaoSqlite, tabelas consumos e recebimentos, painel de hoje, check-in, conta, consumos, recebimentos, estornos e check-out |
| `HTML\assets\js\ContaHospede.js` | o motor das três telas (lista do dia + conta do hóspede) |
| `HTML\checkin.html`, `estadia.html`, `checkout.html` | as telas (cada uma só chama o motor com o seu modo) |
| `HTML\assets\js\IAOperacao.js` | a Luninha da operação |
| `HTML\assets\js\ApiCurso.js` | funções novas: operacaoHoje, fazerCheckin, contaHospede, lancarConsumo, estornarConsumo, receber, estornarRecebimento, fazerCheckout |

## O prompt

```
Crie o Bloco 3 do FastPousada: Check-in, Estadia e consumos, Check-out. Use SOMENTE a FacilApp API SQL do curso
(7777). UX minimalista: lista do dia à esquerda, a reserva/conta à direita. Mostre um plano curto e espere o "pode".
Comente cada função como um prompt e indente para humanos.

=== PARTE 1 — API: a operação (Operacao.cs) ===
1. Tabelas consumos (id, id_reserva, id_item, descricao, quantidade, valor_unitario, valor_total, lancado_em,
   estornado, estorno_motivo) e recebimentos (id, id_reserva, id_forma, valor, recebido_em, observacao, estornado,
   estorno_motivo, id_caixa = 0, já pronto para o caixa do Bloco 4). Interface IOperacaoRepository (multibanco) e
   OperacaoSqlite. NADA SE APAGA: consumo e recebimento só ESTORNAM, com motivo.
2. GET /api/operacao/hoje: chegadas de hoje, atrasadas (entrada já passou, saída não, sem check-in), saídas (hospedados
   com saída hoje ou antes), hospedados, quartos sujos e total de quartos.
3. POST /api/reservas/{id}/checkin {forcar, observacao}: só pré-reserva ou confirmada, a partir da entrada; o quarto
   não pode ter outro hospedado; quarto SUJO ou em MANUTENÇÃO → 409 com confirmar=true (a tela pergunta e manda
   forcar=true). Reserva vira HOSPEDADO.
4. GET /api/reservas/{id}/conta: reserva, diárias, consumos, recebimentos, sinal pago antes, total e SALDO
   (diárias + consumos − recebidos − sinal).
5. POST /api/reservas/{id}/consumos {id_item, quantidade, valor_unitario vazio = preço do cadastro} (só HOSPEDADO);
   POST /api/consumos/{id}/estornar {motivo}.
6. POST /api/reservas/{id}/recebimentos {id_forma, valor, observacao}: não passa do saldo; POST
   /api/recebimentos/{id}/estornar {motivo}.
7. POST /api/reservas/{id}/checkout: só com saldo ZERO; reserva ENCERRADA, quarto fica SUJO; aviso se sair antes da data.
8. Permissões op_checkin, op_estadia, op_checkout; CORS (RotasDasTelas) e menu ligado: op_checkin/sup_checkin →
   checkin.html, op_estadia/sup_estadia → estadia.html, op_checkout/sup_checkout → checkout.html.
9. Teste numa cópia: check-in normal, quarto sujo (409) e forçado, consumo, recebimento acima do saldo (recusa),
   estornos, check-out com saldo (recusa) e zerado, sem login → 401. Publique.

=== PARTE 2 — O motor das telas (ContaHospede.js) e as 3 telas ===
10. ApiCurso: as funções da operação. O erro da API leva status e resposta (para o 409 com confirmar).
11. ContaHospede.iniciar({ modo }): cabeçalho com IA, VOZ e ×; barra com busca (nome, quarto, código) e os números do
    dia (chegadas, atrasadas, saídas, na casa X de Y, sujos); lista de cartões à esquerda; painel à direita; ?id= abre.
    - checkin: chegadas + atrasadas (marca "atrasada"); painel com total, já pago, a receber, origem, aviso de quarto
      sujo/manutenção, observação da entrada e o botão Fazer check-in (409 → FacilAppConfirmar → forcar).
    - estadia: hospedados; a CONTA (diárias, consumos, sinal, recebimentos; estornado riscado; ícone de desfazer pede
      o motivo), totais e saldo em cor; lançar consumo (item, qtd, valor un.) e receber (forma, valor = saldo, obs.).
    - checkout: saídas primeiro, depois os demais hospedados; a mesma conta + "Fechar conta e fazer check-out" (só
      com saldo zero, confirma antes).
12. checkin.html, estadia.html e checkout.html: só o cabeçalho padrão e ContaHospede.iniciar com o modo.
13. Luninha (IA e VOZ) com IAOperacao.js: resumo_do_dia, ver_conta (traz itens e formas com id), abrir_conta,
    fazer_checkin, lancar_consumo, receber, fazer_checkout — as mesmas funções da tela; tudo que grava confirma.
14. Dados de teste: check-in de 2 reservas, consumos e um pagamento; deixe uma chegada num quarto sujo para mostrar o
    aviso. Confira com print as três telas.
```

## Conferir no fim
- [ ] Menu e barra de cima: Check-in, Estadia e Check-out ativos (sair e entrar de novo).
- [ ] Check-in do João no 102 (sujo) → pergunta → confirmar → ele sai das chegadas e aparece na Estadia.
- [ ] Estadia: lançar 2 cervejas → saldo sobe; desfazer uma → pede o motivo e fica riscada.
- [ ] Receber mais que o saldo → a API recusa.
- [ ] Check-out com saldo → botão desligado; receber o saldo → Fechar conta → o quarto fica sujo no mapa.
- [ ] Luninha: "quem chega hoje?", "lança 2 águas no 101" e "quanto o 201 deve?".
