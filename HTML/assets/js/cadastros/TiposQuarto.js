/* ==========================================================================
   FICHA — Tipos de quarto (BrowseTiposQuarto / UpdateTiposQuarto / RptTiposQuarto)
   Daniel, 08/11/2026 (Bloco 1): "use do minimalismo em campos ... teremos motor de reserva on-line, precisa prever".
   O QUE É: o produto que a pousada vende (Standard, Luxo...). Capacidade e diária base valem para as reservas; as
     comodidades e a descrição já servem à página do motor de reservas on-line.
   API: /api/tipos-quarto (Cadastros.cs). Regras na API: nome e sigla não repetem; diária > 0; não exclui tipo em uso.
   ========================================================================== */
window.FICHA = {
  recurso: 'tipos-quarto', chave: 'id_tipo', arquivo: 'TiposQuarto',
  titulo: 'Tipos de quarto', singular: 'Tipo de quarto', novo: 'Novo tipo', icone: 'bed',
  subtitulo: 'O que a pousada vende', busca: 'Buscar por nome, sigla ou comodidade...',

  campos: [
    { campo: 'nome', rotulo: 'Nome', tipo: 'texto', obrig: true, larg: 3, max: 60, exemplo: 'Ex.: Standard' },
    { campo: 'sigla', rotulo: 'Sigla', tipo: 'texto', obrig: true, larg: 1, max: 6, exemplo: 'STD' },
    { campo: 'diaria_base', rotulo: 'Diária base', tipo: 'moeda', obrig: true, larg: 2, exemplo: '0,00', dica: 'vale quando não há tarifa no dia' },
    { campo: 'capacidade_adultos', rotulo: 'Adultos', tipo: 'inteiro', obrig: true, larg: 1, padrao: 2 },
    { campo: 'capacidade_criancas', rotulo: 'Crianças', tipo: 'inteiro', larg: 1, padrao: 0 },
    { campo: 'comodidades', rotulo: 'Comodidades', tipo: 'tags', larg: 4, dica: 'ex.: Wi-Fi, Ar, TV, Frigobar, Varanda' },
    { campo: 'descricao', rotulo: 'Descrição (para o site)', tipo: 'textarea', larg: 6, max: 500, exemplo: 'Frase curta que aparece no motor de reservas on-line' },
    { campo: 'ativo', rotulo: 'Ativo', tipo: 'bool' }
  ],

  colunas: [
    { campo: 'nome', titulo: 'Nome', larg: 2.5, forte: true },
    { campo: 'sigla', titulo: 'Sigla', larg: 0.8 },
    { campo: 'capacidade_adultos', titulo: 'Adultos', larg: 0.8, tipo: 'numero' },
    { campo: 'capacidade_criancas', titulo: 'Crianças', larg: 0.8, tipo: 'numero' },
    { campo: 'diaria_base', titulo: 'Diária base', larg: 1.2, tipo: 'moeda' },
    { campo: 'comodidades', titulo: 'Comodidades', larg: 3, tipo: 'tags' }
  ],

  ia: {
    nome: 'tipo_quarto',
    descricao: 'Cadastro dos tipos de quarto (Standard, Luxo...): capacidade, diária base, comodidades e descrição para o site.',
    exemplo: 'Ex.: "cria o tipo Suíte Master, sigla SUM, 2 adultos, diária de 450 reais".'
  }
};
