/* ==========================================================================
   RelatoriosGestao.js — o motor dos relatórios de GESTÃO (Bloco 5): Ocupação e Faturamento.
   Daniel, 08/11/2026: "Sim, Bloco 5" (relatórios de ocupação e faturamento com RevPAR, como os PMS profissionais).

   O QUE FAZ
     Monta a tela inteira dentro da página que chama RelatoriosGestao.iniciar({ modo }):
       - barra: atalhos de período (7 dias, Este mês, Mês passado, Próximos 30), de/até, tipo de quarto (ocupação),
         CSV, XLSX e Imprimir;
       - cartões com os números do período;
       - gráfico de barras por dia (SVG, sem biblioteca; cores do tema);
       - tabela por dia com total no rodapé (e, no faturamento, os quadros por tipo, categoria e forma).
     ocupacao    → taxa média, ADR (diária média vendida), RevPAR (receita ÷ quartos-noite disponíveis), receita.
     faturamento → faturamento (diárias + consumos), diárias, consumos, recebido, ticket médio.
   DADOS: ApiCurso.relatorioOcupacao / relatorioFaturamento / cadastroListar('tipos-quarto'). Tudo é calculado na API
     (Gestao.cs); a tela só desenha. Exportação com SheetJS (já no projeto).
   SAÍDAS: window.Relatorio = { gerar(de, ate, idTipo), dados() } para a Luninha (IAGestao.js).
   PADRÃO: cores --fa-*, cabeçalho 35px, 3px entre blocos, impressão sem barra (@media print).
   ========================================================================== */
(function () {
  'use strict';
  var el = function (id) { return document.getElementById(id); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var moeda = function (v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
  var pct = function (v) { return Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'; };
  var DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var br = function (s) { return s.slice(8, 10) + '/' + s.slice(5, 7); };
  var diaSemana = function (s) { return DIAS[new Date(s + 'T12:00:00').getDay()]; };
  var aviso = function (m) { if (window.FacilAppAviso) FacilAppAviso(m); };

  var modo = '', resultado = null;

  /* cada modo: título, ícone, frase, colunas da tabela (campo, título, formato, total) e os cartões */
  var MODOS = {
    ocupacao: {
      titulo: 'Ocupação', icone: 'analytics', frase: 'Taxa de ocupação, diária média (ADR) e RevPAR por dia',
      colunas: [['data', 'Dia', 'dia'], ['disponiveis', 'Disponíveis', 'num', 'soma'], ['ocupados', 'Ocupados', 'num', 'soma'],
        ['taxa', 'Taxa', 'pct', 'taxa'], ['receita', 'Receita diárias', 'moeda', 'soma'], ['adr', 'ADR', 'moeda', 'adr'], ['revpar', 'RevPAR', 'moeda', 'revpar']],
      cartoes: function (t) {
        return [['Taxa média', pct(t.taxa_media), true], ['ADR (diária média)', moeda(t.adr)], ['RevPAR', moeda(t.revpar), true],
          ['Receita de diárias', moeda(t.receita_diarias)], ['Quartos-noite', t.quartos_noite_vendidos + ' de ' + t.quartos_noite_disponiveis]];
      },
      barras: function (d) { return [{ v: d.taxa, cor: 'var(--fa-primary, #4b5a32)' }]; }, maximo: function () { return 100; },
      rotuloBarra: function (d) { return Math.round(d.taxa) + '%'; }
    },
    faturamento: {
      titulo: 'Faturamento', icone: 'bar_chart', frase: 'Diárias por competência, consumos e o que foi recebido',
      colunas: [['data', 'Dia', 'dia'], ['diarias', 'Diárias', 'moeda', 'soma'], ['consumos', 'Consumos', 'moeda', 'soma'],
        ['total', 'Faturamento', 'moeda', 'soma'], ['recebido', 'Recebido', 'moeda', 'soma']],
      cartoes: function (t) {
        return [['Faturamento', moeda(t.faturamento), true], ['Diárias', moeda(t.diarias)], ['Consumos', moeda(t.consumos)],
          ['Recebido', moeda(t.recebido)], ['Ticket médio', moeda(t.ticket_medio), true]];
      },
      barras: function (d) { return [{ v: d.diarias, cor: 'var(--fa-primary, #4b5a32)' }, { v: d.consumos, cor: '#d97706' }]; },
      maximo: function (dias) { return Math.max(1, Math.max.apply(null, dias.map(function (d) { return d.total; }))); },
      rotuloBarra: function (d) { return d.total ? moeda(d.total).replace('R$', '').trim().replace(/,\d\d$/, '') : ''; }
    }
  };

  // =================================================================================================
  // MONTAGEM
  // =================================================================================================
  function montar(cfg) {
    var css = document.createElement('style');
    css.textContent =
      '.rg-corpo{flex:1;min-height:0;overflow-y:auto;margin:3px 12px;display:flex;flex-direction:column;gap:3px}' +
      '.rg-cartoes{display:flex;gap:3px}.rg-cartao{flex:1;border:1px solid var(--fa-border,#d8ddcf);border-radius:6px;padding:4px 10px;background:var(--fa-field-bg,#fff)}' +
      '.rg-cartao span{display:block;font-size:10.5px;text-transform:uppercase;font-weight:700;color:var(--fa-muted,#64748b)}' +
      '.rg-cartao b{font-size:17px}.rg-cartao.destaque b{color:var(--fa-primary,#4b5a32)}' +
      '.rg-bloco{border:1px solid var(--fa-border,#d8ddcf);border-radius:6px;padding:4px 8px;background:var(--fa-panel,#fff)}' +
      '.rg-bloco h3{margin:0 0 2px;font-size:10.5px;text-transform:uppercase;color:var(--fa-muted,#64748b)}' +
      '.rg-linha{display:flex;gap:3px}.rg-linha>.rg-bloco{flex:1;min-width:0}' +
      '.rg-tab{width:100%;border-collapse:collapse;font-size:12px}' +
      '.rg-tab th{text-align:right;font-size:10.5px;text-transform:uppercase;color:var(--fa-muted,#64748b);border-bottom:1px solid var(--fa-border,#d8ddcf);padding:2px 6px}' +
      '.rg-tab th:first-child,.rg-tab td:first-child{text-align:left}' +
      '.rg-tab td{text-align:right;padding:2px 6px;border-bottom:1px solid color-mix(in srgb,var(--fa-border,#d8ddcf) 60%,transparent);white-space:nowrap}' +
      '.rg-tab tfoot td{font-weight:800;border-top:2px solid var(--fa-border,#d8ddcf)}.rg-tab .fds{color:var(--fa-muted,#64748b)}' +
      '.rg-legenda{display:flex;gap:10px;font-size:10.5px;color:var(--fa-muted,#64748b)}.rg-legenda i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:3px;vertical-align:-1px}' +
      '#de,#ate{width:128px}' +
      '@media print{.cp-barra,.btn-fechar,.facilapp-ia-grupo{display:none!important}.cp-janela{position:static;border:0}.rg-corpo{overflow:visible}}';
    document.head.appendChild(css);
    document.body.innerHTML =
      '<div class="cp-janela">' +
      '  <header class="cp-cab"><div class="cp-tit"><div class="cp-ico"><span class="material-icons">' + cfg.icone + '</span></div>' +
      '    <div><b>' + cfg.titulo + '</b><small>' + cfg.frase + '</small></div></div>' +
      '    <button type="button" class="btn-fechar" id="btnFechar" title="Fechar">×</button></header>' +
      '  <div class="cp-barra"><div class="cp-esq">' +
      '    <button type="button" class="btn alt" data-atalho="7">7 dias</button>' +
      '    <button type="button" class="btn alt" data-atalho="mes">Este mês</button>' +
      '    <button type="button" class="btn alt" data-atalho="passado">Mês passado</button>' +
      '    <button type="button" class="btn alt" data-atalho="prox30">Próximos 30</button>' +
      '    <input type="date" class="campo" id="de"><input type="date" class="campo" id="ate">' +
      (modo === 'ocupacao' ? '    <select class="campo" id="tipo"><option value="">Todos os tipos</option></select>' : '') +
      '  </div><div class="cp-dir">' +
      '    <button type="button" class="btn alt" id="btnCsv"><span class="material-icons">description</span>CSV</button>' +
      '    <button type="button" class="btn alt" id="btnXlsx"><span class="material-icons">table_view</span>XLSX</button>' +
      '    <button type="button" class="btn alt" id="btnImprimir"><span class="material-icons">print</span>Imprimir</button>' +
      '  </div></div>' +
      '  <div class="rg-corpo" id="corpo"></div>' +
      '  <div class="cp-rodape"><span id="lblRodape"></span><span>Calculado na API: pré-reserva ainda não conta como venda; estornos não entram</span></div>' +
      '</div>';

    document.querySelectorAll('[data-atalho]').forEach(function (b) { b.onclick = function () { atalho(b.dataset.atalho); }; });
    el('de').onchange = el('ate').onchange = function () { gerar(); };
    if (el('tipo')) el('tipo').onchange = function () { gerar(); };
    el('btnCsv').onclick = function () { exportar('csv'); };
    el('btnXlsx').onclick = function () { exportar('xlsx'); };
    el('btnImprimir').onclick = function () { window.print(); };
    el('btnFechar').onclick = function () {
      try { window.parent.postMessage({ origem: 'FACILAPP_FECHAR_BROWSE_MODELO' }, '*'); } catch (e) { /* sem pai */ }
      if (window.parent === window) history.back();
    };
  }

  /** atalho(nome) — preenche de/até: 7 dias (até hoje), este mês, mês passado, próximos 30 (a partir de hoje). */
  function atalho(nome) {
    var h = new Date(), de, ate;
    if (nome === '7') { de = new Date(h); de.setDate(h.getDate() - 6); ate = h; }
    else if (nome === 'mes') { de = new Date(h.getFullYear(), h.getMonth(), 1); ate = new Date(h.getFullYear(), h.getMonth() + 1, 0); }
    else if (nome === 'passado') { de = new Date(h.getFullYear(), h.getMonth() - 1, 1); ate = new Date(h.getFullYear(), h.getMonth(), 0); }
    else { de = h; ate = new Date(h); ate.setDate(h.getDate() + 29); }
    el('de').value = iso(de); el('ate').value = iso(ate);
    gerar();
  }

  // =================================================================================================
  // GERAR E DESENHAR
  // =================================================================================================
  /** gerar(de, ate, idTipo) — pede o relatório à API e desenha. Sem parâmetros usa os campos da tela. */
  async function gerar(de, ate, idTipo) {
    if (de) el('de').value = de;
    if (ate) el('ate').value = ate;
    if (idTipo !== undefined && el('tipo')) el('tipo').value = idTipo || '';
    try {
      resultado = modo === 'ocupacao'
        ? await ApiCurso.relatorioOcupacao(el('de').value, el('ate').value, el('tipo') ? el('tipo').value : '')
        : await ApiCurso.relatorioFaturamento(el('de').value, el('ate').value);
      desenhar();
      return resultado;
    } catch (erro) { el('corpo').innerHTML = '<div class="rg-bloco">' + esc(erro.message) + '</div>'; throw erro; }
  }

  function desenhar() {
    var cfg = MODOS[modo], t = resultado.totais, dias = resultado.dias;
    var html = '<div class="rg-cartoes">' + cfg.cartoes(t).map(function (c) {
      return '<div class="rg-cartao' + (c[2] ? ' destaque' : '') + '"><span>' + c[0] + '</span><b>' + c[1] + '</b></div>'; }).join('') + '</div>';
    html += '<div class="rg-bloco"><h3>Por dia</h3>' + grafico(dias, cfg) +
      (modo === 'faturamento' ? '<div class="rg-legenda"><span><i style="background:var(--fa-primary,#4b5a32)"></i>Diárias</span><span><i style="background:#d97706"></i>Consumos</span></div>' : '') + '</div>';
    if (modo === 'faturamento') {
      var quadro = function (titulo, lista, campo, rotulo) {
        return '<div class="rg-bloco"><h3>' + titulo + '</h3>' + (lista.length ? '<table class="rg-tab"><tbody>' + lista.map(function (x) {
          return '<tr><td>' + esc(x[rotulo]) + '</td><td>' + moeda(x[campo]) + '</td></tr>'; }).join('') + '</tbody></table>' : '<span class="dica">Nada no período.</span>') + '</div>';
      };
      html += '<div class="rg-linha">' + quadro('Diárias por tipo de quarto', resultado.por_tipo, 'diarias', 'tipo') +
        quadro('Consumos por categoria', resultado.por_categoria, 'total', 'categoria') + quadro('Recebido por forma', resultado.por_forma, 'total', 'forma') + '</div>';
    }
    html += '<div class="rg-bloco"><table class="rg-tab"><thead><tr>' + cfg.colunas.map(function (c) { return '<th>' + c[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      dias.map(function (d) {
        var fds = [0, 6].indexOf(new Date(d.data + 'T12:00:00').getDay()) >= 0;
        return '<tr>' + cfg.colunas.map(function (c) { return '<td' + (c[2] === 'dia' && fds ? ' class="fds"' : '') + '>' + formatar(d[c[0]], c[2], d) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody><tfoot><tr>' + cfg.colunas.map(function (c) { return '<td>' + rodape(c, dias, t) + '</td>'; }).join('') + '</tr></tfoot></table></div>';
    el('corpo').innerHTML = html;
    el('lblRodape').textContent = br(resultado.de) + ' a ' + br(resultado.ate) + ' · ' + dias.length + ' dia(s)' + (resultado.quartos != null ? ' · ' + resultado.quartos + ' quarto(s)' : '');
  }

  function formatar(v, f, d) {
    if (f === 'dia') return br(v) + ' ' + diaSemana(v);
    if (f === 'moeda') return moeda(v);
    if (f === 'pct') return pct(v);
    return String(v);
  }
  /** rodape(coluna) — total da coluna: soma, ou o indicador do período (taxa média, ADR, RevPAR) vindo da API. */
  function rodape(c, dias, t) {
    if (c[2] === 'dia') return 'Total';
    if (c[3] === 'soma') { var s = dias.reduce(function (a, d) { return a + Number(d[c[0]] || 0); }, 0); return c[2] === 'moeda' ? moeda(s) : String(s); }
    if (c[3] === 'taxa') return pct(t.taxa_media);
    if (c[3] === 'adr') return moeda(t.adr);
    if (c[3] === 'revpar') return moeda(t.revpar);
    return '';
  }

  /** grafico(dias, cfg) — barras por dia em SVG (empilhadas no faturamento), com o dia embaixo e o valor em cima. */
  function grafico(dias, cfg) {
    // largura real em pixels: ocupa a tela; no celular, no mínimo 22 px por dia (o quadro rola de lado) — nada é esticado
    var larguraTela = Math.max(280, (el('corpo').clientWidth || 1200) - 24);
    var L = Math.max(larguraTela, dias.length * 22), A = 150, base = 128, max = cfg.maximo(dias), w = L / dias.length;
    var s = '<svg viewBox="0 0 ' + L + ' ' + A + '" width="' + L + '" height="' + A + '" style="display:block;width:' + L + 'px;height:' + A + 'px;max-width:none;min-width:' + L + 'px" role="img" aria-label="Gráfico por dia">';
    s += '<line x1="0" y1="' + base + '" x2="' + L + '" y2="' + base + '" stroke="var(--fa-border,#d8ddcf)"/>';
    dias.forEach(function (d, i) {
      var x = i * w + w * 0.18, bw = w * 0.64, y = base;
      cfg.barras(d).forEach(function (b) {
        var h = Math.max(0, (Number(b.v) || 0) / max * (base - 16));
        y -= h;
        s += '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '" rx="2" fill="' + b.cor + '"><title>' + br(d.data) + '</title></rect>';
      });
      var r = cfg.rotuloBarra(d);
      if (r && dias.length <= 31) s += '<text x="' + (x + bw / 2) + '" y="' + (y - 3) + '" font-size="9" text-anchor="middle" fill="var(--fa-text,#1e293b)">' + r + '</text>';
      if (dias.length <= 31 || i % Math.ceil(dias.length / 31) === 0)
        s += '<text x="' + (x + bw / 2) + '" y="' + (base + 13) + '" font-size="9" text-anchor="middle" fill="var(--fa-muted,#64748b)">' + d.data.slice(8, 10) + '</text>';
    });
    return s + '</svg>';
  }

  /** exportar(formato) — a tabela por dia em CSV (;) ou XLSX, com os títulos da tela. */
  function exportar(formato) {
    if (!resultado || !window.XLSX) { aviso('Gere o relatório primeiro.'); return; }
    var cfg = MODOS[modo];
    var linhas = resultado.dias.map(function (d) { var o = {}; cfg.colunas.forEach(function (c) { o[c[1]] = c[2] === 'dia' ? br(d.data) + '/' + d.data.slice(0, 4) : d[c[0]]; }); return o; });
    var ws = XLSX.utils.json_to_sheet(linhas), nome = modo + '_' + resultado.de + '_' + resultado.ate;
    if (formato === 'csv') {
      var blob = new Blob(['﻿' + XLSX.utils.sheet_to_csv(ws, { FS: ';' })], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome + '.csv'; a.click(); URL.revokeObjectURL(a.href);
    } else { var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, cfg.titulo); XLSX.writeFile(wb, nome + '.xlsx'); }
  }

  window.RelatoriosGestao = {
    /** iniciar({ modo }) — monta a tela, carrega os tipos (ocupação) e gera "Este mês". */
    iniciar: async function (opcoes) {
      modo = opcoes.modo;
      montar(MODOS[modo]);
      if (el('tipo')) {
        try {
          var tipos = await ApiCurso.cadastroListar('tipos-quarto', { ativo: 1 });
          el('tipo').innerHTML += tipos.map(function (t) { return '<option value="' + t.id_tipo + '">' + esc(t.nome) + '</option>'; }).join('');
        } catch (e) { /* segue sem o filtro */ }
      }
      atalho('mes');
    }
  };
  window.Relatorio = { gerar: gerar, dados: function () { return resultado; }, modo: function () { return modo; } };
})();
