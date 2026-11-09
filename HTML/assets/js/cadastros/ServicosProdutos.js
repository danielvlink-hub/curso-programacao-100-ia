/* ==========================================================================
   FICHA — Serviços e produtos (BrowseServicosProdutos / UpdateServicosProdutos / RptServicosProdutos)
   Daniel, 08/11/2026 (Bloco 1): minimalismo nos campos.
   O QUE É: o que se lança na conta do quarto durante a estadia (Bloco 3): frigobar, restaurante, lavanderia, passeio.
   API: /api/servicos-produtos. Regras na API: nome não repete; preço >= 0; não exclui item já lançado em consumo.
   ========================================================================== */
(function () {
  var CATEGORIAS = [['FRIGOBAR', 'Frigobar'], ['RESTAURANTE', 'Restaurante'], ['LAVANDERIA', 'Lavanderia'], ['PASSEIO', 'Passeio'], ['OUTROS', 'Outros']];

  window.FICHA = {
    recurso: 'servicos-produtos', chave: 'id_item', arquivo: 'ServicosProdutos',
    titulo: 'Serviços e produtos', singular: 'Item', novo: 'Novo item', icone: 'room_service',
    subtitulo: 'O que vai na conta do quarto', busca: 'Buscar por nome...',

    campos: [
      { campo: 'nome', rotulo: 'Nome', tipo: 'texto', obrig: true, larg: 4, max: 80, exemplo: 'Ex.: Água mineral 500 ml' },
      { campo: 'categoria', rotulo: 'Categoria', tipo: 'lista', obrig: true, larg: 2, opcoes: CATEGORIAS, padrao: 'OUTROS' },
      { campo: 'preco', rotulo: 'Preço', tipo: 'moeda', obrig: true, larg: 2, exemplo: '0,00' },
      { campo: 'unidade', rotulo: 'Unidade', tipo: 'texto', larg: 1, max: 10, padrao: 'UN', exemplo: 'UN, KG, H' },
      { campo: 'ativo', rotulo: 'Ativo', tipo: 'bool' }
    ],

    colunas: [
      { campo: 'nome', titulo: 'Nome', larg: 3, forte: true },
      { campo: 'categoria', titulo: 'Categoria', larg: 1.3, tipo: 'lista' },
      { campo: 'preco', titulo: 'Preço', larg: 1, tipo: 'moeda' },
      { campo: 'unidade', titulo: 'Unid.', larg: 0.6 }
    ],

    filtros: [{ campo: 'categoria', titulo: 'Categoria', rotulo: 'Todas as categorias', opcoes: CATEGORIAS }],

    ia: {
      nome: 'item',
      descricao: 'Serviços e produtos que vão na conta do quarto (frigobar, restaurante, lavanderia, passeio).',
      exemplo: 'Ex.: "cadastra refrigerante lata no frigobar por 7 reais" ou "aumenta a água para 6 reais".'
    }
  };
})();
