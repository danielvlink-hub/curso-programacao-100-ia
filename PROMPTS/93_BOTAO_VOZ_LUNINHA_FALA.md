# 93 — Botão VOZ: a Luninha fala (prompt final da aula)

Construído ao vivo na aula de 08/11/2026, depois do Botão IA (prompt 92). Este prompt já traz tudo o que foi pedido e
ajustado na gravação — inclusive os problemas reais do teste (modelo errado, fala demais, repetição por eco).

**O que você vai ter no fim:** o botão **VOZ** no cabeçalho da tela de Hóspedes. Um clique abre uma "ligação" com a
Luninha: você fala, ela responde falando, em tempo real, com os MESMOS poderes do Botão IA (filtrar a grade, cadastrar,
alterar, excluir com confirmação, previsão do tempo, pesquisa na internet). Desliga sozinha após 30 s sem conversa.

| Arquivo | O que é |
|---|---|
| `API FACILAPP SQLite\IA.cs` | modelo de voz e voz na configuração + rota `/api/ia/voz/conectar` |
| `API FACILAPP SQLite\wwwroot\index.html` e `HTML\ConfigIA.html` | campos "Modelo de voz" e "Voz" |
| `HTML\assets\js\BotaoVoz.js` | o botão, a "ligação" (WebRTC) e a janelinha com Silenciar/Desligar |
| `HTML\assets\js\BotaoIA.js` | passa a emprestar ferramentas, instruções e nome ao VOZ (mesmos poderes, sem código repetido) |

## Antes de colar
1. Botão IA pronto (prompt 92) e a chave da OpenAI gravada.
2. Chrome ou Edge com microfone. A voz ao vivo cobra por minuto de áudio na OpenAI.

## O prompt

```
Crie o Botão VOZ do FastPousada: conversa FALADA ao vivo com a Luninha, com os MESMOS poderes do Botão IA, ligado na
tela BrowseHospedes.html. Use SOMENTE a FacilApp API SQL do curso (porta 7777). Mostre um plano curto e espere o "pode".
Comente cada função como um prompt (O QUE FAZ, ENTRADAS, SAÍDAS, REGRAS, CUIDADOS + o pedido) e indente para humanos.

=== PARTE 1 — Configuração (IA.cs, console da API e ConfigIA.html) ===
1. Acrescente "modelo de voz" e "voz" (padrão marin) à configuração criptografada da IA. Campos vazios mantêm o valor.
2. POST /api/ia/testar devolve também modelos_voz (ids com "realtime" ou "live"). Na escolha automática, PREFIRA um
   modelo com "realtime" no nome (no teste, o gpt-live-1 respondeu "not supported in realtime mode").
3. GET /api/ia/status devolve voz_configurada. Campos "Modelo de voz" (sugestões da conta) e "Voz" (marin, cedar,
   coral, sage, shimmer, alloy, ash, ballad, echo, verse) no console da API e na tela Inteligência Artificial.

=== PARTE 2 — Abrir a ligação sem expor a chave (POST /api/ia/voz/conectar) ===
4. O navegador manda a proposta de áudio (SDP). A API repassa à OpenAI (POST /v1/realtime/calls, multipart com "sdp" e
   "session" {type realtime, model, instructions, audio.output.voice}) com a chave do SERVIDOR e devolve o SDP de
   resposta. A chave nunca vai ao navegador, nem temporária. O áudio passa direto navegador ↔ OpenAI (WebRTC).
5. Instruções da voz (no servidor): "Seu nome é <nome>", as regras do Botão IA e mais: conversa natural, NO MÁXIMO 2
   FRASES, nunca repetir resposta, NUNCA listar as capacidades por conta própria (ficam só internas); se perguntarem o
   que faz, resumir em UMA frase; confirmação falada (ver Parte 4).
6. Erros em português (sem modelo de voz, SDP inválido, chave recusada, modelo que não serve no modo realtime → dizer
   para escolher um "realtime"), todos no .log.

=== PARTE 3 — BotaoVoz.js (genérico, igual ao BotaoIA) ===
7. Botão "VOZ" logo depois do IA (grupo IA VOZ ? ✕). Sem voz configurada ou navegador sem WebRTC: desabilitado com a
   dica. Em modo treinamento: não aparece. Durante a ligação fica vermelho (clique desliga).
8. Ligar: getUserMedia com echoCancellation, noiseSuppression e autoGainControl; RTCPeerConnection; canal de dados
   "oai-events"; oferta → ApiCurso.vozConectar → resposta. Janelinha "<nome> • Voz • <tela>" com bolinha
   (ouvindo/falando), status, legenda do que ela fala, Silenciar e Desligar.
9. Ao abrir o canal: session.update com as ferramentas (as MESMAS do BotaoIA: BotaoIA.ferramentas(manifesto)) + a
   ferramenta confirmar_acao; mensagem de sistema com BotaoIA.instrucoes(manifesto) dizendo que a lista de ações é só
   interna; saudação: só "Oi! Sou a <nome>. Como posso ajudar?".
10. Ferramentas: em response.done, execute EM ORDEM todas as chamadas, devolva cada resultado (function_call_output) e
    peça UMA resposta só (response.create) — pedir uma por resultado fazia ela repetir.
11. ANTI-ECO: microfone mudo enquanto ela fala (output_audio_buffer.started) e reaberto 400 ms depois que ela termina
    (output_audio_buffer.stopped/cleared). Sem isso, a voz dela volta pelo microfone e ela repete.
12. 30 SEGUNDOS SEM CONVERSA → desliga sozinha ("Desliguei sozinha: 30 segundos sem conversa"); a contagem para
    enquanto alguém fala. Desligar solta o microfone e encerra a cobrança; fechar a página também desliga.

=== PARTE 4 — Confirmação por voz ===
13. Ferramenta que grava não executa na hora: aparece o cartão com o resumo (excluir em vermelho) e a IA recebe
    "AGUARDANDO CONFIRMAÇÃO ... pergunte Confirma? e chame confirmar_acao". "sim" executa (com o login do usuário e
    recarregando a grade), "não" cancela. Clicar no cartão também resolve e avisa a IA, que conta o resultado.

=== PARTE 5 — Tela e teste ===
14. No BrowseHospedes.html: <script src="assets/js/BotaoVoz.js"> depois do IAHospedes.js e, no load,
    await BotaoIA.ligarNaTela({ manifesto: IAHospedes }); depois BotaoVoz.ligarNaTela({ manifesto: IAHospedes }).
15. Teste a rota numa cópia da API (sem voz 409, SDP inválido 400, chave falsa recusada, sem token 401, nada da chave
    no log), publique, me peça para rodar o PS1 do serviço e me oriente a escolher o modelo de voz e testar falando.
```

## Conferir no fim
- [ ] Console da API: Testar chave → "Modelos de VOZ: ..." → Modelo de voz com "realtime" → Gravar → "voz ... (marin)".
- [ ] Hóspedes (Ctrl+F5): botões IA · VOZ · ✕; o VOZ habilitado.
- [ ] VOZ → permitir o microfone → "Oi! Sou a Luninha. Como posso ajudar?" (só isso).
- [ ] Bater papo: respostas curtas, sem repetir e sem listar o que sabe fazer.
- [ ] "O que você faz?" → resposta de uma frase.
- [ ] "Vai chover hoje em Itaberá?" → previsão falada, uma vez só.
- [ ] "Mostra só as empresas" → a grade filtra. "Cadastra a Ana Lima, telefone 15 99123-4567" → cartão + "Confirma?" → "sim".
- [ ] Ficar 30 segundos calado → desliga sozinha. Desligar → o botão volta ao normal.
