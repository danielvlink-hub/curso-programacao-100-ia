/* ==========================================================================
   PdfFacilApp.js — gravar PDF no FacilApp (13/09/2026)

   Biblioteca local: pdf-lib 1.17.1 (MIT), em dependencias/pdf-lib-1.17.1.
   Gera o PDF com texto de verdade (selecionável e pesquisável).

   API:
     FacilAppPdf.gerar(html, {papelMm:{w,h}, margemMm:{cima,baixo,esq,dir}})
        -> Promise<Uint8Array> (bytes do .pdf)
        Parágrafos e títulos, negrito, itálico, sublinhado, tamanho de fonte,
        alinhamento, listas, tabelas simples, linha horizontal e quebra de página.

   Importar PDF não é mais daqui: a API FacilApp converte o PDF em DOCX
   (POST /api/documentos/pdf-para-docx) e o DOCX entra no editor pelo mammoth.
   O PDF.js foi excluído em 13/09/2026 (a importação por ele não tinha fidelidade).
   ========================================================================== */
(function (root) {
  'use strict';
  var MM = 72 / 25.4;                                   // pontos por milímetro

  function libPdf() {
    var L = root.PDFLib;
    if (!L) throw new Error('pdf-lib não carregado (dependencias/pdf-lib-1.17.1).');
    return L;
  }

  /* ---------------------------------------------------------------- GERAR */
  var TITULO_PT = {h1: 22, h2: 17, h3: 14, h4: 12, h5: 11, h6: 10};

  function tamanhoPt(valor, padrao) {
    var m = String(valor || '').match(/([\d.]+)\s*(px|pt)?/i);
    if (!m) return padrao;
    var n = parseFloat(m[1]);
    return (m[2] || 'px').toLowerCase() === 'pt' ? n : n * 0.75;
  }

  function alinh(el) {
    var a = String((el.style && el.style.textAlign) || (el.getAttribute && el.getAttribute('align')) || '').toLowerCase();
    return a === 'center' || a === 'right' ? a : 'left';
  }

  /* Runs de texto com estilo herdado: {t, b, i, u, pt}. */
  function runs(no, herdado, saida) {
    saida = saida || [];
    if (no.nodeType === 3) { saida.push(Object.assign({t: no.nodeValue.replace(/\s+/g, ' ')}, herdado)); return saida; }
    if (no.nodeType !== 1) return saida;
    var tag = no.tagName.toLowerCase();
    if (tag === 'br') { saida.push(Object.assign({t: '\n'}, herdado)); return saida; }
    if (tag === 'img') return saida;
    var e = Object.assign({}, herdado), st = no.style || {};
    if (tag === 'b' || tag === 'strong' || st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) e.b = true;
    if (tag === 'i' || tag === 'em' || st.fontStyle === 'italic') e.i = true;
    if (tag === 'u' || /underline/.test(st.textDecoration || '')) e.u = true;
    if (st.fontSize) e.pt = tamanhoPt(st.fontSize, e.pt);
    for (var k = 0; k < no.childNodes.length; k++) runs(no.childNodes[k], e, saida);
    return saida;
  }

  var BLOCOS = {p: 1, div: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, ul: 1, ol: 1, table: 1, blockquote: 1, section: 1, hr: 1};
  function temBloco(no) {
    return [].some.call(no.childNodes, function (f) { return f.nodeType === 1 && BLOCOS[f.tagName.toLowerCase()]; });
  }

  function blocosDoHtml(html) {
    var doc = new DOMParser().parseFromString('<div>' + String(html || '') + '</div>', 'text/html');
    var blocos = [];
    function visitar(no, herdado) {
      if (no.nodeType === 3) { if (no.nodeValue.trim()) blocos.push({tipo: 'p', alinh: 'left', runs: runs(no, herdado)}); return; }
      if (no.nodeType !== 1) return;
      var tag = no.tagName.toLowerCase(), st = no.style || {};
      var e = Object.assign({}, herdado);
      if (st.fontSize) e.pt = tamanhoPt(st.fontSize, e.pt);
      if (st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) e.b = true;
      if (tag === 'hr') { blocos.push({tipo: 'hr'}); return; }
      if (tag === 'table') {
        var linhas = [].filter.call(no.querySelectorAll('tr'), function (tr) { return tr.closest('table') === no; }).map(function (tr) {
          return [].filter.call(tr.children, function (c) { return /^(td|th)$/i.test(c.tagName); }).map(function (c) {
            var ce = Object.assign({}, e, c.tagName.toLowerCase() === 'th' ? {b: true} : {});
            if (c.style && (c.style.fontWeight === 'bold' || Number(c.style.fontWeight) >= 600)) ce.b = true;
            var semBorda = /border\s*:\s*(none|0)/i.test(c.getAttribute('style') || '');
            return {runs: runs(c, ce), alinh: alinh(c), borda: !semBorda};
          });
        });
        var semBordaTabela = /border\s*:\s*(none|0)/i.test(no.getAttribute('style') || '');
        blocos.push({tipo: 'tabela', linhas: linhas, borda: !semBordaTabela});
        return;
      }
      if (tag === 'ul' || tag === 'ol') {
        [].forEach.call(no.children, function (li, i) {
          blocos.push({tipo: 'p', alinh: 'left', recuo: 18, marca: tag === 'ol' ? (i + 1) + '.' : '•', runs: runs(li, e)});
        });
        return;
      }
      if (TITULO_PT[tag]) { blocos.push({tipo: 'p', alinh: alinh(no), runs: runs(no, Object.assign({}, e, {b: true, pt: TITULO_PT[tag]}))}); return; }
      if ((tag === 'div' || tag === 'section' || tag === 'blockquote') && temBloco(no)) {
        [].forEach.call(no.childNodes, function (f) { visitar(f, e); });
        return;
      }
      if (!BLOCOS[tag]) { blocos.push({tipo: 'p', alinh: 'left', runs: runs(no, e)}); return; }
      blocos.push({tipo: 'p', alinh: alinh(no), runs: runs(no, e)});
    }
    [].forEach.call(doc.body.firstChild.childNodes, function (f) { visitar(f, {pt: 11}); });
    return blocos;
  }

  /* Troca caracteres que as fontes padrão do PDF (WinAnsi) não têm. */
  function limpar(t) {
    return String(t).replace(/[    ]/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-').replace(/•/g, '•').replace(/[^\x09\x0a\x20-\x7e -ÿ•€]/g, '');
  }

  async function gerarDeBlocos(blocos, opcoes) {
    var L = libPdf();
    var op = opcoes || {};
    var papel = op.papelMm || {w: 210, h: 297};
    var m = op.margemMm || {cima: 25, baixo: 25, esq: 20, dir: 20};
    var pdf = await L.PDFDocument.create();
    var F = {
      n: await pdf.embedFont(L.StandardFonts.Helvetica),
      b: await pdf.embedFont(L.StandardFonts.HelveticaBold),
      i: await pdf.embedFont(L.StandardFonts.HelveticaOblique),
      bi: await pdf.embedFont(L.StandardFonts.HelveticaBoldOblique)
    };
    var W = papel.w * MM, H = papel.h * MM;
    var esq = m.esq * MM, dir = W - m.dir * MM, topo = H - m.cima * MM, base = m.baixo * MM;
    var pagina = pdf.addPage([W, H]), y = topo;
    var preto = L.rgb(0, 0, 0), cinza = L.rgb(0.45, 0.45, 0.45);

    function fonte(r) { return r.b && r.i ? F.bi : r.b ? F.b : r.i ? F.i : F.n; }
    function novaPagina() { pagina = pdf.addPage([W, H]); y = topo; }

    /* Quebra runs em linhas que cabem na largura. Cada linha = pedaços {t, r, w}. */
    function quebrar(lista, largura) {
      var linhas = [], atual = [], larg = 0, alturaMax = 0;
      function fechar() { linhas.push({pedacos: atual, largura: larg, pt: alturaMax || 11}); atual = []; larg = 0; alturaMax = 0; }
      lista.forEach(function (r) {
        var pt = r.pt || 11, f = fonte(r);
        String(limpar(r.t)).split(/(\n| )/).forEach(function (pal) {
          if (pal === '') return;
          if (pal === '\n') { fechar(); return; }
          var w = f.widthOfTextAtSize(pal, pt);
          if (pal === ' ' && !atual.length) return;
          if (larg + w > largura && atual.length && pal !== ' ') {
            while (atual.length && atual[atual.length - 1].t === ' ') { larg -= atual.pop().w; }
            fechar();
          }
          atual.push({t: pal, r: r, w: w, pt: pt});
          larg += w;
          alturaMax = Math.max(alturaMax, pt);
        });
      });
      if (atual.length || !linhas.length) fechar();
      return linhas;
    }

    function desenharLinha(linha, x0, largura, alinhamento, pag, yy) {
      var x = alinhamento === 'center' ? x0 + (largura - linha.largura) / 2 : alinhamento === 'right' ? x0 + largura - linha.largura : x0;
      linha.pedacos.forEach(function (p) {
        if (p.t !== ' ') {
          pag.drawText(p.t, {x: x, y: yy, size: p.pt, font: fonte(p.r), color: preto});
          if (p.r.u) pag.drawLine({start: {x: x, y: yy - 1.5}, end: {x: x + p.w, y: yy - 1.5}, thickness: 0.6, color: preto});
        } else if (p.r.u) {
          pag.drawLine({start: {x: x, y: yy - 1.5}, end: {x: x + p.w, y: yy - 1.5}, thickness: 0.6, color: preto});
        }
        x += p.w;
      });
    }

    blocos.forEach(function (bl) {
      if (bl.tipo === 'hr') {
        if (y - 10 < base) novaPagina();
        y -= 6;
        pagina.drawLine({start: {x: esq, y: y}, end: {x: dir, y: y}, thickness: 0.7, color: cinza});
        y -= 8;
        return;
      }
      if (bl.tipo === 'tabela') {
        var cols = Math.max.apply(null, bl.linhas.map(function (l) { return l.length; }).concat([1]));
        var larguraCol = (dir - esq) / cols, pad = 3;
        bl.linhas.forEach(function (celulas) {
          var quebradas = celulas.map(function (c) { return quebrar(c.runs, larguraCol - pad * 2); });
          var alturaLinha = Math.max.apply(null, quebradas.map(function (ls) {
            return ls.reduce(function (s, l) { return s + l.pt * 1.25; }, 0);
          }).concat([12])) + pad * 2;
          if (y - alturaLinha < base) novaPagina();
          celulas.forEach(function (c, k) {
            var x0 = esq + k * larguraCol;
            if (bl.borda && c.borda) pagina.drawRectangle({x: x0, y: y - alturaLinha, width: larguraCol, height: alturaLinha, borderColor: cinza, borderWidth: 0.6});
            var yy = y - pad;
            quebradas[k].forEach(function (l) { yy -= l.pt; desenharLinha(l, x0 + pad, larguraCol - pad * 2, c.alinh, pagina, yy); yy -= l.pt * 0.25; });
          });
          y -= alturaLinha;
        });
        y -= 8;
        return;
      }
      var recuo = bl.recuo || 0, larguraTexto = dir - esq - recuo;
      var linhas = quebrar(bl.runs || [], larguraTexto);
      linhas.forEach(function (l, idx) {
        var altura = l.pt * 1.3;
        if (y - altura < base) novaPagina();
        y -= l.pt;
        if (idx === 0 && bl.marca) pagina.drawText(bl.marca, {x: esq + recuo - 12, y: y, size: l.pt, font: F.n, color: preto});
        desenharLinha(l, esq + recuo, larguraTexto, bl.alinh, pagina, y);
        y -= l.pt * 0.3;
      });
      y -= 5;
    });
    return await pdf.save();
  }

  function gerar(html, opcoes) {
    return gerarDeBlocos(blocosDoHtml(html), opcoes);
  }

  root.FacilAppPdf = {gerar: gerar, blocosDoHtml: blocosDoHtml, gerarDeBlocos: gerarDeBlocos};
})(typeof window !== 'undefined' ? window : globalThis);
