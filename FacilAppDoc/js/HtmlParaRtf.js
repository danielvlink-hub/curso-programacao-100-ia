/* ==========================================================================
   HtmlParaRtf — converte o HTML do editor em RTF (13/09/2026)

   Usado pelo "Gravar como" do FacilApp Doc (tipo .rtf). Sem biblioteca.
   Cobre o que o editor produz: parágrafos e títulos, quebra de linha,
   negrito, itálico, sublinhado, tachado, tamanho de fonte, alinhamento
   (esquerda, centro, direita, justificado), listas e tabelas simples.
   Acentos saem como \uNNNN? (Word, WordPad e LibreOffice abrem).

     FacilAppRtf.converter(html, {margemMm:{cima,baixo,esq,dir}, papelMm:{w,h}})

   Não é dele: gravar o arquivo (BrowserFS.salvarArquivo) nem ler RTF (rtf.js).
   ========================================================================== */
(function () {
  'use strict';
  var TWIPS_MM = 56.6929;

  function textoRtf(t) {
    var s = '';
    for (var i = 0; i < t.length; i++) {
      var c = t.charCodeAt(i), ch = t.charAt(i);
      if (ch === '\\' || ch === '{' || ch === '}') s += '\\' + ch;
      else if (c === 160) s += '\\~';
      else if (c > 126) s += '\\u' + (c > 32767 ? c - 65536 : c) + '?';
      else if (c === 9) s += '\\tab ';
      else if (c >= 32) s += ch;
    }
    return s;
  }

  function alinhamento(el) {
    var a = (el.style && el.style.textAlign) || el.getAttribute && el.getAttribute('align') || '';
    a = String(a).toLowerCase();
    return a === 'center' ? '\\qc' : a === 'right' ? '\\qr' : a === 'justify' ? '\\qj' : '\\ql';
  }

  function tamanhoMeiosPontos(valor) {
    var m = String(valor || '').match(/([\d.]+)\s*(px|pt)?/i);
    if (!m) return 0;
    var n = parseFloat(m[1]);
    var pt = (m[2] || 'px').toLowerCase() === 'pt' ? n : n * 0.75;
    return Math.max(2, Math.round(pt * 2));
  }

  function inline(no) {
    if (no.nodeType === 3) return textoRtf(no.nodeValue.replace(/[\r\n]+/g, ' '));
    if (no.nodeType !== 1) return '';
    var tag = no.tagName.toLowerCase();
    if (tag === 'br') return '\\line ';
    if (tag === 'img') return '';
    var abre = '', dentro = filhos(no, inline);
    if (tag === 'b' || tag === 'strong') abre += '\\b ';
    if (tag === 'i' || tag === 'em') abre += '\\i ';
    if (tag === 'u') abre += '\\ul ';
    if (tag === 's' || tag === 'strike' || tag === 'del') abre += '\\strike ';
    var st = no.style || {};
    if (st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) abre += '\\b ';
    if (st.fontStyle === 'italic') abre += '\\i ';
    if (/underline/.test(st.textDecoration || '')) abre += '\\ul ';
    var fs = tamanhoMeiosPontos(st.fontSize);
    if (fs) abre += '\\fs' + fs + ' ';
    return abre ? '{' + abre + dentro + '}' : dentro;
  }

  function filhos(no, fn) {
    var s = '';
    for (var i = 0; i < no.childNodes.length; i++) s += fn(no.childNodes[i]);
    return s;
  }

  var BLOCOS = {p: 1, div: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, ul: 1, ol: 1, table: 1, blockquote: 1, section: 1, hr: 1};
  var TITULO_PT = {h1: 24, h2: 18, h3: 14, h4: 12, h5: 11, h6: 10};

  function temBloco(no) {
    for (var i = 0; i < no.childNodes.length; i++) {
      var f = no.childNodes[i];
      if (f.nodeType === 1 && BLOCOS[f.tagName.toLowerCase()]) return true;
    }
    return false;
  }

  function paragrafo(no, conteudo, extra) {
    var fs = tamanhoMeiosPontos(no.style && no.style.fontSize);
    var negrito = no.style && (no.style.fontWeight === 'bold' || Number(no.style.fontWeight) >= 600);
    return '{\\pard' + alinhamento(no) + '\\sa120 ' + (extra || '') + (fs ? '\\fs' + fs + ' ' : '') + (negrito ? '\\b ' : '') + conteudo + '\\par}\n';
  }

  function tabela(no, larguraTwips) {
    var linhas = no.querySelectorAll('tr'), s = '';
    for (var i = 0; i < linhas.length; i++) {
      var tr = linhas[i];
      if (tr.closest('table') !== no) continue;
      var celulas = [].filter.call(tr.children, function (c) { return /^(td|th)$/i.test(c.tagName); });
      if (!celulas.length) continue;
      var semBorda = /border\s*:\s*(none|0)/i.test(no.getAttribute('style') || '');
      var borda = semBorda ? '' : '\\clbrdrt\\brdrs\\brdrw10\\clbrdrl\\brdrs\\brdrw10\\clbrdrb\\brdrs\\brdrw10\\clbrdrr\\brdrs\\brdrw10';
      s += '\\trowd\\trgaph70';
      var passo = Math.floor(larguraTwips / celulas.length), x = 0;
      celulas.forEach(function (c) {
        var semB = /border\s*:\s*(none|0)/i.test(c.getAttribute('style') || '');
        x += passo;
        s += (semB ? '' : borda) + '\\cellx' + x;
      });
      s += '\n';
      celulas.forEach(function (c) {
        var negrito = c.tagName.toLowerCase() === 'th' || /font-weight\s*:\s*bold/i.test(c.getAttribute('style') || '');
        var partes = temBloco(c)
          ? [].map.call(c.children, function (f) { return filhos(f, inline); }).join('\\line ')
          : filhos(c, inline);
        s += '\\pard\\intbl' + alinhamento(c) + ' ' + (negrito ? '{\\b ' + partes + '}' : partes) + '\\cell\n';
      });
      s += '\\row\n';
    }
    return s + '{\\pard\\par}\n';
  }

  function bloco(no, larguraTwips) {
    if (no.nodeType === 3) return no.nodeValue.trim() ? paragrafo({style: {}}, textoRtf(no.nodeValue)) : '';
    if (no.nodeType !== 1) return '';
    var tag = no.tagName.toLowerCase();
    if (tag === 'table') return tabela(no, larguraTwips);
    if (tag === 'hr') return '{\\pard\\brdrb\\brdrs\\brdrw10\\brsp20 \\par}\n';
    if (tag === 'ul' || tag === 'ol') {
      var n = 0;
      return [].map.call(no.children, function (li) {
        n++;
        var marca = tag === 'ol' ? n + '.' : '\\bullet';
        return '{\\pard\\fi-280\\li560\\sa60 ' + marca + '\\tab ' + filhos(li, inline) + '\\par}\n';
      }).join('');
    }
    if (TITULO_PT[tag]) return paragrafo(no, filhos(no, inline), '\\b\\fs' + TITULO_PT[tag] * 2 + ' ');
    if ((tag === 'div' || tag === 'section' || tag === 'blockquote') && temBloco(no)) {
      return filhos(no, function (f) { return bloco(f, larguraTwips); });
    }
    if (!BLOCOS[tag]) return paragrafo({style: {}}, inline(no));
    return paragrafo(no, filhos(no, inline));
  }

  function converter(html, opcoes) {
    var op = opcoes || {};
    var papel = op.papelMm || {w: 210, h: 297};
    var m = op.margemMm || {cima: 25, baixo: 25, esq: 20, dir: 20};
    var doc = new DOMParser().parseFromString('<div>' + String(html || '') + '</div>', 'text/html');
    var raiz = doc.body.firstChild;
    var largura = Math.round((papel.w - m.esq - m.dir) * TWIPS_MM);
    var corpo = filhos(raiz, function (f) { return bloco(f, largura); });
    return '{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1' +
      '{\\fonttbl{\\f0\\fswiss Arial;}{\\f1\\froman Times New Roman;}}' +
      '\\paperw' + Math.round(papel.w * TWIPS_MM) + '\\paperh' + Math.round(papel.h * TWIPS_MM) +
      '\\margl' + Math.round(m.esq * TWIPS_MM) + '\\margr' + Math.round(m.dir * TWIPS_MM) +
      '\\margt' + Math.round(m.cima * TWIPS_MM) + '\\margb' + Math.round(m.baixo * TWIPS_MM) +
      '\\f0\\fs22\n' + corpo + '}';
  }

  window.FacilAppRtf = {converter: converter};
})();
