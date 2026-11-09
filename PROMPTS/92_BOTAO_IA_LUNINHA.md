# 92 — Botão IA: a Luninha (prompt final da aula)

Construído ao vivo na aula de 08/11/2026, depois do cadastro de Hóspedes (prompt 02). Este prompt já traz tudo o que foi
pedido e ajustado na gravação: copie, cole no Claude Code e acompanhe.

**O que você vai ter no fim:** a Luninha no cabeçalho da tela de Hóspedes. Você escreve ou fala e ela pesquisa, filtra,
cadastra, altera, exclui (sempre com Confirmar), conversa livremente, vê a previsão do tempo e pesquisa na internet.
A chave da OpenAI fica só no servidor. Erros e falhas vão para um arquivo .log.

| Arquivo | O que é |
|---|---|
| `API FACILAPP SQLite\IA.cs` | chave + modelo + nome guardados criptografados; conversa; previsão do tempo; pesquisa na internet |
| `API FACILAPP SQLite\LogArquivo.cs` | log diário de erros e falhas (`ProgramData\FacilApp\CursoApiSqlite\logs`) |
| `API FACILAPP SQLite\wwwroot\index.html` | console da API: seções "Inteligência Artificial (OpenAI)" e "Logs" |
| `HTML\ConfigIA.html` | Administração → Inteligência Artificial (mesma configuração pelo sistema) |
| `HTML\assets\js\BotaoIA.js` | o botão e a janela de conversa (serve para qualquer tela) |
| `HTML\assets\js\IAHospedes.js` | o que a Luninha pode fazer na tela de Hóspedes |

## Antes de colar
1. Cadastro de Hóspedes pronto (prompt 02) e .NET 10 SDK instalado.
2. Uma chave da OpenAI (platform.openai.com). Sem ela tudo funciona; só o Botão IA fica desligado.

## O prompt

```
Crie o Botão IA do FastPousada, com a assistente chamada Luninha, ligado na tela BrowseHospedes.html.
Use SOMENTE a FacilApp API SQL do curso (porta 7777). Mostre um plano curto e espere o meu "pode".

=== PARTE 1 — Chave da OpenAI só no servidor (IA.cs) ===
1. Guarde chave, modelo e nome da assistente em ProgramData\FacilApp\CursoApiSqlite\ia.config.dpapi, criptografados
   pelo Windows (DPAPI), igual à chave dos tokens. A chave NUNCA volta para tela, log ou banco (só os 4 últimos dígitos).
   Nome padrão: "Luninha".
2. Rotas: GET /api/ia/status (logado: configurada, modelo, nome); GET/PUT/DELETE /api/ia/config (só administrador;
   chave vazia no PUT mantém a atual); POST /api/ia/testar (só administrador: consulta a OpenAI e lista os modelos da
   conta, tirando os de áudio, imagem, transcrição, embedding e moderação — NÃO filtre pelo prefixo "gpt").
3. Provedor atrás de uma interface IProvedorIA (hoje OpenAiProvedor), para trocar de provedor no futuro.
4. CORS: inclua /api/ia no bloco que libera o Origin "null" no Program.cs.

=== PARTE 2 — Onde cadastrar ===
5. Console da API (wwwroot/index.html, mesma cópia em TesteDaApi.html): seção "Inteligência Artificial (OpenAI)"
   SEMPRE visível, travada até o login de administrador: Chave (campo senha), Nome da assistente (Luninha),
   Modelo (digita ou escolhe), Testar chave (mostra a lista de modelos para CLICAR e o erro em vermelho ali mesmo;
   se houver modelo com "luna" no nome, já escolhe), Gravar e Remover chave.
6. No sistema: HTML/ConfigIA.html (Administração → Inteligência Artificial, item "adm_ia", ícone smart_toy), com os
   mesmos campos. Funções no ApiCurso.js: iaStatus, iaConfig, salvarIaConfig(chave, modelo, nome), apagarIaConfig,
   testarIa, iaConversar, previsaoTempo, pesquisarInternet.

=== PARTE 3 — A conversa (POST /api/ia/chat) ===
7. A tela manda a conversa e as ferramentas; a API acrescenta as regras ("Seu nome é <nome>", conversa natural e livre,
   dados só pelas ferramentas, perguntar quando faltar dado, gravar só com o Confirmar da tela) e repassa à OpenAI
   (chat/completions com tools). Limites: 40 mensagens, 20 ferramentas, 60 s.
8. Modelos que "raciocinam" (ex.: gpt-6-luna) recusam ferramentas com reasoning_effort: se a OpenAI responder esse
   erro, repita na hora com reasoning_effort "none" e lembre disso para o modelo (linha INFO no log).
9. Mensagens de erro em português: chave recusada, limite/crédito esgotado, sem internet, demora.

=== PARTE 4 — Ferramentas gerais (valem em todas as telas) ===
10. previsao_tempo {cidade, dias}: GET /api/ia/tempo pelo Open-Meteo (gratuito, sem chave): geocoding + previsão
    diária (até 7 dias) com descrição em português, mínima, máxima e chance de chuva.
11. pesquisar_internet {pergunta}: POST /api/ia/pesquisar usando a pesquisa na web da OpenAI (API responses, ferramenta
    web_search), devolvendo a resposta e as fontes. Se o modelo não aceitar, diga isso claramente.

=== PARTE 5 — O botão e a janela (BotaoIA.js, genérico) ===
12. Botão "IA" no cabeçalho, no grupo IA ? ✕ (junto do "?" do treinamento), com a dica "Conversar com a <nome>".
    Sem chave: desabilitado, com a dica de onde cadastrar. Em modo treinamento, não aparece.
13. Janela flutuante (arrastável) "<nome> • <tela>": saudação "Olá! Sou a <nome>, a IA da tela de ...", conversa,
    campo de texto (Enter envia), microfone (pt-BR) e Nova conversa. Espaço máximo de 3px entre blocos.
14. Laço: até 6 rodadas por pedido. A IA escolhe a ferramenta; QUEM EXECUTA É A TELA, com as funções do ApiCurso e o
    login do usuário. Ferramenta que grava mostra o resumo com Confirmar/Cancelar (excluir em vermelho); "pensando..."
    some enquanto espera a confirmação. Depois de gravar, recarrega a grade.
15. As instruções da tela listam as ações dela: se o usuário perguntar "o que você pode fazer?", a Luninha explica
    cada ação com um exemplo de pedido.

=== PARTE 6 — A tela de Hóspedes (IAHospedes.js) ===
16. Ferramentas: listar_hospedes (APLICA o filtro na grade da tela), limpar_filtros, obter_hospede, incluir_hospede,
    alterar_hospede (só os campos que mudam; inclui ativar/inativar), excluir_hospede, cadastrar_empresa_cnpj,
    exportar_lista (xlsx/csv) e abrir_relatorio. Para alterar/excluir, achar o id com listar_hospedes antes; nome
    repetido → perguntar qual. Completar o endereço pelo CEP quando vier só o CEP. Conferir na API antes de dizer "feito".
17. No BrowseHospedes.html: scripts BotaoIA.js e IAHospedes.js depois do ApiCurso.js e
    window.addEventListener('load', () => BotaoIA.ligarNaTela({ manifesto: IAHospedes })).

=== PARTE 7 — Logs de erros e falhas (LogArquivo.cs) ===
18. Arquivo por dia em ProgramData\FacilApp\CursoApiSqlite\logs\api-AAAA-MM-DD.log, guardando 30 dias, escrito por
    uma fila em segundo plano (sem pacote novo). Uma linha por evento: RECUSA/ERRO (método, rota sem a query, status,
    tempo, id do usuário e a mensagem "erro" da API), FALHA (exceção), AVISO (do ASP.NET), INFO (API iniciando/parando).
19. NUNCA grava senha, token, chave, corpo das requisições nem a query string; filtro que oculta texto parecido com
    chave/token. Rota GET /api/logs?dia= (só administrador) e seção "Logs" no console.

=== FIM ===
20. Teste numa cópia da API em outra porta com banco temporário (chave ausente, chave falsa recusada pela OpenAI,
    arquivo da chave sem a chave em texto, CORS, menu, previsão do tempo, log sem senha/token/chave). Publique,
    me peça para rodar PS1\atualizar_servico_7777.ps1 como administrador (o script espera o serviço fechar antes de
    copiar) e confira o 7777. Atualize o PROMPTS/90 (Parte 2) com o padrão final.
PADRÃO: HTML/JS puros, cores --fa-*, nunca alert/confirm/prompt, comentário em cada função, backup fora da pasta da API.
```

## Conferir no fim
- [ ] Console da API: login → seção da IA destrava → Testar chave lista os modelos → escolher o Luna → Gravar →
      "IA ligada · Luninha · modelo ...".
- [ ] Hóspedes (Ctrl+F5): botão IA habilitado; a janela abre como "Luninha • Hóspedes".
- [ ] "o que você pode fazer?" → lista as ações com exemplos.
- [ ] "mostra só as empresas" → a grade filtra.
- [ ] "cadastra a Ana Lima, telefone 15 99123-4567, de Sorocaba" → resumo → Confirmar → aparece na lista.
- [ ] "inativa a Ana" → resumo → Confirmar. "exclui a Ana" → confirmação vermelha. Cancelar → nada grava.
- [ ] "como vai estar o tempo em Sorocaba amanhã?" e "pesquisa os eventos de Sorocaba neste fim de semana".
- [ ] Console → Logs → Ver log do dia: os erros aparecem, sem nenhuma senha, token ou chave.
