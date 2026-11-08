/* PlanilhaExcel.js — conversão da FacilApp Planilha (13/09/2026).

   FortuneSheet guarda as abas no formato Luckysheet; aqui ficam as pontes:
     FacilAppPlanilhaExcel.lerXlsx(buffer)      -> Promise<abas>   (ExcelJS)
     FacilAppPlanilhaExcel.gerarXlsx(abas)      -> Promise<ArrayBuffer>
     FacilAppPlanilhaExcel.lerOutros(buffer)    -> abas  (.xls/.ods pelo SheetJS: valores, mescla, larguras)
     FacilAppPlanilhaExcel.lerCsv(texto, nome)  -> abas
     FacilAppPlanilhaExcel.gerarCsv(aba)        -> string (separador ; como o Excel em português)

   O .xlsx leva: valores, fórmulas, formato de número/data, fonte (nome, tamanho,
   negrito, itálico, sublinhado, tachado, cor), preenchimento, alinhamento,
   quebra de texto, rotação, bordas, mesclagem, largura/altura, linhas e
   colunas ocultas, congelamento e links. Formatação condicional, validação,
   comentários e imagens só ficam no formato próprio (.json), que guarda tudo.

   Estilos no Luckysheet: bl negrito, it itálico, un sublinhado, cl tachado,
   ff fonte, fs tamanho (pt), fc cor, bg fundo, ht 0 centro/1 esquerda/2 direita,
   vt 0 meio/1 topo/2 base, tb '0' corta/'1' transborda/'2' quebra, ct {fa, t}. */
(function (root) {
  'use strict';

  var ESTILO_BORDA = {1: 'thin', 2: 'hair', 3: 'dotted', 4: 'dashed', 5: 'dashDot', 6: 'dashDotDot', 7: 'double',
    8: 'medium', 9: 'mediumDashed', 10: 'mediumDashDot', 11: 'mediumDashDotDot', 12: 'slantDashDot', 13: 'thick'};
  var BORDA_ESTILO = {};
  Object.keys(ESTILO_BORDA).forEach(function (k) { BORDA_ESTILO[ESTILO_BORDA[k]] = Number(k); });
  var FONTES = ['Times New Roman', 'Arial', 'Tahoma', 'Verdana', 'Microsoft YaHei', 'SimSun', 'SimHei', 'KaiTi', 'FangSong', 'NSimSun', 'STXinwei', 'STXingkai', 'STLiti', 'HanaMinA', 'HanaMinB', 'HuaWenCaiYun'];
  var EPOCA_EXCEL = Date.UTC(1899, 11, 30);

  /* ---------------------------------------------------------------- cores */
  function corParaArgb(cor) {
    if (!cor) return null;
    var s = String(cor).trim(), m;
    if ((m = s.match(/^#([0-9a-f]{3})$/i))) s = '#' + m[1].split('').map(function (x) { return x + x; }).join('');
    if ((m = s.match(/^#([0-9a-f]{6})$/i))) return 'FF' + m[1].toUpperCase();
    if ((m = s.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i))) {
      return 'FF' + [m[1], m[2], m[3]].map(function (n) { return ('0' + Number(n).toString(16)).slice(-2); }).join('').toUpperCase();
    }
    return null;
  }
  function argbParaCor(c) {
    if (!c || !c.argb) return null;
    var a = String(c.argb);
    return '#' + (a.length === 8 ? a.slice(2) : a).toLowerCase();
  }

  /* ------------------------------------------------------ endereço A1 <-> r,c */
  function colunaParaIndice(letras) {
    var n = 0;
    for (var i = 0; i < letras.length; i++) n = n * 26 + (letras.charCodeAt(i) - 64);
    return n - 1;
  }
  function enderecoParaRc(end) {
    var m = String(end).replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/i);
    return m ? {r: Number(m[2]) - 1, c: colunaParaIndice(m[1].toUpperCase())} : null;
  }

  function larguraPx(chars) { return Math.round((chars || 8.43) * 7 + 5); }
  function alturaPx(pt) { return Math.round((pt || 15) * 4 / 3); }

  /* ================================================================ LER XLSX */
  async function lerXlsx(buffer) {
    if (!root.ExcelJS) throw new Error('ExcelJS não carregado (dependencias/exceljs-4.4.0).');
    var wb = new root.ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    var abas = [];
    wb.eachSheet(function (ws, idx) {
      var celldata = [], config = {merge: {}, rowlen: {}, columnlen: {}, rowhidden: {}, colhidden: {}, borderInfo: []};
      var hyperlink = {}, maxR = 0, maxC = 0;

      (ws.columns || []).forEach(function (col, c) {
        if (!col) return;
        if (col.width) config.columnlen[c] = larguraPx(col.width);
        if (col.hidden) config.colhidden[c] = 0;
      });

      ws.eachRow({includeEmpty: true}, function (row, rn) {
        var r = rn - 1;
        if (row.height) config.rowlen[r] = alturaPx(row.height);
        if (row.hidden) config.rowhidden[r] = 0;
        row.eachCell({includeEmpty: true}, function (cell, cn) {
          var c = cn - 1, v = {}, valor = cell.value;
          /* célula vazia só interessa se tiver estilo (borda, fundo) */
          if ((valor === null || valor === undefined) && !cell.border && !cell.fill && !cell.isMerged) return;
          if (cell.isMerged && cell.master && cell.master.address !== cell.address) return;
          /* valor */
          if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
            if (valor.formula || valor.sharedFormula) {
              v.f = '=' + (valor.formula || cell.formula || '');
              valor = valor.result;
              if (valor && typeof valor === 'object' && valor.error) valor = valor.error;
            } else if (valor.richText) {
              valor = valor.richText.map(function (p) { return p.text; }).join('');
            } else if (valor.hyperlink) {
              hyperlink[r + '_' + c] = {linkType: 'webpage', linkAddress: valor.hyperlink};
              valor = valor.text || valor.hyperlink;
              v.fc = '#0000ff'; v.un = 1;
            } else if (valor.error) {
              valor = valor.error;
            }
          }
          var fa = cell.numFmt || 'General';
          if (valor instanceof Date) {
            v.v = (valor.getTime() - EPOCA_EXCEL) / 86400000;
            v.ct = {fa: /[dmy]/i.test(fa) ? fa : 'dd/MM/yyyy', t: 'd'};
          } else if (typeof valor === 'number') {
            v.v = valor;
            v.ct = {fa: fa, t: 'n'};
          } else if (typeof valor === 'boolean') {
            v.v = valor ? 'TRUE' : 'FALSE';
            v.ct = {fa: 'General', t: 'b'};
          } else if (valor !== null && valor !== undefined) {
            v.v = String(valor);
            v.m = String(valor);
            v.ct = {fa: fa === 'General' ? 'General' : fa, t: fa === '@' ? 's' : 'g'};
          }
          /* estilo */
          var f = cell.font || {};
          if (f.bold) v.bl = 1;
          if (f.italic) v.it = 1;
          if (f.underline) v.un = 1;
          if (f.strike) v.cl = 1;
          if (f.size) v.fs = f.size;
          if (f.name) v.ff = f.name;
          if (argbParaCor(f.color)) v.fc = argbParaCor(f.color);
          var fill = cell.fill;
          if (fill && fill.type === 'pattern' && fill.pattern && fill.pattern !== 'none') {
            var bg = argbParaCor(fill.fgColor) || argbParaCor(fill.bgColor);
            if (bg) v.bg = bg;
          }
          var al = cell.alignment || {};
          if (al.horizontal) v.ht = {center: 0, centerContinuous: 0, left: 1, right: 2}[al.horizontal];
          if (al.vertical) v.vt = {middle: 0, top: 1, bottom: 2}[al.vertical];
          if (al.wrapText) v.tb = '2';
          if (al.textRotation === 'vertical') v.tr = '3';
          else if (al.textRotation === 45) v.tr = '1';
          else if (al.textRotation === -45 || al.textRotation === 135) v.tr = '2';
          if (v.ht === undefined) delete v.ht;
          if (v.vt === undefined) delete v.vt;
          /* borda */
          var b = cell.border;
          if (b && (b.left || b.right || b.top || b.bottom)) {
            var lado = function (x) { return x && x.style ? {style: BORDA_ESTILO[x.style] || 1, color: argbParaCor(x.color) || '#000000'} : null; };
            config.borderInfo.push({rangeType: 'cell', value: {row_index: r, col_index: c, l: lado(b.left), r: lado(b.right), t: lado(b.top), b: lado(b.bottom)}});
          }
          if (!Object.keys(v).length) return;
          celldata.push({r: r, c: c, v: v});
          maxR = Math.max(maxR, r); maxC = Math.max(maxC, c);
        });
      });

      /* mesclas */
      var merges = (ws.model && ws.model.merges) || [];
      merges.forEach(function (faixa) {
        var p = String(faixa).split(':'), a = enderecoParaRc(p[0]), z = enderecoParaRc(p[1] || p[0]);
        if (!a || !z) return;
        var rs = z.r - a.r + 1, cs = z.c - a.c + 1;
        config.merge[a.r + '_' + a.c] = {r: a.r, c: a.c, rs: rs, cs: cs};
        var mestre = celldata.find(function (x) { return x.r === a.r && x.c === a.c; });
        if (!mestre) { mestre = {r: a.r, c: a.c, v: {}}; celldata.push(mestre); }
        mestre.v.mc = {r: a.r, c: a.c, rs: rs, cs: cs};
        for (var rr = a.r; rr <= z.r; rr++) for (var cc = a.c; cc <= z.c; cc++) {
          if (rr === a.r && cc === a.c) continue;
          var filha = celldata.find(function (x) { return x.r === rr && x.c === cc; });
          if (filha) filha.v = {mc: {r: a.r, c: a.c}};
          else celldata.push({r: rr, c: cc, v: {mc: {r: a.r, c: a.c}}});
        }
        maxR = Math.max(maxR, z.r); maxC = Math.max(maxC, z.c);
      });

      var aba = {
        name: ws.name || ('Planilha' + idx), order: abas.length, status: abas.length ? 0 : 1,
        celldata: celldata, config: config,
        row: Math.max(100, maxR + 20), column: Math.max(26, maxC + 5)
      };
      if (Object.keys(hyperlink).length) aba.hyperlink = hyperlink;
      if (ws.state === 'hidden' || ws.state === 'veryHidden') aba.hide = 1;
      var tab = ws.properties && ws.properties.tabColor;
      if (tab && argbParaCor(tab)) aba.color = argbParaCor(tab);
      var vista = (ws.views || [])[0];
      if (vista && vista.state === 'frozen' && (vista.xSplit || vista.ySplit)) {
        var xs = vista.xSplit || 0, ys = vista.ySplit || 0;
        aba.frozen = xs && ys ? {type: 'rangeBoth', range: {row_focus: ys - 1, column_focus: xs - 1}}
          : ys ? {type: 'rangeRow', range: {row_focus: ys - 1, column_focus: 0}}
          : {type: 'rangeColumn', range: {row_focus: 0, column_focus: xs - 1}};
      }
      if (vista && vista.showGridLines === false) aba.showGridLines = 0;
      abas.push(aba);
    });
    return abas.length ? abas : [abaVazia('Planilha1')];
  }

  /* =============================================================== GERAR XLSX */
  function bordasCalculadas(config, linhas, colunas) {
    var mapa = {};
    function pegar(r, c) { return (mapa[r + '_' + c] = mapa[r + '_' + c] || {}); }
    (config && config.borderInfo || []).forEach(function (info) {
      if (info.rangeType === 'cell') {
        var v = info.value || {}, alvo = pegar(v.row_index, v.col_index);
        ['l', 'r', 't', 'b'].forEach(function (k) { if (v[k] !== undefined) alvo[k] = v[k]; });
        return;
      }
      var lado = {style: Number(info.style) || 1, color: info.color || '#000000'};
      (info.range || []).forEach(function (faixa) {
        var r1 = faixa.row[0], r2 = faixa.row[1], c1 = faixa.column[0], c2 = faixa.column[1];
        r2 = Math.min(r2, linhas - 1); c2 = Math.min(c2, colunas - 1);
        for (var r = r1; r <= r2; r++) for (var c = c1; c <= c2; c++) {
          var x = pegar(r, c), t = info.borderType;
          if (t === 'border-none') { x.l = x.r = x.t = x.b = null; continue; }
          if (t === 'border-all') { x.l = x.r = x.t = x.b = lado; continue; }
          if ((t === 'border-outside' || t === 'border-left') && c === c1) x.l = lado;
          if ((t === 'border-outside' || t === 'border-right') && c === c2) x.r = lado;
          if ((t === 'border-outside' || t === 'border-top') && r === r1) x.t = lado;
          if ((t === 'border-outside' || t === 'border-bottom') && r === r2) x.b = lado;
          if (t === 'border-inside' || t === 'border-vertical') { if (c > c1) x.l = lado; if (c < c2) x.r = lado; }
          if (t === 'border-inside' || t === 'border-horizontal') { if (r > r1) x.t = lado; if (r < r2) x.b = lado; }
        }
      });
    });
    return mapa;
  }

  function matrizDaAba(aba) {
    if (Array.isArray(aba.data) && aba.data.length) return aba.data;
    var m = [];
    (aba.celldata || []).forEach(function (x) { (m[x.r] = m[x.r] || [])[x.c] = x.v; });
    return m;
  }

  function nomeFonte(ff) {
    if (ff === undefined || ff === null || ff === '') return undefined;
    return typeof ff === 'number' || /^\d+$/.test(String(ff)) ? (FONTES[Number(ff)] || 'Arial') : String(ff);
  }

  async function gerarXlsx(abas) {
    if (!root.ExcelJS) throw new Error('ExcelJS não carregado (dependencias/exceljs-4.4.0).');
    var wb = new root.ExcelJS.Workbook();
    wb.creator = 'FacilApp Planilha';
    wb.created = new Date();
    var nomes = {};
    (abas || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).forEach(function (aba, idx) {
      var nome = String(aba.name || ('Planilha' + (idx + 1))).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31) || ('Planilha' + (idx + 1));
      while (nomes[nome.toLowerCase()]) nome = nome.slice(0, 28) + '_' + idx;
      nomes[nome.toLowerCase()] = 1;
      var cfg = aba.config || {};
      var ws = wb.addWorksheet(nome, {
        properties: aba.color ? {tabColor: {argb: corParaArgb(aba.color)}} : {},
        state: aba.hide ? 'hidden' : 'visible'
      });
      var dados = matrizDaAba(aba);
      var linhas = Math.max(dados.length, 1), colunas = 1;
      dados.forEach(function (l) { if (l) colunas = Math.max(colunas, l.length); });
      var bordas = bordasCalculadas(cfg, linhas + 1, colunas + 1);
      var links = aba.hyperlink || {};

      /* Percorre linha x coluna (não forEach): matriz esparsa pula buracos e a célula
         vazia só com borda sumia. */
      Object.keys(bordas).forEach(function (k) {
        var p = k.split('_');
        linhas = Math.max(linhas, Number(p[0]) + 1); colunas = Math.max(colunas, Number(p[1]) + 1);
      });
      for (var r = 0; r < linhas; r++) {
        var linha = dados[r] || [];
        for (var c = 0; c < colunas; c++) (function (v, r, c) {
          var chaveB = bordas[r + '_' + c];
          if (!v && !chaveB) return;
          var cell = ws.getCell(r + 1, c + 1);
          if (v) {
            if (v.mc && v.mc.rs === undefined) { /* célula coberta pela mescla */ }
            else {
              var ct = v.ct || {}, valor = v.v;
              if (valor === undefined || valor === null) valor = null;
              if (ct.t === 'n' || ct.t === 'd' || typeof valor === 'number') {
                var n = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'));
                if (!isNaN(n) && valor !== null && valor !== '') valor = n;
              } else if (ct.t === 'b') {
                valor = String(valor).toUpperCase() === 'TRUE';
              } else if (valor !== null && typeof valor !== 'string') {
                valor = String(valor);
              }
              if (v.ct && v.ct.s && Array.isArray(v.ct.s)) {         // texto rico (célula com vários estilos)
                valor = v.ct.s.map(function (p) { return p.v || ''; }).join('');
              }
              var link = links[r + '_' + c];
              if (v.f) cell.value = {formula: String(v.f).replace(/^=/, ''), result: valor === null ? undefined : valor};
              else if (link && link.linkType === 'webpage') cell.value = {text: String(valor === null ? link.linkAddress : valor), hyperlink: link.linkAddress};
              else cell.value = valor;
              if (ct.fa && ct.fa !== 'General') cell.numFmt = ct.fa;
              else if (ct.t === 'd') cell.numFmt = 'dd/mm/yyyy';
            }
            var font = {};
            if (v.bl) font.bold = true;
            if (v.it) font.italic = true;
            if (v.un) font.underline = true;
            if (v.cl) font.strike = true;
            if (v.fs) font.size = Number(v.fs);
            if (nomeFonte(v.ff)) font.name = nomeFonte(v.ff);
            if (corParaArgb(v.fc)) font.color = {argb: corParaArgb(v.fc)};
            if (Object.keys(font).length) cell.font = font;
            if (corParaArgb(v.bg)) cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: corParaArgb(v.bg)}};
            var al = {};
            if (v.ht !== undefined && v.ht !== null) al.horizontal = {0: 'center', 1: 'left', 2: 'right'}[v.ht];
            if (v.vt !== undefined && v.vt !== null) al.vertical = {0: 'middle', 1: 'top', 2: 'bottom'}[v.vt];
            if (String(v.tb) === '2') al.wrapText = true;
            if (String(v.tr) === '1') al.textRotation = 45;
            else if (String(v.tr) === '2') al.textRotation = -45;
            else if (String(v.tr) === '3') al.textRotation = 'vertical';
            if (Object.keys(al).length) cell.alignment = al;
          }
          if (chaveB) {
            var borda = {};
            [['l', 'left'], ['r', 'right'], ['t', 'top'], ['b', 'bottom']].forEach(function (p) {
              var x = chaveB[p[0]];
              if (x) borda[p[1]] = {style: ESTILO_BORDA[Number(x.style)] || 'thin', color: {argb: corParaArgb(x.color) || 'FF000000'}};
            });
            if (Object.keys(borda).length) cell.border = borda;
          }
        })(linha[c], r, c);
      }

      Object.keys(cfg.merge || {}).forEach(function (k) {
        var m = cfg.merge[k];
        if (m.rs > 1 || m.cs > 1) {
          try { ws.mergeCells(m.r + 1, m.c + 1, m.r + m.rs, m.c + m.cs); } catch (e) { /* mescla sobreposta: ignora */ }
        }
      });
      Object.keys(cfg.columnlen || {}).forEach(function (c) { ws.getColumn(Number(c) + 1).width = Math.max(1, (cfg.columnlen[c] - 5) / 7); });
      Object.keys(cfg.colhidden || {}).forEach(function (c) { ws.getColumn(Number(c) + 1).hidden = true; });
      Object.keys(cfg.rowlen || {}).forEach(function (r) { ws.getRow(Number(r) + 1).height = cfg.rowlen[r] * 0.75; });
      Object.keys(cfg.rowhidden || {}).forEach(function (r) { ws.getRow(Number(r) + 1).hidden = true; });

      var fr = aba.frozen, vista = {};
      if (fr && fr.type) {
        var rf = fr.range ? fr.range.row_focus + 1 : 1, cf = fr.range ? fr.range.column_focus + 1 : 1;
        if (fr.type === 'row') vista = {state: 'frozen', ySplit: 1};
        else if (fr.type === 'column') vista = {state: 'frozen', xSplit: 1};
        else if (fr.type === 'both') vista = {state: 'frozen', xSplit: 1, ySplit: 1};
        else if (fr.type === 'rangeRow') vista = {state: 'frozen', ySplit: rf};
        else if (fr.type === 'rangeColumn') vista = {state: 'frozen', xSplit: cf};
        else if (fr.type === 'rangeBoth') vista = {state: 'frozen', xSplit: cf, ySplit: rf};
      }
      if (aba.showGridLines === 0 || aba.showGridLines === false) vista.showGridLines = false;
      if (Object.keys(vista).length) ws.views = [vista];
    });
    if (!wb.worksheets.length) wb.addWorksheet('Planilha1');
    return wb.xlsx.writeBuffer();
  }

  /* ========================================================= .xls / .ods (SheetJS) */
  function lerOutros(buffer) {
    if (!root.XLSX) throw new Error('SheetJS não carregado (dependencias/sheetjs-0.20.3).');
    var wb = root.XLSX.read(new Uint8Array(buffer), {type: 'array', cellDates: true, cellNF: true, cellStyles: true});
    return wb.SheetNames.map(function (nome, i) {
      var ws = wb.Sheets[nome], celldata = [], config = {merge: {}, columnlen: {}, rowlen: {}};
      var faixa = ws['!ref'] ? root.XLSX.utils.decode_range(ws['!ref']) : {s: {r: 0, c: 0}, e: {r: 0, c: 0}};
      Object.keys(ws).forEach(function (end) {
        if (end[0] === '!') return;
        var rc = root.XLSX.utils.decode_cell(end), cel = ws[end], v = {};
        if (cel.f) v.f = '=' + cel.f;
        if (cel.t === 'n') { v.v = cel.v; v.ct = {fa: cel.z || 'General', t: 'n'}; }
        else if (cel.t === 'd') { v.v = (cel.v.getTime() - EPOCA_EXCEL) / 86400000; v.ct = {fa: 'dd/MM/yyyy', t: 'd'}; }
        else if (cel.t === 'b') { v.v = cel.v ? 'TRUE' : 'FALSE'; v.ct = {fa: 'General', t: 'b'}; }
        else { v.v = String(cel.w !== undefined ? cel.w : cel.v); v.m = v.v; v.ct = {fa: 'General', t: 'g'}; }
        celldata.push({r: rc.r, c: rc.c, v: v});
      });
      (ws['!merges'] || []).forEach(function (m) {
        var rs = m.e.r - m.s.r + 1, cs = m.e.c - m.s.c + 1;
        config.merge[m.s.r + '_' + m.s.c] = {r: m.s.r, c: m.s.c, rs: rs, cs: cs};
        var mestre = celldata.find(function (x) { return x.r === m.s.r && x.c === m.s.c; });
        if (!mestre) { mestre = {r: m.s.r, c: m.s.c, v: {}}; celldata.push(mestre); }
        mestre.v.mc = {r: m.s.r, c: m.s.c, rs: rs, cs: cs};
      });
      (ws['!cols'] || []).forEach(function (col, c) { if (col && (col.wpx || col.wch)) config.columnlen[c] = col.wpx || larguraPx(col.wch); });
      (ws['!rows'] || []).forEach(function (row, r) { if (row && (row.hpx || row.hpt)) config.rowlen[r] = row.hpx || alturaPx(row.hpt); });
      return {name: nome, order: i, status: i ? 0 : 1, celldata: celldata, config: config,
        row: Math.max(100, faixa.e.r + 20), column: Math.max(26, faixa.e.c + 5)};
    });
  }

  /* ==================================================================== CSV */
  function lerCsv(texto, nome) {
    texto = String(texto).replace(/^﻿/, '');
    var primeira = texto.split(/\r?\n/)[0] || '';
    var sep = [';', '\t', ','].sort(function (a, b) { return primeira.split(b).length - primeira.split(a).length; })[0];
    var linhas = [], campo = '', linha = [], aspas = false;
    for (var i = 0; i < texto.length; i++) {
      var ch = texto[i];
      if (aspas) {
        if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (ch === '"') aspas = false;
        else campo += ch;
      } else if (ch === '"') aspas = true;
      else if (ch === sep) { linha.push(campo); campo = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && texto[i + 1] === '\n') i++;
        linha.push(campo); linhas.push(linha); linha = []; campo = '';
      } else campo += ch;
    }
    if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
    var celldata = [], maxC = 0;
    linhas.forEach(function (l, r) {
      maxC = Math.max(maxC, l.length);
      l.forEach(function (txt, c) {
        if (txt === '') return;
        var num = /^-?[\d.]*\d(,\d+)?$/.test(txt) && sep !== ',' ? Number(txt.replace(/\./g, '').replace(',', '.'))
          : /^-?\d+(\.\d+)?$/.test(txt) ? Number(txt) : NaN;
        celldata.push({r: r, c: c, v: isNaN(num) ? {v: txt, m: txt, ct: {fa: 'General', t: 'g'}} : {v: num, ct: {fa: 'General', t: 'n'}}});
      });
    });
    return [{name: String(nome || 'Planilha1').replace(/\.[^.]+$/, '').slice(0, 31), order: 0, status: 1, celldata: celldata,
      config: {}, row: Math.max(100, linhas.length + 20), column: Math.max(26, maxC + 5)}];
  }

  function gerarCsv(aba) {
    var dados = matrizDaAba(aba);
    return '﻿' + dados.map(function (linha) {
      return (linha || []).map(function (v) {
        if (!v) return '';
        var t = v.m !== undefined && v.m !== null ? v.m : (v.v !== undefined && v.v !== null ? v.v : '');
        if (v.ct && Array.isArray(v.ct.s)) t = v.ct.s.map(function (p) { return p.v || ''; }).join('');
        t = String(t);
        return /[;"\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
      }).join(';');
    }).join('\r\n');
  }

  function abaVazia(nome) {
    return {name: nome || 'Planilha1', order: 0, status: 1, celldata: [], config: {}, row: 100, column: 26};
  }

  root.FacilAppPlanilhaExcel = {lerXlsx: lerXlsx, gerarXlsx: gerarXlsx, lerOutros: lerOutros, lerCsv: lerCsv,
    gerarCsv: gerarCsv, abaVazia: abaVazia, bordasCalculadas: bordasCalculadas};
})(typeof window !== 'undefined' ? window : globalThis);
