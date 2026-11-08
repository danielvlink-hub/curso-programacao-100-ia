/* =========================================================================
   browse.js — comportamento único das telas de browse do FacilApp.

   A tela declara suas colunas e sua consulta; tudo o mais vem daqui:
   grade Tabulator, filtro, seletor de colunas, exportações, impressão,
   arrasto da janela e fechamento.

   Referência: MODELO/entregadores_MODELO.html.
   Medidas: PadraoCadastro.md, seção "Medidas travadas".
   ========================================================================= */
/* ============================================================================
   OBS — NAO MEXER NO FECHAMENTO DE TELA SEM LER ISTO

   O X, o Cancelar e o Gravar das telas de cadastro pararam de funcionar
   varias vezes, sempre pelo mesmo motivo, sempre com outra cara. A causa e
   uma so:

     O sistema roda por file://, e o Chrome trata CADA ARQUIVO como uma
     origem diferente. Isso tem duas consequencias, e as duas derrubam o
     fechamento:

     1. A tela de dentro NAO alcanca o documento de cima. window.frameElement
        vem nulo, e nenhuma rotina consegue remover a camada pelo DOM.
     2. A mensagem de postMessage chega com origem "null", que NAO e igual a
        location.origin. Conferencia do tipo
             if (e.origin !== location.origin) return;
        descarta o pedido em silencio — o botao nao faz nada e a tela fica
        com "Gravando..." na cara.

   REGRAS QUE MANTEM ISSO FUNCIONANDO:

   - Quem ENVIA usa alvo '*', nunca location.origin. Com "null" de alvo o
     navegador recusa a chamada e ela estoura.
   - Quem RECEBE aceita location.origin OU 'null', e confere e.source. Quem
     enviou e o que importa; a origem sozinha nao serve por file://.
   - O fechamento nunca depende de resposta: FacilAppBrowse.fecharTela()
     tenta desfazer a camada sozinha e, se nao conseguir, diz o motivo na
     faixa de aviso da tela e no console. Nada de falhar calado.

   Antes de alterar qualquer coisa aqui, testar: abrir, Cancelar, X e Gravar
   em UM cadastro de cada tipo — Veiculos, Armazem, Produto, Tabela, Faixa.
   ============================================================================ */

(function () {
  'use strict';

  var topoHost = Number(new URLSearchParams(window.location.search).get('topo') || 0);
  if (Number.isFinite(topoHost) && topoHost > 0) {
    var topoArredondado = Math.round(topoHost);
    document.documentElement.style.setProperty('--browse-host-top', topoArredondado + 'px');
    document.documentElement.style.setProperty('--update-host-top', topoArredondado + 'px');
    document.documentElement.style.setProperty('--update-center-offset', Math.round(topoArredondado / 2) + 'px');
  }

  var FacilAppBrowse = {};

  /* ---------------------------------------------------------------------
     Grade
     --------------------------------------------------------------------- */

  /**
   * Opções padrão do Tabulator. Quem manda no tamanho é ele, não o CSS:
   * altura de linha e linhas por página são opções da grade.
   */
  /* Chave onde a grade guarda as larguras das colunas. Muitas telas usam o
     mesmo id (#grade) e algumas criam varias grades na mesma pagina, entao a
     chave e a pagina + os campos das colunas: cada grade tem a sua. */
  function chaveLarguras(extra) {
    /* Pela ponte o endereco vem codificado (/HTML/C:%5C...%5CTela.html): decodifica e
       separa por / e por \ para ficar so o nome da tela. */
    var endereco = String(location.pathname || '');
    try { endereco = decodeURIComponent(endereco); } catch (e) {}
    var pagina = endereco.split(/[\\/]/).pop().replace(/\.html?$/i, '') || 'pagina';
    var campos = ((extra && extra.columns) || []).map(function (c) { return c && (c.field || c.title) || ''; }).join('|');
    var hash = 0;
    for (var i = 0; i < campos.length; i++) hash = (hash * 31 + campos.charCodeAt(i)) | 0;
    /* _v3: descarta larguras antigas guardadas (Ações 63px e cabeçalho sem seta, 13/09/2026). */
    return 'facilapp_grade_v3_' + pagina + '_' + (hash >>> 0).toString(36);
  }

  /* Cabeçalho sempre inteiro (pedido do Daniel, 13/09/2026): mede o título com
     o CSS real do cabeçalho e garante largura mínima para ele caber, somando o
     recuo da célula e a seta de ordenação. Vale para todas as grades. */
  function larguraMinimaDosTitulos(colunas) {
    if (!Array.isArray(colunas) || !document.body) return;
    var raiz = document.createElement('div');
    raiz.className = 'tabulator';
    raiz.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;height:auto;width:auto';
    raiz.innerHTML = '<div class="tabulator-header"><div class="tabulator-col"><div class="tabulator-col-content">' +
      '<div class="tabulator-col-title-holder"><div class="tabulator-col-title"><span></span></div></div></div></div></div>';
    document.body.appendChild(raiz);
    var titulo = raiz.querySelector('.tabulator-col-title');
    var alvo = titulo.querySelector('span');
    titulo.style.cssText = 'white-space:nowrap;overflow:visible;display:inline-block;width:auto';
    (function ajustar(lista) {
      lista.forEach(function (c) {
        if (!c) return;
        if (Array.isArray(c.columns)) return ajustar(c.columns);
        if (!c.title || c.field === '__acoes') return;
        alvo.textContent = c.title;
        var precisa = Math.ceil(alvo.getBoundingClientRect().width) + 12 + 4;  /* recuo 5+5 e borda; a seta de ordenação foi retirada do cabeçalho (13/09/2026) */
        c.minWidth = Math.max(Number(c.minWidth || 0), precisa);
        if (c.width && Number(c.width) < precisa) c.width = precisa;
      });
    })(colunas);
    raiz.remove();
  }

  FacilAppBrowse.opcoesGrade = function (extra) {
    if (extra && extra.columns) larguraMinimaDosTitulos(extra.columns);
    return Object.assign({
      /* Largura ajustada pelo usuario fica guardada no navegador (estado de
         tela, nao dado de negocio) e volta na proxima abertura. */
      persistence: { columns: ['width'] },
      persistenceMode: 'local',
      persistenceID: chaveLarguras(extra),
      layout: 'fitColumns',
      rowHeight: 25,
      pagination: 'local',
      paginationSize: 15,
      paginationSizeSelector: [15, 25, 50, 100],
      paginationCounter: 'rows',
      movableColumns: true,
      resizableRows: false,
      /* Uma linha por vez fica marcada ao clicar, e continua marcada: é assim
         que o usuário sabe em qual registro está antes de Alterar ou Excluir. */
      selectableRows: 1,
      placeholder: 'Nenhum registro encontrado.',
      locale: true,
      langs: {
        'default': {
          pagination: {
            page_size: 'Registros por página', page_title: 'Página',
            first: 'Primeira', last: 'Última', prev: 'Anterior', next: 'Próxima',
            counter: { showing: 'Exibindo', of: 'de', rows: 'registros', pages: 'páginas' }
          }
        }
      }
    }, extra || {});
  };

  /* ---------------------------------------------------------------------
     Impressão da listagem — PRETO E BRANCO, nunca cópia da tela
     ---------------------------------------------------------------------
     Mesmo molde dos browses da Balança (Veículos, Armazéns): monta uma tabela
     simples com as linhas VISÍVEIS (filtro e ordenação da tela) e as colunas
     visíveis, sem a de ações, e imprime pelo FacilAppImpressao no documento
     principal. O papel não herda cor, fundo nem fonte da grade.
     Exige ImpressaoBalanca.js carregado na tela.

     @param {Tabulator} grade
     @param {string} titulo
     @param {string[]} subtitulos  linhas abaixo do título (filtro, totais...)
     @param {function} [valor]     (linha, campo) => texto; sem ela, o dado cru
     @returns {boolean} true se mandou imprimir
   */
  /* rodape (opcional): {campo: texto} vira a linha Total no fim da tabela.
     Quem não passa, imprime como antes. */
  FacilAppBrowse.imprimirGrade = function (grade, titulo, subtitulos, valor, rodape) {
    if (!grade || !window.FacilAppImpressao) return false;
    var esc = FacilAppBrowse.esc;
    var linhas = grade.getData('active');
    var colunas = grade.getColumns().filter(function (c) {
      var d = c.getDefinition() || {};
      return c.isVisible() && c.getField() && c.getField() !== '__acoes' && d.print !== false;
    }).map(function (c) { return {field: c.getField(), title: c.getDefinition().title || c.getField()}; });

    var html = '<style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}' +
      'body{font-family:Arial,sans-serif;color:#000;font-size:9px;background:#fff}' +
      'h2{font-size:18px;margin:0 0 8px;color:#000}.print-sub{font-size:10px;margin:3px 0;color:#000}' +
      'table{width:100%;border-collapse:collapse;margin-top:12px}thead{display:table-header-group}' +
      'tr{break-inside:avoid}th,td{border:1px solid #777;padding:5px 6px;font-size:9px;line-height:1.2;' +
      'text-align:left;color:#000;background:#fff}th{background:#eee}</style><section>' +
      '<h2>' + esc(titulo || 'Relatório') + '</h2>' +
      '<p class="print-sub">Emitido em ' + esc(new Date().toLocaleString('pt-BR')) + '</p>';
    (subtitulos || []).forEach(function (texto) { if (texto) html += '<p class="print-sub">' + esc(texto) + '</p>'; });
    html += '<table><thead><tr>';
    colunas.forEach(function (c) { html += '<th>' + esc(c.title) + '</th>'; });
    html += '</tr></thead><tbody>';
    linhas.forEach(function (linha) {
      html += '<tr>';
      colunas.forEach(function (c) {
        var texto = typeof valor === 'function' ? valor(linha, c.field) : linha[c.field];
        html += '<td>' + esc(texto == null ? '' : texto) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody>';
    if (rodape && linhas.length) {
      html += '<tfoot><tr>';
      colunas.forEach(function (c, i) {
        var texto = rodape[c.field] != null ? rodape[c.field] : (i === 0 ? 'Total' : '');
        html += '<td style="font-weight:700;border-top:2px solid #000">' + esc(texto) + '</td>';
      });
      html += '</tr></tfoot>';
    }
    html += '</table></section>';
    return window.FacilAppImpressao.imprimir(html);
  };

  /* ---------------------------------------------------------------------
     Filtro — uma caixa de busca varrendo vários campos
     --------------------------------------------------------------------- */

  /**
   * Filtra por qualquer um dos campos informados, sem diferenciar acento
   * nem maiúscula: é o que o usuário espera de uma busca única.
   */
  FacilAppBrowse.filtrarPorCampos = function (grade, texto, campos) {
    if (!grade) return;
    var alvo = FacilAppBrowse.normalizar(texto);
    if (!alvo) { grade.clearFilter(true); return; }
    grade.setFilter(function (dados) {
      for (var i = 0; i < campos.length; i++) {
        if (FacilAppBrowse.normalizar(dados[campos[i]]).indexOf(alvo) >= 0) return true;
      }
      return false;
    });
  };

  FacilAppBrowse.normalizar = function (v) {
    return String(v == null ? '' : v)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().trim();
  };

  /* ---------------------------------------------------------------------
     Seletor de colunas
     --------------------------------------------------------------------- */

  /**
   * Monta o menu de colunas a partir das colunas reais da grade.
   *
   * A escolha vale para tela, impressão, CSV e XLSX — por isso as
   * exportações abaixo nunca recebem lista própria de colunas: elas
   * perguntam à grade quais estão visíveis.
   */
  FacilAppBrowse.montarMenuColunas = function (grade, elementoMenu, camposFixos) {
    if (!grade || !elementoMenu) return;
    var fixos = camposFixos || [];
    elementoMenu.innerHTML = '';

    grade.getColumns().forEach(function (coluna) {
      var def = coluna.getDefinition();
      var campo = def.field;
      if (!campo || fixos.indexOf(campo) >= 0) return;

      var rotulo = document.createElement('label');
      var caixa = document.createElement('input');
      caixa.type = 'checkbox';
      caixa.checked = coluna.isVisible();
      caixa.addEventListener('change', function () {
        if (caixa.checked) coluna.show(); else coluna.hide();
      });
      rotulo.appendChild(caixa);
      rotulo.appendChild(document.createTextNode(def.title || campo));
      elementoMenu.appendChild(rotulo);
    });
  };

  FacilAppBrowse.alternarMenuColunas = function (evento, elementoMenu) {
    if (evento) evento.stopPropagation();
    if (!elementoMenu) return;
    elementoMenu.classList.toggle('open');
  };

  /* Fecha o menu ao clicar fora — senão ele fica aberto por cima da grade. */
  document.addEventListener('click', function (e) {
    document.querySelectorAll('.column-menu.open').forEach(function (menu) {
      if (!menu.contains(e.target) && !menu.parentElement.contains(e.target)) {
        menu.classList.remove('open');
      }
    });
  });

  /* ---------------------------------------------------------------------
     Exportações e impressão
     --------------------------------------------------------------------- */

  /**
   * CSV com ponto e vírgula e BOM: sem os dois, o Excel em português abre
   * tudo numa coluna só e quebra os acentos.
   */
  FacilAppBrowse.exportarCSV = function (grade, nomeArquivo) {
    if (!grade) return;
    grade.download('csv', nomeArquivo + '.csv', { delimiter: ';', bom: true });
  };

  FacilAppBrowse.exportarXLSX = function (grade, nomeArquivo, aba) {
    if (!grade) return;
    grade.download('xlsx', nomeArquivo + '.xlsx', { sheetName: aba || 'Dados' });
  };

  /* ---------------------------------------------------------------------
     Janela: arrasto e fechamento
     --------------------------------------------------------------------- */

  /**
   * Arrasto pelo cabeçalho, como no modelo: pointer events, captura do
   * ponteiro e limite de 10px das bordas. Ignora clique em button e input
   * para o X continuar fechando em vez de arrastar.
   */
  FacilAppBrowse.habilitarArrasto = function (handle, caixa) {
    if (!handle || !caixa) return;
    var arrastando = false, deslocaX = 0, deslocaY = 0;

    handle.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button') || e.target.closest('input')) return;
      var r = caixa.getBoundingClientRect();
      arrastando = true;
      deslocaX = e.clientX - r.left;
      deslocaY = e.clientY - r.top;
      caixa.style.position = 'fixed';
      caixa.style.margin = '0';
      caixa.style.transform = 'none';
      caixa.style.left = r.left + 'px';
      caixa.style.top = r.top + 'px';
      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', function (e) {
      if (!arrastando) return;
      var x = Math.max(10, Math.min(window.innerWidth - caixa.offsetWidth - 10, e.clientX - deslocaX));
      var y = Math.max(10, Math.min(window.innerHeight - caixa.offsetHeight - 10, e.clientY - deslocaY));
      caixa.style.left = x + 'px';
      caixa.style.top = y + 'px';
    });

    handle.addEventListener('pointerup', function (e) {
      arrastando = false;
      try { handle.releasePointerCapture(e.pointerId); } catch (erro) {}
    });
  };

  /**
   * Fecha a tela sem derrubar o sistema.
   *
   * Rodando dentro do iframe do menu, window.close() não fecha o painel:
   * atinge a janela que hospeda tudo e o sistema fecha junto. Aqui a tela
   * pede para ser fechada e quem fecha é o menu.
   */
  FacilAppBrowse.fechar = function (nomeTela) {
    try {
      if (window.WL && typeof window.WL.Execute === 'function') {
        window.WL.Execute((nomeTela || 'Browse') + 'HTML_Click', 'FECHAR', '{}');
        return;
      }
    } catch (erro) {}
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ origem: 'FACILAPP_FECHAR_TELA', tela: nomeTela || '' }, '*');
        return;
      }
    } catch (erro) {}
    window.close();
  };

  /**
   * Esc fecha: primeiro o modal aberto, depois a janela. Nunca os dois de
   * uma vez, para não sumir tudo com um toque.
   */
  FacilAppBrowse.ligarEsc = function (nomeTela, aoFecharModal) {
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var modalAberto = document.querySelector('.modal-layer.open');
      if (modalAberto) {
        if (typeof aoFecharModal === 'function') aoFecharModal();
        else modalAberto.classList.remove('open');
        return;
      }
      FacilAppBrowse.fechar(nomeTela);
    });
  };

  /* ---------------------------------------------------------------------
     Utilidades de formatação
     --------------------------------------------------------------------- */

  FacilAppBrowse.esc = function (v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };

  /* Vazio vira traço discreto em vez de célula em branco. */
  FacilAppBrowse.textoOuTraco = function (cell) {
    var v = cell.getValue();
    return (v === null || v === undefined || String(v).trim() === '')
      ? '<span style="color:var(--text-muted);font-style:italic;">-</span>'
      : FacilAppBrowse.esc(v);
  };

  FacilAppBrowse.selo = function (ligado, textoSim, textoNao) {
    return ligado
      ? '<span class="status-ok">● ' + (textoSim || 'Sim') + '</span>'
      : '<span class="status-ok">● ' + (textoNao || 'Não') + '</span>';
  };

  /* Flags char(1) do banco legado: "1" ligado, " " ou null desligado. */
  FacilAppBrowse.flagLigada = function (v) {
    return String(v == null ? '' : v).trim() === '1';
  };

  /**
   * Modal de mensagem padrao. Substitui o alert() do navegador, que ignora o
   * tema, trava a pagina e mostra o endereco do site no titulo.
   * Usa <dialog>, como as confirmacoes ja existentes nos browses, com as
   * cores por variavel de tema e botao de 26px.
   * @param {string} texto
   * @param {object} [opcoes]
   * @param {string} [opcoes.titulo]
   * @param {string} [opcoes.botao]
   * @returns {Promise<void>} resolve quando o usuario fecha
   */
  FacilAppBrowse.mensagem = function (texto, opcoes) {
    var config = opcoes || {};
    return new Promise(function (resolver) {
      var caixa = document.createElement('dialog');
      caixa.className = 'facilapp-msg';
      if (config.titulo) {
        var titulo = document.createElement('strong');
        titulo.className = 'facilapp-msg-titulo';
        titulo.textContent = config.titulo;
        caixa.append(titulo);
      }
      var corpo = document.createElement('p');
      corpo.className = 'facilapp-msg-texto';
      corpo.textContent = String(texto == null ? '' : texto);
      caixa.append(corpo);
      var acoes = document.createElement('div');
      acoes.className = 'modal-footer-actions';
      var ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'toolbar-btn';
      ok.textContent = config.botao || 'OK';
      acoes.append(ok);
      caixa.append(acoes);
      document.body.append(caixa);
      function encerrar() {
        caixa.close();
        caixa.remove();
        resolver();
      }
      ok.addEventListener('click', encerrar);
      caixa.addEventListener('cancel', function (evento) { evento.preventDefault(); encerrar(); });
      caixa.showModal();
      ok.focus();
    });
  };
  /**
   * Modal que pede um valor. Mesmo desenho do FacilAppBrowse.mensagem.
   * @param {object} opcoes
   * @param {string} opcoes.titulo
   * @param {string} opcoes.texto
   * @param {string} [opcoes.valor]     valor inicial do campo
   * @param {string} [opcoes.tipo]      tipo do input, padrao 'text'
   * @param {string} [opcoes.confirmar] rotulo do botao de confirmar
   * @returns {Promise<string|null>} o valor digitado, ou null se cancelado
   */
  FacilAppBrowse.pedirValor = function (opcoes) {
    var config = opcoes || {};
    return new Promise(function (resolver) {
      var caixa = document.createElement('dialog');
      caixa.className = 'facilapp-msg';
      if (config.titulo) {
        var titulo = document.createElement('strong');
        titulo.className = 'facilapp-msg-titulo';
        titulo.textContent = config.titulo;
        caixa.append(titulo);
      }
      var corpo = document.createElement('p');
      corpo.className = 'facilapp-msg-texto';
      corpo.textContent = String(config.texto || '');
      caixa.append(corpo);
      var campo = document.createElement('input');
      campo.type = config.tipo || 'text';
      campo.className = 'form-control facilapp-msg-campo';
      campo.value = config.valor === undefined || config.valor === null ? '' : String(config.valor);
      caixa.append(campo);
      var acoes = document.createElement('div');
      acoes.className = 'modal-footer-actions';
      var cancelar = document.createElement('button');
      cancelar.type = 'button';
      cancelar.className = 'toolbar-btn facilapp-msg-cancelar';
      cancelar.textContent = 'Cancelar';
      var confirmar = document.createElement('button');
      confirmar.type = 'button';
      confirmar.className = 'toolbar-btn';
      confirmar.textContent = config.confirmar || 'Confirmar';
      acoes.append(cancelar, confirmar);
      caixa.append(acoes);
      document.body.append(caixa);

      function encerrar(valor) {
        caixa.close();
        caixa.remove();
        resolver(valor);
      }
      confirmar.addEventListener('click', function () { encerrar(campo.value); });
      cancelar.addEventListener('click', function () { encerrar(null); });
      campo.addEventListener('keydown', function (evento) {
        if (evento.key === 'Enter') { evento.preventDefault(); encerrar(campo.value); }
      });
      caixa.addEventListener('cancel', function (evento) { evento.preventDefault(); encerrar(null); });
      caixa.showModal();
      campo.focus();
      campo.select();
    });
  };
  /**
   * Confirmacao Sim/Nao, no desenho do FacilAppBrowse.mensagem.
   * Equivalente ao Dialog() do Clarion, que devolve 1 para Sim e 2 para Nao.
   * @param {string} texto
   * @param {object} [opcoes] {titulo, sim, nao, perigo}
   * @returns {Promise<boolean>} true quando o usuario confirma
   */
  FacilAppBrowse.confirmar = function (texto, opcoes) {
    var config = opcoes || {};
    return new Promise(function (resolver) {
      var caixa = document.createElement('dialog');
      caixa.className = 'facilapp-msg';
      if (config.titulo) {
        var titulo = document.createElement('strong');
        titulo.className = 'facilapp-msg-titulo';
        titulo.textContent = config.titulo;
        caixa.append(titulo);
      }
      var corpo = document.createElement('p');
      corpo.className = 'facilapp-msg-texto';
      corpo.textContent = String(texto == null ? '' : texto);
      caixa.append(corpo);
      var acoes = document.createElement('div');
      acoes.className = 'modal-footer-actions';
      var nao = document.createElement('button');
      nao.type = 'button';
      nao.className = 'toolbar-btn facilapp-msg-cancelar';
      nao.textContent = config.nao || 'Não';
      var sim = document.createElement('button');
      sim.type = 'button';
      sim.className = 'toolbar-btn' + (config.perigo ? ' facilapp-msg-perigo' : '');
      sim.textContent = config.sim || 'Sim';
      acoes.append(nao, sim);
      caixa.append(acoes);
      document.body.append(caixa);
      function encerrar(valor) { caixa.close(); caixa.remove(); resolver(valor); }
      sim.addEventListener('click', function () { encerrar(true); });
      nao.addEventListener('click', function () { encerrar(false); });
      caixa.addEventListener('cancel', function (evento) { evento.preventDefault(); encerrar(false); });
      caixa.showModal();
      /* O foco nasce no Nao: a acao costuma ser destrutiva. */
      nao.focus();
    });
  };

  FacilAppBrowse.colunaAcoes = function (aoEditar, aoExcluir) {
    return {
      title: 'Ações', field: '__acoes', width: 63, minWidth: 63, maxWidth: 63, widthGrow: 0, widthShrink: 0, resizable: false, hozAlign: 'center', cssClass: 'col-acoes',
      headerHozAlign: 'center', headerSort: false,
      /* Botão não vai para o papel nem para as exportações. */
      print: false, download: false,
      formatter: function () {
        return '<div class="actions-cell-wrap">' +
          '<button type="button" class="btn-detail edit" title="Alterar">' +
            '<span class="material-symbols-rounded">edit</span></button>' +
          '<button type="button" class="btn-detail delete" title="Excluir">' +
            '<span class="material-symbols-rounded">delete</span></button>' +
        '</div>';
      },
      cellClick: function (e, cell) {
        var botao = e.target.closest('.btn-detail');
        if (!botao) return;
        if (botao.classList.contains('edit') && aoEditar) aoEditar(cell.getRow().getData());
        if (botao.classList.contains('delete') && aoExcluir) aoExcluir(cell.getRow().getData());
      }
    };
  };

  /**
   * Fecha a tela, seja ela qual for. E o unico caminho de fechamento do
   * sistema; nenhuma tela deve inventar o seu.
   *
   * POR QUE ISSO EXISTE
   * Toda tela de cadastro roda dentro de um <iframe>, dentro de uma camada,
   * dentro de outra tela. Quem precisa sumir e a CAMADA, que pertence ao
   * documento de cima — a tela de dentro nao alcanca a si mesma.
   *
   * O jeito antigo era pedir por postMessage e torcer para alguem responder.
   * Isso falhava em silencio de varias maneiras: alvo location.origin, que
   * por file:// vira a string "null" e o navegador recusa; conferencia de
   * origem no recebedor que nao casa; camada aberta por quem nao e o pai
   * imediato; ou simplesmente ninguem escutando aquele nome de mensagem. Em
   * todos os casos o botao nao fazia nada e a tela ficava com "Gravando..."
   * na cara. Cada tela tinha a sua versao do problema, e consertar uma nao
   * consertava as outras.
   *
   * O jeito certo nao depende de resposta: tudo aqui e mesma origem, entao a
   * tela alcanca o proprio <iframe> por window.frameElement e desfaz a camada
   * ela mesma. Subindo de quadro em quadro, funciona em qualquer profundidade.
   * O postMessage continua sendo enviado, mas so para quem quiser recarregar
   * a lista — nunca para fechar.
   *
   * @param {string} [aviso]  nome da mensagem a enviar antes de fechar
   * @returns {string} '' quando fechou; o motivo quando nao conseguiu
   */
  FacilAppBrowse.fecharTela = function (aviso) {
    if (aviso) {
      /* Alvo '*' de proposito: location.origin quebra em file://. Quem recebe
         e que confere a origem. */
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({origem: aviso}, '*');
        }
        if (window.top && window.top !== window && window.top !== window.parent) {
          window.top.postMessage({origem: aviso}, '*');
        }
      } catch (e) { /* aviso e opcional; nao pode impedir o fechamento */ }
    }

    /* Tela aberta no PALCO do menu geral do Cereais (iframe mainStageFrame).
       Ali nao ha camada: o palco e do menu, e procurar "camada por forma"
       removeria o proprio palco. Quem fecha e o index, pelo aviso generico. */
    try {
      if (window.frameElement && window.frameElement.id === 'mainStageFrame') {
        window.parent.postMessage({origem: 'FACILAPP_FECHAR_TELA'}, '*');
        return '';
      }
    } catch (e) { /* outra origem: segue o caminho normal */ }

    /* Pagina aberta por file:// (WinDev): cada arquivo e uma origem, e o
       navegador devolve frameElement = null. Sem enxergar o proprio quadro, a
       rotina abaixo concluia "nenhuma camada conhecida" e o X nao fechava.
       Quem hospeda e quem fecha: pede pelo aviso generico. O index do menu
       geral fecha o palco com ele; os hosts da Balanca ja fecharam pelo aviso
       especifico enviado acima (e so reagem ao generico com o nome da tela). */
    try {
      if (window.parent && window.parent !== window) {
        var proprioQuadro = null;
        try { proprioQuadro = window.frameElement; } catch (e) { proprioQuadro = null; }
        if (!proprioQuadro) {
          window.parent.postMessage({origem: 'FACILAPP_FECHAR_TELA'}, '*');
          return '';
        }
      }
    } catch (e) { /* segue o caminho normal */ }

    var janela = window;
    var voltas = 0;
    while (voltas++ < 10) {
      var quadro;
      try {
        quadro = janela.frameElement;
      } catch (e) {
        return reclamar('a tela de cima e de outra origem e nao pode ser tocada');
      }
      if (!quadro) break;

      /* A camada e o ancestral que cobre a tela: a do padrao (.modal-layer) ou
         uma criada na hora (id comecando com camada/overlay). */
      var camada = quadro.closest ? quadro.closest('.modal-layer') : null;
      if (camada) {
        camada.classList.remove('open');
        quadro.src = 'about:blank';
        return '';
      }
      var solta = quadro.parentElement;
      while (solta && !/^(camada|overlay)/i.test(solta.id || '')) solta = solta.parentElement;
      if (solta) { solta.remove(); return ''; }

      /* Nao reconheceu a camada pelo nome. Em vez de desistir, procura pela
         forma: o ancestral mais alto que cobre a tela (position fixed ou
         absolute) e a camada, tenha o id que tiver. E o que faz esta rotina
         servir para camada que ainda nem foi escrita. */
      var coberta = porForma(quadro);
      if (coberta) { coberta.remove(); return ''; }

      /* Nem por forma: ao menos o quadro sai da frente, para o botao nao
         morrer em silencio. */
      if (quadro.parentElement) { quadro.remove(); return ''; }

      /* Sem camada neste nivel: sobe um quadro e procura de novo. */
      janela = quadro.ownerDocument ? quadro.ownerDocument.defaultView : null;
      if (!janela) break;
    }

    if (window.parent === window) { window.close(); return ''; }
    return reclamar('a tela nao esta dentro de nenhuma camada conhecida');
  };

  /* O ancestral mais alto que esta posicionado por cima da pagina. E assim que
     uma camada se parece, independente de como foi nomeada. */
  function porForma(quadro) {
    var achado = null;
    var no = quadro.parentElement;
    var dono = quadro.ownerDocument;
    while (no && no !== dono.body && no !== dono.documentElement) {
      var posicao = '';
      try {
        posicao = dono.defaultView.getComputedStyle(no).position;
      } catch (e) { posicao = ''; }
      if (posicao === 'fixed' || posicao === 'absolute') achado = no;
      no = no.parentElement;
    }
    return achado;
  }

  /* Falha de fechamento nunca mais em silencio: o motivo vai para o console e,
     se a tela tiver a faixa de aviso do padrao, aparece nela. Fica aqui, e nao
     em cada tela, para nenhuma precisar saber disso. */
  function reclamar(motivo) {
    var texto = 'Nao foi possivel fechar a tela: ' + motivo + '.';
    try {
      console.error('[FacilAppBrowse.fecharTela]', motivo);
      var faixa = document.getElementById('aviso');
      if (faixa) {
        faixa.textContent = texto;
        faixa.classList.add('erro');
      }
    } catch (e) { /* aviso e cortesia; nao pode virar outro erro */ }
    return motivo;
  }

  /* Nome antigo, mantido para nao quebrar chamada existente. */
  FacilAppBrowse.fecharMinhaCamada = function () {
    return FacilAppBrowse.fecharTela() === '';
  };

  window.FacilAppBrowse = FacilAppBrowse;
})();
