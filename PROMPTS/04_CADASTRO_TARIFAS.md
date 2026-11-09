# 04 — Tarifas

Valor da diária por tipo de quarto e período (alta e baixa temporada).

```
Crie o cadastro de Tarifas do FastPousada seguindo PROMPTS/01_PADRAO_BROWSE_UPDATE.md.

BACKEND
- Tabela tarifas: id_tarifa (PK), id_tipo (FK quartos_tipos, obrigatória), descricao (ex.: "Alta temporada"),
  valor_diaria (> 0, 2 casas), inicio (data), fim (data), ativo.
- Rotas: /api/tarifas (CRUD) e GET /api/tarifas/vigente?id_tipo=&data=AAAA-MM-DD → a tarifa que vale naquele dia.
- Regras na API: fim >= inicio; não pode haver duas tarifas ATIVAS do mesmo tipo com períodos que se cruzam
  (responder qual tarifa conflita); valor sempre gravado em número, nunca texto.

FRONT-END
- HTML/BrowseTarifas.html + UpdateTarifas.html. Colunas: Tipo, Descrição, Diária (R$ 0,00), Início, Fim, Situação, Ações.
- Filtro por tipo de quarto e opção "só vigentes hoje".
- Update: Tipo (ComboBusca), Descrição*, Diária*, Início*, Fim*, Ativo. Valor digitado em reais com vírgula.
- Menu: módulo Cadastros → "Tarifas", ícone sell.
```

## Teste
- [ ] Standard: Baixa 01/03–30/11 R$ 180,00 e Alta 01/12–28/02 R$ 260,00.
- [ ] Criar outra tarifa Standard cruzando 15/11–15/12 → recusada, citando a tarifa em conflito.
- [ ] /api/tarifas/vigente para Standard em 20/12 devolve R$ 260,00.
