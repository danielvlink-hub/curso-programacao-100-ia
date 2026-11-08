# 15 — Configurações

Dados da pousada e parâmetros usados pelas outras telas. Só administrador.

```
Crie a tela de Configurações do FastPousada (HTML/configuracoes.html), no padrão visual do curso. Só administrador.

BACKEND
- Tabela configuracoes: chave (PK), valor, alterado_em, alterado_por.
- Chaves: nome_pousada, documento (CNPJ/CPF), telefone, email, endereco, cidade, uf, horario_checkin (ex.: 14:00),
  horario_checkout (ex.: 12:00), minimo_diarias (1), permite_checkin_antecipado (0/1), texto_rodape_extrato.
- Rotas: GET /api/configuracoes (qualquer logado lê); PUT /api/configuracoes (só administrador; grava várias chaves
  numa transação; recusa chave desconhecida).
- Usar as chaves nas regras: minimo_diarias nas Reservas, horários no Check-in/Check-out, nome e rodapé no extrato.

FRONT-END
- Formulário em seções (Dados da pousada, Horários, Regras da operação, Extrato), campos de 22px, botão Gravar.
- CEP com busca automática pela rota pública que a API já tem (GET /api/cep/{cep}) preenchendo endereço/cidade/UF.
- Usuário comum vê a tela só para leitura (ou nem vê: módulo Administração é só do administrador no menu).
- Menu: módulo Administração → "Configurações", ícone settings.
```

## Teste
- [ ] Gravar nome e horários; reabrir a tela e conferir.
- [ ] Digitar um CEP válido preenche o endereço.
- [ ] minimo_diarias = 2 → reserva de 1 noite passa a ser recusada (prompt 07).
- [ ] Usuário comum não consegue gravar (a API responde 403).
