/* ==========================================================================
   IAGestao.js — a Luninha da GESTÃO (Botão IA e Botão VOZ) — Painel de hoje, Ocupação, Faturamento e Configurações.
   Daniel, 08/11/2026 (Bloco 5): "Sim, Bloco 5"; "ligue ele com os mesmos poderes da luninha".

   O QUE FAZ: as ferramentas que a Luninha usa para responder sobre o negócio e agir na tela:
     resumo_hoje, ocupacao (taxa, ADR, RevPAR), faturamento (diárias, consumos, recebido, ticket médio),
     liberar_quarto (sujo → livre), ver_configuracoes e alterar_configuracoes (só administrador).
   COMO: as MESMAS funções das telas (ApiCurso.painel, relatorioOcupacao, relatorioFaturamento, liberarQuarto,
     configuracoes, salvarConfiguracoes). Nos relatórios abertos, mostra o período pedido na própria tela.
   REGRAS: números vêm sempre da API (nunca inventa); tudo que grava mostra o resumo e pede Confirmar.
   ========================================================================== */
(function () {
  'use strict';
  var recarregar = async function () { if (typeof window.recarregarTela === 'function') { try { await window.recarregarTela(); } catch (e) { /* segue */ } } };

  window.IAGestao = {
    tela: 'GESTAO',
    titulo: 'Gestão da pousada',
    descricao: 'Números da pousada: o dia de hoje (chegadas, saídas, quartos, recebido), ocupação por período (taxa %, ADR = ' +
      'diária média vendida, RevPAR = receita de diárias dividida pelos quartos-noite disponíveis), faturamento (diárias por ' +
      'competência, consumos, recebido, ticket médio) e as configurações da pousada (horários, sinal, prazo da pré-reserva, política).',
    regras: 'Datas em AAAA-MM-DD; "este mês", "semana que vem" etc. você converte usando a data de hoje. Explique RevPAR e ADR ' +
      'em palavras simples quando perguntarem. Para liberar quarto, use o número que o usuário disser.',
    saudacao: 'Posso contar como está o dia, a ocupação, o faturamento e ajustar as configurações.',
    exemplo: 'Ex.: "como está hoje?", "qual o RevPAR deste mês?", "quanto faturamos em consumos?" ou "libera o 104".',

    preparar: async function () { return { hoje: new Date().toISOString().slice(0, 10) }; },

    ferramentas: {
      resumo_hoje: {
        descricao: 'O dia de hoje: chegadas, atrasadas, saídas, hospedados, quartos por situação, ocupação dos próximos 7 dias, recebido hoje e se o caixa está aberto. Não grava.',
        parametros: {}, grava: false,
        executar: async function () {
          var d = await ApiCurso.painel(), cont = {};
          d.quartos.forEach(function (q) { var s = q.ocupado ? 'OCUPADO' : q.situacao; cont[s] = (cont[s] || 0) + 1; });
          return { hoje: d.hoje, chegadas: d.chegadas, atrasadas: d.atrasadas, saidas: d.saidas, hospedados: d.hospedados, quartos_por_situacao: cont,
            quartos_sujos: d.quartos.filter(function (q) { return q.situacao === 'SUJO' && !q.ocupado; }).map(function (q) { return q.numero; }),
            proximos_7_dias: d.proximos_dias.map(function (x) { return { data: x.data, taxa: x.taxa }; }),
            recebido_hoje: d.recebido_hoje, por_forma: d.recebido_por_forma, caixa_aberto: d.caixa_aberto };
        }
      },
      ocupacao: {
        descricao: 'Ocupação de um período: taxa média, ADR, RevPAR, receita de diárias e o pior/melhor dia. Se a tela de Ocupação estiver aberta, mostra o período nela. Não grava.',
        parametros: { de: 'AAAA-MM-DD', ate: 'AAAA-MM-DD' }, obrigatorios: ['de', 'ate'], grava: false,
        executar: async function (p) {
          var r = window.Relatorio && Relatorio.modo() === 'ocupacao' ? await Relatorio.gerar(p.de, p.ate) : await ApiCurso.relatorioOcupacao(p.de, p.ate);
          var ord = r.dias.slice().sort(function (a, b) { return a.taxa - b.taxa; });
          return { periodo: r.de + ' a ' + r.ate, totais: r.totais, dia_mais_vazio: ord[0], dia_mais_cheio: ord[ord.length - 1] };
        }
      },
      faturamento: {
        descricao: 'Faturamento de um período: diárias, consumos, total, recebido, ticket médio e as divisões por tipo, categoria e forma. Se a tela de Faturamento estiver aberta, mostra nela. Não grava.',
        parametros: { de: 'AAAA-MM-DD', ate: 'AAAA-MM-DD' }, obrigatorios: ['de', 'ate'], grava: false,
        executar: async function (p) {
          var r = window.Relatorio && Relatorio.modo() === 'faturamento' ? await Relatorio.gerar(p.de, p.ate) : await ApiCurso.relatorioFaturamento(p.de, p.ate);
          return { periodo: r.de + ' a ' + r.ate, totais: r.totais, por_tipo: r.por_tipo, por_categoria: r.por_categoria, por_forma: r.por_forma };
        }
      },
      liberar_quarto: {
        descricao: 'Governança: marca um quarto SUJO como LIVRE (limpeza feita).',
        parametros: { numero: 'número do quarto (ex.: 104)' }, obrigatorios: ['numero'], grava: true,
        resumo: function (p) { return 'Liberar o quarto ' + p.numero + ' (limpeza feita)?'; },
        executar: async function (p) {
          var l = await ApiCurso.cadastroListar('quartos', { ativo: 1 });
          var q = l.find(function (x) { return String(x.numero) === String(p.numero).trim(); });
          if (!q) return 'Não achei o quarto ' + p.numero + '.';
          var r = await ApiCurso.liberarQuarto(q.id_quarto);
          await recarregar();
          return r.mensagem;
        }
      },
      ver_configuracoes: {
        descricao: 'As configurações da pousada (nome, contato, endereço, horários, % do sinal, prazo da pré-reserva, política, rodapé). Não grava.',
        parametros: {}, grava: false,
        executar: async function () { return await ApiCurso.configuracoes(); }
      },
      alterar_configuracoes: {
        descricao: 'Altera configurações (só administrador). Mande só as chaves que mudam: nome_pousada, documento, telefone, email, cep, ' +
          'endereco, cidade, uf, horario_checkin (HH:MM), horario_checkout (HH:MM), sinal_percentual, prazo_pre_reserva_horas, ' +
          'politica_cancelamento, texto_rodape_extrato.',
        parametros: { valores: { type: 'object', description: 'objeto { chave: valor } só com o que muda', additionalProperties: { type: 'string' } } },
        obrigatorios: ['valores'], grava: true,
        resumo: function (p) { var v = p.valores || {}; return 'Alterar as configurações:\n' + Object.keys(v).map(function (k) { return '• ' + k + ': ' + v[k]; }).join('\n'); },
        executar: async function (p) {
          var v = {}; Object.keys(p.valores || {}).forEach(function (k) { v[k] = String(p.valores[k]); });
          await ApiCurso.salvarConfiguracoes(v);
          await recarregar();
          return 'Configurações gravadas: ' + Object.keys(v).join(', ') + '.';
        }
      }
    }
  };
})();
