# 13 — Relatórios de Ocupação e Faturamento

Consultas de leitura, com filtros, totais, gráfico simples e exportação.

```
Crie os relatórios de Ocupação e de Faturamento do FastPousada (HTML/RptOcupacao.html e HTML/RptFaturamento.html),
no padrão visual do curso. Somente leitura.

BACKEND
- GET /api/relatorios/ocupacao?de=&ate=&id_tipo= → por dia: quartos disponíveis (ativos, fora de manutenção),
  ocupados, taxa %; e totais do período (taxa média, diária média, RevPAR = receita de diárias / quartos-noite disponíveis).
- GET /api/relatorios/faturamento?de=&ate=&agrupar=dia|forma|tipo_quarto → receita de diárias, de consumos,
  descontos, total; por forma de pagamento; ignora estornados e cancelados.
- Tudo calculado em SQL na API (GROUP BY), nunca somando no navegador a lista inteira.

FRONT-END
- Filtros no topo (período com atalhos: Hoje, 7 dias, Mês atual, Mês anterior; tipo de quarto; agrupamento).
- Cartões de resumo (taxa média, diária média, RevPAR / receita total, ticket médio).
- Tabela (Tabulator) com os valores por linha e total no rodapé; exportar CSV e XLSX; imprimir.
- Gráfico de barras simples em SVG/HTML (sem biblioteca nova), cores do tema.
- Menu: módulo Relatórios → "Ocupação" (ícone query_stats) e "Faturamento" (ícone bar_chart).
```

## Teste
- [ ] Com as reservas dos prompts anteriores, conferir à mão a taxa de um dia e bater com o relatório.
- [ ] Faturamento por forma soma exatamente o que está em Recebimentos no mesmo período.
- [ ] Período sem movimento mostra zeros, sem erro.
