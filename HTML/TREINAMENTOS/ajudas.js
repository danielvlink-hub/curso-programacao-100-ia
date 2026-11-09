/* ajudas.js — apresentações guiadas PRONTAS (com roteiro e voz), por tela. Lido pelo assets/js/AjudaTela.js.
   Copiado do Gourmet em 08/11/2026 (lá é window.AJUDAS_GOURMET + tabela menu_ajuda; aqui é só esta lista).
   Código da tela = HTML_<arquivo sem .html>, em maiúsculas: modelo_browse.html → HTML_MODELO_BROWSE.
   titulo = nome da ajuda; url = a partir da pasta HTML;
   ancora = seletor do ✕ ao lado do qual o "?" vai (opcional; depois: true = à direita dele);
   posicao = CSS do "?" flutuante quando a tela não tem ✕ (opcional, padrão canto de baixo à direita).
   Para tirar o "?" de uma tela sem apagar a apresentação: apague (ou comente) a linha dela aqui. */
window.AJUDAS_CURSO = {
  HTML_MODELO_BROWSE: { titulo: 'Cadastro de Hóspedes (modelo)', url: 'TREINAMENTOS/Hospedes/Apresentacao_Hospedes.html', ancora: '.browse-header .btn-fechar' }
};
