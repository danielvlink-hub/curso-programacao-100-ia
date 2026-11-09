/* ==========================================================================
   AjudaTela.js — botão "?" de ajuda (apresentação guiada com voz) ao lado do ✕ da tela — CURSO (FastPousada)

   Copiado do Gourmet (C:\COWORK-CHATGPT\Gourmet WEB\assets\js\AjudaTela.js) em 08/11/2026.
   Daniel: "como faz o help igual do Gourmet".
   Diferenças do Gourmet:
     - sem tabela menu_ajuda: a lista é só o TREINAMENTOS/ajudas.js (window.AJUDAS_CURSO);
     - modo treinamento reconhecido também por ?treinamento=1 no endereço (o file:// não deixa ler o pai);
     - repasse para um iframe da tela (campo "quadro" do roteiro): o motor pergunta à tela, a tela pergunta ao iframe
       (ex.: janela do update) e devolve a posição já somada.

   COMO O "?" NASCE (nenhuma tela precisa ser editada):
     - o avisos.js (carregado por todas as telas) carrega este arquivo;
     - código da tela = HTML_<ARQUIVO> (modelo_browse.html → HTML_MODELO_BROWSE);
     - TREINAMENTOS/ajudas.js lista as apresentações prontas (código → título, endereço, onde pôr o "?");
     - o "?" vai antes do ✕ da tela; tela sem ✕ ganha o "?" flutuante no canto (ou onde o ajudas.js mandar: ancora).

   DENTRO DA APRESENTAÇÃO (a tela no palco): não cria "?" e responde ao motor (Treinamento.js) onde está cada campo
   (TREINAMENTO_ALVO), clica (TREINAMENTO_CLICAR) e digita letra por letra (TREINAMENTO_DIGITAR).
   A trava de gravação do modo treinamento fica no avisos.js (precisa valer antes da tela iniciar).
   ========================================================================== */
(function () {
  'use strict';
  if (window.AjudaTela) return;
  var SCRIPT = (document.currentScript && document.currentScript.src) || '';
  /* raiz do HTML do curso, pelo endereço deste script (vale em file:// e em http) */
  var RAIZ = SCRIPT ? SCRIPT.replace(/assets\/js\/AjudaTela\.js(\?[^#]*)?(#.*)?$/i, '') : '';
  var ID = 'ajudaTelaCamada';

  function emTreinamento() { return !!window.__FACILAPP_TREINAMENTO; }   /* decidido no avisos.js */

  // ---------------------------------------------------------------- código da tela
  /** HTML_<caminho sem .html>, em maiúsculas. */
  function codigoDaTela() {
    var caminho = decodeURIComponent(location.pathname || '');
    var raizPath = '';
    try { raizPath = decodeURIComponent(new URL(RAIZ, location.href).pathname); } catch (e) { raizPath = ''; }
    var rel = raizPath && caminho.indexOf(raizPath) === 0 ? caminho.slice(raizPath.length) : (caminho.split('/').pop() || '');
    rel = rel.replace(/\.html?$/i, '');
    return ('HTML_' + rel).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  }

  // ---------------------------------------------------------------- lista de apresentações prontas
  function carregarScript(src) {
    return new Promise(function (ok, falha) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { ok(); };
      s.onerror = function () { falha(new Error(src)); };
      document.head.appendChild(s);
    });
  }
  async function registro() {
    if (!window.AJUDAS_CURSO) {
      try { await carregarScript(RAIZ + 'TREINAMENTOS/ajudas.js?v=' + Math.floor(Date.now() / 600000)); } catch (e) {}
    }
    return window.AJUDAS_CURSO || {};
  }

  // ---------------------------------------------------------------- janela da ajuda
  function el(tag, estilo, texto) {
    var e = document.createElement(tag);
    if (estilo) e.style.cssText = estilo;
    if (texto != null) e.textContent = texto;
    return e;
  }
  function fechar() {
    var c = document.getElementById(ID);
    if (c) c.remove();
    document.removeEventListener('keydown', teclas, true);
  }
  function teclas(e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); fechar(); } }

  var estiloBotao = 'height:26px !important;min-width:26px !important;padding:0 8px !important;border-radius:6px !important;cursor:pointer !important;' +
    'font:700 14px system-ui,sans-serif !important;line-height:1 !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;' +
    'background:var(--fa-field-bg,#fff) !important;color:var(--fa-text,#171a10) !important;border:1px solid var(--fa-border,#9caf77) !important;';

  /* janela da ajuda: no máximo 1280 x 765, centralizada (mesmo tamanho do Gourmet) */
  function abrir(pronta) {
    fechar();
    var camada = el('div', 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:8px;background:rgba(0,0,0,.35);');
    camada.id = ID;
    var janela = el('section', 'width:100%;height:100%;max-width:1280px;max-height:765px;display:flex;flex-direction:column;overflow:hidden;background:var(--fa-background,#eef3e6);' +
      'color:var(--fa-text,#171a10);border:1px solid var(--fa-border,#9caf77);border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.32);font-family:Roboto,"Segoe UI",sans-serif;');
    var topo = el('header', 'height:36px;min-height:36px;padding:0 10px;display:flex;align-items:center;gap:8px;' +
      'background:var(--fa-panel-alt,var(--fa-panel,#d8e9c5));color:var(--fa-text,#171a10);border-bottom:1px solid var(--fa-border,#9caf77);');
    var nome = el('span', 'font-size:13px;font-weight:700;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;', 'Ajuda • ' + (pronta.titulo || document.title));
    var xis = el('div', estiloBotao, '×');
    xis.setAttribute('role', 'button');
    xis.title = 'Fechar a ajuda';
    topo.append(nome, xis);
    var quadro = el('iframe', 'flex:1;min-height:0;width:100%;border:0;background:var(--fa-background,#eef3e6);');
    quadro.allow = 'autoplay; fullscreen';
    quadro.src = RAIZ + pronta.url;
    janela.append(topo, quadro);
    camada.appendChild(janela);
    document.body.appendChild(camada);
    camada.addEventListener('mousedown', function (e) { if (e.target === camada) fechar(); });
    xis.onclick = fechar;
    document.addEventListener('keydown', teclas, true);
  }

  // ---------------------------------------------------------------- o botão "?"
  var SELETORES_X = ['.browse-header .btn-fechar', '#fechar', '#btnFechar', '.btn-header-close', '.btn-fechar', 'button[title^="Fechar"]'];
  function acharX(ancora) {
    var lista = ancora ? [ancora] : SELETORES_X;
    for (var i = 0; i < lista.length; i++) {
      var x = null;
      try { x = document.querySelector(lista[i].split(',').map(function (p) { return p.trim() + ':not(.ajuda-tela-btn)'; }).join(', ')); } catch (e) { x = null; }
      if (x && x.parentNode && x.getBoundingClientRect().width > 0) return x;
    }
    return null;
  }
  function criarBotao(pronta) {
    var antigo = document.querySelector('.ajuda-tela-btn');
    if (antigo) antigo.remove();
    var x = acharX(pronta.ancora);
    var b;
    if (x) {
      b = document.createElement(x.tagName === 'BUTTON' ? 'button' : 'div');
      if (b.tagName === 'BUTTON') b.type = 'button'; else b.setAttribute('role', 'button');
      b.className = x.className + ' ajuda-tela-btn';   /* mesmo visual do ✕ vizinho */
      b.textContent = '?';
      b.style.setProperty('min-width', '26px', 'important'); b.style.setProperty('width', 'auto', 'important');
      b.style.setProperty('padding', '0 8px', 'important');
      b.style.marginRight = '6px';
      if (pronta.depois) {
        x.parentNode.insertBefore(b, x.nextSibling);
        b.style.marginRight = ''; b.style.marginLeft = '6px';
      } else {
        /* PADRÃO (Daniel: "sempre ao lado do X"): "?" e ✕ juntos num grupo à direita */
        if (x.parentNode.classList && x.parentNode.classList.contains('ajuda-tela-grupo')) x.parentNode.insertBefore(b, x);
        else {
          var grupo = document.createElement('span');
          grupo.className = 'ajuda-tela-grupo';
          grupo.style.cssText = 'display:inline-flex;align-items:center;gap:0;margin-left:auto;flex:0 0 auto;';
          x.parentNode.insertBefore(grupo, x);
          grupo.append(b, x);
        }
      }
    } else {
      /* tela sem ✕: "?" flutuante no canto */
      b = el('div', estiloBotao + 'position:fixed !important;z-index:2147482000 !important;box-shadow:0 2px 8px rgba(0,0,0,.25) !important;' +
        (pronta.posicao || 'right:8px;bottom:8px;'), '?');
      b.setAttribute('role', 'button');
      b.className = 'ajuda-tela-btn';
      document.body.appendChild(b);
    }
    b.title = 'Ajuda desta tela (apresentação guiada com voz)';
    b.setAttribute('aria-label', 'Ajuda desta tela');
    b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); abrir(pronta); };
    return b;
  }

  async function ligar() {
    if (emTreinamento()) return null;
    if (window.parent !== window && !/[?&]ajuda=1/.test(location.search)) {
      /* tela dentro de outra (ex.: o update dentro do browse): o "?" é da tela de fora */
      var reg0 = await registro();
      if (!reg0[codigoDaTela()]) return null;
    }
    var codigo = codigoDaTela();
    var reg = await registro();
    if (!reg[codigo]) return null;   /* sem apresentação pronta: o "?" não nasce */
    return criarBotao(Object.assign({ codigo: codigo }, reg[codigo]));
  }

  // ---------------------------------------------------------------- respostas ao motor da apresentação
  /* repasse para um iframe da tela (campo "quadro"): guarda quem pediu e soma a posição do iframe na resposta */
  var repasses = {}, repasseId = 0;
  function iframeDo(quadro) {
    var q = null; try { q = document.querySelector(quadro); } catch (x) {}
    return q && q.contentWindow ? q : null;
  }
  function repassar(d, origem) {
    var q = iframeDo(d.quadro);
    if (!q) {
      if (d.origem === 'TREINAMENTO_ALVO') origem.postMessage({ origem: 'TREINAMENTO_ALVO_RESPOSTA', id: d.id, rect: null }, '*');
      if (d.origem === 'TREINAMENTO_DIGITAR') origem.postMessage({ origem: 'TREINAMENTO_DIGITAR_FIM', id: d.id }, '*');
      return;
    }
    var rid = 'r' + (++repasseId);
    repasses[rid] = { id: d.id, origem: origem, quadro: q };
    var copia = Object.assign({}, d, { id: rid, quadro: '' });
    q.contentWindow.postMessage(copia, '*');
  }

  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.origem === 'AJUDA_VIDEO_FECHAR' && document.getElementById(ID)) { fechar(); return; }

    /* respostas que voltam do iframe repassado */
    if ((d.origem === 'TREINAMENTO_ALVO_RESPOSTA' || d.origem === 'TREINAMENTO_DIGITAR_FIM') && repasses[d.id]) {
      var rp = repasses[d.id]; delete repasses[d.id];
      var resp = { origem: d.origem, id: rp.id };
      if (d.origem === 'TREINAMENTO_ALVO_RESPOSTA') {
        var rq = rp.quadro.getBoundingClientRect();
        resp.rect = d.rect ? { left: rq.left + (rp.quadro.clientLeft || 0) + d.rect.left, top: rq.top + (rp.quadro.clientTop || 0) + d.rect.top,
          width: d.rect.width, height: d.rect.height } : null;
      }
      rp.origem.postMessage(resp, '*');
      return;
    }
    if (!/^TREINAMENTO_(ALVO|CLICAR|DIGITAR)$/.test(d.origem || '')) return;
    if (d.quadro && e.source) { repassar(d, e.source); return; }
    if (d.quadro) { var q2 = iframeDo(d.quadro); if (q2) q2.contentWindow.postMessage(Object.assign({}, d, { quadro: '' }), '*'); return; }

    if (d.origem === 'TREINAMENTO_ALVO' && e.source) {
      var rect = null;
      String(d.seletor || '').split(',').some(function (s) {
        var alvo = null;
        try { alvo = document.querySelector(s.trim()); } catch (x) {}
        if (!alvo) return false;
        var r = alvo.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        rect = { left: r.left, top: r.top, width: r.width, height: r.height };
        return true;
      });
      e.source.postMessage({ origem: 'TREINAMENTO_ALVO_RESPOSTA', id: d.id, rect: rect }, '*');
      return;
    }
    if (d.origem === 'TREINAMENTO_CLICAR') {   /* file://: o motor não alcança a tela; ela mesma clica */
      String(d.seletor || '').split(',').some(function (s) {
        var alvo = null; try { alvo = document.querySelector(s.trim()); } catch (x) {}
        if (!alvo || alvo.getBoundingClientRect().width <= 0) return false;
        try { alvo.click(); } catch (x) {} return true;
      });
      return;
    }
    if (d.origem === 'TREINAMENTO_DIGITAR' && e.source) {
      var origem = e.source, campo = null;
      try { campo = document.querySelector(String(d.seletor || '')); } catch (x) {}
      if (!campo || !('value' in campo)) { origem.postMessage({ origem: 'TREINAMENTO_DIGITAR_FIM', id: d.id }, '*'); return; }
      var texto = String(d.texto || ''), i = 0;
      campo.focus(); campo.value = '';
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      (function proxima() {
        if (i >= texto.length) {
          campo.dispatchEvent(new Event('change', { bubbles: true }));
          origem.postMessage({ origem: 'TREINAMENTO_DIGITAR_FIM', id: d.id }, '*');
          return;
        }
        campo.value += texto.charAt(i++);
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(proxima, Number(d.intervalo) || 110);
      })();
    }
  });

  window.AjudaTela = { ligar: ligar, abrir: abrir, fechar: fechar, codigoDaTela: codigoDaTela, emTreinamento: emTreinamento };
  setTimeout(function () { ligar().catch(function () {}); }, 700);
})();
