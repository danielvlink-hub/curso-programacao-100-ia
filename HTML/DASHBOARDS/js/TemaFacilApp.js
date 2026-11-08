/* ============================================================================
   TemaFacilApp.js - Ponte Única de Tema do FacilApp
   ============================================================================ */

window.FacilAppTemaConfig = {
  tema: "dark-tech"
};

(function () {
  'use strict';

  var TEMA_PADRAO_MENU = 'dark-tech';
  var TEMAS_VALIDOS = ['dark-tech', 'codex-dark', 'obsidian-gold', 'deep-teal', 'v1-cyberpunk', 'default'];
  
  function temaValido(tema) {
    return TEMAS_VALIDOS.indexOf(String(tema || '').toLowerCase()) >= 0;
  }

  function lerTemaGravado() {
    try {
      var temaSalvo = localStorage.getItem('facilapp_tema_ativo');
      if (temaValido(temaSalvo)) return String(temaSalvo).toLowerCase();
    } catch (e) {}
    return TEMA_PADRAO_MENU;
  }

  function aplicar(tema) {
    tema = temaValido(tema) ? String(tema).toLowerCase() : lerTemaGravado();
    document.documentElement.setAttribute('data-theme', tema);
    if (document.body) {
      document.body.setAttribute('data-theme', tema);
    }

    const iframe = document.getElementById('app-iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({ origem: 'FACILAPP_TEMA_ALTERADO', skinId: tema }, '*');
        if (iframe.contentDocument && iframe.contentDocument.documentElement) {
          iframe.contentDocument.documentElement.setAttribute('data-theme', tema);
          iframe.contentDocument.body.setAttribute('data-theme', tema);
        }
      } catch (e) {}
    }

    window.dispatchEvent(new CustomEvent('facilapp:tema-alterado', { detail: { tema: tema } }));
    return tema;
  }

  function temaDoPai() {
    try {
      if (!window.parent || window.parent === window) return '';
      return window.parent.document.documentElement.getAttribute('data-theme') ||
        window.parent.document.body.getAttribute('data-theme') || '';
    } catch (e) { return ''; }
  }

  function sincronizarComPai() {
    var tema = temaDoPai();
    if (temaValido(tema)) aplicar(tema);
  }

  window.FacilAppTema = {
    padrao: TEMA_PADRAO_MENU,
    obter: lerTemaGravado,
    aplicar: aplicar,
    gravar: function (tema) {
      tema = temaValido(tema) ? String(tema).toLowerCase() : TEMA_PADRAO_MENU;
      try { localStorage.setItem('facilapp_tema_ativo', tema); } catch (e) {}
      aplicar(tema);
      return tema;
    },
    sincronizar: sincronizarComPai
  };

  const temaInicial = temaDoPai() || lerTemaGravado();
  aplicar(temaInicial);

  document.addEventListener('DOMContentLoaded', function () {
    aplicar(temaDoPai() || lerTemaGravado());
  });

  window.addEventListener('message', function (evento) {
    var dados = evento.data || {};
    if (dados.origem === 'FACILAPP_TEMA_ALTERADO' || dados.skinId || dados.skin) {
      aplicar(dados.skinId || dados.skin);
    }
  });
}());
