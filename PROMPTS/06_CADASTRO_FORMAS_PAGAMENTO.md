# 06 — Formas de pagamento

Usadas no Check-out, nos Recebimentos e no Caixa.

```
Crie o cadastro de Formas de Pagamento do FastPousada seguindo PROMPTS/01_PADRAO_BROWSE_UPDATE.md.

BACKEND
- Tabela formas_pagamento: id_forma (PK), descricao (obrigatória, única), tipo ('dinheiro','pix','debito',
  'credito','transferencia','outro'), aceita_troco (1 só para dinheiro), dias_para_receber (0 = na hora), ativo.
- Carga inicial (só se a tabela estiver vazia): Dinheiro, PIX, Cartão de Débito, Cartão de Crédito.
- Rotas: /api/formas-pagamento (CRUD).
- Regras na API: aceita_troco só quando tipo = 'dinheiro'; não excluir forma já usada em recebimento (inativar).

FRONT-END
- HTML/formas_pagamento.html + formas_pagamento_update.html.
- Colunas: Descrição, Tipo, Aceita troco, Dias para receber, Situação, Ações.
- Update: Descrição*, Tipo*, Aceita troco (habilitado só para dinheiro), Dias para receber, Ativo.
- Menu: módulo Cadastros → "Formas de Pagamento", ícone payments.
```

## Teste
- [ ] As 4 formas da carga inicial aparecem na primeira abertura.
- [ ] Marcar "aceita troco" em PIX → a tela não deixa e a API recusa.
- [ ] Incluir "Vale-viagem" (tipo outro, 30 dias).
