/* ==========================================================================
   FICHA — Tarifas (BrowseTarifas / UpdateTarifas / RptTarifas)
   Daniel, 08/11/2026 (Bloco 1): preço inteligente, base do motor de reservas.
   O QUE É: o preço da diária por tipo de quarto, período e dias da semana (alta temporada, fim de semana, feriado),
     com mínimo de noites. Sem tarifa no dia, vale a diária base do tipo. O cálculo é noite a noite.
   API: /api/tarifas e /api/tarifas/calcular. Regras na API: fim >= início; pelo menos um dia da semana; não pode haver
     outra tarifa ATIVA do mesmo tipo no mesmo período e dia (a API diz qual conflita).
   ========================================================================== */
(function () {
  var TIPO = { recurso: 'tipos-quarto', valor: 'id_tipo', texto: 'nome' };

  window.FICHA = {
    recurso: 'tarifas', chave: 'id_tarifa', arquivo: 'Tarifas',
    titulo: 'Tarifas', singular: 'Tarifa', novo: 'Nova tarifa', icone: 'sell',
    subtitulo: 'Preço por período e dia da semana', busca: 'Buscar por descrição...',

    campos: [
      { campo: 'id_tipo', rotulo: 'Tipo de quarto', tipo: 'ref', obrig: true, larg: 2, ref: TIPO },
      { campo: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrig: true, larg: 4, max: 60, exemplo: 'Ex.: Alta temporada, Fim de semana' },
      { campo: 'inicio', rotulo: 'De', tipo: 'data', obrig: true, larg: 2 },
      { campo: 'fim', rotulo: 'Até', tipo: 'data', obrig: true, larg: 2 },
      { campo: 'valor_diaria', rotulo: 'Diária', tipo: 'moeda', obrig: true, larg: 2, exemplo: '0,00' },
      { campo: 'dias_semana', rotulo: 'Dias da semana', tipo: 'dias', larg: 4, padrao: '0123456', dica: 'clique para ligar/desligar' },
      { campo: 'minimo_noites', rotulo: 'Mínimo de noites', tipo: 'inteiro', larg: 2, padrao: 1 },
      { campo: 'ativo', rotulo: 'Ativa', tipo: 'bool' }
    ],

    colunas: [
      { campo: 'id_tipo', titulo: 'Tipo', larg: 1.4, tipo: 'ref' },
      { campo: 'descricao', titulo: 'Descrição', larg: 2, forte: true },
      { campo: 'inicio', titulo: 'De', larg: 1, tipo: 'data' },
      { campo: 'fim', titulo: 'Até', larg: 1, tipo: 'data' },
      { campo: 'dias_semana', titulo: 'Dias', larg: 1.6, tipo: 'dias' },
      { campo: 'valor_diaria', titulo: 'Diária', larg: 1, tipo: 'moeda' },
      { campo: 'minimo_noites', titulo: 'Mín. noites', larg: 0.8, tipo: 'numero' }
    ],

    filtros: [{ campo: 'id_tipo', titulo: 'Tipo', rotulo: 'Todos os tipos', ref: TIPO }],

    ia: {
      nome: 'tarifa',
      descricao: 'Tarifas por tipo de quarto, período e dias da semana, com mínimo de noites. Também calcula o preço de uma estadia noite a noite.',
      regras: 'Dias da semana em dígitos: 0=domingo ... 6=sábado (fim de semana = "56"). Datas em AAAA-MM-DD.',
      exemplo: 'Ex.: "tarifa de fim de semana do Standard em dezembro por 220, mínimo 2 noites" ou "quanto fica o Luxo de 12 a 15 de novembro?".',
      ferramentas: {
        calcular_diarias: {
          descricao: 'Calcula o valor de uma estadia noite a noite para um tipo de quarto (diz a tarifa de cada noite e se cumpre o mínimo). Não grava.',
          parametros: {
            id_tipo: { type: 'integer', description: 'id do tipo de quarto (veja os dados de apoio)' },
            entrada: 'data de entrada AAAA-MM-DD', saida: 'data de saída AAAA-MM-DD'
          },
          obrigatorios: ['id_tipo', 'entrada', 'saida'], grava: false,
          executar: async function (p) { return await ApiCurso.calcularDiarias(p.id_tipo, p.entrada, p.saida); }
        }
      }
    }
  };
})();
