# 14 — Painel inicial (dashboard de abertura)

A primeira coisa que a recepção vê ao entrar: o dia de hoje em números.

```
Crie o Painel Inicial do FastPousada (HTML/painel.html), no padrão visual do curso, e coloque-o como primeira aba
da faixa de dashboards (acessos.html → aba Dashboards).

BACKEND
- GET /api/painel?data=AAAA-MM-DD (padrão hoje) → numa chamada: chegadas do dia, saídas do dia, hospedados agora,
  quartos por situação (livre/ocupado/limpeza/manutencao), taxa de ocupação de hoje e dos próximos 7 dias,
  recebido hoje por forma, caixa aberto ou fechado.

FRONT-END
- Linha de cartões: Chegadas, Saídas, Hospedados, Ocupação hoje (%), Recebido hoje (R$). Clique no cartão abre a
  tela correspondente (Check-in, Check-out, Estadia, Mapa, Recebimentos) pelo menu.
- Quadro de quartos: um quadradinho por quarto com o número, cor pela situação; quarto em 'limpeza' tem botão
  "Liberado" (PUT /api/quartos/{id}/situacao → 'livre').
- Mini-gráfico da ocupação dos próximos 7 dias.
- Atualiza sozinho a cada 60 s (sem piscar a tela) e tem botão de recarregar.
- Aviso em destaque quando o caixa está fechado.
```

## Teste
- [ ] Os números batem com Check-in, Check-out e Mapa do mesmo dia.
- [ ] Quarto em limpeza → "Liberado" → fica verde e aparece livre no Mapa.
- [ ] Com o caixa fechado, aparece o aviso.
