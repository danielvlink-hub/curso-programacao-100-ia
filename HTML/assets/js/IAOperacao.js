/* ==========================================================================
   IAOperacao.js — a Luninha da OPERAÇÃO do dia (Botão IA e Botão VOZ) — telas Check-in, Estadia e Check-out.
   Daniel, 08/11/2026 (Bloco 3): "gere o bloco 3"; "ligue ele com os mesmos poderes da luninha".

   O QUE FAZ: as ferramentas que a Luninha usa para conversar sobre o dia da pousada e agir na tela:
     resumo_do_dia, ver_conta, abrir_conta, fazer_checkin, lancar_consumo, receber, fazer_checkout.
   COMO: cada ferramenta chama as MESMAS funções da tela (ContaHospede.js → ApiCurso). Depois de gravar, a tela
     recarrega sozinha. A regra de verdade é da API (Operacao.cs): saldo, quarto sujo, check-out só com saldo zero.
   REGRAS: tudo que grava mostra o resumo e pede Confirmar; estornos ficam na tela (ícone na linha, com motivo).
   ========================================================================== */
(function () {
  'use strict';
  var moeda = function (v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
  /** curta(r) — a reserva resumida para a IA (sem contato). */
  var curta = function (r) { return { id: r.id_reserva, hospede: r.hospede_nome, quarto: r.quarto_numero, entrada: r.entrada, saida: r.saida, situacao: r.situacao }; };

  window.IAOperacao = {
    tela: 'OPERACAO',
    titulo: 'Operação do dia',
    descricao: 'Operação do dia da pousada: chegadas e check-in, hóspedes na casa com a conta (diárias, consumos, recebimentos, saldo) ' +
      'e check-out. Regras da API: check-in só de reserva pré ou confirmada; quarto sujo ou em manutenção precisa de confirmação; ' +
      'consumo só para hospedado; recebimento não passa do saldo; check-out só com saldo zero (o quarto fica sujo).',
    regras: 'Use resumo_do_dia para achar a reserva pelo nome ou quarto (o id vem dali). Para receber, use ver_conta para saber o saldo ' +
      'e listar as formas de pagamento. Para consumo, use ver_conta para listar os itens do cadastro. Estorno: diga ao usuário ' +
      'para clicar no ícone de desfazer na linha da conta.',
    saudacao: 'Posso dizer quem chega e quem sai, fazer check-in, lançar consumo, receber e fechar a conta.',
    exemplo: 'Ex.: "quem chega hoje?", "faz o check-in da Maria", "lança 2 águas no 102" ou "quanto o 201 deve?".',

    preparar: async function () {
      var h = ContaHospede.hoje();
      return { hoje: h ? h.hoje : new Date().toISOString().slice(0, 10), tela: ContaHospede.modo(), aberta: ContaHospede.atual() };
    },

    ferramentas: {
      resumo_do_dia: {
        descricao: 'O dia da pousada: chegadas, atrasadas, saídas, hospedados (com id e quarto) e quartos sujos. Não grava.',
        parametros: {}, grava: false,
        executar: async function () {
          var h = await ApiCurso.operacaoHoje();
          return { hoje: h.hoje, chegadas: h.chegadas.map(curta), atrasadas: h.atrasadas.map(curta), saidas: h.saidas.map(curta),
            hospedados: h.hospedados.map(curta), quartos_sujos: h.quartos_sujos, total_quartos: h.total_quartos };
        }
      },
      ver_conta: {
        descricao: 'A conta de uma reserva: diárias, consumos, recebimentos e saldo; traz também os itens de consumo e as formas de pagamento (com id). Não grava.',
        parametros: { id: { type: 'integer', description: 'id da reserva' } }, obrigatorios: ['id'], grava: false,
        executar: async function (p) {
          var c = await ApiCurso.contaHospede(p.id);
          var itens = await ApiCurso.cadastroListar('servicos-produtos', { ativo: 1 });
          var formas = await ApiCurso.cadastroListar('formas-pagamento', { ativo: 1 });
          return { hospede: c.reserva.hospede_nome, quarto: c.reserva.quarto_numero, situacao: c.reserva.situacao,
            diarias: c.diarias, consumos: c.consumos.filter(function (x) { return !x.estornado; }).map(function (x) { return x.descricao + ' × ' + x.quantidade + ' = ' + moeda(x.valor_total); }),
            pago: c.total_recebido + c.sinal_pago_antes, total: c.total, saldo: c.saldo,
            itens: itens.map(function (i) { return { id_item: i.id_item, nome: i.nome, preco: i.preco }; }),
            formas: formas.map(function (f) { return { id_forma: f.id_forma, nome: f.nome }; }) };
        }
      },
      abrir_conta: {
        descricao: 'Mostra a reserva/conta na tela (painel da direita).', parametros: { id: { type: 'integer', description: 'id da reserva' } },
        obrigatorios: ['id'], grava: false,
        executar: async function (p) { await ContaHospede.abrir(p.id); return 'Abri na tela.'; }
      },
      fazer_checkin: {
        descricao: 'Dá a ENTRADA do hóspede (check-in) de uma reserva pré ou confirmada.',
        parametros: { id: { type: 'integer', description: 'id da reserva' }, observacao: 'observação da entrada (opcional)' },
        obrigatorios: ['id'], grava: true,
        resumo: function (p) { return 'Fazer o check-in da reserva nº ' + p.id + (p.observacao ? '\nObs.: ' + p.observacao : '') + '?'; },
        executar: async function (p) { return await ContaHospede.checkin(p.id, p.observacao || ''); }
      },
      lancar_consumo: {
        descricao: 'Lança um consumo (item do cadastro de serviços/produtos) na conta de um hóspede HOSPEDADO.',
        parametros: { id: { type: 'integer', description: 'id da reserva' }, id_item: { type: 'integer', description: 'id do item (use ver_conta)' },
          quantidade: { type: 'number', description: 'quantidade (padrão 1)' } },
        obrigatorios: ['id', 'id_item'], grava: true,
        resumo: function (p) { return 'Lançar ' + (p.quantidade || 1) + ' × item nº ' + p.id_item + ' na conta da reserva nº ' + p.id + '?'; },
        executar: async function (p) { var r = await ContaHospede.consumo(p.id, p.id_item, p.quantidade || 1, null); return 'Lançado ' + moeda(r.total) + '. Saldo agora: ' + moeda(r.saldo) + '.'; }
      },
      receber: {
        descricao: 'Recebe um valor na conta (não pode passar do saldo).',
        parametros: { id: { type: 'integer', description: 'id da reserva' }, id_forma: { type: 'integer', description: 'id da forma de pagamento (use ver_conta)' },
          valor: { type: 'number', description: 'valor em reais' }, observacao: 'observação (opcional)' },
        obrigatorios: ['id', 'id_forma', 'valor'], grava: true,
        resumo: function (p) { return 'Receber ' + moeda(p.valor) + ' (forma nº ' + p.id_forma + ') na conta da reserva nº ' + p.id + '?'; },
        executar: async function (p) { var r = await ContaHospede.receber(p.id, p.id_forma, p.valor, p.observacao || ''); return 'Recebido. Saldo agora: ' + moeda(r.saldo) + '.'; }
      },
      fazer_checkout: {
        descricao: 'Fecha a conta e faz o CHECK-OUT (só com saldo zero). O quarto fica sujo para a limpeza.',
        parametros: { id: { type: 'integer', description: 'id da reserva' } }, obrigatorios: ['id'], grava: true,
        resumo: function (p) { return 'Fechar a conta e fazer o check-out da reserva nº ' + p.id + '?'; },
        executar: async function (p) {
          var r = await ContaHospede.fazerCheckout(p.id);
          return r.mensagem + (r.avisos && r.avisos.length ? ' ' + r.avisos.join(' ') : '');
        }
      }
    }
  };
})();
