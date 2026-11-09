/* ==========================================================================
   FICHA — Reservas (BrowseReservas / RptReservas; o formulário UpdateReservas.html é próprio)
   Daniel, 08/11/2026 (Bloco 2): "as reservas devem ser sofisticadas, agendas de arrastar para reservas".
   O QUE É: a lista de reservas no padrão do motor de telas: código, hóspede, quarto, datas, noites, situação colorida,
     origem e total. Sem "Ativo" (a reserva tem situação). A lixeira vira "Cancelar reserva" (pede o motivo).
   API: /api/reservas (Reservas.cs). A Luninha desta tela é a das reservas (IAReservas.js).
   ========================================================================== */
(function () {
  var SITUACOES = [['PRE_RESERVA', 'Pré-reserva'], ['CONFIRMADA', 'Confirmada'], ['HOSPEDADO', 'Hospedado'], ['ENCERRADA', 'Encerrada'],
                   ['CANCELADA', 'Cancelada'], ['NO_SHOW', 'No-show']];
  var ORIGENS = [['BALCAO', 'Balcão'], ['TELEFONE', 'Telefone'], ['WHATSAPP', 'WhatsApp'], ['SITE', 'Site'], ['BOOKING', 'Booking'], ['OUTRO', 'Outro']];

  /**
   * cancelar(d, CP) — "Cancelar reserva" na linha: pede o motivo (FacilAppPerguntar) e cancela pela API.
   * REGRAS: só pré-reserva ou confirmada; o motivo é obrigatório (a API confere de novo).
   */
  async function cancelar(d, CP) {
    if (['PRE_RESERVA', 'CONFIRMADA'].indexOf(d.situacao) < 0) { FacilAppAviso('Só reserva pré ou confirmada pode ser cancelada.'); return; }
    var motivo = await FacilAppPerguntar('Cancelar a reserva ' + d.codigo + ' de ' + d.hospede_nome + '?\nMotivo:', { confirmar: 'Cancelar reserva' });
    if (motivo === null) return;
    try { await ApiCurso.reservaCancelar(d.id_reserva, motivo); await CP.carregar(); FacilAppAviso('Reserva cancelada.'); }
    catch (erro) { FacilAppAviso('Não foi possível cancelar: ' + erro.message); }
  }

  window.FICHA = {
    recurso: 'reservas', chave: 'id_reserva', arquivo: 'Reservas', semAtivo: true,
    titulo: 'Reservas', singular: 'Reserva', novo: 'Nova reserva', icone: 'event',
    subtitulo: 'Da pré-reserva ao check-out', busca: 'Buscar por hóspede, código ou quarto...',

    // só para os rótulos das listas (o formulário é o UpdateReservas.html)
    campos: [
      { campo: 'situacao', rotulo: 'Situação', tipo: 'lista', opcoes: SITUACOES },
      { campo: 'origem', rotulo: 'Origem', tipo: 'lista', opcoes: ORIGENS }
    ],

    colunas: [
      { campo: 'codigo', titulo: 'Código', larg: 1, forte: true },
      { campo: 'hospede_nome', titulo: 'Hóspede', larg: 2.4 },
      { campo: 'quarto_numero', titulo: 'Quarto', larg: 0.7 },
      { campo: 'tipo_nome', titulo: 'Tipo', larg: 1.2 },
      { campo: 'entrada', titulo: 'Entrada', larg: 1, tipo: 'data' },
      { campo: 'saida', titulo: 'Saída', larg: 1, tipo: 'data' },
      { campo: 'noites', titulo: 'Noites', larg: 0.6, tipo: 'numero' },
      { campo: 'situacao', titulo: 'Situação', larg: 1.1, tipo: 'badge' },
      { campo: 'origem', titulo: 'Origem', larg: 0.9, tipo: 'lista' },
      { campo: 'valor_total', titulo: 'Total', larg: 1, tipo: 'moeda' }
    ],

    filtros: [
      { campo: 'situacao', titulo: 'Situação', rotulo: 'Todas as situações', opcoes: SITUACOES },
      { campo: 'origem', titulo: 'Origem', rotulo: 'Todas as origens', opcoes: ORIGENS }
    ],

    extras: [{ rotulo: 'Mapa', icone: 'calendar_view_month', titulo: 'Abrir o mapa de ocupação (agenda de arrastar)',
      acao: function () { location.href = 'mapa_ocupacao.html'; } }],

    excluir: { rotulo: 'Cancelar reserva', icone: 'event_busy', acao: cancelar },

    // a Luninha das reservas (mesma do mapa)
    manifestoIA: window.IAReservas
  };

  // depois de a Luninha gravar, a lista recarrega e mostra a reserva
  window.recarregarTela = function (id) { return window.CP ? CP.carregar(id) : null; };
})();
