/* ==========================================================================
   Aplica o tema antes da primeira pintura

   Le o tema salvo e o aplica antes de a tela aparecer, para nao piscar com a cor
   errada (anti-FOUC).

   "jotape" e tema proprio (Jotapê): nao e mais convertido.

   Carregado por: todas as telas, como primeiro script
   ========================================================================== */
/**
 * TemaInicial.js - Balança FacilApp
 * Aplica o tema antes da primeira pintura sem piscar (Anti-FOUC).
 * Padrão: Verde Claro (Padrão)
 */
(function () {
  'use strict';

  function chaveDoUsuario() {
    try {
      var sessao = JSON.parse(sessionStorage.getItem('facilapp_usuario_logado') || 'null');
      var usuario = sessao && (sessao.login || sessao.idUsuario);
      usuario = usuario || localStorage.getItem('facilapp_usuario') ||
        localStorage.getItem('facilapp_usuario_id') || 'padrao';
      usuario = String(usuario).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
      return 'facilapp_tema_' + (usuario || 'padrao');
    } catch (erro) {
      return 'facilapp_tema_padrao';
    }
  }

  window.FacilAppTemaChaveUsuario = chaveDoUsuario;

  /* Antes "jotape" era convertido para "verde-claro". Desde 12/09/2026 o
     Jotapê voltou a ser tema proprio no TemaFacilApp.css e o nome gravado
     vale como esta. A funcao fica para uma proxima troca de nome. */
  function converterNomeAntigo(nome) {
    return nome;
  }

  var tema = 'verde-claro';
  try { tema = converterNomeAntigo(localStorage.getItem(chaveDoUsuario())) || tema; } catch (_) {}
  try {
    if (parent !== window) tema = parent.document.documentElement.getAttribute('data-theme') || tema;
  } catch (_) {}

  var documentos = new WeakSet();
  function propagar(doc, novo) {
    try {
      if (doc.documentElement && doc.documentElement.getAttribute('data-theme') !== novo)
        doc.documentElement.setAttribute('data-theme', novo);
      if (doc.body && doc.body.getAttribute('data-theme') !== novo) doc.body.setAttribute('data-theme', novo);
      if (!documentos.has(doc)) {
        documentos.add(doc);
        doc.addEventListener('load', function (e) {
          if (e.target.tagName === 'IFRAME') {
            try { propagar(e.target.contentDocument, document.documentElement.getAttribute('data-theme')); } catch (_) {}
          }
        }, true);
      }
      doc.querySelectorAll('iframe').forEach(function (frame) {
        try { if (frame.contentDocument) propagar(frame.contentDocument, novo); } catch (_) {}
      });
    } catch (_) {}
  }
  propagar(document, tema);
  new MutationObserver(function () {
    tema = document.documentElement.getAttribute('data-theme') || 'verde-claro';
    propagar(document, tema);
  }).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
  document.addEventListener('DOMContentLoaded', function () { propagar(document, tema); });
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin && e.origin !== 'null' || e.source !== parent) return;
    var d = e.data || {};
    if (d.origem !== 'FACILAPP_TEMA_ALTERADO') return;
    var novo = d.tema || d.skinId || d.skin;
    if (!novo) return;
    tema = novo;
    propagar(document, novo);
    try { localStorage.setItem(chaveDoUsuario(), novo); } catch (_) {}
  });
})();
