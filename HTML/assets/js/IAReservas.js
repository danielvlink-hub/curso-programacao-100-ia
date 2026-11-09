/* ==========================================================================
   IAReservas.js — a Luninha das reservas (Botão IA e Botão VOZ) — lista de reservas e mapa de ocupação.
   Daniel, 08/11/2026 (Bloco 2): "as reservas devem ser sofisticadas, agendas de arrastar para reservas".

   O QUE FAZ: as ferramentas que a Luninha usa para conversar sobre reservas e agir na tela:
     buscar_hospede, disponibilidade (quartos livres com preço), listar_reservas, criar_reserva, alterar_reserva,
     mover_reserva, cancelar_reserva (com motivo, vermelho), marcar_no_show e abrir_reserva.
   COMO: cada ferramenta chama as MESMAS funções da tela (ApiCurso.reserva*, cadastroListar, listarHospedes). Depois
     de gravar, recarrega a tela que estiver aberta (window.recarregarTela). A regra de verdade é da API (Reservas.cs):
     conflito, capacidade, meio-dia, preço noite a noite.
   REGRAS: tudo que grava mostra o resumo e pede Confirmar; cancelar pede o motivo; datas em AAAA-MM-DD.
   ========================================================================== */
(function () {
  'use strict';
  var SIT = { PRE_RESERVA: 'Pré-reserva', CONFIRMADA: 'Confirmada', HOSPEDADO: 'Hospedado', ENCERRADA: 'Encerrada', CANCELADA: 'Cancelada', NO_SHOW: 'No-show' };
  var br = function (iso) { var s = String(iso || ''); return s.length >= 10 ? s.slice(8, 10) + '/' + s.slice(5, 7) : s; };
  var moeda = function (v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
  var recarregar = async function (id) { if (typeof window.recarregarTela === 'function') { try { await window.recarregarTela(id); } catch (e) { /* tela segue */ } } };

  /** curta(r) — a reserva resumida para a IA (sem dados de contato). */
  function curta(r) {
    return { id: r.id_reserva, codigo: r.codigo, hospede: r.hospede_nome, quarto: r.quarto_numero, tipo: r.tipo_nome,
      entrada: r.entrada, saida: r.saida, noites: r.noites, situacao: SIT[r.situacao] || r.situacao, total: r.valor_total };
  }

  window.IAReservas = {
    tela: 'RESERVAS',
    titulo: 'Reservas',
    descricao: 'Reservas da pousada: ver quartos livres com o preço, reservar, alterar, mover de quarto ou de data, cancelar e no-show. ' +
      'Regras da API: o mesmo quarto não pode ter duas reservas que se cruzam (a saída de um pode ser a entrada de outro), ' +
      'a capacidade do tipo é respeitada e o preço é calculado noite a noite pelas tarifas.',
    regras: 'Para reservar: ache o hóspede com buscar_hospede e um quarto livre com disponibilidade, depois criar_reserva. ' +
      'Para alterar, mover ou cancelar: ache a reserva com listar_reservas. Datas em AAAA-MM-DD; se o usuário disser ' +
      '"sexta" ou "dia 20", converta usando a data de hoje. Situação padrão: CONFIRMADA (ou PRE_RESERVA se pedirem).',
    saudacao: 'Posso ver quartos livres e preços, reservar, mover, cancelar — e conversar.',
    exemplo: 'Ex.: "tem quarto para 2 de sexta a domingo?", "reserva o 102 para a Maria de 20 a 22" ou "cancela a reserva da Ana".',

    preparar: async function () {
      var quartos = await ApiCurso.cadastroListar('quartos', { ativo: 1 });
      return { hoje: new Date().toISOString().slice(0, 10), quartos: quartos.map(function (q) { return { id: q.id_quarto, numero: q.numero }; }) };
    },

    ferramentas: {
      buscar_hospede: {
        descricao: 'Procura hóspedes pelo nome, documento ou telefone para achar o id. Não grava.',
        parametros: { busca: 'parte do nome, documento ou telefone' }, obrigatorios: ['busca'], grava: false,
        executar: async function (p) {
          var l = await ApiCurso.listarHospedes({ busca: p.busca, ativo: 1 });
          return l.length ? l.slice(0, 10).map(function (h) { return { id: h.id_hospede, nome: h.nome, documento: h.documento, telefone: h.telefone }; })
            : 'Nenhum hóspede encontrado. O usuário precisa cadastrar o hóspede antes (tela de Hóspedes).';
        }
      },
      disponibilidade: {
        descricao: 'Quartos LIVRES no período para as pessoas informadas, com o preço total de cada um. Não grava.',
        parametros: { entrada: 'AAAA-MM-DD', saida: 'AAAA-MM-DD', adultos: { type: 'integer', description: 'adultos (padrão 2)' },
          criancas: { type: 'integer', description: 'crianças (padrão 0)' } },
        obrigatorios: ['entrada', 'saida'], grava: false,
        executar: async function (p) {
          var d = await ApiCurso.reservaDisponibilidade(p.entrada, p.saida, p.adultos || 2, p.criancas || 0);
          if (!d.quartos.length) return 'Nenhum quarto livre para ' + d.noites + ' noite(s) nesse período.';
          return { noites: d.noites, livres: d.quartos.map(function (q) {
            return { id_quarto: q.id_quarto, quarto: q.numero, tipo: q.tipo, total: q.total, aviso_minimo: q.atende_minimo ? '' : 'mínimo ' + q.minimo_noites + ' noites' };
          }) };
        }
      },
      listar_reservas: {
        descricao: 'Lista reservas (por nome, código ou quarto; por período; por situação). Não grava.',
        parametros: { busca: 'nome do hóspede, código ou número do quarto', de: 'AAAA-MM-DD', ate: 'AAAA-MM-DD',
          situacao: { type: 'string', enum: ['', 'PRE_RESERVA', 'CONFIRMADA', 'HOSPEDADO', 'ENCERRADA', 'CANCELADA', 'NO_SHOW'] } },
        grava: false,
        executar: async function (p) {
          var l = await ApiCurso.cadastroListar('reservas', { busca: p.busca, de: p.de, ate: p.ate, situacao: p.situacao });
          if (window.CP) CP.aplicarFiltros({ busca: p.busca || '', situacao: p.situacao || '' });
          return { total: l.length, reservas: l.slice(0, 25).map(curta) };
        }
      },
      criar_reserva: {
        descricao: 'Cria UMA reserva. Obrigatórios: id_hospede, id_quarto, entrada, saida.',
        parametros: {
          id_hospede: { type: 'integer', description: 'id do hóspede (use buscar_hospede)' },
          id_quarto: { type: 'integer', description: 'id do quarto (use disponibilidade)' },
          entrada: 'AAAA-MM-DD', saida: 'AAAA-MM-DD',
          adultos: { type: 'integer', description: 'adultos' }, criancas: { type: 'integer', description: 'crianças' },
          situacao: { type: 'string', enum: ['CONFIRMADA', 'PRE_RESERVA'] },
          origem: { type: 'string', enum: ['BALCAO', 'TELEFONE', 'WHATSAPP', 'SITE', 'BOOKING', 'OUTRO'] },
          observacao: 'observação'
        },
        obrigatorios: ['id_hospede', 'id_quarto', 'entrada', 'saida'], grava: true,
        validar: function (p) {
          if (!p.id_hospede) return 'Para qual hóspede?';
          if (!p.id_quarto) return 'Qual quarto?';
          if (!p.entrada || !p.saida) return 'Quais as datas de entrada e saída?';
          return '';
        },
        resumo: function (p) {
          return 'Reservar o quarto nº ' + p.id_quarto + ' para o hóspede nº ' + p.id_hospede + ':\n• ' + br(p.entrada) + ' a ' + br(p.saida) +
            '\n• ' + (p.adultos || 1) + ' adulto(s)' + (p.criancas ? ' e ' + p.criancas + ' criança(s)' : '') +
            '\n• ' + (p.situacao === 'PRE_RESERVA' ? 'Pré-reserva (vence em 24 h)' : 'Confirmada');
        },
        executar: async function (p) {
          var r = await ApiCurso.reservaGravar(null, Object.assign({ adultos: 1, criancas: 0, situacao: 'CONFIRMADA', origem: 'BALCAO' }, p));
          var g = await ApiCurso.cadastroObter('reservas', r.id);
          await recarregar(r.id);
          return 'Reserva ' + g.codigo + ' criada: ' + g.hospede_nome + ', quarto ' + g.quarto_numero + ', ' + br(g.entrada) + ' a ' + br(g.saida) +
            ', total ' + moeda(g.valor_total) + '.' + (r.avisos && r.avisos.length ? ' Aviso: ' + r.avisos.join(' ') : '');
        }
      },
      alterar_reserva: {
        descricao: 'Altera uma reserva pelo id (pessoas, situação, origem, observação, datas, quarto). Mande só o que muda.',
        parametros: { id: { type: 'integer', description: 'id da reserva' }, entrada: 'AAAA-MM-DD', saida: 'AAAA-MM-DD',
          id_quarto: { type: 'integer', description: 'id do quarto' }, adultos: { type: 'integer' }, criancas: { type: 'integer' },
          situacao: { type: 'string', enum: ['CONFIRMADA', 'PRE_RESERVA'] }, observacao: 'observação' },
        obrigatorios: ['id'], grava: true,
        resumo: function (p) { var c = Object.assign({}, p); delete c.id; return 'Alterar a reserva nº ' + p.id + ':\n' + Object.keys(c).map(function (k) { return '• ' + k + ': ' + c[k]; }).join('\n'); },
        executar: async function (p) {
          var a = await ApiCurso.cadastroObter('reservas', p.id);
          var d = { id_hospede: a.id_hospede, id_quarto: a.id_quarto, entrada: a.entrada, saida: a.saida, adultos: a.adultos, criancas: a.criancas,
            situacao: a.situacao, origem: a.origem, sinal_valor: a.sinal_valor, sinal_pago: a.sinal_pago, contato_nome: a.contato_nome,
            contato_email: a.contato_email, contato_telefone: a.contato_telefone, observacao: a.observacao };
          Object.keys(p).forEach(function (k) { if (k !== 'id') d[k] = p[k]; });
          var r = await ApiCurso.reservaGravar(p.id, d);
          var g = await ApiCurso.cadastroObter('reservas', p.id);
          await recarregar(p.id);
          return 'Reserva ' + g.codigo + ' alterada: quarto ' + g.quarto_numero + ', ' + br(g.entrada) + ' a ' + br(g.saida) + ', total ' + moeda(g.valor_total) + '.' +
            (r.avisos && r.avisos.length ? ' Aviso: ' + r.avisos.join(' ') : '');
        }
      },
      mover_reserva: {
        descricao: 'Muda a reserva de quarto e/ou de datas (como arrastar no mapa). Recalcula o total.',
        parametros: { id: { type: 'integer', description: 'id da reserva' }, id_quarto: { type: 'integer', description: 'novo quarto' },
          entrada: 'nova entrada AAAA-MM-DD', saida: 'nova saída AAAA-MM-DD' },
        obrigatorios: ['id'], grava: true,
        resumo: function (p) { return 'Mover a reserva nº ' + p.id + (p.id_quarto ? ' para o quarto nº ' + p.id_quarto : '') + (p.entrada ? ', de ' + br(p.entrada) + ' a ' + br(p.saida) : '') + '?'; },
        executar: async function (p) {
          var r = await ApiCurso.reservaMover(p.id, p.id_quarto, p.entrada, p.saida);
          await recarregar(p.id);
          return 'Reserva movida. Novo total: ' + moeda(r.valor_total) + '.';
        }
      },
      cancelar_reserva: {
        descricao: 'CANCELA uma reserva (pré ou confirmada). Precisa do motivo.',
        parametros: { id: { type: 'integer', description: 'id da reserva' }, motivo: 'motivo do cancelamento' },
        obrigatorios: ['id', 'motivo'], grava: true, exclui: true,
        validar: function (p) { return p.motivo && String(p.motivo).trim().length >= 3 ? '' : 'Qual o motivo do cancelamento?'; },
        resumo: function (p) { return 'CANCELAR a reserva nº ' + p.id + '?\nMotivo: ' + p.motivo; },
        executar: async function (p) { await ApiCurso.reservaCancelar(p.id, p.motivo); await recarregar(); return 'Reserva cancelada.'; }
      },
      marcar_no_show: {
        descricao: 'Marca que o hóspede NÃO VEIO (no-show). Só a partir do dia da entrada.',
        parametros: { id: { type: 'integer', description: 'id da reserva' } }, obrigatorios: ['id'], grava: true,
        resumo: function (p) { return 'Marcar a reserva nº ' + p.id + ' como no-show (o hóspede não veio)?'; },
        executar: async function (p) { await ApiCurso.reservaNoShow(p.id); await recarregar(); return 'Marcada como no-show.'; }
      },
      abrir_reserva: {
        descricao: 'Abre a ficha de uma reserva na tela (formulário).', parametros: { id: { type: 'integer', description: 'id da reserva' } },
        obrigatorios: ['id'], grava: false,
        executar: async function (p) {
          if (window.CP) CP.abrirUpdate(p.id); else if (typeof window.abrirReserva === 'function') window.abrirReserva(p.id);
          return 'Abri a reserva na tela.';
        }
      }
    }
  };
})();
