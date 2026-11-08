# 09 — Check-in

Transforma a reserva em hospedagem: confere o hóspede e ocupa o quarto.

```
Crie a tela de Check-in do FastPousada (HTML/checkin.html), no padrão visual do curso.

BACKEND
- POST /api/reservas/{id}/checkin {documento, telefone, placa_veiculo?, observacao?}
  Em UMA transação: confere se a reserva está 'prevista' ou 'confirmada', se a entrada é hoje (ou permite
  antecipar com motivo), se o quarto está 'livre'; atualiza dados do hóspede; reserva → 'hospedado' com
  checkin_em (data e hora); quarto → 'ocupado'. Qualquer falha desfaz tudo e devolve a mensagem.
- GET /api/checkin/pendentes?data= → reservas com entrada no dia ainda não hospedadas.

FRONT-END
- Lista "Chegadas de hoje" (Tabulator): Hóspede, Quarto, Noites, Situação; busca por nome.
- Ao escolher uma chegada, abre a janela central de confirmação: dados da reserva (só leitura), documento e telefone
  editáveis (obrigatórios), placa do veículo, observação, e o botão "Confirmar check-in".
- Depois de confirmar: mensagem "Check-in feito — quarto 101 ocupado", a linha sai da lista.
- Se o quarto estiver em limpeza/manutenção, a API recusa e a tela mostra o motivo.
- Menu: módulo Operação → "Check-in", ícone login. Atalho no menu superior.
```

## Teste
- [ ] Fazer o check-in da Maria → reserva 'hospedado', quarto 101 'ocupado' (conferir no Mapa).
- [ ] Tentar check-in de novo na mesma reserva → recusado.
- [ ] Quarto em manutenção → recusado com a mensagem da API.
