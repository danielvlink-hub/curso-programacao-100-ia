# 07 — Reservas

Coração da operação. Precisa de Hóspedes (02), Quartos (03) e Tarifas (04) prontos.

```
Crie a tela de Reservas do FastPousada (browse + update separado em janela central, PROMPTS/01_PADRAO_BROWSE_UPDATE.md).

BACKEND
- Tabela reservas: id_reserva (PK), id_hospede (FK), id_quarto (FK), entrada (data), saida (data), adultos (>=1),
  criancas (>=0), valor_diaria (copiado da tarifa vigente na entrada, pode ser ajustado), situacao ('prevista',
  'confirmada','hospedado','encerrada','cancelada'), observacao, criado_em, alterado_em, cancelado_motivo.
- Rotas: /api/reservas (CRUD; GET com ?de=&ate=&situacao=&busca=), GET /api/quartos/disponiveis?entrada=&saida=&pessoas=,
  POST /api/reservas/{id}/cancelar {motivo}.
- Regras na API (as mais importantes do curso):
  * saida > entrada; pessoas (adultos+criancas) <= capacidade do tipo do quarto;
  * o quarto NÃO pode ter outra reserva ativa (prevista/confirmada/hospedado) com período que se cruze
    (o dia da saída de uma pode ser o dia da entrada de outra);
  * reserva 'hospedado' ou 'encerrada' não é alterada nem excluída por aqui; cancelar exige motivo;
  * valor_diaria padrão = tarifa vigente do tipo do quarto na data de entrada.

FRONT-END
- HTML/BrowseReservas.html + UpdateReservas.html.
- Browse: Nº, Hóspede, Quarto, Entrada, Saída, Noites, Diária, Total previsto, Situação (etiqueta colorida), Ações.
  Filtro por período (padrão: de hoje a +30 dias), situação e busca por hóspede.
- Update: Hóspede (ComboBusca em /api/hospedes, com botão "+" que abre UpdateHospedes.html), Entrada, Saída,
  Adultos, Crianças → botão "Ver quartos livres" lista só os disponíveis (/api/quartos/disponiveis);
  Diária vem da tarifa e pode ser ajustada; mostra Noites e Total previsto ao vivo; Observação.
- Ação "Cancelar reserva" na linha (pede o motivo com FacilAppPerguntar).
- Menu: módulo Operação → "Reservas", ícone event.
```

## Teste
- [ ] Reserva Maria, quarto 101, 10/12 a 13/12 → 3 noites, diária da tarifa de alta.
- [ ] Outra reserva no 101 de 12/12 a 14/12 → recusada (conflito). De 13/12 a 15/12 → aceita.
- [ ] 3 pessoas num Standard (capacidade 2) → recusada.
- [ ] Cancelar sem motivo → não deixa.
