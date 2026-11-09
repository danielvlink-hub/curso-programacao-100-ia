/* ==========================================================================
   FICHA — Quartos (BrowseQuartos / UpdateQuartos / RptQuartos)
   Daniel, 08/11/2026 (Bloco 1): minimalismo nos campos; agenda de arrastar e reservas sofisticadas vêm no Bloco 2.
   O QUE É: as unidades físicas (101, 102...). Situação do dia a dia: Livre, Sujo (após check-out), Manutenção, Bloqueado.
   EXTRA: "Gerar em lote" — "101 a 110, tipo Standard, 1º andar" cria só os números que ainda não existem.
   API: /api/quartos e /api/quartos/lote. Regras na API: número não repete; tipo existe; não exclui quarto com reserva.
   ========================================================================== */
(function () {
  var SITUACOES = [['LIVRE', 'Livre'], ['SUJO', 'Sujo'], ['MANUTENCAO', 'Manutenção'], ['BLOQUEADO', 'Bloqueado']];
  var TIPO = { recurso: 'tipos-quarto', valor: 'id_tipo', texto: 'nome' };

  /**
   * gerarLote(CP) — pergunta a faixa, o tipo e o andar (FacilAppPerguntar) e cria os quartos pela API.
   * REGRAS: o tipo pode ser digitado pelo nome ou pela sigla; a API pula os números que já existem.
   */
  async function gerarLote(CP) {
    var de = await FacilAppPerguntar('Gerar quartos em lote — do número:', { tipo: 'number', confirmar: 'Próximo' });
    if (de === null) return;
    var ate = await FacilAppPerguntar('Até o número:', { tipo: 'number', valor: de, confirmar: 'Próximo' });
    if (ate === null) return;
    var tipos = (CP.refs['tipos-quarto'] || { lista: [] }).lista;
    var nomeTipo = await FacilAppPerguntar('Tipo de quarto (' + tipos.map(function (t) { return t.sigla; }).join(', ') + '):', { confirmar: 'Próximo' });
    if (nomeTipo === null) return;
    var tipo = tipos.find(function (t) { return [t.sigla, t.nome].some(function (x) { return String(x).toLowerCase() === nomeTipo.trim().toLowerCase(); }); });
    if (!tipo) { FacilAppAviso('Erro: tipo "' + nomeTipo + '" não encontrado.'); return; }
    var andar = await FacilAppPerguntar('Andar / bloco (opcional):', { confirmar: 'Gerar' });
    if (andar === null) return;
    try {
      var r = await ApiCurso.gerarQuartosEmLote(de, ate, tipo.id_tipo, andar);
      await CP.carregar();
      FacilAppAviso(r.criados + ' quarto(s) criado(s)' + (r.ja_existiam ? ', ' + r.ja_existiam + ' já existiam' : '') + '.');
    } catch (erro) { FacilAppAviso('Não foi possível gerar: ' + erro.message); }
  }

  window.FICHA = {
    recurso: 'quartos', chave: 'id_quarto', arquivo: 'Quartos',
    titulo: 'Quartos', singular: 'Quarto', novo: 'Novo quarto', icone: 'meeting_room',
    subtitulo: 'As unidades da pousada', busca: 'Buscar por número, andar ou observação...',

    campos: [
      { campo: 'numero', rotulo: 'Número', tipo: 'texto', obrig: true, larg: 1, max: 10, exemplo: '101' },
      { campo: 'id_tipo', rotulo: 'Tipo', tipo: 'ref', obrig: true, larg: 3, ref: TIPO },
      { campo: 'andar', rotulo: 'Andar / bloco', tipo: 'texto', larg: 2, max: 30, exemplo: 'Ex.: 1º andar' },
      { campo: 'situacao', rotulo: 'Situação', tipo: 'lista', obrig: true, larg: 2, opcoes: SITUACOES, padrao: 'LIVRE' },
      { campo: 'observacao', rotulo: 'Observação', tipo: 'texto', larg: 4, max: 300, exemplo: 'Ex.: vista para o jardim' },
      { campo: 'ativo', rotulo: 'Ativo', tipo: 'bool' }
    ],

    colunas: [
      { campo: 'numero', titulo: 'Número', larg: 0.8, forte: true },
      { campo: 'id_tipo', titulo: 'Tipo', larg: 2, tipo: 'ref' },
      { campo: 'andar', titulo: 'Andar / bloco', larg: 1.5 },
      { campo: 'situacao', titulo: 'Quarto', larg: 1.1, tipo: 'badge' },
      { campo: 'observacao', titulo: 'Observação', larg: 2.5 }
    ],

    filtros: [
      { campo: 'id_tipo', titulo: 'Tipo', rotulo: 'Todos os tipos', ref: TIPO },
      { campo: 'situacao', titulo: 'Situação do quarto', rotulo: 'Livres, sujos...', opcoes: SITUACOES }
    ],

    extras: [{ rotulo: 'Gerar em lote', icone: 'library_add', titulo: 'Cria vários quartos de uma vez (ex.: 101 a 110)', acao: gerarLote }],

    ia: {
      nome: 'quarto',
      descricao: 'Cadastro dos quartos: número, tipo, andar e situação (livre, sujo, manutenção, bloqueado). Também gera quartos em lote.',
      regras: 'Para mudar a situação de um quarto (ex.: "o 102 está sujo"), ache o id com listar_quartos e use alterar_quarto.',
      exemplo: 'Ex.: "gera os quartos 201 a 210 do tipo Luxo no 2º andar" ou "marca o 101 como limpo".',
      ferramentas: {
        gerar_quartos_lote: {
          descricao: 'Cria vários quartos de uma vez numa faixa de números (os que já existem são pulados).',
          parametros: {
            de: { type: 'integer', description: 'primeiro número' }, ate: { type: 'integer', description: 'último número' },
            id_tipo: { type: 'integer', description: 'id do tipo de quarto (veja os dados de apoio)' }, andar: 'andar ou bloco'
          },
          obrigatorios: ['de', 'ate', 'id_tipo'], grava: true,
          resumo: function (p) { return 'Gerar os quartos ' + p.de + ' a ' + p.ate + (p.andar ? ' (' + p.andar + ')' : '') + '?'; },
          executar: async function (p) {
            var r = await ApiCurso.gerarQuartosEmLote(p.de, p.ate, p.id_tipo, p.andar);
            if (window.CP) await CP.carregar();
            return r.criados + ' criado(s), ' + r.ja_existiam + ' já existiam.';
          }
        }
      }
    }
  };
})();
