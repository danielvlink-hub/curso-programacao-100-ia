/* ==========================================================================
   FICHA — Recebimentos (BrowseRecebimentos / RptRecebimentos) — Bloco 4, aula gravada de 08/11/2026.
   Daniel: "Sim, Bloco 4" (caixa e recebimentos com estorno).
   O QUE É: a lista de TODO dinheiro que entrou: data/hora, hóspede, quarto, forma, valor, caixa, situação.
     Somente leitura (o recebimento nasce na conta do hóspede — Estadia/Check-out). Total no rodapé (sem estornados).
     A lixeira vira "Estornar" (pede o motivo). A API recusa estorno de conta encerrada ou de caixa já fechado.
   API: GET /api/recebimentos (Caixa.cs), POST /api/recebimentos/{id}/estornar (Operacao.cs). Luninha: IACaixa.js.
   ========================================================================== */
(function () {
  var SITUACOES = [['ATIVO', 'Recebido'], ['ESTORNADO', 'Estornado']];
  var moeda = function (v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };

  /** meses() — os últimos 12 meses para o filtro ("2026-11" → "nov/2026"). */
  function meses() {
    var N = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'], l = [], d = new Date();
    for (var i = 0; i < 12; i++) {
      var x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      l.push([x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'), N[x.getMonth()] + '/' + x.getFullYear()]);
    }
    return l;
  }

  /**
   * listar(q) — busca na API e prepara cada linha: mes (para o filtro), situacao (Recebido/Estornado) e caixa_txt.
   * q (do relatório) traz os filtros escolhidos: mes, id_forma, situacao — aplicados aqui.
   */
  async function listar(q) {
    var l = (await ApiCurso.recebimentos()).map(function (r) {
      r.mes = String(r.recebido_em).slice(0, 7);
      r.situacao = r.estornado ? 'ESTORNADO' : 'ATIVO';
      r.caixa_txt = r.id_caixa ? 'nº ' + r.id_caixa : '—';
      var s = String(r.recebido_em);   // "2026-11-08 20:51:35" → "08/11/2026 20:51"
      r.quando = s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) + ' ' + s.slice(11, 16);
      return r;
    });
    q = q || {};
    return l.filter(function (r) {
      return (!q.mes || r.mes === q.mes) && (!q.id_forma || String(r.id_forma) === String(q.id_forma)) && (!q.situacao || r.situacao === q.situacao);
    });
  }

  /** estornar(d, CP) — pede o motivo e estorna pela API (que confere conta e caixa). */
  async function estornar(d, CP) {
    if (d.estornado) { FacilAppAviso('Este recebimento já foi estornado.'); return; }
    var motivo = await FacilAppPerguntar('Estornar ' + moeda(d.valor) + ' (' + d.forma + ') de ' + d.hospede + '?\nMotivo:', { confirmar: 'Estornar' });
    if (motivo === null) return;
    try { await ApiCurso.estornarRecebimento(d.id_recebimento, motivo); await CP.carregar(d.id_recebimento); FacilAppAviso('Recebimento estornado.'); }
    catch (erro) { FacilAppAviso('Não foi possível estornar: ' + erro.message); }
  }

  window.FICHA = {
    recurso: 'recebimentos', chave: 'id_recebimento', arquivo: 'Recebimentos', semAtivo: true, somenteLeitura: true,
    titulo: 'Recebimentos', singular: 'Recebimento', novo: '', icone: 'paid',
    subtitulo: 'Todo dinheiro que entrou, por forma e por caixa', busca: 'Buscar por hóspede, quarto ou observação...',
    dicaRodape: 'Recebimento nasce na conta do hóspede (Estadia / Check-out)',
    listar: listar,
    somar: function (linhas) { return 'Total recebido ' + moeda(linhas.filter(function (r) { return !r.estornado; }).reduce(function (s, r) { return s + r.valor; }, 0)); },

    campos: [
      { campo: 'situacao', rotulo: 'Situação', tipo: 'lista', opcoes: SITUACOES },
      { campo: 'id_forma', rotulo: 'Forma', tipo: 'ref', ref: { recurso: 'formas-pagamento', valor: 'id_forma', texto: 'nome' } }
    ],

    colunas: [
      { campo: 'quando', titulo: 'Data/hora', larg: 1.2, forte: true },
      { campo: 'hospede', titulo: 'Hóspede', larg: 2.2 },
      { campo: 'quarto', titulo: 'Quarto', larg: 0.6 },
      { campo: 'forma', titulo: 'Forma', larg: 1.5 },
      { campo: 'valor', titulo: 'Valor', larg: 0.9, tipo: 'moeda' },
      { campo: 'caixa_txt', titulo: 'Caixa', larg: 0.6 },
      { campo: 'observacao', titulo: 'Observação', larg: 1.6 },
      { campo: 'situacao', titulo: 'Situação', larg: 0.9, tipo: 'badge' }
    ],

    filtros: [
      { campo: 'mes', titulo: 'Mês', rotulo: 'Todos os meses', opcoes: meses() },
      { campo: 'id_forma', titulo: 'Forma', rotulo: 'Todas as formas', ref: { recurso: 'formas-pagamento', valor: 'id_forma', texto: 'nome' } },
      { campo: 'situacao', titulo: 'Situação', rotulo: 'Todas as situações', opcoes: SITUACOES }
    ],

    extras: [{ rotulo: 'Caixa', icone: 'point_of_sale', titulo: 'Abrir a tela do caixa', acao: function () { location.href = 'caixa.html'; } }],

    excluir: { rotulo: 'Estornar', icone: 'undo', acao: estornar },

    manifestoIA: window.IACaixa
  };

  window.recarregarTela = function (id) { return window.CP ? CP.carregar(id) : null; };
})();
