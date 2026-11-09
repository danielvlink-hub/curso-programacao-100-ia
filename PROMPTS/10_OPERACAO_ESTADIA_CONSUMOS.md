# 10 — Estadia e consumos

Conta do hóspede durante a estadia: lança serviços e produtos.

```
Crie a tela de Estadia e Consumos do FastPousada (HTML/estadia.html + HTML/UpdateConsumos.html), no padrão do curso.

BACKEND
- Tabela consumos: id_consumo (PK), id_reserva (FK), id_item (FK servicos_produtos), descricao (copiada do item),
  quantidade (> 0), valor_unitario (copiado do preço, pode ajustar), total, lancado_em, lancado_por (usuário do token),
  cancelado (0/1), cancelado_motivo.
- Rotas: GET /api/reservas/{id}/conta → {reserva, diarias:{noites, valor, total}, consumos:[...], total_consumos,
  total_geral}; POST /api/reservas/{id}/consumos; POST /api/consumos/{id}/cancelar {motivo}.
- Regras na API: só lança em reserva 'hospedado'; consumo não é apagado, é CANCELADO com motivo (fica no histórico);
  total = quantidade × valor_unitario calculado na API.

FRONT-END
- Lado esquerdo: hóspedes hospedados agora (quarto + nome), busca.
- Lado direito: a conta do escolhido — diárias, lista de consumos (Tabulator: Data/hora, Item, Qtd, Unitário, Total,
  Lançado por, ação Cancelar) e o Total geral em destaque.
- "Lançar consumo" abre UpdateConsumos.html na janela central: Item (ComboBusca em /api/servicos-produtos),
  Quantidade, Unitário (vem do cadastro), Total ao vivo.
- Consumo cancelado aparece riscado e fora do total.
- Menu: módulo Operação → "Estadia e Consumos", ícone receipt_long.
```

## Teste
- [ ] Lançar 2 águas (R$ 6,00) na conta da Maria → total de consumos R$ 12,00.
- [ ] Cancelar 1 lançamento sem motivo → não deixa; com motivo → riscado e fora do total.
- [ ] Tentar lançar numa reserva só 'confirmada' → recusado.
