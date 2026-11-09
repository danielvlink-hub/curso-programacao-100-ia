/* ==========================================================================
   FICHA — Formas de pagamento (BrowseFormasPagamento / UpdateFormasPagamento / RptFormasPagamento)
   Daniel, 08/11/2026 (Bloco 1): minimalismo nos campos.
   O QUE É: como a pousada recebe. Taxa e prazo servem ao financeiro (Bloco 4: caixa e recebimentos).
   API: /api/formas-pagamento. Regras na API: nome não repete; tipo da lista; não exclui forma já usada em recebimento.
   ========================================================================== */
(function () {
  var TIPOS = [['DINHEIRO', 'Dinheiro'], ['PIX', 'Pix'], ['CARTAO_DEBITO', 'Cartão de débito'], ['CARTAO_CREDITO', 'Cartão de crédito'],
               ['TRANSFERENCIA', 'Transferência'], ['FATURADO', 'Faturado (empresa)']];

  window.FICHA = {
    recurso: 'formas-pagamento', chave: 'id_forma', arquivo: 'FormasPagamento',
    titulo: 'Formas de pagamento', singular: 'Forma de pagamento', novo: 'Nova forma', icone: 'credit_card',
    subtitulo: 'Como a pousada recebe', busca: 'Buscar por nome...',

    campos: [
      { campo: 'nome', rotulo: 'Nome', tipo: 'texto', obrig: true, larg: 3, max: 40, exemplo: 'Ex.: Pix, Visa crédito' },
      { campo: 'tipo', rotulo: 'Tipo', tipo: 'lista', obrig: true, larg: 3, opcoes: TIPOS },
      { campo: 'taxa_percentual', rotulo: 'Taxa %', tipo: 'decimal', larg: 2, padrao: 0, dica: 'cobrada pela operadora' },
      { campo: 'prazo_dias', rotulo: 'Prazo (dias)', tipo: 'inteiro', larg: 2, padrao: 0, dica: 'para o dinheiro cair' },
      { campo: 'ativo', rotulo: 'Ativa', tipo: 'bool' }
    ],

    colunas: [
      { campo: 'nome', titulo: 'Nome', larg: 2.5, forte: true },
      { campo: 'tipo', titulo: 'Tipo', larg: 1.6, tipo: 'lista' },
      { campo: 'taxa_percentual', titulo: 'Taxa %', larg: 0.8, tipo: 'numero' },
      { campo: 'prazo_dias', titulo: 'Prazo (dias)', larg: 0.9, tipo: 'numero' }
    ],

    filtros: [{ campo: 'tipo', titulo: 'Tipo', rotulo: 'Todos os tipos', opcoes: TIPOS }],

    ia: {
      nome: 'forma_pagamento',
      descricao: 'Formas de pagamento da pousada (dinheiro, Pix, cartões, transferência, faturado), com taxa e prazo.',
      exemplo: 'Ex.: "cadastra Mastercard crédito, taxa 3,2%, recebe em 30 dias".'
    }
  };
})();
