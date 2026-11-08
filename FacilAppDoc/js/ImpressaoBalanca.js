/* ==========================================================================
   Impressao do sistema

   Monta o conteudo no documento principal e chama a impressao de la.

   E obrigatorio: as telas rodam dentro de iframe, e ali o navegador bloqueia
   window.open — sem este arquivo o botao de imprimir nao faz nada.

   Carregado por: todas as telas que imprimem
   ========================================================================== */
(function () {
  'use strict';
  function janelaPrincipal() {
    try { return window.top && window.top.document ? window.top : window; }
    catch (_) { return window; }
  }
  function imprimir(html) {
    var destino = janelaPrincipal();
    try {
      var doc = destino.document;
      var idRaiz = 'balanca-print-host';
      var idEstilo = 'balanca-print-style';
      doc.getElementById(idRaiz)?.remove();
      doc.getElementById(idEstilo)?.remove();
      var relatorio = new destino.DOMParser().parseFromString(String(html || ''), 'text/html');
      var raiz = doc.createElement('section');
      raiz.id = idRaiz;
      raiz.innerHTML = relatorio.body.innerHTML;
      var estilo = doc.createElement('style');
      estilo.id = idEstilo;
      estilo.textContent = [].map.call(relatorio.querySelectorAll('style'), function (item) { return item.textContent; }).join('\n') +
        '\n#' + idRaiz + '{display:none}@media print{body.balanca-imprimindo>*:not(#' + idRaiz + '){display:none!important}body.balanca-imprimindo{margin:0!important;padding:0!important;background:#fff!important}body.balanca-imprimindo>#' + idRaiz + ',body.balanca-imprimindo>#' + idRaiz + ' *{visibility:visible!important}body.balanca-imprimindo>#' + idRaiz + '{display:block!important;position:static!important;width:100%!important;margin:0!important;padding:0!important}}';
      doc.head.appendChild(estilo);
      doc.body.appendChild(raiz);
      doc.body.classList.add('balanca-imprimindo');
      var limpar = function () {
        doc.body.classList.remove('balanca-imprimindo');
        raiz.remove();
        estilo.remove();
        destino.removeEventListener('afterprint', limpar);
      };
      destino.addEventListener('afterprint', limpar, {once:true});
      destino.focus();
      destino.print();
      return true;
    } catch (erro) {
      console.error('Falha ao preparar impressão:', erro);
      return false;
    }
  }
  window.FacilAppImpressao = {imprimir: imprimir};
})();
