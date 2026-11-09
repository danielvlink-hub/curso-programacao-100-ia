/* ==========================================================================
   BotaoVoz.js — botão "VOZ" das telas do FastPousada: conversa FALADA ao vivo com a Luninha.

   PEDIDO (Daniel, 08/11/2026, aula gravada):
     "Crie o Botão VOZ, usando Live, conversa humana, ligue ele com os mesmos poderes da Luninha"
     "e se ficar sem falar por 30 segundos, desligar sozinho".

   O QUE FAZ
     Um clique em VOZ abre uma "ligação" com a Luninha: você fala, ela responde falando, em tempo real, e pode ser
     interrompida. Ela tem OS MESMOS PODERES do Botão IA (texto): as ferramentas da tela (pesquisar e filtrar a grade,
     cadastrar, alterar, excluir...) e as gerais (previsão do tempo, pesquisa na internet).

   COMO FUNCIONA
     1. O navegador pede o microfone e monta a conexão de áudio (WebRTC).
     2. A proposta de áudio (SDP) vai para a FacilApp API SQL (POST /api/ia/voz/conectar), que abre a conversa na OpenAI
        com a chave do SERVIDOR e devolve a resposta. A chave nunca passa pelo navegador.
     3. O áudio vai direto entre o navegador e a OpenAI. Os comandos passam pelo canal de dados "oai-events":
        - ao abrir: envia as ferramentas e as instruções da tela (as mesmas do Botão IA) e pede a saudação;
        - quando a IA chama uma ferramenta: QUEM EXECUTA É A TELA (mesmas funções do ApiCurso, login do usuário) e o
          resultado volta para a IA, que conta falando.
     4. CONFIRMAÇÃO POR VOZ: ferramenta que grava NÃO executa na hora. Aparece o cartão com o resumo e a IA pergunta
        "Confirma?". O usuário responde falando ("sim"/"não" → a IA chama confirmar_acao) ou clica no cartão.
        Excluir: cartão vermelho.
     5. 30 SEGUNDOS SEM CONVERSA → desliga sozinho (conta só quando ninguém está falando).

   ENTRADAS: BotaoVoz.ligarNaTela({ manifesto, aoConcluir }) — o mesmo manifesto do Botão IA (ex.: IAHospedes).
   DEPENDÊNCIAS: ApiCurso.js (vozConectar, iaStatus), BotaoIA.js (ferramentas, instruções e nome — mesmos poderes).
   REGRAS: sem modelo de voz configurado o botão fica desabilitado com a dica; em modo treinamento não aparece;
     nunca diálogo nativo do navegador; nunca a chave no JavaScript.
   CUIDADOS: a voz ao vivo cobra por minuto de áudio — Desligar (ou os 30 s sem fala) encerra a cobrança.
   ========================================================================== */
(function () {
  'use strict';
  if (window.BotaoVoz) return;

  var SILENCIO_MS = 30000;            // 30 s sem ninguém falar → desliga (pedido do Daniel)

  var estado = {
    manifesto: null, aoConcluir: null,
    pc: null, canal: null, microfone: null, audio: null,
    ligado: false, mudo: false,
    falandoIA: false, falandoUsuario: false, ultimaAtividade: 0, relogio: null,
    pendente: null,                    // ação que grava esperando "sim"/"não" { nome, f, p, cartao }
    janela: null, lista: null, status: null, btn: null, btnMudo: null
  };

  function el(tag, cls, texto) { var e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; }
  function nome() { return (window.BotaoIA && BotaoIA.nome()) || 'Luninha'; }

  // ---------------------------------------------------------------- estilo (cores --fa-*, espaço máx. 3px)
  /** injetarEstilo() — CSS da janelinha da ligação (uma vez por página). */
  function injetarEstilo() {
    if (document.getElementById('botaoVozEstilo')) return;
    var s = document.createElement('style');
    s.id = 'botaoVozEstilo';
    s.textContent = [
      '.voz-btn{width:auto !important;min-width:30px;padding:0 7px !important;margin-right:6px;font:800 11.5px/1 Arial,sans-serif !important;letter-spacing:.5px}',
      '.voz-btn[disabled]{opacity:.45;cursor:not-allowed}',
      '.voz-btn.no-ar{background:#b42318 !important;border-color:#b42318 !important;color:#fff !important}',
      '#vozJanela{position:fixed;left:12px;bottom:12px;width:min(340px,calc(100vw - 24px));max-height:min(420px,calc(100vh - 24px));z-index:2147482500;',
      ' display:none;flex-direction:column;background:var(--fa-panel,#fff);color:var(--fa-text,#1e293b);border:1px solid var(--fa-border,#d8ddcf);',
      ' border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.32);overflow:hidden;font:12.5px Roboto,"Segoe UI",sans-serif}',
      '#vozJanela.aberta{display:flex}',
      '#vozJanela .voz-cab{height:35px;flex:0 0 35px;display:flex;align-items:center;gap:6px;padding:0 8px 0 10px;background:var(--fa-panel-alt,#f1f5f9);border-bottom:1px solid var(--fa-border,#d8ddcf)}',
      '#vozJanela .voz-cab b{flex:1;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#vozJanela .voz-x{width:26px;height:26px;border-radius:6px;border:1px solid var(--fa-primary-dark,#35470e);background:var(--fa-primary,#4b5a32);',
      ' color:var(--fa-button-text,#fff);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font:700 16px/1 Arial,sans-serif;flex:0 0 26px}',
      '#vozJanela .voz-x:hover{background:#b42318;border-color:#b42318}',
      '#vozJanela .voz-bola{width:12px;height:12px;border-radius:50%;background:#9ca3af;flex:0 0 12px}',
      '#vozJanela .voz-bola.ouvindo{background:#16a34a;animation:vozPulso 1.2s infinite}',
      '#vozJanela .voz-bola.falando{background:var(--fa-primary,#4b5a32);animation:vozPulso .6s infinite}',
      '@keyframes vozPulso{0%{box-shadow:0 0 0 0 rgba(22,163,74,.6)}100%{box-shadow:0 0 0 9px rgba(22,163,74,0)}}',
      '#vozJanela .voz-status{font-size:11px;color:var(--fa-muted,#64748b);padding:3px 10px 0}',
      '#vozJanela .voz-lista{flex:1;min-height:60px;overflow-y:auto;padding:3px 8px;display:flex;flex-direction:column;gap:3px}',
      '#vozJanela .voz-msg{padding:4px 7px;border-radius:7px;white-space:pre-wrap;line-height:1.35}',
      '#vozJanela .voz-msg.ia{background:var(--fa-field-bg,#fff);border:1px solid var(--fa-border,#d8ddcf)}',
      '#vozJanela .voz-msg.nota{font-size:11px;color:var(--fa-muted,#64748b);text-align:center}',
      '#vozJanela .voz-msg.erro{background:#fde8e7;color:#9b1c1c}',
      '#vozJanela .voz-conf{border:1px solid var(--fa-border,#d8ddcf);border-radius:7px;padding:5px 7px;display:flex;flex-direction:column;gap:3px}',
      '#vozJanela .voz-conf.perigo{border-color:#b42318}',
      '#vozJanela .voz-conf .acoes,#vozJanela .voz-rod{display:flex;justify-content:flex-end;gap:6px}',
      '#vozJanela .voz-rod{padding:3px 8px;border-top:1px solid var(--fa-border,#d8ddcf)}',
      '#vozJanela .voz-b{height:24px;padding:0 10px;border-radius:5px;font-size:11.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px;',
      ' user-select:none;background:var(--fa-field-bg,#f1f5f9);color:var(--fa-text,#1e293b);border:1px solid var(--fa-border,#d8ddcf)}',
      '#vozJanela .voz-b .material-icons{font-size:16px}',
      '#vozJanela .voz-b.ok{background:var(--fa-button-bg,#4b5a32);color:var(--fa-button-text,#fff);border-color:var(--fa-button-bg,#4b5a32)}',
      '#vozJanela .voz-b.vermelho{background:#b42318;color:#fff;border-color:#b42318}',
      '#vozJanela .voz-b.feito{opacity:.5;pointer-events:none}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------- janelinha da ligação
  /** linha(texto, tipo) — escreve na legenda da ligação (tipo: ia | nota | erro). */
  function linha(texto, tipo) {
    if (!estado.lista) return null;
    var m = el('div', 'voz-msg ' + tipo, texto);
    estado.lista.appendChild(m);
    estado.lista.scrollTop = estado.lista.scrollHeight;
    return m;
  }

  /** situacao(texto, modo) — status da ligação + bolinha (modo: ouvindo | falando | ''). */
  function situacao(texto, modo) {
    if (!estado.status) return;
    estado.status.textContent = texto;
    estado.janela.querySelector('.voz-bola').className = 'voz-bola ' + (modo || '');
  }

  /** montarJanela() — cria a janelinha (uma vez): cabeçalho, status, legenda, Silenciar e Desligar. */
  function montarJanela() {
    injetarEstilo();
    var j = el('div'); j.id = 'vozJanela';
    var cab = el('div', 'voz-cab');
    // ✕ no cabeçalho: encerra a ligação e fecha a janela (Daniel, 08/11/2026: "a tela deve ter um botão X que fecha e
    // encerra a ligação do botão")
    var fecharJanela = el('div', 'voz-x', '×');
    fecharJanela.setAttribute('role', 'button');
    fecharJanela.tabIndex = 0;
    fecharJanela.title = 'Encerrar a ligação e fechar';
    fecharJanela.onclick = function () {
      if (estado.ligado) desligar('Ligação encerrada.');
      j.classList.remove('aberta');
    };
    cab.append(el('span', 'voz-bola'), el('b', null, nome() + ' • Voz • ' + estado.manifesto.titulo), fecharJanela);
    var status = el('div', 'voz-status', 'Conectando...');
    var lista = el('div', 'voz-lista');
    var rod = el('div', 'voz-rod');
    var mudo = el('div', 'voz-b'); mudo.innerHTML = '<span class="material-icons">mic_off</span>Silenciar';
    var desl = el('div', 'voz-b vermelho'); desl.innerHTML = '<span class="material-icons">call_end</span>Desligar';
    [mudo, desl].forEach(function (b) { b.setAttribute('role', 'button'); b.tabIndex = 0; });
    rod.append(mudo, desl);
    j.append(cab, status, lista, rod);
    document.body.appendChild(j);
    estado.janela = j; estado.lista = lista; estado.status = status; estado.btnMudo = mudo;
    mudo.onclick = alternarMudo;
    desl.onclick = function () { desligar('Ligação encerrada.'); };
  }

  /** alternarMudo() — liga/desliga o microfone sem encerrar a ligação. */
  function alternarMudo() {
    if (!estado.microfone) return;
    estado.mudo = !estado.mudo;
    estado.microfone.getAudioTracks().forEach(function (t) { t.enabled = !estado.mudo; });
    estado.btnMudo.innerHTML = estado.mudo ? '<span class="material-icons">mic</span>Ativar' : '<span class="material-icons">mic_off</span>Silenciar';
    situacao(estado.mudo ? 'Microfone silenciado.' : 'Ouvindo...', estado.mudo ? '' : 'ouvindo');
  }

  // ---------------------------------------------------------------- canal de dados (eventos da OpenAI)
  /** enviar(evento) — manda um evento pelo canal "oai-events". */
  function enviar(evento) {
    if (estado.canal && estado.canal.readyState === 'open') estado.canal.send(JSON.stringify(evento));
  }

  /** atividade() — alguém falou ou a IA respondeu: zera a contagem dos 30 segundos. */
  function atividade() { estado.ultimaAtividade = Date.now(); }

  /**
   * ferramentasParaVoz() — ferramentas da tela + gerais (as MESMAS do Botão IA) no formato da conversa ao vivo,
   * mais a confirmar_acao, usada quando o usuário responde "sim"/"não" à confirmação falada.
   */
  function ferramentasParaVoz() {
    var lista = BotaoIA.ferramentas(estado.manifesto);
    var saida = Object.keys(lista).map(function (n) {
      var f = lista[n], props = {};
      Object.keys(f.parametros || {}).forEach(function (c) {
        var v = f.parametros[c];
        props[c] = typeof v === 'string' ? { type: 'string', description: v } : v;
      });
      return { type: 'function', name: n, description: f.descricao || n,
        parameters: { type: 'object', properties: props, required: f.obrigatorios || [] } };
    });
    saida.push({ type: 'function', name: 'confirmar_acao',
      description: 'Use SÓ depois de perguntar "Confirma?" sobre uma ação AGUARDANDO CONFIRMAÇÃO: resposta "sim" executa, "nao" cancela.',
      parameters: { type: 'object', properties: { resposta: { type: 'string', enum: ['sim', 'nao'] } }, required: ['resposta'] } });
    return saida;
  }

  /** aoAbrirCanal() — manda as ferramentas e as instruções da tela e pede a saudação. */
  async function aoAbrirCanal() {
    enviar({ type: 'session.update', session: { type: 'realtime', tools: ferramentasParaVoz(), tool_choice: 'auto' } });
    var texto = await BotaoIA.instrucoes(estado.manifesto);
    // Na VOZ: conversa de verdade, curta; as ações ficam só aqui, internas (Daniel, 08/11/2026: "ela tem que estar
    // disponível para conversar e essas coisas ela guarda só internamente no prompt dela; caso alguém pergunte o que ela
    // pode fazer, ela fala resumidamente").
    texto += '\nNA CONVERSA POR VOZ: a lista de ações acima é só para você saber; NUNCA a leia nem liste por conta própria. ' +
      'Converse naturalmente, no máximo 2 frases por resposta. Só se perguntarem o que você faz, resuma em UMA frase ' +
      '(ex.: "cuido dos hóspedes da tela, pesquiso, vejo o tempo e converso com você").';
    enviar({ type: 'conversation.item.create', item: { type: 'message', role: 'system',
      content: [{ type: 'input_text', text: texto }] } });
    // saudação curtinha, sem listar nada
    enviar({ type: 'response.create', response: { instructions:
      'Diga só: "Oi! Sou a ' + nome() + '. Como posso ajudar?" — nada mais.' } });
    situacao('Ouvindo...', 'ouvindo');
    atividade();
  }

  /**
   * devolver(callId, resultado) — entrega o resultado de UMA ferramenta à IA (sem pedir resposta ainda).
   * REGRAS: quem pede a resposta é aoEvento, UMA vez só, depois de devolver todos os resultados da rodada.
   * (Daniel, 08/11/2026, no teste: ela repetia a resposta — cada resultado pedia uma resposta nova.)
   */
  function devolver(callId, resultado) {
    enviar({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId,
      output: (typeof resultado === 'string' ? resultado : JSON.stringify(resultado)).slice(0, 6000) } });
  }

  /**
   * microfoneAberto(sim) — abre/fecha o microfone sem desligar a ligação.
   * PARA QUE: enquanto a Luninha fala, o microfone fica mudo; senão a voz dela volta pelo microfone (eco — comum com
   * caixa de som e microfone virtual, ex.: NVIDIA Broadcast) e ela "ouve a si mesma" e repete a resposta.
   * Daniel, 08/11/2026, no teste: "você está repetindo bastante".
   */
  function microfoneAberto(sim) {
    if (!estado.microfone) return;
    var abrir = sim && !estado.mudo;
    estado.microfone.getAudioTracks().forEach(function (t) { t.enabled = abrir; });
  }

  /** executarDeVez(f, p) — roda a ferramenta (já confirmada) e recarrega a tela quando grava. */
  async function executarDeVez(f, p) {
    try {
      var r = await f.executar(p);
      if (f.grava && typeof estado.aoConcluir === 'function') { try { await estado.aoConcluir(); } catch (e) { /* tela segue */ } }
      return typeof r === 'string' ? r : JSON.stringify(r);
    } catch (erro) {
      linha(erro.message, 'erro');
      return 'ERRO da API (conte ao usuário): ' + erro.message;
    }
  }

  /**
   * cartaoConfirmacao(resumo, perigo) — cartão na janelinha (também dá para confirmar clicando).
   * O clique resolve a ação pendente e avisa a IA, que conta o resultado falando.
   */
  function cartaoConfirmacao(resumo, perigo) {
    var c = el('div', 'voz-conf' + (perigo ? ' perigo' : ''));
    c.appendChild(el('div', null, resumo));
    var acoes = el('div', 'acoes');
    var nao = el('div', 'voz-b', 'Cancelar'), sim = el('div', 'voz-b ' + (perigo ? 'vermelho' : 'ok'), perigo ? 'Excluir' : 'Confirmar');
    [nao, sim].forEach(function (b) { b.setAttribute('role', 'button'); b.tabIndex = 0; });
    nao.onclick = function () { resolverPendente(false, true); };
    sim.onclick = function () { resolverPendente(true, true); };
    acoes.append(nao, sim);
    c.appendChild(acoes);
    estado.lista.appendChild(c);
    estado.lista.scrollTop = estado.lista.scrollHeight;
    return c;
  }

  /**
   * resolverPendente(confirmou, peloClique) — executa ou cancela a ação que estava esperando confirmação.
   * SAÍDA: texto do resultado (para devolver à IA). peloClique = true → avisa a IA por mensagem do usuário.
   */
  async function resolverPendente(confirmou, peloClique) {
    var pend = estado.pendente;
    if (!pend) return 'Não há ação esperando confirmação.';
    estado.pendente = null;
    pend.cartao.querySelectorAll('.voz-b').forEach(function (b) { b.classList.add('feito'); });
    var resultado = confirmou ? await executarDeVez(pend.f, pend.p) : 'O usuário CANCELOU. Nada foi gravado.';
    if (!confirmou) linha('Cancelado: nada foi gravado.', 'nota');
    if (peloClique) {
      enviar({ type: 'conversation.item.create', item: { type: 'message', role: 'user',
        content: [{ type: 'input_text', text: (confirmou ? 'Confirmei pelo botão. ' : 'Cancelei pelo botão. ') + 'Resultado: ' + resultado }] } });
      enviar({ type: 'response.create' });
    }
    atividade();
    return resultado;
  }

  /**
   * chamadaDeFerramenta(nomeF, argumentos, callId) — a IA pediu uma ferramenta.
   * REGRAS: consulta executa na hora; o que grava vira "AGUARDANDO CONFIRMAÇÃO" (cartão + pergunta falada);
   *   confirmar_acao resolve a pendente; validar() devolve a pergunta quando falta dado.
   */
  async function chamadaDeFerramenta(nomeF, argumentos, callId) {
    var p = {};
    try { p = JSON.parse(argumentos || '{}') || {}; } catch (e) { devolver(callId, 'ERRO: parâmetros inválidos.'); return; }

    if (nomeF === 'confirmar_acao') {
      devolver(callId, await resolverPendente(String(p.resposta).toLowerCase() === 'sim', false));
      return;
    }
    var f = BotaoIA.ferramentas(estado.manifesto)[nomeF];
    if (!f) { devolver(callId, 'ERRO: ferramenta "' + nomeF + '" não existe nesta tela.'); return; }
    if (f.validar) {
      var falta = f.validar(p);
      if (falta) { devolver(callId, 'FALTA DADO (pergunte ao usuário, não grave): ' + falta); return; }
    }
    if (f.grava) {
      if (estado.pendente) resolverPendente(false, false);          // só uma confirmação por vez
      var resumo = f.resumo ? f.resumo(p) : nomeF;
      estado.pendente = { nome: nomeF, f: f, p: p, cartao: cartaoConfirmacao(resumo, !!f.exclui) };
      devolver(callId, 'AGUARDANDO CONFIRMAÇÃO. Leia em voz alta, curto: "' + resumo.replace(/\n/g, '; ') +
        '". Pergunte "Confirma?" e chame confirmar_acao com a resposta.' + (f.exclui ? ' Atenção: é uma EXCLUSÃO.' : ''));
      return;
    }
    devolver(callId, await executarDeVez(f, p));
  }

  /**
   * responderFerramentas(chamadas) — executa, EM ORDEM, todas as ferramentas que a IA pediu numa resposta, devolve os
   * resultados e só então pede UMA resposta falada (antes pedia uma por ferramenta e ela repetia).
   */
  async function responderFerramentas(chamadas) {
    if (!chamadas.length) return;
    for (var i = 0; i < chamadas.length; i++) {
      await chamadaDeFerramenta(chamadas[i].name, chamadas[i].arguments, chamadas[i].call_id);
    }
    enviar({ type: 'response.create' });
  }

  /**
   * aoEvento(e) — eventos da conversa ao vivo (canal "oai-events").
   * Usa: fala do usuário (início/fim), fala da IA (início/fim/legenda), resposta pronta (com chamadas de ferramenta), erro.
   */
  function aoEvento(e) {
    // depois de desligar, eventos atrasados não mexem mais na janela (antes voltava a mostrar "Ouvindo...")
    if (!estado.ligado && estado.canal === null) return;
    var ev;
    try { ev = JSON.parse(e.data); } catch (x) { return; }
    switch (ev.type) {
      case 'input_audio_buffer.speech_started':
        estado.falandoUsuario = true; atividade(); situacao('Ouvindo você...', 'ouvindo'); break;
      case 'input_audio_buffer.speech_stopped':
        estado.falandoUsuario = false; atividade(); situacao('Pensando...', ''); break;
      case 'output_audio_buffer.started':
        // ela começou a falar: microfone mudo (evita o eco que a fazia repetir)
        estado.falandoIA = true; atividade(); microfoneAberto(false); situacao(nome() + ' falando...', 'falando'); break;
      case 'response.created':
        estado.falandoIA = true; atividade(); situacao(nome() + ' pensando...', 'falando'); break;
      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared':
        // terminou de falar: reabre o microfone com uma pequena folga (o som da caixa ainda está no ar)
        estado.falandoIA = false; atividade(); situacao('Ouvindo...', 'ouvindo');
        setTimeout(function () { if (estado.ligado && !estado.falandoIA) microfoneAberto(true); }, 400);
        break;
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
        if (ev.transcript) linha(ev.transcript, 'ia');
        break;
      case 'response.done':
        atividade();
        responderFerramentas(((ev.response && ev.response.output) || []).filter(function (item) { return item.type === 'function_call'; }));
        break;
      case 'error':
        linha((ev.error && ev.error.message) || 'Erro na conversa por voz.', 'erro');
        break;
    }
  }

  // ---------------------------------------------------------------- ligar / desligar
  /**
   * ligar() — pede o microfone, monta a conexão de áudio e abre a conversa pela API.
   * EFEITOS: começa a cobrar minutos de áudio na OpenAI até desligar.
   */
  async function ligar() {
    if (estado.ligado) return;
    if (!estado.janela) montarJanela();
    estado.janela.classList.add('aberta');
    estado.lista.innerHTML = '';
    situacao('Pedindo o microfone...', '');
    try {
      // cancelamento de eco, redução de ruído e ganho automático pedidos explicitamente (ajuda contra a repetição)
      estado.microfone = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
    } catch (e) {
      linha('Sem acesso ao microfone. Libere o microfone para esta página no navegador e tente de novo.', 'erro');
      situacao('Microfone bloqueado.', '');
      return;
    }
    try {
      situacao('Conectando...', '');
      var pc = new RTCPeerConnection();
      estado.pc = pc;
      estado.audio = estado.audio || el('audio');
      estado.audio.autoplay = true;
      pc.ontrack = function (ev) { estado.audio.srcObject = ev.streams[0]; };
      estado.microfone.getTracks().forEach(function (t) { pc.addTrack(t, estado.microfone); });
      estado.canal = pc.createDataChannel('oai-events');
      estado.canal.onopen = aoAbrirCanal;
      estado.canal.onmessage = aoEvento;
      pc.onconnectionstatechange = function () {
        if (['failed', 'disconnected'].indexOf(pc.connectionState) >= 0 && estado.ligado) desligar('A conexão de voz caiu.');
      };
      var oferta = await pc.createOffer();
      await pc.setLocalDescription(oferta);
      var r = await ApiCurso.vozConectar(oferta.sdp, estado.manifesto.titulo);
      await pc.setRemoteDescription({ type: 'answer', sdp: r.sdp });
      estado.ligado = true;
      estado.btn.classList.add('no-ar');
      estado.btn.title = 'Desligar a conversa por voz';
      atividade();
      // 30 s sem ninguém falar → desliga (Daniel, 08/11/2026)
      estado.relogio = setInterval(function () {
        if (!estado.ligado || estado.falandoIA || estado.falandoUsuario) return;
        if (Date.now() - estado.ultimaAtividade > SILENCIO_MS) desligar('Desliguei sozinha: 30 segundos sem conversa.');
      }, 1000);
    } catch (erro) {
      linha(erro.message || 'Não foi possível abrir a conversa por voz.', 'erro');
      desligar(null);
    }
  }

  /** desligar(motivo) — encerra a ligação (para a cobrança), solta o microfone e cancela confirmação pendente. */
  function desligar(motivo) {
    if (estado.pendente) { estado.pendente.cartao.querySelectorAll('.voz-b').forEach(function (b) { b.classList.add('feito'); }); estado.pendente = null; }
    if (estado.relogio) { clearInterval(estado.relogio); estado.relogio = null; }
    try { if (estado.canal) estado.canal.close(); } catch (e) { /* já fechado */ }
    try { if (estado.pc) estado.pc.close(); } catch (e) { /* já fechado */ }
    if (estado.microfone) estado.microfone.getTracks().forEach(function (t) { t.stop(); });
    estado.pc = null; estado.canal = null; estado.microfone = null;
    estado.ligado = false; estado.mudo = false; estado.falandoIA = false; estado.falandoUsuario = false;
    if (estado.btn) { estado.btn.classList.remove('no-ar'); estado.btn.title = 'Conversar falando com a ' + nome(); }
    if (motivo) linha(motivo, 'nota');
    situacao('Desligado.', '');
  }

  // ---------------------------------------------------------------- botão no cabeçalho
  /**
   * ligarNaTela(cfg) — cria o botão VOZ logo depois do IA (grupo IA VOZ ? ✕).
   * cfg: { manifesto (o mesmo do Botão IA), aoConcluir }. Precisa do BotaoIA já ligado na tela.
   */
  async function ligarNaTela(cfg) {
    if (window.__FACILAPP_TREINAMENTO || !window.BotaoIA) return null;
    estado.manifesto = cfg.manifesto;
    estado.aoConcluir = cfg.aoConcluir || null;
    var ia = BotaoIA.botao();
    if (!ia || !ia.parentNode) return null;
    injetarEstilo();
    var b = document.createElement('button');
    b.type = 'button';
    b.className = ia.className.replace('ia-btn', '').trim() + ' voz-btn';
    b.textContent = 'VOZ';
    b.title = 'Conversar falando com a ' + nome();
    ia.parentNode.insertBefore(b, ia.nextSibling);
    estado.btn = b;
    b.onclick = function () { if (estado.ligado) desligar('Ligação encerrada.'); else ligar(); };
    if (!window.RTCPeerConnection || !navigator.mediaDevices) {
      b.disabled = true; b.title = 'Este navegador não faz conversa por voz. Use o Chrome ou o Edge.';
      return b;
    }
    try {
      var st = await ApiCurso.iaStatus();
      if (!st.voz_configurada) {
        b.disabled = true;
        b.title = 'Voz desligada: um administrador escolhe o modelo de voz em Administração → Inteligência Artificial.';
      }
    } catch (e) { b.disabled = true; b.title = 'Voz indisponível: ' + e.message; }
    window.addEventListener('beforeunload', function () { if (estado.ligado) desligar(null); });
    return b;
  }

  window.BotaoVoz = { ligarNaTela: ligarNaTela, ligar: ligar, desligar: desligar };
})();
