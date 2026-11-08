# 03 — Tipos de quarto e Quartos

Dois cadastros ligados: o tipo (Standard, Luxo, Suíte...) define capacidade; o quarto é a unidade física.

```
Crie os cadastros de Tipos de Quarto e de Quartos do FastPousada seguindo PROMPTS/01_PADRAO_BROWSE_UPDATE.md.

BACKEND
- Tabela quartos_tipos: id_tipo (PK), nome (obrigatório, único), capacidade (1 a 10), descricao, ativo.
- Tabela quartos: id_quarto (PK), numero (obrigatório, único, ex.: "101"), id_tipo (FK obrigatória), andar,
  situacao ('livre','ocupado','limpeza','manutencao'; padrão 'livre'), observacao, ativo.
- Rotas: /api/quartos-tipos e /api/quartos (GET lista, GET {id}, POST, PUT {id}, DELETE {id}).
  GET /api/quartos devolve também o nome do tipo e a capacidade (JOIN).
- Regras na API: não excluir tipo que tem quarto; não excluir quarto que tem reserva (inativar);
  situacao só aceita os 4 valores; numero não repete.

FRONT-END
- HTML/quartos_tipos.html + quartos_tipos_update.html; HTML/quartos.html + quartos_update.html.
- Quartos: colunas Número, Tipo, Capacidade, Andar, Situação (etiqueta colorida: livre verde, ocupado vermelho,
  limpeza amarelo, manutenção cinza), Ações. Filtro por situação e por tipo.
- No update do quarto, o Tipo é um combo com busca (ComboBusca.js) carregado de /api/quartos-tipos.
- Menu: módulo Cadastros → "Tipos de Quarto" (ícone category) e "Quartos" (ícone bed).
```

## Teste
- [ ] Criar tipos Standard (2) e Luxo (3); criar quartos 101 e 102 (Standard) e 201 (Luxo).
- [ ] Repetir o número 101 → recusado.
- [ ] Excluir o tipo Standard → recusado porque tem quartos.
- [ ] Filtro "livre" mostra só os livres.
