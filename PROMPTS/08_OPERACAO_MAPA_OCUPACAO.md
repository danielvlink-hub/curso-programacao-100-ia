# 08 — Mapa de ocupação

Visão em grade: quartos nas linhas, dias nas colunas. Não é browse/update; é uma tela de consulta com atalhos.

```
Crie o Mapa de Ocupação do FastPousada (HTML/mapa_ocupacao.html), no padrão visual do curso (TemaFacilApp.css,
cabeçalho 35px, ✕ à direita).

BACKEND
- GET /api/mapa-ocupacao?de=AAAA-MM-DD&dias=14 → { dias:[...], quartos:[{id_quarto, numero, tipo, situacao,
  ocupacoes:[{id_reserva, hospede, entrada, saida, situacao}]}] } numa única chamada (sem N+1 consultas).

FRONT-END
- Barra: período (◀ semana anterior | hoje | próxima semana ▶), quantidade de dias (7/14/30), filtro por tipo.
- Grade: 1ª coluna fixa com Número + Tipo do quarto; cada dia uma coluna (fim de semana com fundo levemente diferente,
  hoje destacado). Cada reserva é uma barra contínua do dia de entrada ao de saída, com o nome do hóspede,
  cor pela situação (prevista, confirmada, hospedado). Quarto em limpeza/manutenção com marca no número.
- Clique na barra abre a reserva (reservas_update.html?id=) na janela central; clique num dia vazio abre
  reserva nova já com quarto e entrada preenchidos.
- Rodapé com legenda das cores e taxa de ocupação do período (quartos-noite ocupados / disponíveis).
- Menu: módulo Operação → "Mapa de Ocupação", ícone calendar_view_month. Também como atalho no menu superior.
```

## Teste
- [ ] A reserva de Maria (101, 10 a 13/12) aparece como barra de 3 dias.
- [ ] Clique num dia vazio do 102 abre reserva nova com quarto 102 e a data clicada.
- [ ] Navegar semanas não trava e a taxa de ocupação muda.
