/* ==========================================================================
   CadastroPadrao.js — motor das telas de cadastro do FastPousada (Browse, Update e Rpt a partir de uma FICHA).

   PEDIDO (Daniel, 08/11/2026, aula gravada — Bloco 1):
     "gere todas as telas faltantes, use do minimalismo em campos, não coloque o que não seja necessário ...
      coloque os campos que você julgar necessários à fiel execução do sistema".

   O QUE FAZ
     Cada cadastro tem uma FICHA (assets/js/cadastros/<Nome>.js) que diz: rota da API, campos, colunas, filtros, extras
     e o que a Luninha pode fazer. Com a ficha, este motor monta as 3 telas no mesmo padrão do cadastro de Hóspedes:
       CadastroPadrao.browse(ficha)    → lista (Tabulator), busca, filtros, Novo, Relatório, CSV, XLSX, IA, VOZ
       CadastroPadrao.update(ficha)    → formulário em janela central (Ativo na linha 1, 3px, sem barra)
       CadastroPadrao.relatorio(ficha) → prévia A4, PDF (jsPDF), Imprimir, CSV, XLSX
       CadastroPadrao.manifesto(ficha) → as ferramentas da Luninha (Botão IA e Botão VOZ) para esta tela

   FORMATO DA FICHA (resumo — ver as fichas prontas)
     { recurso, chave, arquivo, titulo, singular, novo, icone, subtitulo, busca,
       campos:  [{ campo, rotulo, tipo, obrig, larg(1-6), opcoes:[[valor,texto]], ref:{recurso, valor, texto}, dica, padrao }],
                tipo: texto | textarea | inteiro | decimal | moeda | data | bool | lista | ref | dias | tags
       colunas: [{ campo, titulo, larg, tipo }]   (tipo: texto | moeda | numero | data | lista | ref | dias | badge)
       filtros: [{ campo, rotulo, opcoes | ref }],  extras: [{ rotulo, icone, acao(CP) }],
       opcionais: semAtivo, excluir:{rotulo, icone, acao(d, CP)}, manifestoIA, somenteLeitura, dicaRodape,
                  listar() (dados próprios), somar(linhas) (texto do total no rodapé),
       ia: { descricao, regras, exemplo, saudacao, ferramentas:{...extras} } }

   REGRAS: dados só pelo ApiCurso (cadastroListar/Obter/Incluir/Alterar/Excluir); a regra de verdade fica na API
     (Cadastros.cs); nunca alert/confirm/prompt (avisos.js); cores --fa-*; 3px entre blocos; sem barra quando cabe.
   CUIDADOS: o motor é genérico — regra especial de um cadastro vai na FICHA (ou na API), não aqui.
   ========================================================================== */
(function () {
  'use strict';

  // ---------------------------------------------------------------- utilidades
  var el = function (id) { return document.getElementById(id); };
  var aviso = function (m) { return window.FacilAppAviso ? FacilAppAviso(m) : console.log(m); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  /** moeda(v) — 1234.5 → "R$ 1.234,50". */
  function moeda(v) { return v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  /** data(v) — "2026-11-13" → "13/11/2026". */
  function data(v) { var s = String(v || ''); return s.length >= 10 ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : s; }
  /** dias(v) — "56" → "Sex, Sáb"; "0123456" → "Todos". */
  function dias(v) { var s = String(v || ''); return s.length === 7 ? 'Todos' : s.split('').map(function (d) { return DIAS[+d] || ''; }).join(', '); }
  /** numeroBr(texto) — "1.234,50" ou "1234.5" → 1234.5 (vazio → ''). */
  function numeroBr(t) {
    var s = String(t == null ? '' : t).trim();
    if (!s) return '';
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    return s;
  }

  // ---------------------------------------------------------------- referências (ex.: tipo de quarto do quarto)
  var refs = {};   // recurso → { lista, mapa(id → texto) }
  /** carregarRefs(ficha) — lê os cadastros citados em campos "ref" (uma vez por tela). */
  async function carregarRefs(ficha) {
    var pedidos = {};
    ficha.campos.concat(ficha.filtros || []).forEach(function (c) { if (c.ref) pedidos[c.ref.recurso] = c.ref; });
    await Promise.all(Object.keys(pedidos).map(async function (rec) {
      var r = pedidos[rec], lista = await ApiCurso.cadastroListar(rec), mapa = {};
      lista.forEach(function (x) { mapa[x[r.valor]] = x[r.texto]; });
      refs[rec] = { lista: lista, mapa: mapa, cfg: r };
    }));
  }

  /** textoDe(ficha, col, linha) — o valor da coluna como o usuário lê (moeda, data, lista, ref...). */
  function textoDe(ficha, col, d) {
    var v = d[col.campo];
    var campo = ficha.campos.find(function (c) { return c.campo === col.campo; }) || {};
    switch (col.tipo || campo.tipo) {
      case 'moeda': return moeda(v);
      case 'numero': return v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR');
      case 'data': return data(v);
      case 'dias': return dias(v);
      case 'ref': return refs[campo.ref.recurso] ? (refs[campo.ref.recurso].mapa[v] || '') : v;
      case 'lista': case 'badge': {
        var op = (campo.opcoes || []).find(function (o) { return String(o[0]) === String(v); });
        return op ? op[1] : (v == null ? '' : v);
      }
      case 'bool': return v ? 'Sim' : 'Não';
      case 'tags': return String(v || '').split(';').filter(Boolean).join(', ');
      default: return v == null ? '' : String(v);
    }
  }

  // =================================================================================================
  // BROWSE (lista)
  // =================================================================================================
  /**
   * browse(ficha) — monta a lista da ficha no <body> e liga tudo (grade, busca, filtros, update, exportar, IA, VOZ).
   * SAÍDA: window.CP = { grade, carregar, filtrar, exportar, abrirRelatorio, abrirUpdate, aplicarFiltros, ficha }.
   */
  function browse(ficha) {
    var filtrosHtml = (ficha.filtros || []).map(function (f, i) {
      return '<select class="campo" id="filtro' + i + '"><option value="">' + esc(f.rotulo) + '</option></select>';
    }).join('');
    document.body.innerHTML =
      '<div class="cp-janela">' +
      '  <header class="cp-cab">' +
      '    <div class="cp-tit"><div class="cp-ico"><span class="material-icons">' + ficha.icone + '</span></div>' +
      '      <div><b>' + esc(ficha.titulo) + '</b><small>' + esc(ficha.subtitulo || '') + '</small></div></div>' +
      '    <button type="button" class="btn-fechar" id="btnFechar" title="Fechar">×</button>' +
      '  </header>' +
      '  <div class="cp-barra">' +
      '    <div class="cp-esq">' +
      // ficha.somenteLeitura: lista sem Novo e sem Alterar (ex.: recebimentos — Bloco 4, 08/11/2026)
      (ficha.somenteLeitura ? '' : '      <button type="button" class="btn" id="btnNovo"><span class="material-icons">add</span>' + esc(ficha.novo) + '</button>') +
      (ficha.extras || []).map(function (x, i) {
        return '<button type="button" class="btn" id="btnExtra' + i + '" title="' + esc(x.titulo || '') + '"><span class="material-icons">' + x.icone + '</span>' + esc(x.rotulo) + '</button>';
      }).join('') +
      '      <div class="cp-busca"><span class="material-icons">search</span><input id="inputFiltro" class="campo" autocomplete="off" placeholder="' + esc(ficha.busca || 'Buscar...') + '"></div>' +
      filtrosHtml +
      // ficha.semAtivo: cadastro sem "Ativo" (ex.: reservas têm situação própria) — Bloco 2, 08/11/2026
      (ficha.semAtivo ? '' : '      <select id="selSituacao" class="campo"><option value="">Todas as situações</option><option value="1">Ativos</option><option value="0">Inativos</option></select>') +
      '    </div>' +
      '    <div class="cp-dir">' +
      '      <button type="button" class="btn alt" id="btnRelatorio"><span class="material-icons">print</span>Relatório</button>' +
      '      <button type="button" class="btn alt" id="btnCsv"><span class="material-icons">description</span>CSV</button>' +
      '      <button type="button" class="btn alt" id="btnXlsx"><span class="material-icons">table_view</span>XLSX</button>' +
      '      <button type="button" class="btn alt" id="btnRecarregar" title="Recarregar"><span class="material-icons">refresh</span></button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="cp-grade"><div id="grade"></div></div>' +
      '  <div class="cp-rodape"><span id="lblTotal"></span><span>' + (ficha.somenteLeitura ? esc(ficha.dicaRodape || '') : 'Duplo clique na linha para alterar') + '</span></div>' +
      '</div>' +
      '<div id="janelaUpdate"><div class="caixa" id="caixaUpdate">' +
      '  <div class="barra" id="barraUpdate"><div class="titulo"><span class="material-icons">' + ficha.icone + '</span><span id="tituloUpdate"></span></div>' +
      '    <button type="button" class="btn-fechar" id="btnFecharUpdate" title="Fechar">×</button></div>' +
      '  <iframe title="Cadastro"></iframe>' +
      '</div></div>';

    var LANG = { default: { pagination: { page_size: 'Registros por página', first: 'Primeira', last: 'Última', prev: 'Anterior', next: 'Próxima',
      counter: { showing: 'Exibindo', of: 'de', rows: 'registros', pages: 'páginas' } } } };

    // colunas: as da ficha + Situação + Ações
    // celular (até 760 px): as colunas da direita somem primeiro; a 1ª e as Ações ficam sempre (Daniel, 08/11/2026)
    var celular = window.matchMedia && matchMedia('(max-width: 760px)').matches;
    var colunas = ficha.colunas.map(function (c, i) {
      var col = { title: c.titulo, field: c.campo, minWidth: c.min || 80, widthGrow: c.larg || 1, responsive: i === 0 ? 0 : i + 1,
        accessorDownload: function (v, d) { return textoDe(ficha, c, d); } };
      if (c.tipo === 'moeda' || c.tipo === 'numero') { col.hozAlign = 'right'; col.headerHozAlign = 'right'; }
      col.formatter = function (cell) {
        var t = esc(textoDe(ficha, c, cell.getRow().getData()));
        if (c.tipo === 'badge') return '<span class="badge ' + String(cell.getValue() || '').toLowerCase() + '">' + t + '</span>';
        return c.forte ? '<strong>' + t + '</strong>' : t;
      };
      return col;
    });
    if (!ficha.semAtivo) colunas.push({ title: 'Situação', field: 'ativo', width: 96, hozAlign: 'center', headerHozAlign: 'center',
      formatter: function (c) { return c.getValue() ? '<span class="badge ativo">● Ativo</span>' : '<span class="badge inativo">✕ Inativo</span>'; },
      accessorDownload: function (v) { return v ? 'Ativo' : 'Inativo'; } });
    // ficha.excluir: troca a lixeira por outra ação (ex.: reservas → "Cancelar reserva" com motivo)
    var acaoExcluir = ficha.excluir || { rotulo: 'Excluir', icone: 'delete' };
    colunas.push({ title: 'Ações', width: 70, hozAlign: 'center', headerHozAlign: 'center', headerSort: false, download: false, responsive: 0,
      formatter: function () {
        return '<div class="cp-acoes">' + (ficha.somenteLeitura ? '' : '<button type="button" class="row-btn edit" title="Alterar"><span class="material-icons">edit</span></button>') +
               '<button type="button" class="row-btn delete" title="' + acaoExcluir.rotulo + '"><span class="material-icons">' + acaoExcluir.icone + '</span></button></div>';
      },
      cellClick: function (e, cell) {
        var d = cell.getRow().getData();
        if (e.target.closest('.edit')) abrirUpdate(d[ficha.chave]);
        else if (e.target.closest('.delete')) { if (ficha.excluir) ficha.excluir.acao(d, window.CP); else excluir(d); }
      } });

    var grade = new Tabulator('#grade', {
      data: [], layout: 'fitColumns', height: '100%', pagination: 'local', paginationSize: 50, paginationCounter: 'rows',
      responsiveLayout: celular ? 'hide' : false,
      locale: true, langs: LANG, selectableRows: 1, index: ficha.chave, placeholder: 'Nenhum registro.', columns: colunas
    });
    grade.on('rowDblClick', function (e, row) { if (!ficha.somenteLeitura) abrirUpdate(row.getData()[ficha.chave]); });
    // ficha.somar(dados) — texto extra do rodapé com o total das linhas filtradas (ex.: "Total R$ 1.200,00")
    grade.on('dataFiltered', function (f, linhas) {
      el('lblTotal').textContent = linhas.length + ' registro(s)' + (ficha.somar ? ' · ' + ficha.somar(linhas.map(function (l) { return l.getData(); })) : '');
    });

    /** carregar(selecionarId) — lê os dados da API e reaplica os filtros da tela. */
    async function carregar(selecionarId) {
      try {
        await carregarRefs(ficha);
        preencherFiltros();
        // ficha.listar(): a ficha busca e prepara os dados ela mesma (ex.: recebimentos); senão, o CRUD padrão
        await grade.replaceData(ficha.listar ? await ficha.listar() : await ApiCurso.cadastroListar(ficha.recurso));
        filtrar();
        if (selecionarId) {
          var linha = grade.getRow(selecionarId);
          if (linha) { grade.deselectRow(); linha.select(); grade.scrollToRow(linha, 'center', false); }
        }
      } catch (erro) { grade.setData([]); aviso('Não foi possível carregar: ' + erro.message); }
    }

    /** preencherFiltros() — opções dos filtros (fixas da ficha ou de um cadastro de referência). Mantém a escolha. */
    function preencherFiltros() {
      (ficha.filtros || []).forEach(function (f, i) {
        var s = el('filtro' + i), atual = s.value;
        var opcoes = f.opcoes || (refs[f.ref.recurso] ? refs[f.ref.recurso].lista.map(function (x) { return [x[f.ref.valor], x[f.ref.texto]]; }) : []);
        s.innerHTML = '<option value="">' + esc(f.rotulo) + '</option>' + opcoes.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('');
        s.value = atual;
      });
    }

    /** filtrar() — busca no texto das colunas + filtros da ficha + situação (tudo na grade já carregada). */
    function filtrar() {
      var t = el('inputFiltro').value.trim().toLowerCase(), sit = el('selSituacao') ? el('selSituacao').value : '';
      var fs = (ficha.filtros || []).map(function (f, i) { return { campo: f.campo, valor: el('filtro' + i).value }; });
      grade.setFilter(function (d) {
        var okBusca = !t || ficha.colunas.some(function (c) { return textoDe(ficha, c, d).toLowerCase().indexOf(t) >= 0; });
        var okFiltros = fs.every(function (f) { return !f.valor || String(d[f.campo]) === f.valor; });
        return okBusca && okFiltros && (sit === '' || String(Number(d.ativo)) === sit);
      });
    }

    /** aplicarFiltros(p) — usado pela Luninha: { busca, situacao: ativos|inativos|todos, <campo>: valor }. */
    function aplicarFiltros(p) {
      p = p || {};
      el('inputFiltro').value = p.busca || '';
      if (el('selSituacao')) el('selSituacao').value = p.situacao === 'ativos' ? '1' : p.situacao === 'inativos' ? '0' : '';
      (ficha.filtros || []).forEach(function (f, i) { el('filtro' + i).value = p[f.campo] != null ? String(p[f.campo]) : ''; });
      filtrar();
    }

    function exportar(formato) {
      var nome = ficha.arquivo.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
      if (formato === 'csv') grade.download('csv', nome + '.csv', { delimiter: ';', bom: true });
      else grade.download('xlsx', nome + '.xlsx', { sheetName: ficha.titulo.slice(0, 30) });
    }
    function abrirRelatorio() { location.href = 'Rpt' + ficha.arquivo + '.html?de=browse'; }

    /** excluir(d) — confirma em vermelho e exclui pela API (que recusa registro em uso ou sem permissão). */
    async function excluir(d) {
      var nome = textoDe(ficha, ficha.colunas[0], d);
      if (!(await FacilAppConfirmar('Excluir ' + ficha.singular.toLowerCase() + ' "' + nome + '"?', { confirmar: 'Excluir', perigo: true }))) return;
      try { await ApiCurso.cadastroExcluir(ficha.recurso, d[ficha.chave]); await carregar(); aviso(ficha.singular + ' excluído.'); }
      catch (erro) { aviso('Não foi possível excluir: ' + erro.message); }
    }

    /** abrirUpdate(id) — abre o Update<Arquivo>.html na janela central; sem id = inclusão. */
    function abrirUpdate(id) {
      var caixa = el('caixaUpdate');
      caixa.style.left = ''; caixa.style.top = ''; caixa.style.position = '';
      el('tituloUpdate').textContent = (id ? 'Alterar ' : '') + (id ? ficha.singular.toLowerCase() : ficha.novo);
      el('janelaUpdate').querySelector('iframe').src = 'Update' + ficha.arquivo + '.html?' + (id ? 'id=' + encodeURIComponent(id) : 'novo=1') + '&_v=' + Date.now();
      el('janelaUpdate').classList.add('aberta');
    }
    function fecharUpdate() { el('janelaUpdate').classList.remove('aberta'); el('janelaUpdate').querySelector('iframe').src = 'about:blank'; }

    // recados do update: gravou, cancelou, altura do conteúdo (janela sem sobra)
    window.addEventListener('message', function (e) {
      var f = el('janelaUpdate').querySelector('iframe');
      if (!f || e.source !== f.contentWindow) return;
      var d = e.data || {};
      if (d.origem === 'FACILAPP_MODELO_GRAVADO') { fecharUpdate(); carregar(d.id); aviso(ficha.singular + ' gravado.'); }
      if (d.origem === 'FACILAPP_MODELO_CANCELADO') fecharUpdate();
      if (d.origem === 'FACILAPP_MODELO_ALTURA' && d.altura > 0) el('caixaUpdate').style.height = Math.min(innerHeight - 24, 35 + Number(d.altura) + 1) + 'px';
    });

    // arrastar a janela do update pela barra
    (function () {
      var barra = el('barraUpdate'), caixa = el('caixaUpdate'), ini = null;
      barra.addEventListener('mousedown', function (e) {
        if (e.target.closest('button')) return;
        var r = caixa.getBoundingClientRect(); ini = { x: e.clientX - r.left, y: e.clientY - r.top };
        caixa.style.position = 'fixed'; caixa.style.left = r.left + 'px'; caixa.style.top = r.top + 'px';
        el('janelaUpdate').querySelector('iframe').style.pointerEvents = 'none'; e.preventDefault();
      });
      document.addEventListener('mousemove', function (e) {
        if (!ini) return;
        caixa.style.left = Math.max(0, Math.min(innerWidth - 80, e.clientX - ini.x)) + 'px';
        caixa.style.top = Math.max(0, Math.min(innerHeight - 35, e.clientY - ini.y)) + 'px';
      });
      document.addEventListener('mouseup', function () { if (ini) { ini = null; el('janelaUpdate').querySelector('iframe').style.pointerEvents = ''; } });
    })();

    // botões e teclas
    if (el('btnNovo')) el('btnNovo').onclick = function () { abrirUpdate(); };
    el('btnFechar').onclick = fechar;
    el('btnFecharUpdate').onclick = fecharUpdate;
    el('btnRelatorio').onclick = abrirRelatorio;
    el('btnCsv').onclick = function () { exportar('csv'); };
    el('btnXlsx').onclick = function () { exportar('xlsx'); };
    el('btnRecarregar').onclick = function () { carregar(); };
    el('inputFiltro').oninput = filtrar;
    if (el('selSituacao')) el('selSituacao').onchange = filtrar;
    (ficha.filtros || []).forEach(function (f, i) { el('filtro' + i).onchange = filtrar; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && el('janelaUpdate').classList.contains('aberta')) fecharUpdate(); });

    var CP = { grade: grade, carregar: carregar, filtrar: filtrar, exportar: exportar, abrirRelatorio: abrirRelatorio,
      abrirUpdate: abrirUpdate, aplicarFiltros: aplicarFiltros, ficha: ficha, refs: refs };
    (ficha.extras || []).forEach(function (x, i) { el('btnExtra' + i).onclick = function () { x.acao(CP); }; });
    window.CP = CP;

    grade.on('tableBuilt', function () { carregar(); });
    // Luninha: Botão IA e Botão VOZ com o manifesto desta ficha (mesmos poderes nos dois)
    window.addEventListener('load', async function () {
      if (!window.BotaoIA) return;
      // ficha.manifestoIA: tela com Luninha própria (ex.: reservas); senão, a gerada da ficha
      var m = ficha.manifestoIA || manifesto(ficha);
      await BotaoIA.ligarNaTela({ manifesto: m, ancora: '#btnFechar' });
      if (window.BotaoVoz) await BotaoVoz.ligarNaTela({ manifesto: m });
    });
    return CP;
  }

  /** fechar() — ✕ da tela: fecha no palco do menu (ou volta, se aberta sozinha). */
  function fechar() {
    try { window.parent.postMessage({ origem: 'FACILAPP_FECHAR_BROWSE_MODELO' }, '*'); } catch (e) { /* sem pai */ }
    if (window.parent === window) history.back();
  }

  // =================================================================================================
  // UPDATE (formulário)
  // =================================================================================================
  /**
   * update(ficha) — monta o formulário da ficha (aberto dentro da janela do Browse). ?id= altera; ?novo=1 inclui.
   * REGRAS: campos "bool" (ex.: Ativo) vão na linha 1, na frente dos campos (Daniel); valida obrigatórios; grava pela
   *   API e SÓ DEPOIS avisa o browse; se a API recusar, a janela fica aberta com o que foi digitado; avisa a altura.
   */
  function update(ficha) {
    var id = new URLSearchParams(location.search).get('id');
    var bools = ficha.campos.filter(function (c) { return c.tipo === 'bool'; });
    var outros = ficha.campos.filter(function (c) { return c.tipo !== 'bool'; });

    document.body.innerHTML =
      '<section class="cp-form">' +
      '  <div id="erro"></div>' +
      // linha 1: os campos Sim/Não (ex.: Ativo), na frente dos demais (Daniel, 08/11/2026)
      (bools.length ? '<div class="cp-linha1">' + bools.map(function (c) {
        return '<label><input type="checkbox" id="f_' + c.campo + '"' + (c.padrao === false ? '' : ' checked') + '> ' + esc(c.rotulo) + '</label>';
      }).join('') + '</div>' : '') +
      '  <div class="cp-campos">' + outros.map(htmlCampo).join('') + '</div>' +
      '  <footer class="cp-rod"><span class="dica">Campos com <span class="req">*</span> são obrigatórios. Ctrl+Enter grava, Esc cancela.</span>' +
      '    <div class="acoes"><button class="btn alt" type="button" id="btnCancelar">Cancelar</button>' +
      '      <button class="btn" type="button" id="btnGravar"><span class="material-icons">save</span>Gravar</button></div></footer>' +
      '</section>';

    /** htmlCampo(c) — o HTML de um campo conforme o tipo. */
    function htmlCampo(c) {
      var rot = '<label class="rot" for="f_' + c.campo + '">' + esc(c.rotulo) + (c.obrig ? ' <span class="req">*</span>' : '') + '</label>';
      var ph = c.exemplo ? ' placeholder="' + esc(c.exemplo) + '"' : '';
      var input;
      switch (c.tipo) {
        case 'textarea': input = '<textarea id="f_' + c.campo + '" maxlength="' + (c.max || 500) + '"' + ph + '></textarea>'; break;
        case 'data': input = '<input type="date" id="f_' + c.campo + '">'; break;
        case 'lista': input = '<select id="f_' + c.campo + '">' + (c.obrig ? '' : '<option value=""></option>') +
          c.opcoes.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>'; break;
        case 'ref': input = '<select id="f_' + c.campo + '"><option value="">Escolha...</option></select>'; break;
        case 'dias': input = '<div class="chips" id="f_' + c.campo + '">' + DIAS.map(function (d, i) {
          return '<span class="chip on" data-v="' + i + '">' + d + '</span>'; }).join('') + '</div>'; break;
        case 'tags': input = '<div class="chips" id="f_' + c.campo + '"><input type="text" placeholder="+ adicionar (Enter)"></div>'; break;
        case 'inteiro': case 'decimal': case 'moeda':
          input = '<input type="text" class="numero" inputmode="decimal" id="f_' + c.campo + '"' + ph + '>'; break;
        default: input = '<input type="text" id="f_' + c.campo + '" maxlength="' + (c.max || 120) + '"' + ph + '>';
      }
      return '<div class="c' + (c.larg || 2) + '">' + rot + input + (c.dica ? '<div class="dica">' + esc(c.dica) + '</div>' : '') + '</div>';
    }

    // chips: dias da semana (liga/desliga) e tags (Enter adiciona, × remove)
    document.querySelectorAll('.chips[id^="f_"]').forEach(function (box) {
      box.addEventListener('click', function (e) {
        var ch = e.target.closest('.chip');
        if (!ch) return;
        if (ch.dataset.v !== undefined) ch.classList.toggle('on');
        else if (e.target.classList.contains('x')) ch.remove();
      });
      var inp = box.querySelector('input');
      if (inp) inp.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || !inp.value.trim()) return;
        e.preventDefault(); e.stopPropagation(); addTag(box, inp.value.trim()); inp.value = '';
      });
    });
    function addTag(box, t) {
      var ch = document.createElement('span'); ch.className = 'chip on'; ch.dataset.tag = t;
      ch.innerHTML = esc(t) + ' <span class="x">×</span>';
      box.insertBefore(ch, box.querySelector('input'));
    }

    /** setar(c, v) / ler(c) — põe e lê o valor de um campo conforme o tipo. */
    function setar(c, v) {
      var f = el('f_' + c.campo);
      if (c.tipo === 'bool') { f.checked = !!v; return; }
      if (c.tipo === 'dias') { f.querySelectorAll('.chip').forEach(function (ch) { ch.classList.toggle('on', String(v || '').indexOf(ch.dataset.v) >= 0); }); return; }
      if (c.tipo === 'tags') { f.querySelectorAll('.chip').forEach(function (ch) { ch.remove(); }); String(v || '').split(';').filter(Boolean).forEach(function (t) { addTag(f, t); }); return; }
      if ((c.tipo === 'decimal' || c.tipo === 'moeda') && v != null && v !== '') { f.value = Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return; }
      f.value = v == null ? '' : v;
    }
    function ler(c) {
      var f = el('f_' + c.campo);
      if (c.tipo === 'bool') return f.checked;
      if (c.tipo === 'dias') return Array.prototype.filter.call(f.querySelectorAll('.chip'), function (ch) { return ch.classList.contains('on'); }).map(function (ch) { return ch.dataset.v; }).join('');
      if (c.tipo === 'tags') { var p = f.querySelector('input').value.trim(); if (p) { addTag(f, p); f.querySelector('input').value = ''; }
        return Array.prototype.map.call(f.querySelectorAll('.chip'), function (ch) { return ch.dataset.tag; }).join(';'); }
      if (c.tipo === 'inteiro' || c.tipo === 'decimal' || c.tipo === 'moeda') return numeroBr(f.value);
      return f.value.trim();
    }

    function mostrarErro(m) { el('erro').textContent = m || ''; el('erro').style.display = m ? 'block' : 'none'; }

    /** avisarAltura() — o browse ajusta a janela à altura do conteúdo (sem sobra e sem barra). */
    function avisarAltura() {
      var s = document.querySelector('.cp-form');
      window.parent.postMessage({ origem: 'FACILAPP_MODELO_ALTURA', altura: Math.ceil(s.getBoundingClientRect().height) }, '*');
    }
    if (window.ResizeObserver) new ResizeObserver(avisarAltura).observe(document.querySelector('.cp-form'));

    /** iniciar() — opções das referências, valores padrão (inclusão) ou o registro (alteração). */
    async function iniciar() {
      try {
        await carregarRefs(ficha);
        ficha.campos.filter(function (c) { return c.tipo === 'ref'; }).forEach(function (c) {
          var r = refs[c.ref.recurso];
          el('f_' + c.campo).innerHTML = '<option value="">Escolha...</option>' + r.lista.filter(function (x) { return x.ativo !== false; })
            .map(function (x) { return '<option value="' + x[c.ref.valor] + '">' + esc(x[c.ref.texto]) + '</option>'; }).join('');
        });
        if (id) {
          var d = await ApiCurso.cadastroObter(ficha.recurso, id);
          ficha.campos.forEach(function (c) { setar(c, d[c.campo]); });
        } else {
          ficha.campos.forEach(function (c) { if (c.padrao !== undefined && c.tipo !== 'bool') setar(c, c.padrao); });
        }
      } catch (erro) { mostrarErro(erro.message); el('btnGravar').disabled = true; }
      var primeiro = outros[0] && el('f_' + outros[0].campo);
      if (primeiro && primeiro.focus) primeiro.focus();
      avisarAltura();
    }

    /** gravar() — valida obrigatórios, grava pela API e só então avisa o browse. */
    async function gravar() {
      mostrarErro('');
      document.querySelectorAll('.invalido').forEach(function (x) { x.classList.remove('invalido'); });
      var d = {};
      ficha.campos.forEach(function (c) { d[c.campo] = ler(c); });
      var falta = ficha.campos.find(function (c) { return c.obrig && (d[c.campo] === '' || d[c.campo] == null); });
      if (falta) { el('f_' + falta.campo).classList.add('invalido'); el('f_' + falta.campo).focus && el('f_' + falta.campo).focus(); mostrarErro('Informe ' + falta.rotulo.toLowerCase() + '.'); return; }
      var btn = el('btnGravar'); btn.disabled = true;
      try {
        var novoId = id;
        if (id) await ApiCurso.cadastroAlterar(ficha.recurso, id, d); else novoId = await ApiCurso.cadastroIncluir(ficha.recurso, d);
        window.parent.postMessage({ origem: 'FACILAPP_MODELO_GRAVADO', id: Number(novoId) }, '*');
      } catch (erro) { mostrarErro(erro.message); btn.disabled = false; }
    }
    function cancelar() { window.parent.postMessage({ origem: 'FACILAPP_MODELO_CANCELADO' }, '*'); }

    el('btnGravar').onclick = gravar;
    el('btnCancelar').onclick = cancelar;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cancelar(); if (e.key === 'Enter' && e.ctrlKey) gravar(); });
    iniciar();
  }

  // =================================================================================================
  // RELATÓRIO
  // =================================================================================================
  /**
   * relatorio(ficha) — filtros + prévia A4 (altura do conteúdo) + PDF desenhado pelo jsPDF (cabeçalho da tabela
   * repetido a cada página, "Página X de Y") + Imprimir + CSV + XLSX. ✕ volta para a lista quando veio dela (?de=browse).
   */
  function relatorio(ficha) {
    var filtros = (ficha.filtros || []);
    document.body.innerHTML =
      '<div class="cp-janela">' +
      '  <header class="cp-cab"><div class="cp-tit"><div class="cp-ico"><span class="material-icons">print</span></div><div><b>' + esc(ficha.titulo) + ' — relatório</b></div></div>' +
      '    <button type="button" class="btn-fechar" id="btnFechar" title="Fechar">×</button></header>' +
      '  <div class="cp-filtros">' +
      // no relatório o filtro mostra o TÍTULO (ex.: "Tipo"), não o texto da lista (ex.: "Todos os tipos")
      filtros.map(function (f, i) { return '<label>' + esc(f.titulo || f.rotulo) + '<select class="campo" id="filtro' + i + '"><option value="">Todos</option></select></label>'; }).join('') +
      (ficha.semAtivo ? '' : '    <label>Situação<select class="campo" id="selSituacao"><option value="">Todas</option><option value="1" selected>Ativos</option><option value="0">Inativos</option></select></label>') +
      '    <span class="cp-espaco"></span>' +
      '    <button type="button" class="btn" id="btnPdf"><span class="material-icons">picture_as_pdf</span>Gerar PDF</button>' +
      '    <button type="button" class="btn alt" id="btnImprimir"><span class="material-icons">print</span>Imprimir</button>' +
      '    <button type="button" class="btn alt" id="btnCsv"><span class="material-icons">description</span>CSV</button>' +
      '    <button type="button" class="btn alt" id="btnXlsx"><span class="material-icons">table_view</span>XLSX</button>' +
      '  </div>' +
      '  <div class="cp-previa" id="previa"></div>' +
      '</div>';

    var linhas = [], geradoEm = null;
    var cols = ficha.colunas;
    var dataHora = function (d) { return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };

    function textoFiltros() {
      var p = filtros.map(function (f, i) { var s = el('filtro' + i); return s.value ? f.rotulo + ': ' + s.options[s.selectedIndex].text : ''; }).filter(Boolean);
      if (el('selSituacao')) {
        var sit = el('selSituacao').value;
        p.push(sit === '1' ? 'Ativos' : sit === '0' ? 'Inativos' : 'Todas as situações');
      }
      return p.join(' • ') || 'Todos';
    }

    /** gerar() — busca na API com os filtros e desenha a prévia. */
    async function gerar() {
      try {
        await carregarRefs(ficha);
        filtros.forEach(function (f, i) {
          var s = el('filtro' + i);
          if (s.options.length > 1) return;
          var op = f.opcoes || refs[f.ref.recurso].lista.map(function (x) { return [x[f.ref.valor], x[f.ref.texto]]; });
          s.innerHTML += op.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('');
        });
        var q = el('selSituacao') ? { ativo: el('selSituacao').value } : {};
        filtros.forEach(function (f, i) { q[f.campo] = el('filtro' + i).value; });
        linhas = ficha.listar ? await ficha.listar(q) : await ApiCurso.cadastroListar(ficha.recurso, q);   // listar(q): a ficha aplica os filtros
        geradoEm = new Date();
        el('previa').innerHTML = '<div class="folha"><div class="topo"><span class="marca">FastPousada</span><span class="titulo">' + esc(ficha.titulo) + '</span></div>' +
          '<div class="info"><span>' + esc(textoFiltros()) + '</span><span>Emitido em ' + dataHora(geradoEm) + '</span></div>' +
          (linhas.length ? '<table><thead><tr>' + cols.map(function (c) { return '<th' + (c.tipo === 'moeda' || c.tipo === 'numero' ? ' class="direita"' : '') + '>' + esc(c.titulo) + '</th>'; }).join('') + '</tr></thead><tbody>' +
            linhas.map(function (d) { return '<tr>' + cols.map(function (c) { return '<td' + (c.tipo === 'moeda' || c.tipo === 'numero' ? ' class="direita"' : '') + '>' + esc(textoDe(ficha, c, d)) + '</td>'; }).join('') + '</tr>'; }).join('') +
            '</tbody></table>' : '<div class="vazio">Nenhum registro com esses filtros.</div>') +
          '<div class="total">Total: ' + linhas.length + ' registro(s)</div></div>';
      } catch (erro) { aviso('Não foi possível gerar: ' + erro.message); }
    }

    /** pdf(imprimir) — PDF A4 retrato; colunas proporcionais ao "larg" da ficha. */
    function pdf(imprimir) {
      if (!geradoEm) return;
      var jsPDF = window.jspdf.jsPDF, doc = new jsPDF({ unit: 'mm', format: 'a4' });
      var M = 12, L = 186, ALT = 5.4, BASE = 281, y = 0;
      var soma = cols.reduce(function (s, c) { return s + (c.larg || 1); }, 0);
      var larg = cols.map(function (c) { return L * (c.larg || 1) / soma; });
      var corte = function (t, w) { t = String(t || ''); while (t && doc.getTextWidth(t) > w - 2) t = t.slice(0, -1); return t; };
      function topo() {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('FastPousada', M, M + 4);
        doc.setFontSize(11); doc.text(ficha.titulo, 210 - M, M + 4, { align: 'right' });
        doc.setLineWidth(0.4); doc.line(M, M + 6, 210 - M, M + 6);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(70);
        doc.text(textoFiltros(), M, M + 10); doc.text('Emitido em ' + dataHora(geradoEm), 210 - M, M + 10, { align: 'right' });
        doc.setTextColor(0); y = M + 14;
        doc.setFillColor(229, 231, 235); doc.rect(M, y, L, ALT + 0.6, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        var x = M; cols.forEach(function (c, i) { doc.text(c.titulo, x + 1, y + 3.9); x += larg[i]; });
        y += ALT + 0.6; doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      }
      topo();
      linhas.forEach(function (d, k) {
        if (y + ALT > BASE - 6) { doc.addPage(); topo(); }
        if (k % 2) { doc.setFillColor(246, 247, 248); doc.rect(M, y, L, ALT, 'F'); }
        var x = M;
        cols.forEach(function (c, i) {
          var t = corte(textoDe(ficha, c, d), larg[i]), dir = c.tipo === 'moeda' || c.tipo === 'numero';
          doc.text(t, dir ? x + larg[i] - 1 : x + 1, y + 3.8, dir ? { align: 'right' } : undefined);
          x += larg[i];
        });
        y += ALT;
      });
      doc.setFont('helvetica', 'bold'); doc.text('Total: ' + linhas.length + ' registro(s)', 210 - M, y + 5, { align: 'right' });
      var n = doc.getNumberOfPages();
      for (var p = 1; p <= n; p++) {
        doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100);
        doc.setLineWidth(0.2); doc.line(M, BASE, 210 - M, BASE);
        doc.text('Curso Programação 100% IA — FacilApp', M, BASE + 4);
        doc.text('Página ' + p + ' de ' + n, 210 - M, BASE + 4, { align: 'right' });
      }
      if (imprimir) { doc.autoPrint(); window.open(doc.output('bloburl'), '_blank'); }
      else doc.save(ficha.arquivo.toLowerCase() + '.pdf');
    }

    /** exportar(tipo) — CSV (;) ou XLSX com as mesmas colunas do relatório. */
    function exportar(tipo) {
      var dados = [cols.map(function (c) { return c.titulo; })].concat(linhas.map(function (d) { return cols.map(function (c) { return textoDe(ficha, c, d); }); }));
      if (tipo === 'xlsx') {
        var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dados), ficha.titulo.slice(0, 30));
        XLSX.writeFile(wb, ficha.arquivo.toLowerCase() + '.xlsx'); return;
      }
      var csv = dados.map(function (l) { return l.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
      a.download = ficha.arquivo.toLowerCase() + '.csv'; a.click();
    }

    el('btnFechar').onclick = function () {
      if (new URLSearchParams(location.search).get('de') === 'browse') location.href = 'Browse' + ficha.arquivo + '.html';
      else fechar();
    };
    el('btnPdf').onclick = function () { pdf(false); };
    el('btnImprimir').onclick = function () { pdf(true); };
    el('btnCsv').onclick = function () { exportar('csv'); };
    el('btnXlsx').onclick = function () { exportar('xlsx'); };
    if (el('selSituacao')) el('selSituacao').onchange = gerar;
    filtros.forEach(function (f, i) { el('filtro' + i).onchange = gerar; });
    gerar();
  }

  // =================================================================================================
  // MANIFESTO DA LUNINHA (Botão IA e Botão VOZ)
  // =================================================================================================
  /**
   * manifesto(ficha) — as ferramentas da Luninha para esta tela, geradas da ficha:
   *   listar_<x> (filtra a grade da tela), obter_<x>, incluir_<x>, alterar_<x>, excluir_<x>, exportar_lista,
   *   abrir_relatorio + as extras da ficha (ficha.ia.ferramentas).
   * REGRAS: tudo pelas mesmas funções da tela (ApiCurso.cadastro*); o que grava pede confirmação; referências (ex.:
   *   tipo do quarto) vão como dados de apoio para a IA achar o id certo.
   */
  function manifesto(ficha) {
    var nome = ficha.ia && ficha.ia.nome || ficha.recurso.replace(/-/g, '_');
    var props = {}, obrig = [];
    ficha.campos.forEach(function (c) {
      var p = { description: c.rotulo + (c.dica ? ' (' + c.dica + ')' : '') };
      if (c.tipo === 'inteiro' || c.tipo === 'ref') p.type = 'integer';
      else if (c.tipo === 'decimal' || c.tipo === 'moeda') p.type = 'number';
      else if (c.tipo === 'bool') p.type = 'boolean';
      else p.type = 'string';
      if (c.tipo === 'lista') p.enum = c.opcoes.map(function (o) { return String(o[0]); });
      if (c.tipo === 'dias') p.description += ' — dígitos 0 a 6 (0=domingo), ex.: "56" = sexta e sábado';
      if (c.tipo === 'tags') p.description += ' — separadas por ponto e vírgula';
      if (c.tipo === 'data') p.description += ' — AAAA-MM-DD';
      if (c.ref) p.description += ' — id do cadastro de referência (veja os dados de apoio)';
      props[c.campo] = p;
      if (c.obrig) obrig.push(c.campo);
    });
    var linhas = function (p) {
      return ficha.campos.filter(function (c) { return p[c.campo] !== undefined && p[c.campo] !== null && p[c.campo] !== ''; })
        .map(function (c) { return '• ' + c.rotulo + ': ' + textoDe(ficha, { campo: c.campo, tipo: c.tipo === 'decimal' ? 'moeda' : c.tipo }, p); }).join('\n');
    };
    var curto = function (d) { var r = { id: d[ficha.chave] }; ficha.colunas.forEach(function (c) { r[c.campo] = textoDe(ficha, c, d); }); r.ativo = !!d.ativo; return r; };
    var filtroProps = { busca: { type: 'string', description: 'texto para buscar' },
      situacao: { type: 'string', enum: ['ativos', 'inativos', 'todos'], description: 'situação' } };
    (ficha.filtros || []).forEach(function (f) { filtroProps[f.campo] = { type: 'string', description: f.rotulo + (f.opcoes ? ' (' + f.opcoes.map(function (o) { return o[0]; }).join(', ') + ')' : ' (id)') }; });

    var ferramentas = {};
    ferramentas['listar_' + nome] = {
      descricao: 'Pesquisa ' + ficha.titulo.toLowerCase() + ' e APLICA o filtro na lista da tela. Não grava. Use também para achar o id.',
      parametros: filtroProps, grava: false,
      executar: async function (p) {
        var q = { busca: p.busca, ativo: p.situacao === 'ativos' ? 1 : p.situacao === 'inativos' ? 0 : '' };
        (ficha.filtros || []).forEach(function (f) { if (p[f.campo]) q[f.campo] = p[f.campo]; });
        var lista = await ApiCurso.cadastroListar(ficha.recurso, q);
        if (window.CP) CP.aplicarFiltros(p);
        return { total: lista.length, itens: lista.slice(0, 30).map(curto) };
      }
    };
    ferramentas['obter_' + nome] = {
      descricao: 'Mostra todos os dados de um registro pelo id. Não grava.', parametros: { id: { type: 'integer', description: 'id' } }, obrigatorios: ['id'], grava: false,
      executar: async function (p) { return await ApiCurso.cadastroObter(ficha.recurso, p.id); }
    };
    ferramentas['incluir_' + nome] = {
      descricao: 'Cadastra ' + ficha.singular.toLowerCase() + '. Obrigatórios: ' + obrig.join(', ') + '.',
      parametros: props, obrigatorios: obrig, grava: true,
      validar: function (p) { var f = ficha.campos.find(function (c) { return c.obrig && (p[c.campo] === undefined || p[c.campo] === '' || p[c.campo] === null) && c.padrao === undefined; }); return f ? 'Qual ' + f.rotulo.toLowerCase() + '?' : ''; },
      resumo: function (p) { return 'Cadastrar ' + ficha.singular.toLowerCase() + ':\n' + linhas(p); },
      executar: async function (p) {
        var d = {}; ficha.campos.forEach(function (c) { d[c.campo] = p[c.campo] !== undefined ? p[c.campo] : (c.padrao !== undefined ? c.padrao : ''); });
        var novo = await ApiCurso.cadastroIncluir(ficha.recurso, d);
        var gravado = await ApiCurso.cadastroObter(ficha.recurso, novo);
        if (window.CP) await CP.carregar(novo);
        return 'Cadastrado: ' + JSON.stringify(curto(gravado));
      }
    };
    ferramentas['alterar_' + nome] = {
      descricao: 'Altera um registro pelo id. Mande só o que muda (ex.: { id: 3, ativo: false } para inativar).',
      parametros: Object.assign({ id: { type: 'integer', description: 'id (use listar antes)' } }, props), obrigatorios: ['id'], grava: true,
      resumo: function (p) { var c = Object.assign({}, p); delete c.id; return 'Alterar o registro nº ' + p.id + ':\n' + linhas(c); },
      executar: async function (p) {
        var atual = await ApiCurso.cadastroObter(ficha.recurso, p.id), d = {};
        ficha.campos.forEach(function (c) { d[c.campo] = p[c.campo] !== undefined ? p[c.campo] : atual[c.campo]; });
        await ApiCurso.cadastroAlterar(ficha.recurso, p.id, d);
        var gravado = await ApiCurso.cadastroObter(ficha.recurso, p.id);
        if (window.CP) await CP.carregar(p.id);
        return 'Alterado: ' + JSON.stringify(curto(gravado));
      }
    };
    ferramentas['excluir_' + nome] = {
      descricao: 'EXCLUI um registro pelo id (a API recusa se estiver em uso: aí, inative).', parametros: { id: { type: 'integer', description: 'id' } },
      obrigatorios: ['id'], grava: true, exclui: true,
      resumo: function (p) { return 'EXCLUIR o registro nº ' + p.id + ' de ' + ficha.titulo.toLowerCase() + '?'; },
      executar: async function (p) { await ApiCurso.cadastroExcluir(ficha.recurso, p.id); if (window.CP) await CP.carregar(); return 'Excluído.'; }
    };
    ferramentas.exportar_lista = {
      descricao: 'Baixa a lista da tela (como está filtrada) em XLSX ou CSV.', parametros: { formato: { type: 'string', enum: ['xlsx', 'csv'] } },
      obrigatorios: ['formato'], grava: false, executar: async function (p) { CP.exportar(p.formato); return 'Arquivo baixado.'; }
    };
    ferramentas.abrir_relatorio = {
      descricao: 'Abre o relatório desta tela (PDF).', parametros: {}, grava: false,
      executar: async function () { setTimeout(CP.abrirRelatorio, 800); return 'Abrindo o relatório.'; }
    };
    Object.assign(ferramentas, (ficha.ia && ficha.ia.ferramentas) || {});

    return {
      tela: ficha.recurso.toUpperCase(),
      titulo: ficha.titulo,
      descricao: (ficha.ia && ficha.ia.descricao) || ('Cadastro de ' + ficha.titulo.toLowerCase() + '.'),
      regras: (ficha.ia && ficha.ia.regras) || 'Para alterar ou excluir, ache o id com a ferramenta de listar.',
      saudacao: (ficha.ia && ficha.ia.saudacao) || 'Posso pesquisar, cadastrar, alterar, inativar e excluir aqui — e conversar.',
      exemplo: (ficha.ia && ficha.ia.exemplo) || '',
      preparar: async function () {
        var apoio = {};
        Object.keys(refs).forEach(function (rec) { apoio[rec] = refs[rec].lista.map(function (x) { return { id: x[refs[rec].cfg.valor], nome: x[refs[rec].cfg.texto] }; }); });
        return apoio;
      },
      ferramentas: ferramentas
    };
  }

  window.CadastroPadrao = { browse: browse, update: update, relatorio: relatorio, manifesto: manifesto, moeda: moeda, data: data, dias: dias };
})();
