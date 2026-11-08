# 12 — Caixa e Recebimentos

Todo dinheiro que entra (check-out, adiantamento de reserva) passa por um caixa aberto.

```
Crie Caixa e Recebimentos do FastPousada (HTML/caixa.html e HTML/recebimentos.html), no padrão do curso.

BACKEND
- Tabela caixas: id_caixa (PK), aberto_em, aberto_por, saldo_inicial, fechado_em, fechado_por, saldo_informado,
  diferenca, observacao. Só UM caixa aberto por vez.
- Tabela recebimentos: id_recebimento (PK), id_caixa (FK), id_reserva (FK, opcional para adiantamento), id_forma (FK),
  valor (> 0), troco, recebido_em, recebido_por, estornado (0/1), estorno_motivo.
- Tabela caixa_movimentos: id_mov, id_caixa, tipo ('suprimento','sangria'), valor, motivo, feito_em, feito_por.
- Rotas: GET /api/caixa/atual; POST /api/caixa/abrir {saldo_inicial}; POST /api/caixa/fechar {saldo_informado,
  observacao}; POST /api/caixa/movimentos; GET /api/recebimentos?de=&ate=&id_forma=; POST /api/recebimentos/{id}/estornar.
- Regras na API: sem caixa aberto não há recebimento (o check-out avisa "abra o caixa"); fechar calcula o esperado
  em dinheiro (inicial + recebido em dinheiro − troco + suprimentos − sangrias) e grava a diferença;
  estorno exige motivo e só no caixa aberto; nada é apagado.

FRONT-END
- caixa.html: situação do caixa (aberto por/desde), totais por forma de pagamento, botões Abrir, Suprimento,
  Sangria e Fechar (cada um na janela central). No fechamento mostra Esperado × Informado × Diferença.
- recebimentos.html: browse por período e forma (Data/hora, Reserva, Hóspede, Forma, Valor, Troco, Por, Situação),
  totais no rodapé, CSV/XLSX, ação Estornar.
- Menu: módulo Financeiro → "Caixa" (ícone point_of_sale) e "Recebimentos" (ícone request_quote).
```

## Teste
- [ ] Abrir caixa com R$ 100,00; fazer o check-out da Maria (prompt 11) → recebimentos aparecem.
- [ ] Sangria de R$ 50,00 com motivo; fechar informando o saldo → diferença zero.
- [ ] Check-out com caixa fechado → recusado com "abra o caixa".
