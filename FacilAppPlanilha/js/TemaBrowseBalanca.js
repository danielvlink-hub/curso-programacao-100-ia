/* ==========================================================================
   Propaga o tema para as telas em iframe

   Browse, cadastro e relatorio abrem dentro de iframe e nao herdam o data-theme
   da tela de cima sozinhos. Este arquivo sincroniza os dois.

   Ele nao define cor: so repassa qual tema esta ativo.

   Carregado por: todas as telas que abrem em camada
   ========================================================================== */
/** Browses usam a paleta oficial do data-theme, sem copiar ou recalcular cores. */
(function () {
  'use strict';
  function aplicar(novo) {
    if (!novo) return;
    document.documentElement.setAttribute('data-theme', novo);
    if (document.body) document.body.setAttribute('data-theme', novo);
    sincronizarPaleta();
  }
  function sincronizarPaleta() {
    try {
      var origem = parent !== window ? parent : window.opener;
      if (!origem || origem === window) return;
      var css = origem.getComputedStyle(origem.document.documentElement);
      var mapa = {
        '--background':'--bg-app', '--bg':'--bg-app',
        '--panel':'--bg-surface', '--card':'--bg-surface',
        '--panel-alt':'--bg-card-inner',
        '--border':'--border-glass', '--line':'--border-glass',
        '--text':'--text-primary', '--txt':'--text-primary',
        '--text-dim':'--text-muted', '--mut':'--text-muted',
        '--primary':'--contour-primary',
        '--primary-dark':'--facilapp-btn-menu-border',
        '--accent':'--contour-gold',
        '--fa-background':'--bg-app',
        '--fa-panel':'--bg-surface',
        '--fa-panel-alt':'--bg-card-inner',
        '--fa-border':'--border-glass',
        '--fa-field-bg':'--bg-card-inner',
        '--fa-text':'--text-primary',
        '--fa-muted':'--text-muted',
        '--fa-primary':'--contour-primary',
        '--fa-primary-dark':'--facilapp-btn-menu-border',
        '--fa-accent':'--contour-gold',
        '--fa-button-bg':'--contour-primary',
        '--fa-button-border':'--facilapp-btn-menu-border',
        '--fa-button-hover-bg':'--facilapp-btn-menu-border',
        '--fa-button-hover-border':'--facilapp-btn-menu-border',
        '--fa-modal-header-bg':'--bg-card-inner'
      };
      Object.keys(mapa).forEach(function (destino) {
        var valor = css.getPropertyValue(mapa[destino]).trim();
        if (valor) document.documentElement.style.setProperty(destino, valor);
      });
    } catch (_) {}
  }
  function temaDaOrigem() {
    try {
      var origem = parent !== window ? parent : window.opener;
      if (origem && origem !== window) return origem.document.documentElement.getAttribute('data-theme');
    } catch (_) {}
    return document.documentElement.getAttribute('data-theme') || 'verde-claro';
  }
  aplicar(temaDaOrigem());
  document.addEventListener('DOMContentLoaded', function () { aplicar(temaDaOrigem()); });
  try {
    var origem = parent !== window ? parent : window.opener;
    if (origem && origem !== window) new MutationObserver(function () { aplicar(temaDaOrigem()); })
      .observe(origem.document.documentElement, {attributes:true, attributeFilter:['data-theme']});
  } catch (_) {}
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.origem === 'FACILAPP_TEMA_ALTERADO') aplicar(d.tema || d.skinId || d.skin);
  });
})();
