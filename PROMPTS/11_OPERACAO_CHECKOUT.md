# 11 — Check-out

Fecha a conta, recebe e libera o quarto para limpeza.

```
Crie a tela de Check-out do FastPousada (HTML/checkout.html), no padrão visual do curso.

BACKEND
- POST /api/reservas/{id}/checkout {pagamentos:[{id_forma, valor}], desconto?, motivo_desconto?}
  Em UMA transação: reserva 'hospedado'; total = diárias (noites reais até hoje, mínimo 1) + consumos não cancelados
  − desconto; soma dos pagamentos = total (dinheiro pode passar e gera troco); grava recebimentos (ver 12);
  reserva → 'encerrada' com checkout_em; quarto → 'limpeza'. Desconto exige motivo.
- GET /api/checkout/pendentes?data= → hospedados com saída até a data.

FRONT-END
- Lista "Saídas de hoje" + busca por qualquer hospedado (saída antecipada).
- Ao escolher: janela central com o RESUMO DA CONTA (diárias, consumos, desconto, total), e a área de pagamento:
  várias formas (ex.: parte PIX, parte dinheiro), cada uma com valor; mostra "Falta" ou "Troco" ao vivo.
  Botão "Finalizar check-out" só habilita quando Falta = 0.
- Depois: mensagem com o total recebido e o troco; opção de imprimir o extrato (window.print de uma área própria).
- Menu: módulo Operação → "Check-out", ícone logout. Atalho no menu superior.
```

## Teste
- [ ] Maria: 3 diárias de R$ 260,00 + R$ 6,00 de consumo = R$ 786,00.
- [ ] Pagar R$ 500,00 no PIX + R$ 300,00 em dinheiro → troco R$ 14,00; finaliza.
- [ ] Quarto 101 vai para 'limpeza' no Mapa; reserva 'encerrada'.
- [ ] Pagar menos que o total → botão não habilita e a API também recusa.
