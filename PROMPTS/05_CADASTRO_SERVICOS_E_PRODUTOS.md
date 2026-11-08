# 05 — Serviços e produtos

O que pode ser lançado na conta do hóspede durante a estadia (frigobar, lavanderia, passeio...).

```
Crie o cadastro de Serviços e Produtos do FastPousada seguindo PROMPTS/01_PADRAO_BROWSE_UPDATE.md.

BACKEND
- Tabela servicos_produtos: id_item (PK), descricao (obrigatória, única), tipo ('servico' ou 'produto'),
  categoria (ex.: Frigobar, Lavanderia, Passeio), preco (>= 0), unidade (UN, KG, PCT...), ativo.
- Rotas: /api/servicos-produtos (CRUD); GET aceita ?tipo= e ?busca=.
- Regras na API: descrição única; preço não negativo; não excluir item já lançado em consumo (inativar).

FRONT-END
- HTML/servicos_produtos.html + servicos_produtos_update.html.
- Colunas: Descrição, Tipo, Categoria, Preço (R$), Unidade, Situação, Ações. Filtro por tipo e categoria.
- Update: Descrição*, Tipo* (Serviço/Produto), Categoria (ComboBusca com as categorias já usadas, aceita nova),
  Preço*, Unidade, Ativo.
- Menu: módulo Cadastros → "Serviços e Produtos", ícone room_service.
```

## Teste
- [ ] Cadastrar "Água mineral 500 ml" (produto, Frigobar, R$ 6,00) e "Lavagem de roupa" (serviço, Lavanderia, R$ 35,00).
- [ ] Preço negativo → recusado.
- [ ] Filtro "serviço" mostra só a lavagem.
