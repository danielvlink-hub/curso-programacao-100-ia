/* ==========================================================================
   Treinamento.js — motor da apresentação guiada (TREINAMENTOS/<Tela>/) — CURSO (FastPousada)
   Copiado do Gourmet (C:\COWORK-CHATGPT\Gourmet WEB) em 08/11/2026 — Daniel: "como faz o help igual do Gourmet".
   Diferenças do Gourmet: (1) o palco abre a tela com ?treinamento=1 (no file:// a tela não consegue ler o endereço
   do pai, então é assim que ela sabe que está em treinamento e trava a gravação — avisos.js);
   (2) campo "quadro" no passo: o alvo fica DENTRO de um iframe da tela (ex.: a janela do update '#janelaUpdate iframe').
   Origem do Gourmet: clonado do AgroFácil em 16/10/2026.
   A tela de verdade no palco (iframe), cursor virtual, destaque no campo, legenda e voz (mp3 gerado pelo
   gerar_audios.py com edge-tts / pt-BR-FranciscaNeural, ritmo +3%).
   Roteiro em roteiro.js (window.TREINAMENTO), sem login (a sessão já está aberta), só DESTACA (a tela no palco
   fica em modo treinamento: o AjudaTela.js bloqueia gravação e impressão), cores do tema, ícones offline, sem alert.
   Botões: Iniciar/Pausar, Anterior, Próximo, Som, Fechar. Fechar pede ao pai (camada do "?" — AjudaTela.js)
   com AJUDA_VIDEO_FECHAR.
   ========================================================================== */
(function () {
  'use strict';
  var T = window.TREINAMENTO || {passos: []};
  var passo = -1, rodando = false, audio = null, somLigado = true, geracao = 0;
  var palco, cursor, destaque, legenda, legendaTexto, fase, btnIniciar, btnSom;

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function icone(nome) { return '<span class="material-symbols-rounded">' + nome + '</span>'; }

  function montar() {
    palco = el('iframe', {id: 'trPalco', title: 'Tela do sistema', src: T.tela + (T.tela.indexOf('?') >= 0 ? '&' : '?') + 'treinamento=1'});
    var dock = el('div', {'class': 'tr-dock'});
    fase = el('span', {'class': 'tr-fase'}, '0/' + T.passos.length);
    btnIniciar = el('button', {type: 'button', 'class': 'primario', title: 'Iniciar a apresentação'}, icone('play_arrow') + 'Iniciar');
    var btnAnt = el('button', {type: 'button', title: 'Passo anterior'}, icone('skip_previous'));
    var btnProx = el('button', {type: 'button', title: 'Próximo passo'}, icone('skip_next'));
    btnSom = el('button', {type: 'button', title: 'Som ligado'}, icone('volume_up'));
    var btnFechar = el('button', {type: 'button', title: 'Fechar o treinamento'}, icone('close'));
    dock.append(fase, btnAnt, btnIniciar, btnProx, btnSom, btnFechar);
    /* dockEsquerda no roteiro (ex.: '62%'): desloca a barra de controles quando ela cobriria botões da tela (Menu Balança, 13/10/2026). */
    if (T.dockEsquerda) dock.style.left = String(T.dockEsquerda);
    /* dockTopo (Gourmet, 16/10/2026): desce a barra quando ela cobriria o topo da tela (linha do Delivery no PDV) */
    if (T.dockTopo) dock.style.top = String(T.dockTopo);

    cursor = el('div', {id: 'trCursor'}, '<svg viewBox="0 0 24 24"><path d="M5.5 3.2L18.5 13.5L12.5 14.5L15.8 21.5L13.2 22.8L9.9 15.8L5.5 19.5V3.2Z" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/></svg>');
    destaque = el('div', {id: 'trDestaque'});
    legenda = el('div', {id: 'trLegenda'}, icone('record_voice_over'));
    legendaTexto = el('span', {}, 'Clique em Iniciar para começar o treinamento' + (T.titulo ? ' — ' + T.titulo : '') + '.');
    legenda.appendChild(legendaTexto);
    legenda.classList.add('ativa');
    document.body.append(palco, dock, cursor, destaque, legenda);

    btnIniciar.onclick = function () { rodando ? pausar() : iniciar(); };
    btnAnt.onclick = function () { irPara(Math.max(0, passo - 1), false); };
    btnProx.onclick = function () { irPara(Math.min(T.passos.length - 1, passo + 1), false); };
    btnSom.onclick = function () {
      somLigado = !somLigado;
      btnSom.innerHTML = icone(somLigado ? 'volume_up' : 'volume_off');
      btnSom.title = somLigado ? 'Som ligado' : 'Som desligado';
      if (!somLigado && audio) audio.pause();
    };
    btnFechar.onclick = fechar;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') btnProx.click();
      else if (e.key === 'ArrowLeft') btnAnt.click();
      else if (e.key === ' ') { e.preventDefault(); btnIniciar.click(); }
      else if (e.key === 'Escape') fechar();
    });
  }

  function fechar() {
    pausar();
    if (window.parent && window.parent !== window) window.parent.postMessage({origem: 'AJUDA_VIDEO_FECHAR'}, '*');
  }

  function iniciar() {
    rodando = true;
    btnIniciar.innerHTML = icone('pause') + 'Pausar';
    irPara(passo < 0 || passo >= T.passos.length - 1 ? 0 : passo, true);
  }
  function pausar() {
    rodando = false;
    geracao++;
    if (audio) { audio.pause(); audio = null; }
    if (btnIniciar) btnIniciar.innerHTML = icone('play_arrow') + (passo >= 0 ? 'Continuar' : 'Iniciar');
  }

  /* file:// ou outra origem: pergunta à tela (AjudaTela.js responde TREINAMENTO_ALVO) */
  var pedidos = {}, pedidoId = 0;
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.origem === 'TREINAMENTO_ALVO_RESPOSTA' && pedidos[d.id]) { pedidos[d.id](d.rect); delete pedidos[d.id]; }
    if (d.origem === 'TREINAMENTO_DIGITAR_FIM' && pedidos[d.id]) { pedidos[d.id](); delete pedidos[d.id]; }
  });
  /* digita como o usuário (letra por letra), igual ao modelo do Antigravity */
  function digitar(seletor, texto, quadro) {
    return new Promise(function (resolve) {
      var id = ++pedidoId;
      pedidos[id] = resolve;
      setTimeout(function () { if (pedidos[id]) { delete pedidos[id]; resolve(); } }, String(texto).length * 150 + 1500);
      try { palco.contentWindow.postMessage({origem: 'TREINAMENTO_DIGITAR', id: id, seletor: seletor, texto: texto, intervalo: 110, quadro: quadro || ''}, '*'); } catch (_) { resolve(); }
    });
  }
  function alvoPorMensagem(seletor, quadro) {
    return new Promise(function (resolve) {
      var id = ++pedidoId;
      pedidos[id] = function (r) {
        if (!r) { resolve(null); return; }
        var f = palco.getBoundingClientRect();
        resolve({left: f.left + r.left, top: f.top + r.top, width: r.width, height: r.height});
      };
      setTimeout(function () { if (pedidos[id]) { delete pedidos[id]; resolve(null); } }, 600);
      try { palco.contentWindow.postMessage({origem: 'TREINAMENTO_ALVO', id: id, seletor: seletor, quadro: quadro || ''}, '*'); } catch (_) { resolve(null); }
    });
  }

  function alvo(seletor, quadro) {
    var direto = alvoDireto(seletor, quadro);
    return direto === undefined ? alvoPorMensagem(seletor, quadro) : Promise.resolve(direto);
  }
  /* documento onde o alvo está: a tela do palco ou, com quadro, o iframe dentro dela. {doc, dx, dy}, null ou undefined */
  function docDoAlvo(quadro) {
    var doc = palco.contentDocument;
    if (!doc) return undefined;
    var f = palco.getBoundingClientRect(), dx = f.left, dy = f.top;
    if (quadro) {
      var q = doc.querySelector(quadro);
      if (!q) return null;
      var rq = q.getBoundingClientRect();
      dx += rq.left + (q.clientLeft || 0); dy += rq.top + (q.clientTop || 0);
      doc = q.contentDocument;
      if (!doc) return undefined;
    }
    return {doc: doc, dx: dx, dy: dy};
  }
  /* null = não achou; undefined = não dá para ler a tela daqui (file://: pergunta por mensagem) */
  function alvoDireto(seletor, quadro) {
    try {
      var b = docDoAlvo(quadro);
      if (!b) return b;
      var lista = String(seletor || '').split(',');
      for (var i = 0; i < lista.length; i++) {
        var e = b.doc.querySelector(lista[i].trim());
        if (e) {
          var r = e.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) return {left: b.dx + r.left, top: b.dy + r.top, width: r.width, height: r.height};
        }
      }
    } catch (_) { return undefined; }
    return null;
  }

  /* CLICAR (Gourmet, 16/10/2026 — Daniel: "precisa preencher o número como é usado"): o passo pode clicar de verdade
     na tela do palco para abrir a janela que está explicando (clicar: true = o alvo; ou um seletor) e fechar no fim
     (fechar: seletor). A tela do palco está em modo treinamento (avisos.js): gravar e imprimir não fazem nada. */
  function elementoNoPalco(seletor, quadro) {
    try {
      var b = docDoAlvo(quadro);
      if (!b) return null;
      var lista = String(seletor || '').split(',');
      for (var i = 0; i < lista.length; i++) {
        var e = b.doc.querySelector(lista[i].trim());
        if (e) { var r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return e; }
      }
    } catch (_) {}
    return null;
  }
  function clicarNoPalco(seletor, quadro) {
    var e = elementoNoPalco(seletor, quadro);
    if (e) { try { e.click(); } catch (_) {} return esperar(450); }
    try { palco.contentWindow.postMessage({origem: 'TREINAMENTO_CLICAR', seletor: seletor, quadro: quadro || ''}, '*'); } catch (_) {}
    return esperar(450);
  }

  function escolherNoPalco(seletor, opcao, quadro) {
    var e = elementoNoPalco(seletor, quadro);
    if (!e || !e.options) return;
    var i = typeof opcao === 'number' ? opcao : [].findIndex.call(e.options, function (o) { return String(o.textContent).trim().toLowerCase().indexOf(String(opcao).toLowerCase()) === 0; });
    if (i < 0 || i >= e.options.length) return;
    e.selectedIndex = i;
    e.dispatchEvent(new Event('change', {bubbles: true}));
  }
  function limparNoPalco(seletores) {
    try {
      var doc = palco.contentDocument;
      String(seletores || '').split(',').forEach(function (sel) {
        var e = doc.querySelector(sel.trim());
        if (e && 'value' in e) { e.value = ''; e.dispatchEvent(new Event('input', {bubbles: true})); e.dispatchEvent(new Event('change', {bubbles: true})); }
      });
    } catch (_) {}
  }

  function moverCursor(x, y) {
    cursor.style.display = 'block';
    cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    return esperar(650);
  }
  /* clique visível: duas ondas + ponto pulsando no alvo até o próximo passo */
  var ponto = null;
  function ripple(x, y) {
    [0, 260].forEach(function (atraso) {
      setTimeout(function () {
        var r = el('div', {'class': 'tr-ripple'});
        r.style.left = x + 'px';
        r.style.top = y + 'px';
        document.body.appendChild(r);
        setTimeout(function () { r.remove(); }, 520);
      }, atraso);
    });
    tirarPonto();
    ponto = el('div', {'class': 'tr-ponto'});
    ponto.style.left = x + 'px';
    ponto.style.top = y + 'px';
    document.body.appendChild(ponto);
  }
  function tirarPonto() { if (ponto) { ponto.remove(); ponto = null; } }
  function destacar(r) {
    var p = 4;
    destaque.style.display = 'block';
    destaque.style.left = Math.max(0, r.left - p) + 'px';
    destaque.style.top = Math.max(0, r.top - p) + 'px';
    destaque.style.width = (r.width + p * 2) + 'px';
    destaque.style.height = (r.height + p * 2) + 'px';
  }

  function tocar(src) {
    return new Promise(function (resolve) {
      if (audio) { audio.pause(); audio = null; }
      if (!somLigado || !src) { setTimeout(resolve, 3500); return; }
      var a = new Audio(src);
      audio = a;
      a.onended = function () { resolve(); };
      a.onerror = function () { setTimeout(resolve, 3500); };
      a.play().catch(function () { setTimeout(resolve, 3500); });
    });
  }

  async function irPara(i, continuar) {
    var minha = ++geracao;
    passo = i;
    var p = T.passos[i];
    if (!p) return;
    fase.textContent = (i + 1) + '/' + T.passos.length;
    legendaTexto.textContent = p.texto;
    legenda.classList.add('ativa');
    if (p.antes) { await clicarNoPalco(p.antes); if (minha !== geracao) return; }   /* abre a janela antes de apontar */
    if (p.aguardar) { await esperar(p.aguardar); if (minha !== geracao) return; }   /* dá tempo da tela carregar (ex.: quartos do hotel) */
    var r = await alvo(p.alvo, p.quadro);
    if (minha !== geracao) return;
    if (r) {
      var x = r.left + Math.min(r.width / 2, 160), y = r.top + Math.min(r.height / 2, 40);
      await moverCursor(x, y);
      if (minha !== geracao) return;
      destacar(r);
      ripple(x, y);
      if (p.escolher != null) escolherNoPalco(p.alvo, p.escolher, p.quadro);   /* combo: escolhe a opção (número = posição, texto = rótulo) */
      if (p.clicar) { await clicarNoPalco(p.clicar === true ? p.alvo : p.clicar, p.quadro); if (minha !== geracao) return;
        var r2 = await alvo(p.alvo, p.quadro); if (r2) destacar(r2); }
    } else {
      destaque.style.display = 'none';
      tirarPonto();
    }
    /* voz e digitação juntas; segue quando as duas terminarem */
    await Promise.all([tocar(p.audio), (r && p.digitar) ? esperar(400).then(function () { return minha === geracao ? digitar(p.alvo.split(',')[0].trim(), p.digitar, p.quadro) : null; }) : null]);
    if (minha !== geracao) return;
    if (p.fechar) await clicarNoPalco(p.fechar);
    if (p.limpar) limparNoPalco(p.limpar);   /* apaga o que o treino digitou nos filtros (lista de seletores) */
    await esperar(p.espera || 700);
    if (minha !== geracao || !continuar || !rodando) return;
    if (i + 1 < T.passos.length) irPara(i + 1, true);
    else finalizar();
  }

  function finalizar() {
    rodando = false;
    destaque.style.display = 'none';
    cursor.style.display = 'none';
    tirarPonto();
    btnIniciar.innerHTML = icone('replay') + 'Repetir';
    passo = T.passos.length - 1;
  }

  window.addEventListener('resize', function () {
    if (passo >= 0 && destaque.style.display === 'block') {
      alvo(T.passos[passo].alvo, T.passos[passo].quadro).then(function (r) { if (r) destacar(r); });
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
