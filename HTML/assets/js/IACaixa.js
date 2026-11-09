/* ==========================================================================
   IACaixa.js — a Luninha do CAIXA (Botão IA e Botão VOZ) — telas Caixa e Recebimentos.
   Daniel, 08/11/2026 (Bloco 4): "Sim, Bloco 4"; "ligue ele com os mesmos poderes da luninha".

   O QUE FAZ: as ferramentas que a Luninha usa para conversar sobre o dinheiro da pousada e agir na tela:
     situacao_caixa, abrir_caixa, suprimento, sangria, fechar_caixa, listar_recebimentos, estornar_recebimento.
   COMO: cada ferramenta chama as MESMAS funções da tela (ApiCurso.caixaAtual, abrirCaixa, movimentoCaixa, fecharCaixa, recebimentos, estornarRecebimento) e depois
     recarrega a tela aberta (window.recarregarTela). A regra de verdade é da API (Caixa.cs): um caixa por usuário,
     sangria até o dinheiro da gaveta, fechamento com diferença exige observação, caixa fechado não muda mais.
   REGRAS: tudo que grava mostra o resumo e pede Confirmar; estorno pede o motivo (vermelho).
   ========================================================================== */
(function () {
  'use strict';
  var moeda = function (v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
  var recarregar = async function () { if (typeof window.recarregarTela === 'function') { try { await window.recarregarTela(); } catch (e) { /* segue */ } } };

  window.IACaixa = {
    tela: 'CAIXA',
    titulo: 'Caixa e recebimentos',
    descricao: 'O caixa da pousada: cada usuário abre o seu caixa com o troco, os recebimentos dos hóspedes entram nele, ' +
      'há suprimento (entra dinheiro) e sangria (sai dinheiro, com motivo) e no fim fecha conferindo o dinheiro contado. ' +
      'A lista de recebimentos mostra tudo o que entrou, por forma de pagamento.',
    regras: 'Antes de abrir, suprimento, sangria ou fechar, use situacao_caixa. Para fechar, PERGUNTE quanto dinheiro foi ' +
      'contado na gaveta (nunca invente); se houver diferença, peça a explicação para a observação. Para estornar, ache o ' +
      'recebimento com listar_recebimentos e peça o motivo.',
    saudacao: 'Posso dizer como está o caixa, abrir, registrar sangria ou suprimento, fechar e ver os recebimentos.',
    exemplo: 'Ex.: "como está o caixa?", "abre o caixa com 100 reais", "sangria de 200 para o banco" ou "quanto entrou em Pix hoje?".',

    preparar: async function () { return { hoje: new Date().toISOString().slice(0, 10) }; },

    ferramentas: {
      situacao_caixa: {
        descricao: 'Como está o caixa do usuário: aberto ou fechado, troco inicial, recebido por forma, sangrias, suprimentos e o dinheiro esperado na gaveta. Não grava.',
        parametros: {}, grava: false,
        executar: async function () {
          var a = await ApiCurso.caixaAtual();
          if (!a.aberto) return 'O caixa de ' + a.usuario + ' está FECHADO.';
          var d = a.dados;
          return { caixa: d.caixa.id_caixa, aberto_em: d.caixa.aberto_em, troco_inicial: d.caixa.saldo_inicial, total_recebido: d.total_recebido,
            por_forma: d.por_forma, suprimentos: d.suprimentos, sangrias: d.sangrias, dinheiro_esperado_na_gaveta: d.esperado_dinheiro };
        }
      },
      abrir_caixa: {
        descricao: 'Abre o caixa do usuário com o troco inicial da gaveta.',
        parametros: { troco: { type: 'number', description: 'troco inicial em reais' } }, obrigatorios: ['troco'], grava: true,
        resumo: function (p) { return 'Abrir o caixa com ' + moeda(p.troco) + ' de troco?'; },
        executar: async function (p) { var r = await ApiCurso.abrirCaixa(p.troco); await recarregar(); return r.mensagem; }
      },
      suprimento: {
        descricao: 'Registra SUPRIMENTO: dinheiro que ENTRA na gaveta (ex.: troco trazido do cofre). Precisa do motivo.',
        parametros: { valor: { type: 'number', description: 'valor em reais' }, motivo: 'motivo' }, obrigatorios: ['valor', 'motivo'], grava: true,
        resumo: function (p) { return 'Suprimento de ' + moeda(p.valor) + '\nMotivo: ' + p.motivo; },
        executar: async function (p) { var r = await ApiCurso.movimentoCaixa('SUPRIMENTO', p.valor, p.motivo); await recarregar(); return r.mensagem; }
      },
      sangria: {
        descricao: 'Registra SANGRIA: dinheiro que SAI da gaveta (ex.: depósito no banco). Não passa do dinheiro do caixa. Precisa do motivo.',
        parametros: { valor: { type: 'number', description: 'valor em reais' }, motivo: 'motivo' }, obrigatorios: ['valor', 'motivo'], grava: true,
        resumo: function (p) { return 'Sangria de ' + moeda(p.valor) + '\nMotivo: ' + p.motivo; },
        executar: async function (p) { var r = await ApiCurso.movimentoCaixa('SANGRIA', p.valor, p.motivo); await recarregar(); return r.mensagem; }
      },
      fechar_caixa: {
        descricao: 'FECHA o caixa conferindo o dinheiro contado na gaveta. Com diferença, a observação é obrigatória.',
        parametros: { contado: { type: 'number', description: 'dinheiro contado na gaveta, em reais (pergunte ao usuário)' }, observacao: 'explicação da diferença' },
        obrigatorios: ['contado'], grava: true,
        resumo: function (p) { return 'Fechar o caixa com ' + moeda(p.contado) + ' contados na gaveta?' + (p.observacao ? '\nObs.: ' + p.observacao : ''); },
        executar: async function (p) {
          var r = await ApiCurso.fecharCaixa(p.contado, p.observacao || '');
          await recarregar();
          return r.mensagem + ' Esperado ' + moeda(r.esperado) + ', contado ' + moeda(r.informado) + ', diferença ' + moeda(r.diferenca) + '.';
        }
      },
      listar_recebimentos: {
        descricao: 'Lista os recebimentos (período, forma, busca por hóspede/quarto), com o total. Não grava.',
        parametros: { de: 'AAAA-MM-DD', ate: 'AAAA-MM-DD', busca: 'hóspede, quarto ou observação', forma: 'nome da forma de pagamento (ex.: Pix)' },
        grava: false,
        executar: async function (p) {
          var l = await ApiCurso.recebimentos({ de: p.de, ate: p.ate, busca: p.busca });
          if (p.forma) { var f = String(p.forma).toLowerCase(); l = l.filter(function (r) { return r.forma.toLowerCase().indexOf(f) >= 0; }); }
          var ativos = l.filter(function (r) { return !r.estornado; });
          return { quantidade: ativos.length, total: ativos.reduce(function (s, r) { return s + r.valor; }, 0),
            recebimentos: l.slice(0, 30).map(function (r) { return { id: r.id_recebimento, quando: r.recebido_em, hospede: r.hospede, quarto: r.quarto,
              forma: r.forma, valor: r.valor, caixa: r.id_caixa, estornado: r.estornado }; }) };
        }
      },
      estornar_recebimento: {
        descricao: 'ESTORNA um recebimento (não apaga). Só se a conta do hóspede estiver aberta e o caixa dele não fechado. Precisa do motivo.',
        parametros: { id: { type: 'integer', description: 'id do recebimento (use listar_recebimentos)' }, motivo: 'motivo do estorno' },
        obrigatorios: ['id', 'motivo'], grava: true, exclui: true,
        validar: function (p) { return p.motivo && String(p.motivo).trim().length >= 3 ? '' : 'Qual o motivo do estorno?'; },
        resumo: function (p) { return 'ESTORNAR o recebimento nº ' + p.id + '?\nMotivo: ' + p.motivo; },
        executar: async function (p) { await ApiCurso.estornarRecebimento(p.id, p.motivo); await recarregar(); return 'Recebimento estornado.'; }
      }
    }
  };
})();
