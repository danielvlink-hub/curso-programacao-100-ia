# 02 — Cadastro de Hóspedes

Primeira tela de verdade do FastPousada. Base para Reservas, Check-in e Check-out.

```
Crie o cadastro de Hóspedes do FastPousada seguindo PROMPTS/01_PADRAO_BROWSE_UPDATE.md.
O modelo HTML/modelo_browse.html já é um browse de hóspedes com dados de demonstração: transforme-o na tela real.

BACKEND
- Tabela hospedes: id_hospede (PK), nome (obrigatório), documento (CPF/RG/passaporte), telefone (obrigatório),
  email, data_nascimento, cidade, uf, observacao, ativo (1), criado_em, alterado_em.
- Rotas: GET/POST /api/hospedes, GET/PUT/DELETE /api/hospedes/{id}. GET aceita ?busca= (nome, documento, telefone).
- Regras na API: nome com 3+ letras; telefone com DDD (10+ dígitos); documento não pode repetir entre hóspedes;
  e-mail válido quando informado; não excluir hóspede que já tem reserva (responder "inativar em vez de excluir").

FRONT-END
- HTML/hospedes.html (do modelo_browse.html) e HTML/hospedes_update.html (do modelo_browse_update.html).
- Colunas: Nome, Documento, Telefone, Cidade/UF, Situação, Ações. Busca por nome, documento, telefone ou cidade.
- Update: Nome*, Ativo, Documento, Telefone*, E-mail, Nascimento, Cidade, UF, Observação.
- Menu: módulo Cadastros, item "Hóspedes", ícone person, arquivo hospedes.html (no acessos.html).
```

## Teste
- [ ] Incluir "Maria da Silva", telefone (15) 99700-1234 → aparece na lista.
- [ ] Incluir outro com o mesmo documento → a API recusa com mensagem clara.
- [ ] Sem telefone → mensagem no campo, nada gravado.
- [ ] Busca "maria" e busca por parte do telefone funcionam.
