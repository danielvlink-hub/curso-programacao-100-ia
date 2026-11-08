# 01 — Padrão de tela de cadastro: Browse + Update separado (janela central)

Todo cadastro do FastPousada segue este padrão. Os prompts 02 a 06 apontam para cá.

**Modelos para abrir e copiar:**
- `HTML\modelo_browse.html` — lista com Tabulator: busca, filtro de situação, paginação, CSV, XLSX, recarregar,
  editar/excluir na linha, duplo clique altera.
- `HTML\modelo_browse_update.html` — formulário em arquivo SEPARADO, aberto num iframe dentro de uma janela
  flutuante CENTRALIZADA (fundo escuro, arrastável pela barra, ✕ à direita, Esc fecha).
- `HTML\assets\js\modelo_dados_demo.js` — dados de demonstração; na tela real é trocado pelo `ApiCurso.js`.

## Prompt

```
Crie o cadastro de <NOME> do FastPousada no padrão do curso (browse + update separado em janela central).

BACKEND (FacilApp API SQL, pasta "API FACILAPP SQLite"):
1. Tabela <tabela> no SQLite com os campos: <campos>. Crie na inicialização se não existir (sem apagar dados).
2. Rotas autenticadas (Bearer): GET /api/<recurso>, GET /api/<recurso>/{id}, POST /api/<recurso>,
   PUT /api/<recurso>/{id}, DELETE /api/<recurso>/{id}. Queries parametrizadas. Nada de rota SQL genérica.
3. Validação de verdade na API (obrigatórios, duplicados, valores negativos) devolvendo {ok:false, erro:"mensagem clara"}.
4. CORS igual às rotas /api/menu (telas abrem por file://). Documente no Swagger.
5. Compile, reinicie o serviço e teste cada rota no Swagger antes de ir para a tela.

FRONT-END (pasta HTML):
6. No ApiCurso.js: listar<X>, obter<X>, incluir<X>, alterar<X>, excluir<X> (mesmo padrão de listarUsuarios).
7. <arquivo>.html copiando o modelo_browse.html: troque título, ícone, colunas, busca e o nome do update.
8. <arquivo>_update.html copiando o modelo_browse_update.html: troque os campos e a validação.
   Troque DADOS_DEMO.x pelas funções do ApiCurso. Só avise FACILAPP_MODELO_GRAVADO depois que a API respondeu ok.
9. Cadastre a tela no menu pelo acessos.html (módulo <módulo>, ícone <ícone>).

PADRÃO OBRIGATÓRIO: HTML/JS puro; cores só --fa-* do TemaFacilApp.css; cabeçalho 35px; campos e linhas 22px;
✕ no canto direito; sem alert/confirm/prompt (usar FacilAppAviso e FacilAppConfirmar); comentário em cada função
(O QUE FAZ · COMO · ENTRADAS · SAÍDAS · DEPENDÊNCIAS · REGRAS · EFEITOS · CUIDADOS).

Mostre o plano curto antes de começar.
```

## Checklist de pronto

- [ ] Rotas testadas no Swagger (incluir, alterar, excluir, erro de validação).
- [ ] Browse abre pelo menu, lista, busca e exporta CSV/XLSX.
- [ ] Novo e Alterar abrem a janela no CENTRO; dá para arrastar; Esc e ✕ fecham.
- [ ] Gravar sem obrigatório mostra a mensagem e não grava.
- [ ] Depois de gravar, a lista recarrega sozinha e o registro aparece.
- [ ] Excluir pergunta antes (FacilAppConfirmar) e some da lista.
- [ ] Usuário comum sem permissão de Excluir (Usuários → Permissões) não consegue excluir.
