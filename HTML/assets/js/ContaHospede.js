/* ==========================================================================
   ContaHospede.js — o motor das telas de OPERAÇÃO do dia (Bloco 3): Check-in, Estadia e Check-out.
   Daniel, 08/11/2026: "gere o bloco 3" (check-in, estadia/consumos, check-out), minimalismo em campos.

   O QUE FAZ
     Uma tela de duas colunas, montada aqui dentro da página que chama ContaHospede.iniciar({ modo }):
       ESQUERDA  a lista do dia em cartões (busca por nome, quarto ou código):
                 checkin  → chegadas de hoje + atrasadas (entrada já passou e não chegaram)
                 estadia  → hóspedes hospedados agora
                 checkout → saídas de hoje (e atrasadas) primeiro; depois os demais hospedados
       DIREITA   a reserva escolhida:
                 checkin  → dados da reserva, aviso de quarto sujo/manutenção, observação e o botão Fazer check-in
                 estadia  → a CONTA: diárias, consumos e recebimentos; lançar consumo; receber; estornar
                 checkout → a mesma conta + o botão Fechar conta (só com saldo zero)
     No topo, os números do dia: chegadas, atrasadas, saídas, hospedados e quartos sujos.
   ENTRADAS: opções { modo: 'checkin' | 'estadia' | 'checkout' }; parâmetro ?id=<id_reserva> já abre essa reserva.
   SAÍDAS: nada para quem chamou; window.recarregarTela(id) e window.abrirConta(id) ficam para a Luninha (IAOperacao.js).
   DADOS: ApiCurso.operacaoHoje, contaHospede, fazerCheckin, lancarConsumo, estornarConsumo, receber,
          estornarRecebimento, fazerCheckout, cadastroListar('servicos-produtos' | 'formas-pagamento' | 'quartos').
   REGRAS: a verdade é da API (Operacao.cs): saldo, quarto sujo (409 + confirmar), check-out só com saldo zero.
           Nada é apagado: consumo e recebimento só ESTORNAM (com motivo). Sem alert/confirm/prompt (avisos.js).
   PADRÃO: cores --fa-*, cabeçalho 35px, 3px entre blocos, campos 22px, sem barra quando cabe.
   ========================================================================== */
(function () {
  'use strict';

  var el = function (id) { return document.getElementById(id); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var moeda = function (v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
  var br = function (s) { s = String(s || ''); return s.length >= 10 ? s.slice(8, 10) + '/' + s.slice(5, 7) : s; };
  var hora = function (s) { s = String(s || ''); return s.length >= 16 ? br(s) + ' ' + s.slice(11, 16) : br(s); };
  var numero = function (t) { var s = String(t == null ? '' : t).trim(); if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); return s === '' ? null : Number(s); };
  var aviso = function (m) { if (window.FacilAppAviso) FacilAppAviso(m); };
  var SIT = { PRE_RESERVA: 'Pré-reserva', CONFIRMADA: 'Confirmada', HOSPEDADO: 'Hospedado', ENCERRADA: 'Encerrada' };

  /* cada modo: título, ícone, frase do cabeçalho e de onde vem a lista */
  var MODOS = {
    checkin: { titulo: 'Check-in', icone: 'login', frase: 'Chegadas de hoje e atrasadas: confira e dê entrada no quarto',
      lista: function (h) { return h.atrasadas.map(function (r) { r._marca = 'atrasada'; return r; }).concat(h.chegadas); },
      vazio: 'Nenhuma chegada para hoje.' },
    estadia: { titulo: 'Estadia e consumos', icone: 'receipt_long', frase: 'Hóspedes na casa: lance consumos e receba na conta',
      lista: function (h) { return h.hospedados; }, vazio: 'Nenhum hóspede na casa agora.' },
    checkout: { titulo: 'Check-out', icone: 'logout', frase: 'Saídas de hoje: confira a conta, receba e feche',
      lista: function (h) {
        var sai = {}; h.saidas.forEach(function (r) { sai[r.id_reserva] = 1; r._marca = r.saida < h.hoje ? 'atrasada' : 'sai hoje'; });
        return h.saidas.concat(h.hospedados.filter(function (r) { return !sai[r.id_reserva]; }));
      }, vazio: 'Nenhum hóspede para sair.' }
  };

  var cfg = null;          // MODOS[modo]
  var modo = '';
  var hoje = null;         // resposta de operacaoHoje
  var lista = [];          // reservas da coluna esquerda
  var atual = null;        // id_reserva aberta à direita
  var conta = null;        // resposta de contaHospede
  var itens = [], formas = [], quartos = {};

  // =================================================================================================
  // MONTAGEM DA TELA
  // =================================================================================================
  /** montar() — escreve o esqueleto da tela (cabeçalho, barra, duas colunas, rodapé). */
  function montar() {
    var css = document.createElement('style');
    css.textContent =
      '.op-corpo{flex:1;min-height:0;display:flex;gap:3px;margin:3px 12px}' +
      '.op-lista{width:310px;flex:0 0 310px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;padding:1px}' +
      '.op-card{border:1px solid var(--fa-border,#d8ddcf);border-radius:6px;padding:4px 8px;cursor:pointer;background:var(--fa-field-bg,#fff);line-height:1.3}' +
      '.op-card:hover{border-color:var(--fa-primary,#4b5a32)}' +
      '.op-card.sel{border-color:var(--fa-primary,#4b5a32);box-shadow:inset 3px 0 0 var(--fa-primary,#4b5a32)}' +
      '.op-card .l1{display:flex;justify-content:space-between;gap:6px;font-size:12.5px}' +
      '.op-card .l2{display:flex;justify-content:space-between;gap:6px;font-size:11px;color:var(--fa-muted,#64748b)}' +
      '.op-card .q{font-weight:800;color:var(--fa-primary,#4b5a32)}' +
      '.op-marca{font-size:10px;font-weight:800;color:#b45309;text-transform:uppercase}' +
      '.op-painel{flex:1;min-width:0;border:1px solid var(--fa-border,#d8ddcf);border-radius:6px;padding:6px 10px;overflow-y:auto;display:flex;flex-direction:column;gap:3px}' +
      '.op-vazio{margin:auto;color:var(--fa-muted,#64748b);font-size:12px;text-align:center}' +
      '.op-cab{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}' +
      '.op-cab b{font-size:15px}.op-cab small{display:block;font-size:11.5px;color:var(--fa-muted,#64748b)}' +
      '.op-num{display:flex;gap:6px;font-size:11px}.op-num span{padding:1px 8px;border-radius:9px;background:var(--fa-panel-alt,#eef3e6)}' +
      '.op-num b{font-size:12px}.op-num .alerta{background:#fef3c7;color:#92400e}' +
      '.op-alerta{padding:4px 8px;border-radius:5px;background:#fef3c7;color:#92400e;font-size:12px}' +
      '.op-tab{width:100%;border-collapse:collapse;font-size:12px}' +
      '.op-tab th{text-align:left;font-size:10.5px;text-transform:uppercase;color:var(--fa-muted,#64748b);border-bottom:1px solid var(--fa-border,#d8ddcf);padding:2px 4px}' +
      '.op-tab td{padding:2px 4px;border-bottom:1px solid color-mix(in srgb,var(--fa-border,#d8ddcf) 60%,transparent)}' +
      '.op-tab .v{text-align:right;white-space:nowrap}.op-tab .est td{text-decoration:line-through;color:var(--fa-muted,#64748b)}' +
      '.op-tab .rec td.v{color:#166534}' +
      '.op-est{font-size:16px;cursor:pointer;color:var(--fa-muted,#64748b)}.op-est:hover{color:#b42318}' +
      '.op-totais{display:flex;justify-content:flex-end;gap:14px;font-size:12px;padding:2px 4px}' +
      '.op-totais b{font-size:13px}.op-saldo{font-size:15px !important}.op-saldo.zero{color:#166534}.op-saldo.deve{color:#b42318}' +
      '.op-form{display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap;border-top:1px solid var(--fa-border,#d8ddcf);padding-top:3px}' +
      '.op-form label{display:grid;gap:1px;font-size:10.5px;font-weight:700;text-transform:uppercase;color:var(--fa-muted,#64748b)}' +
      '.op-form .campo{width:auto}.op-form .numero{text-align:right;width:84px}.op-form .largo{min-width:220px}' +
      '.op-fim{display:flex;justify-content:flex-end;gap:6px;border-top:1px solid var(--fa-border,#d8ddcf);padding-top:3px}' +
      '.op-dados{display:grid;grid-template-columns:repeat(4,auto);justify-content:start;gap:2px 18px;font-size:12px}' +
      '.op-dados span{color:var(--fa-muted,#64748b);font-size:10.5px;text-transform:uppercase;font-weight:700;display:block}';
    document.head.appendChild(css);

    document.body.innerHTML =
      '<div class="cp-janela">' +
      '  <header class="cp-cab">' +
      '    <div class="cp-tit"><div class="cp-ico"><span class="material-icons">' + cfg.icone + '</span></div>' +
      '      <div><b>' + cfg.titulo + '</b><small>' + cfg.frase + '</small></div></div>' +
      '    <button type="button" class="btn-fechar" id="btnFechar" title="Fechar">×</button>' +
      '  </header>' +
      '  <div class="cp-barra">' +
      '    <div class="cp-esq"><div class="cp-busca"><span class="material-icons">search</span>' +
      '      <input class="campo" id="busca" placeholder="Hóspede, quarto ou código" autocomplete="off"></div>' +
      '      <span class="op-num" id="numeros"></span></div>' +
      '    <div class="cp-dir">' +
      '      <button type="button" class="btn alt" id="btnMapa"><span class="material-icons">calendar_view_month</span>Mapa</button>' +
      // Bloco 4: receber exige o caixa aberto de quem recebe — atalho para a tela do caixa
      (modo === 'checkin' ? '' : '      <button type="button" class="btn alt" id="btnCaixa"><span class="material-icons">point_of_sale</span>Caixa</button>') +
      '      <button type="button" class="btn alt" id="btnRecarregar" title="Recarregar"><span class="material-icons">refresh</span></button></div>' +
      '  </div>' +
      '  <div class="op-corpo"><div class="op-lista" id="lista"></div><div class="op-painel" id="painel"></div></div>' +
      '  <div class="cp-rodape"><span id="lblRodape"></span><span>Nada é apagado: consumo e recebimento só se estornam, com motivo</span></div>' +
      '</div>';

    el('busca').addEventListener('input', desenharLista);
    el('btnRecarregar').onclick = function () { carregar(atual); };
    el('btnMapa').onclick = function () { location.href = 'mapa_ocupacao.html'; };
    if (el('btnCaixa')) el('btnCaixa').onclick = function () { location.href = 'caixa.html'; };
    el('btnFechar').onclick = function () {
      try { window.parent.postMessage({ origem: 'FACILAPP_FECHAR_BROWSE_MODELO' }, '*'); } catch (e) { /* sem pai */ }
      if (window.parent === window) history.back();
    };
  }

  // =================================================================================================
  // LISTA DO DIA (esquerda)
  // =================================================================================================
  /** carregar(idAbrir) — busca o painel do dia na API, redesenha a lista e reabre a reserva (se ainda estiver na lista). */
  async function carregar(idAbrir) {
    try {
      hoje = (await ApiCurso.operacaoHoje());
      lista = cfg.lista(hoje);
      var n = hoje;
      el('numeros').innerHTML =
        '<span>Chegadas <b>' + n.chegadas.length + '</b></span>' +
        (n.atrasadas.length ? '<span class="alerta">Atrasadas <b>' + n.atrasadas.length + '</b></span>' : '') +
        '<span>Saídas <b>' + n.saidas.length + '</b></span>' +
        '<span>Na casa <b>' + n.hospedados.length + '</b> de ' + n.total_quartos + '</span>' +
        (n.quartos_sujos.length ? '<span class="alerta" title="' + esc(n.quartos_sujos.join(', ')) + '">Sujos <b>' + n.quartos_sujos.length + '</b></span>' : '');
      el('lblRodape').textContent = 'Hoje ' + br(n.hoje) + ' · ' + lista.length + ' na lista';
      desenharLista();
      var alvo = idAbrir && lista.some(function (r) { return r.id_reserva === Number(idAbrir); }) ? Number(idAbrir) : (lista[0] && lista[0].id_reserva);
      if (alvo) await abrir(alvo); else { atual = null; el('painel').innerHTML = '<div class="op-vazio">' + cfg.vazio + '</div>'; }
    } catch (erro) { el('painel').innerHTML = '<div class="op-vazio">' + esc(erro.message) + '</div>'; }
  }

  /** desenharLista() — cartões filtrados pela busca (nome, quarto ou código). */
  function desenharLista() {
    var b = el('busca').value.trim().toLowerCase();
    var vis = lista.filter(function (r) { return !b || (r.hospede_nome + ' ' + r.quarto_numero + ' ' + r.codigo).toLowerCase().indexOf(b) >= 0; });
    el('lista').innerHTML = vis.length ? vis.map(function (r) {
      return '<div class="op-card' + (r.id_reserva === atual ? ' sel' : '') + '" data-id="' + r.id_reserva + '">' +
        '<div class="l1"><b>' + esc(r.hospede_nome) + '</b><span class="q">' + esc(r.quarto_numero) + '</span></div>' +
        '<div class="l2"><span>' + br(r.entrada) + ' → ' + br(r.saida) + ' · ' + r.noites + ' noite(s)</span>' +
        (r._marca ? '<span class="op-marca">' + r._marca + '</span>' : '<span>' + esc(r.codigo) + '</span>') + '</div></div>';
    }).join('') : '<div class="op-vazio">' + (b ? 'Nada com "' + esc(b) + '".' : cfg.vazio) + '</div>';
  }
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.op-card');
    if (c) abrir(Number(c.dataset.id)).then(function () {
      // celular: a conta fica embaixo da lista — rola até ela depois do toque
      if (window.matchMedia && matchMedia('(max-width: 760px)').matches) el('painel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // =================================================================================================
  // PAINEL DA RESERVA (direita)
  // =================================================================================================
  /** abrir(id) — mostra a reserva: no check-in os dados e o botão; na estadia/check-out a conta inteira. */
  async function abrir(id) {
    atual = id;
    desenharLista();
    try {
      conta = await ApiCurso.contaHospede(id);
      if (modo === 'checkin') desenharCheckin(); else desenharConta();
    } catch (erro) { el('painel').innerHTML = '<div class="op-vazio">' + esc(erro.message) + '</div>'; }
  }

  /** cabecalho(r) — nome, quarto, datas, pessoas e a situação (igual nas três telas). */
  function cabecalho(r) {
    return '<div class="op-cab"><div><b>' + esc(r.hospede_nome) + '</b>' +
      '<small>Quarto <b>' + esc(r.quarto_numero) + '</b> · ' + esc(r.tipo_nome) + ' · ' + br(r.entrada) + ' a ' + br(r.saida) + ' · ' + r.noites + (r.noites === 1 ? ' noite' : ' noites') + ' · ' +
      r.adultos + ' adulto(s)' + (r.criancas ? ' e ' + r.criancas + ' criança(s)' : '') + ' · ' + esc(r.codigo) + '</small></div>' +
      '<span class="badge ' + String(r.situacao).toLowerCase() + '">' + (SIT[r.situacao] || r.situacao) + '</span></div>';
  }

  /** desenharCheckin() — conferência antes da entrada: valor, sinal, observação da reserva, situação do quarto. */
  function desenharCheckin() {
    var r = conta.reserva, q = quartos[r.id_quarto] || {};
    var alerta = q.situacao === 'SUJO' ? 'O quarto ' + r.quarto_numero + ' está SUJO. Peça a limpeza antes (ou confirme a entrada mesmo assim).'
      : q.situacao === 'MANUTENCAO' ? 'O quarto ' + r.quarto_numero + ' está em MANUTENÇÃO.' : '';
    el('painel').innerHTML = cabecalho(r) +
      (alerta ? '<div class="op-alerta">' + alerta + '</div>' : '') +
      (r.entrada < hoje.hoje ? '<div class="op-alerta">A entrada era ' + br(r.entrada) + ': o hóspede está atrasado.</div>' : '') +
      '<div class="op-dados">' +
      '<div><span>Total da estadia</span>' + moeda(conta.total) + '</div>' +
      '<div><span>Já pago</span>' + moeda(conta.total_recebido + conta.sinal_pago_antes) + '</div>' +
      '<div><span>A receber</span><b>' + moeda(conta.saldo) + '</b></div>' +
      '<div><span>Origem</span>' + esc(r.origem) + '</div></div>' +
      (r.observacao ? '<div class="dica">Obs. da reserva: ' + esc(r.observacao) + '</div>' : '') +
      '<div class="op-form"><label>Observação da entrada<input class="campo largo" id="obsCheckin" maxlength="200" placeholder="Ex.: placa do carro, chegou às 15h"></label></div>' +
      '<div class="op-fim"><button type="button" class="btn" id="btnCheckin"><span class="material-icons">login</span>Fazer check-in</button></div>';
    el('btnCheckin').onclick = function () { checkin(r.id_reserva, el('obsCheckin').value); };
  }

  /** desenharConta() — o extrato: diárias, consumos, recebimentos, totais e saldo; forms de consumo e de recebimento. */
  function desenharConta() {
    var r = conta.reserva, linhas = '';
    linhas += '<tr><td>' + br(r.entrada) + '</td><td>Diárias (' + r.noites + ' noite(s))</td><td class="v">' + moeda(conta.diarias) + '</td><td></td></tr>';
    conta.consumos.forEach(function (c) {
      linhas += '<tr class="' + (c.estornado ? 'est' : '') + '" title="' + esc(c.estornado ? 'Estornado: ' + c.estorno_motivo : '') + '"><td>' + hora(c.lancado_em) + '</td>' +
        '<td>' + esc(c.descricao) + (c.quantidade !== 1 ? ' × ' + String(c.quantidade).replace('.', ',') : '') + '</td><td class="v">' + moeda(c.valor_total) + '</td>' +
        '<td>' + (c.estornado || modo === 'checkin' ? '' : '<span class="op-est material-icons" role="button" tabindex="0" data-est-consumo="' + c.id_consumo + '" title="Estornar (pede o motivo)">undo</span>') + '</td></tr>';
    });
    if (conta.sinal_pago_antes) linhas += '<tr class="rec"><td></td><td>Sinal pago na reserva</td><td class="v">− ' + moeda(conta.sinal_pago_antes) + '</td><td></td></tr>';
    conta.recebimentos.forEach(function (p) {
      linhas += '<tr class="rec ' + (p.estornado ? 'est' : '') + '" title="' + esc(p.estornado ? 'Estornado: ' + p.estorno_motivo : p.observacao) + '"><td>' + hora(p.recebido_em) + '</td>' +
        '<td>Recebido · ' + esc(p.forma) + '</td><td class="v">− ' + moeda(p.valor) + '</td>' +
        '<td>' + (p.estornado ? '' : '<span class="op-est material-icons" role="button" tabindex="0" data-est-receb="' + p.id_recebimento + '" title="Estornar (pede o motivo)">undo</span>') + '</td></tr>';
    });
    var s = conta.saldo;
    var aberta = r.situacao === 'HOSPEDADO';
    el('painel').innerHTML = cabecalho(r) +
      '<table class="op-tab"><thead><tr><th style="width:92px">Quando</th><th>Lançamento</th><th class="v">Valor</th><th style="width:20px"></th></tr></thead><tbody>' + linhas + '</tbody></table>' +
      '<div class="op-totais"><span>Diárias <b>' + moeda(conta.diarias) + '</b></span><span>Consumos <b>' + moeda(conta.total_consumos) + '</b></span>' +
      '<span>Pago <b>' + moeda(conta.total_recebido + conta.sinal_pago_antes) + '</b></span>' +
      '<span>Saldo <b class="op-saldo ' + (s <= 0 ? 'zero' : 'deve') + '">' + moeda(s) + '</b></span></div>' +
      (aberta ?
        '<div class="op-form"><label>Consumo<select class="campo largo" id="selItem">' + itens.map(function (i) {
          return '<option value="' + i.id_item + '" data-preco="' + i.preco + '">' + esc(i.nome) + ' — ' + moeda(i.preco) + '</option>'; }).join('') + '</select></label>' +
        '<label>Qtd<input class="campo numero" id="qtdItem" value="1" style="width:52px"></label>' +
        '<label>Valor un.<input class="campo numero" id="valItem" placeholder="do cadastro"></label>' +
        '<button type="button" class="btn" id="btnConsumo"><span class="material-icons">add</span>Lançar</button></div>' +
        '<div class="op-form"><label>Receber em<select class="campo" id="selForma">' + formas.map(function (f) {
          return '<option value="' + f.id_forma + '">' + esc(f.nome) + '</option>'; }).join('') + '</select></label>' +
        '<label>Valor<input class="campo numero" id="valReceb" value="' + (s > 0 ? s.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '') + '"></label>' +
        '<label>Observação<input class="campo largo" id="obsReceb" maxlength="120" placeholder="Ex.: NSU, últimos 4 dígitos"></label>' +
        '<button type="button" class="btn" id="btnReceber"' + (s > 0 ? '' : ' disabled') + '><span class="material-icons">payments</span>Receber</button></div>'
        : '<div class="dica">Conta encerrada: só consulta.</div>') +
      (modo === 'checkout' && aberta ?
        '<div class="op-fim">' + (s > 0 ? '<span class="dica" style="margin-right:auto">Receba o saldo para fechar a conta.</span>' : '') +
        '<button type="button" class="btn" id="btnCheckout"' + (s > 0 ? ' disabled' : '') + '><span class="material-icons">logout</span>Fechar conta e fazer check-out</button></div>' : '');

    if (!aberta) return;
    el('btnConsumo').onclick = function () { consumo(r.id_reserva, el('selItem').value, numero(el('qtdItem').value) || 1, numero(el('valItem').value)); };
    el('btnReceber').onclick = function () { receber(r.id_reserva, el('selForma').value, numero(el('valReceb').value), el('obsReceb').value); };
    if (el('btnCheckout')) el('btnCheckout').onclick = function () { checkout(r.id_reserva); };
  }

  /* estornos pelos ícones da tabela (pede o motivo) */
  document.addEventListener('click', async function (e) {
    var b = e.target.closest && e.target.closest('[data-est-consumo],[data-est-receb]');
    if (!b) return;
    var ehConsumo = b.hasAttribute('data-est-consumo');
    var motivo = await FacilAppPerguntar('Motivo do estorno do ' + (ehConsumo ? 'consumo' : 'recebimento') + ':', { confirmar: 'Estornar' });
    if (motivo === null) return;
    try {
      if (ehConsumo) await ApiCurso.estornarConsumo(b.getAttribute('data-est-consumo'), motivo);
      else await ApiCurso.estornarRecebimento(b.getAttribute('data-est-receb'), motivo);
      aviso('Estornado.');
      await abrir(atual);
    } catch (erro) { aviso(erro.message); }
  });

  // =================================================================================================
  // AÇÕES (as mesmas que a Luninha usa)
  // =================================================================================================
  /**
   * checkin(id, observacao, forcar) — dá a entrada. Se a API responder que o quarto está sujo/em manutenção
   * (409 com confirmar), pergunta e tenta de novo com forcar. Depois a reserva sai da lista de chegadas.
   */
  async function checkin(id, observacao, forcar) {
    try {
      var r = await ApiCurso.fazerCheckin(id, forcar, observacao);
      aviso(r.mensagem);
      await carregarQuartos();
      await carregar();
      return r.mensagem;
    } catch (erro) {
      if (erro.status === 409 && erro.dados && erro.dados.confirmar && !forcar) {
        if (await FacilAppConfirmar(erro.message, { confirmar: 'Fazer check-in mesmo assim' })) return checkin(id, observacao, true);
        return 'Check-in não feito.';
      }
      aviso(erro.message);
      throw erro;
    }
  }
  /** consumo(id, idItem, qtd, valorUnit) — lança na conta; valor vazio = preço do cadastro. */
  async function consumo(id, idItem, qtd, valorUnit) {
    try { var r = await ApiCurso.lancarConsumo(id, idItem, qtd, valorUnit); aviso('Consumo lançado: ' + moeda(r.total) + '.'); await abrir(id); return r; }
    catch (erro) { aviso(erro.message); throw erro; }
  }
  /** receber(id, idForma, valor, obs) — recebimento na conta (a API não deixa passar do saldo). */
  async function receber(id, idForma, valor, obs) {
    if (!valor || valor <= 0) { aviso('Informe o valor a receber.'); return; }
    try { var r = await ApiCurso.receber(id, idForma, valor, obs); aviso('Recebido ' + moeda(valor) + '. Saldo: ' + moeda(r.saldo) + '.'); await abrir(id); return r; }
    catch (erro) { aviso(erro.message); throw erro; }
  }
  /** checkout(id) — fecha a conta (saldo zero), a reserva vira ENCERRADA e o quarto fica SUJO para a limpeza. */
  async function checkout(id) {
    if (!(await FacilAppConfirmar('Fechar a conta e fazer o check-out de ' + conta.reserva.hospede_nome + ' (quarto ' + conta.reserva.quarto_numero + ')?', { confirmar: 'Fazer check-out' }))) return;
    try {
      var r = await ApiCurso.fazerCheckout(id);
      aviso(r.mensagem + (r.avisos && r.avisos.length ? ' ' + r.avisos.join(' ') : ''));
      await carregar();
      return r.mensagem;
    } catch (erro) { aviso(erro.message); }
  }

  /** carregarQuartos() — situação de cada quarto (para avisar sujo/manutenção no check-in). */
  async function carregarQuartos() {
    var l = await ApiCurso.cadastroListar('quartos', { ativo: 1 });
    quartos = {}; l.forEach(function (q) { quartos[q.id_quarto] = q; });
  }

  // =================================================================================================
  // INÍCIO
  // =================================================================================================
  window.ContaHospede = {
    /** iniciar({ modo }) — monta a tela, carrega serviços, formas e quartos e abre a lista do dia. */
    iniciar: async function (opcoes) {
      modo = opcoes.modo; cfg = MODOS[modo];
      montar();
      try {
        var r = await Promise.all([ApiCurso.cadastroListar('servicos-produtos', { ativo: 1 }), ApiCurso.cadastroListar('formas-pagamento', { ativo: 1 }), carregarQuartos()]);
        itens = r[0]; formas = r[1];
      } catch (erro) { aviso(erro.message); }
      await carregar(new URLSearchParams(location.search).get('id'));
    },
    // para a Luninha (IAOperacao.js): as mesmas ações da tela
    modo: function () { return modo; },
    lista: function () { return lista; },
    hoje: function () { return hoje; },
    atual: function () { return atual; },
    abrir: abrir,
    checkin: checkin,
    consumo: consumo,
    receber: receber,
    fazerCheckout: async function (id) { var r = await ApiCurso.fazerCheckout(id); await carregar(); return r; }
  };
  window.recarregarTela = function (id) { return carregar(id || atual); };
  window.abrirConta = abrir;
})();
