/* ==========================================================================
   BotaoIA.js — botão "IA" das telas do FastPousada: conversa (texto ou voz) e a IA executa o que a TELA permite.
   Daniel, 08/11/2026 (aula gravada): "Botão IA ... é nada mais do que a conversa com a IA, e ela executa o CRUD,
   listagens e filtros solicitados".

   COMO FUNCIONA
     1. A tela chama BotaoIA.ligarNaTela({ manifesto, aoConcluir }). O manifesto (ex.: IAHospedes.js) diz o que a tela
        faz e quais FERRAMENTAS a IA pode usar (listar, incluir, alterar, excluir, filtrar, exportar...).
     2. O botão IA aparece no cabeçalho, no grupo IA ? ✕. Sem chave cadastrada na API, ele fica desabilitado com a dica.
     3. A conversa vai para a FacilApp API SQL (POST /api/ia/chat), que repassa à OpenAI com a chave guardada lá.
        A IA devolve um texto ou "chame a ferramenta X com estes dados".
     4. QUEM EXECUTA É A TELA, com as mesmas funções do ApiCurso e o login do usuário (as permissões e regras
        continuam na API). Ferramenta que grava mostra o RESUMO e só executa depois do Confirmar; excluir pede
        confirmação em vermelho. O resultado volta para a IA, que conta ao usuário.
   FORMATO DE UMA FERRAMENTA (no manifesto)
     nome: { descricao, parametros: { campo: 'explicação' | { type, description, enum } }, obrigatorios: [...],
             grava: true|false, exclui?: true, validar?(p) -> 'pergunta' | '', resumo?(p) -> texto,
             executar(p) -> texto ou objeto (vai para a IA) }
   REGRAS: nunca diálogo nativo do navegador; nunca a chave da IA no JavaScript; em modo treinamento o botão não aparece.
   CUIDADOS: no máximo 6 rodadas por pedido (evita laço); conversa longa pede "Nova conversa".
   ========================================================================== */
(function () {
  'use strict';
  if (window.BotaoIA) return;

  var MAX_RODADAS = 6, MAX_MENSAGENS = 36;
  // nome = nome da assistente gravado na API (Daniel, 08/11/2026: "dê o nome de Luninha")
  var estado = { manifesto: null, aoConcluir: null, mensagens: [], ocupado: false, janela: null, lista: null, campo: null, btn: null, nome: 'Luninha' };

  function el(tag, cls, texto) { var e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; }

  // ---------------------------------------------------------------- estilo (cores só --fa-*, espaço máx. 3px)
  function injetarEstilo() {
    if (document.getElementById('botaoIaEstilo')) return;
    var s = document.createElement('style'); s.id = 'botaoIaEstilo';
    s.textContent = [
      '.ia-btn{width:auto !important;min-width:30px;padding:0 7px !important;margin-right:6px;font:800 11.5px/1 Arial,sans-serif !important;letter-spacing:.5px}',
      '.ia-btn[disabled]{opacity:.45;cursor:not-allowed}',
      '#iaJanela{position:fixed;right:12px;bottom:12px;width:min(400px,calc(100vw - 24px));height:min(520px,calc(100vh - 24px));z-index:2147482500;display:none;flex-direction:column;',
      ' background:var(--fa-panel,#fff);color:var(--fa-text,#1e293b);border:1px solid var(--fa-border,#d8ddcf);border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.32);overflow:hidden;font:12.5px Roboto,"Segoe UI",sans-serif}',
      '#iaJanela.aberta{display:flex}',
      '#iaJanela .ia-cab{height:35px;flex:0 0 35px;display:flex;align-items:center;gap:6px;padding:0 8px 0 10px;background:var(--fa-panel-alt,#f1f5f9);border-bottom:1px solid var(--fa-border,#d8ddcf);cursor:move;user-select:none}',
      '#iaJanela .ia-cab b{flex:1;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#iaJanela .ia-cab .material-icons{font-size:18px;color:var(--fa-primary,#4b5a32)}',
      '#iaJanela .ia-ico{width:26px;height:26px;border-radius:6px;border:1px solid var(--fa-border,#d8ddcf);background:var(--fa-field-bg,#fff);color:var(--fa-text,#1e293b);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font:700 15px/1 Arial,sans-serif}',
      '#iaJanela .ia-ico .material-icons{font-size:16px;color:inherit}',
      '#iaJanela .ia-lista{flex:1;min-height:0;overflow-y:auto;padding:6px 8px;display:flex;flex-direction:column;gap:3px;background:color-mix(in srgb,var(--fa-panel-alt,#f1f5f9) 40%,var(--fa-panel,#fff))}',
      '#iaJanela .ia-msg{max-width:88%;padding:5px 8px;border-radius:8px;white-space:pre-wrap;line-height:1.35;word-wrap:break-word}',
      '#iaJanela .ia-msg.usuario{align-self:flex-end;background:var(--fa-primary,#4b5a32);color:var(--fa-button-text,#fff)}',
      '#iaJanela .ia-msg.ia{align-self:flex-start;background:var(--fa-field-bg,#fff);border:1px solid var(--fa-border,#d8ddcf)}',
      '#iaJanela .ia-msg.nota{align-self:center;font-size:11px;color:var(--fa-muted,#64748b);background:none;padding:1px 4px}',
      '#iaJanela .ia-msg.erro{align-self:flex-start;background:#fde8e7;color:#9b1c1c}',
      '#iaJanela .ia-conf{align-self:stretch;border:1px solid var(--fa-border,#d8ddcf);border-radius:8px;padding:6px 8px;background:var(--fa-panel,#fff);display:flex;flex-direction:column;gap:3px}',
      '#iaJanela .ia-conf.perigo{border-color:#b42318}',
      '#iaJanela .ia-conf .txt{white-space:pre-wrap}',
      '#iaJanela .ia-conf .acoes{display:flex;justify-content:flex-end;gap:6px}',
      '#iaJanela .ia-b{height:22px;padding:0 10px;border-radius:5px;font-size:11.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;user-select:none;',
      ' background:var(--fa-field-bg,#f1f5f9);color:var(--fa-text,#1e293b);border:1px solid var(--fa-border,#d8ddcf)}',
      '#iaJanela .ia-b.ok{background:var(--fa-button-bg,#4b5a32);color:var(--fa-button-text,#fff);border-color:var(--fa-button-bg,#4b5a32)}',
      '#iaJanela .ia-b.vermelho{background:#b42318;color:#fff;border-color:#b42318}',
      '#iaJanela .ia-b.feito{opacity:.5;pointer-events:none}',
      '#iaJanela .ia-rod{flex:0 0 auto;display:flex;gap:3px;align-items:flex-end;padding:3px 8px;border-top:1px solid var(--fa-border,#d8ddcf)}',
      '#iaJanela textarea{display:block;flex:1;height:44px;resize:none;padding:4px 7px;font:12px Roboto,"Segoe UI",sans-serif;border:1px solid var(--fa-border,#d8ddcf);border-radius:5px;background:var(--fa-field-bg,#fff);color:var(--fa-text,#1e293b);outline:none}',
      '#iaJanela textarea:focus{border-color:var(--fa-primary,#4b5a32)}',
      '#iaJanela .ia-ico.ouvindo{background:#b42318;color:#fff;border-color:#b42318}',
      '#iaJanela .ia-ico.enviar{background:var(--fa-button-bg,#4b5a32);color:var(--fa-button-text,#fff);border-color:var(--fa-button-bg,#4b5a32)}',
      '#iaJanela .ia-pensando{align-self:flex-start;font-size:11px;color:var(--fa-muted,#64748b)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------- mensagens na janela
  function rolar() { estado.lista.scrollTop = estado.lista.scrollHeight; }
  function balao(texto, tipo) { var b = el('div', 'ia-msg ' + tipo, texto); estado.lista.appendChild(b); rolar(); return b; }

  /** confirmar(resumo, perigo) — cartão com Confirmar/Cancelar dentro da conversa. Promise<boolean>. */
  function confirmar(resumo, perigo) {
    var pensando = estado.lista.querySelector('.ia-pensando');
    if (pensando) pensando.style.display = 'none';            // esperando o usuário, não a IA
    return new Promise(function (ok) {
      var c = el('div', 'ia-conf' + (perigo ? ' perigo' : ''));
      c.appendChild(el('div', 'txt', resumo));
      var acoes = el('div', 'acoes');
      var nao = el('div', 'ia-b', 'Cancelar'), sim = el('div', 'ia-b ' + (perigo ? 'vermelho' : 'ok'), perigo ? 'Excluir' : 'Confirmar');
      [nao, sim].forEach(function (b) { b.setAttribute('role', 'button'); b.tabIndex = 0; });
      function fim(r) {
        nao.classList.add('feito'); sim.classList.add('feito');
        if (pensando && pensando.parentNode) { pensando.style.display = ''; estado.lista.appendChild(pensando); rolar(); }
        ok(r);
      }
      nao.onclick = function () { fim(false); }; sim.onclick = function () { fim(true); };
      acoes.append(nao, sim); c.appendChild(acoes); estado.lista.appendChild(c); rolar(); sim.focus();
    });
  }

  // ---------------------------------------------------------------- ferramentas GERAIS (valem em todas as telas)
  // Daniel, 08/11/2026: "se perguntar qual a previsão do tempo, dê liberdade para ela consultar".
  var GERAIS = {
    previsao_tempo: {
      descricao: 'Consulta a previsão do tempo de uma cidade para os próximos dias (até 7). Não grava. Se a cidade não foi dita, pergunte.',
      parametros: { cidade: 'nome da cidade, ex.: Sorocaba', dias: { type: 'integer', description: 'quantos dias, de 1 a 7 (padrão 3)' } },
      obrigatorios: ['cidade'], grava: false,
      executar: async function (p) { return await ApiCurso.previsaoTempo(p.cidade, p.dias || 3); }
    },
    // Daniel, 08/11/2026: "a ideia é ela poder consultar igual você e dar retorno sobre qualquer coisa"
    pesquisar_internet: {
      descricao: 'Pesquisa na internet qualquer assunto atual (notícias, eventos, cotações, horários, endereços, dúvidas gerais) e ' +
        'devolve a resposta com as fontes. Não grava. Use quando não souber ou quando a informação puder ter mudado; cite as fontes.',
      parametros: { pergunta: 'o que pesquisar, em português, com o máximo de contexto (cidade, data...)' },
      obrigatorios: ['pergunta'], grava: false,
      executar: async function (p) { return await ApiCurso.pesquisarInternet(p.pergunta); }
    }
  };
  /** todas(m) — ferramentas da tela + as gerais (a da tela vence se tiver o mesmo nome). */
  function todas(m) { return Object.assign({}, GERAIS, m.ferramentas || {}); }

  // ---------------------------------------------------------------- ferramentas → formato da IA
  function ferramentasParaIA(m) {
    var lista = todas(m);
    return Object.keys(lista).map(function (nome) {
      var f = lista[nome], props = {};
      Object.keys(f.parametros || {}).forEach(function (c) {
        var v = f.parametros[c];
        props[c] = typeof v === 'string' ? { type: 'string', description: v } : v;
      });
      return { type: 'function', 'function': { name: nome, description: f.descricao || nome,
        parameters: { type: 'object', properties: props, required: f.obrigatorios || [] } } };
    });
  }

  /** executar(chamada) — roda UMA ferramenta pedida pela IA e devolve o texto que volta para ela. */
  async function executar(chamada) {
    var m = estado.manifesto, nome = chamada['function'] && chamada['function'].name, f = todas(m)[nome];
    if (!f) return 'ERRO: ferramenta "' + nome + '" não existe nesta tela.';
    var p = {};
    try { p = JSON.parse(chamada['function'].arguments || '{}') || {}; } catch (e) { return 'ERRO: parâmetros inválidos.'; }
    if (f.validar) { var falta = f.validar(p); if (falta) return 'FALTA DADO (pergunte ao usuário, não grave): ' + falta; }
    if (f.grava) {
      var resumo = f.resumo ? f.resumo(p) : (nome + '\n' + JSON.stringify(p, null, 1));
      if (!(await confirmar(resumo, !!f.exclui))) { balao('Cancelado: nada foi gravado.', 'nota'); return 'O usuário CANCELOU. Nada foi gravado.'; }
    }
    try {
      var r = await f.executar(p);
      if (f.grava && typeof estado.aoConcluir === 'function') { try { await estado.aoConcluir(); } catch (e) {} }
      return typeof r === 'string' ? r : JSON.stringify(r);
    } catch (erro) {
      balao(erro.message, 'erro');
      return 'ERRO da API (conte ao usuário): ' + erro.message;
    }
  }

  /**
   * sistema(manifesto) — instruções da tela para a IA: o que a tela é, as regras dela, a lista das ações que a IA
   * executa (para responder "o que você pode fazer?") e os dados de apoio do manifesto.
   * Usado pelo texto (BotaoIA) e pela voz (BotaoVoz.js), para os dois terem exatamente os mesmos poderes.
   */
  async function sistema(manifesto) {
    var m = manifesto || estado.manifesto, apoio = '';
    if (typeof m.preparar === 'function') { try { apoio = JSON.stringify(await m.preparar()); } catch (e) { apoio = ''; } }
    // Daniel, 08/11/2026: "não só executar, e ela diz, se perguntar, o que ela pode executar"
    var lista = todas(m);
    var acoes = Object.keys(lista).map(function (n) {
      var f = lista[n]; return '- ' + (f.descricao || n) + (f.grava ? ' (pede confirmação)' : '');
    }).join('\n');
    return 'Tela: ' + m.titulo + '. ' + (m.descricao || '') + (m.regras ? '\nRegras desta tela: ' + m.regras : '') +
      '\nVocê pode conversar livremente. Se o usuário perguntar o que você sabe ou pode fazer, explique em linguagem simples ' +
      'as ações que você executa nesta tela, com um exemplo de pedido para cada uma:\n' + acoes +
      '\nHoje é ' + new Date().toLocaleDateString('pt-BR') + '.' + (apoio ? '\nDados de apoio: ' + apoio : '');
  }

  /** enviar(texto) — uma pergunta do usuário: rodadas com a IA até ela responder em texto. */
  async function enviar(texto) {
    texto = String(texto || '').trim();
    if (!texto || estado.ocupado) return;
    if (estado.mensagens.length > MAX_MENSAGENS) { balao('Conversa longa: clique em Nova conversa (ícone do lápis).', 'nota'); return; }
    estado.ocupado = true; estado.campo.value = '';
    balao(texto, 'usuario');
    if (!estado.mensagens.length) estado.mensagens.push({ role: 'system', content: await sistema() });
    estado.mensagens.push({ role: 'user', content: texto });
    var pensando = el('div', 'ia-pensando', 'pensando...'); estado.lista.appendChild(pensando); rolar();
    try {
      for (var i = 0; i < MAX_RODADAS; i++) {
        var resp = await ApiCurso.iaConversar(estado.mensagens, ferramentasParaIA(estado.manifesto));
        var msg = { role: 'assistant', content: resp.content || null };
        if (resp.tool_calls && resp.tool_calls.length) msg.tool_calls = resp.tool_calls;
        estado.mensagens.push(msg);
        if (!msg.tool_calls) { pensando.remove(); balao(resp.content || '(sem resposta)', 'ia'); break; }
        if (resp.content) balao(resp.content, 'ia');
        for (var k = 0; k < msg.tool_calls.length; k++) {
          var ch = msg.tool_calls[k];
          var resultado = await executar(ch);
          estado.mensagens.push({ role: 'tool', tool_call_id: ch.id, content: String(resultado).slice(0, 6000) });
        }
        if (i === MAX_RODADAS - 1) { pensando.remove(); balao('Parei aqui para não entrar em laço. Reformule o pedido.', 'nota'); }
      }
    } catch (erro) {
      pensando.remove(); balao(erro.message, 'erro');
      estado.mensagens.pop();   // tira a pergunta que falhou, para poder tentar de novo
    } finally {
      if (pensando.parentNode) pensando.remove();
      estado.ocupado = false; estado.campo.focus();
    }
  }

  function novaConversa() {
    if (estado.ocupado) return;
    estado.mensagens = []; estado.lista.innerHTML = '';
    balao('Olá! Sou a ' + estado.nome + ', a IA da tela de ' + estado.manifesto.titulo + '. ' +
      (estado.manifesto.saudacao || 'Diga o que você quer fazer.') + (estado.manifesto.exemplo ? '\n' + estado.manifesto.exemplo : ''), 'ia');
  }

  // ---------------------------------------------------------------- voz (microfone do navegador, pt-BR)
  var reconhecedor = null;
  function microfone(botao) {
    var R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { balao('Este navegador não tem reconhecimento de voz. Use o Chrome ou o Edge.', 'nota'); return; }
    if (reconhecedor) { reconhecedor.stop(); return; }
    reconhecedor = new R(); reconhecedor.lang = 'pt-BR'; reconhecedor.interimResults = true; reconhecedor.continuous = false;
    var base = estado.campo.value ? estado.campo.value + ' ' : '';
    reconhecedor.onresult = function (e) {
      var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      estado.campo.value = base + t;
    };
    reconhecedor.onend = function () { botao.classList.remove('ouvindo'); reconhecedor = null; if (estado.campo.value.trim()) enviar(estado.campo.value); };
    reconhecedor.onerror = function () { botao.classList.remove('ouvindo'); };
    botao.classList.add('ouvindo'); reconhecedor.start();
  }

  // ---------------------------------------------------------------- janela
  function montarJanela() {
    injetarEstilo();
    var j = el('div'); j.id = 'iaJanela';
    var cab = el('div', 'ia-cab');
    var ico = el('span', 'material-icons', 'smart_toy');
    var tit = el('b', null, estado.nome + ' • ' + estado.manifesto.titulo);
    var nova = el('div', 'ia-ico'); nova.title = 'Nova conversa'; nova.innerHTML = '<span class="material-icons">edit_square</span>';
    var x = el('div', 'ia-ico', '×'); x.title = 'Fechar';
    cab.append(ico, tit, nova, x);
    var lista = el('div', 'ia-lista');
    var rod = el('div', 'ia-rod');
    var campo = el('textarea'); campo.placeholder = 'Escreva ou fale o que deseja... (Enter envia, Shift+Enter quebra linha)';
    var mic = el('div', 'ia-ico'); mic.title = 'Falar'; mic.innerHTML = '<span class="material-icons">mic</span>';
    var env = el('div', 'ia-ico enviar'); env.title = 'Enviar'; env.innerHTML = '<span class="material-icons">send</span>';
    [nova, x, mic, env].forEach(function (b) { b.setAttribute('role', 'button'); b.tabIndex = 0; });
    rod.append(campo, mic, env);
    j.append(cab, lista, rod);
    document.body.appendChild(j);
    estado.janela = j; estado.lista = lista; estado.campo = campo;
    x.onclick = function () { j.classList.remove('aberta'); };
    nova.onclick = novaConversa;
    env.onclick = function () { enviar(campo.value); };
    mic.onclick = function () { microfone(mic); };
    campo.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(campo.value); }
      if (e.key === 'Escape') { e.stopPropagation(); j.classList.remove('aberta'); }
    });
    // arrastar pela barra
    var ini = null;
    cab.addEventListener('mousedown', function (e) {
      if (e.target.closest('.ia-ico')) return;
      var r = j.getBoundingClientRect(); ini = { x: e.clientX - r.left, y: e.clientY - r.top };
      j.style.right = 'auto'; j.style.bottom = 'auto'; j.style.left = r.left + 'px'; j.style.top = r.top + 'px'; e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!ini) return;
      j.style.left = Math.max(0, Math.min(innerWidth - 80, e.clientX - ini.x)) + 'px';
      j.style.top = Math.max(0, Math.min(innerHeight - 35, e.clientY - ini.y)) + 'px';
    });
    document.addEventListener('mouseup', function () { ini = null; });
    novaConversa();
  }

  function abrir() {
    if (!estado.janela) montarJanela();
    estado.janela.classList.add('aberta');
    estado.campo.focus();
  }

  // ---------------------------------------------------------------- botão no cabeçalho
  /**
   * ligarNaTela(cfg) — cria o botão IA ao lado do ✕ (grupo IA ? ✕) e liga a conversa.
   * cfg: { manifesto, aoConcluir: função chamada depois de gravar (ex.: recarregar a lista), ancora: seletor do ✕ }
   */
  async function ligarNaTela(cfg) {
    if (window.__FACILAPP_TREINAMENTO) return null;          // dentro do treinamento "?" não há IA
    estado.manifesto = cfg.manifesto; estado.aoConcluir = cfg.aoConcluir || null;
    injetarEstilo();
    var x = document.querySelector(cfg.ancora || '.browse-header .btn-fechar, .cab .btn-fechar, .btn-fechar');
    if (!x || !x.parentNode) return null;
    var b = document.createElement('button');
    b.type = 'button'; b.className = x.className + ' ia-btn'; b.textContent = 'IA'; b.title = 'Conversar com a IA desta tela';
    // mesmo grupo do "?" (AjudaTela.js): IA ? ✕ juntos à direita
    var grupo = x.parentNode.classList && x.parentNode.classList.contains('ajuda-tela-grupo') ? x.parentNode : null;
    if (!grupo) {
      grupo = document.createElement('span'); grupo.className = 'ajuda-tela-grupo';
      grupo.style.cssText = 'display:inline-flex;align-items:center;gap:0;margin-left:auto;flex:0 0 auto;';
      x.parentNode.insertBefore(grupo, x); grupo.appendChild(x);
    }
    grupo.insertBefore(b, grupo.firstChild);
    estado.btn = b;
    b.onclick = abrir;
    try {
      var st = await ApiCurso.iaStatus();
      if (st.nome) { estado.nome = st.nome; b.title = 'Conversar com a ' + st.nome; }
      if (!st.configurada) { b.disabled = true; b.title = 'IA desligada: um administrador cadastra a chave em Administração → Inteligência Artificial.'; }
    } catch (e) { b.disabled = true; b.title = 'IA indisponível: ' + e.message; }
    return b;
  }

  /*
   * O que o BotaoIA empresta ao Botão VOZ (Daniel, 08/11/2026: "ligue ele com os mesmos poderes da Luninha"):
   *   ferramentas(m)    → ferramentas da tela + gerais (tempo, internet), no formato do manifesto
   *   instrucoes(m)     → texto das instruções da tela (mesmo do texto)
   *   nome()            → nome da assistente gravado na API (Luninha)
   *   botao()           → o botão IA do cabeçalho (o VOZ entra logo depois dele, no grupo IA VOZ ? ✕)
   */
  window.BotaoIA = {
    ligarNaTela: ligarNaTela,
    abrir: abrir,
    enviar: enviar,
    ferramentas: function (m) { return todas(m); },
    instrucoes: sistema,
    nome: function () { return estado.nome; },
    botao: function () { return estado.btn; }
  };
})();
