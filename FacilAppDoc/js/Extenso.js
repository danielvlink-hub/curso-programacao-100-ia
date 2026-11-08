/* ==========================================================================
   Extenso — números, valores em reais e quantidades por extenso (pt-BR)

   Usado pelos contratos (#QUANTIDADEPOREXTENSO#, #VALORPOREXTENSO#).
     FacilAppExtenso.numero(1230)                 -> "mil duzentos e trinta"
     FacilAppExtenso.reais(10250.5)               -> "dez mil duzentos e cinquenta reais e cinquenta centavos"
     FacilAppExtenso.quantidade(1230, 'sacas')    -> "mil duzentas e trinta sacas"
     FacilAppExtenso.quantidade(2.5, 'toneladas') -> "duas vírgula cinco toneladas"
     FacilAppExtenso.quantidade(80000, 'quilos')  -> "oitenta mil quilos"
   Saca e tonelada são femininas: um/dois/duzentos viram uma/duas/duzentas.
   Vai até 999 trilhões. Sem dependências.
   ========================================================================== */
(function () {
  'use strict';
  var UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
    'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  var DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  var CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  var ESCALAS = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões'], ['trilhão', 'trilhões']];

  /* Unidades femininas: saca, tonelada, arroba... (quilo, real e centavo são masculinos). */
  var FEMININAS = {sacas: 1, saca: 1, toneladas: 1, tonelada: 1, arrobas: 1, arroba: 1};

  function unidade(u, fem) {
    if (fem && u === 1) return 'uma';
    if (fem && u === 2) return 'duas';
    return UNIDADES[u];
  }

  function ate999(n, fem) {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    var c = Math.floor(n / 100), resto = n % 100, partes = [];
    if (c) partes.push(fem && c > 1 ? CENTENAS[c].replace(/os$/, 'as') : CENTENAS[c]);
    if (resto) {
      if (resto < 20) partes.push(unidade(resto, fem));
      else {
        var d = Math.floor(resto / 10), u = resto % 10;
        partes.push(u ? DEZENAS[d] + ' e ' + unidade(u, fem) : DEZENAS[d]);
      }
    }
    return partes.join(' e ');
  }

  /**
   * Inteiro por extenso.
   * @param {number} valor
   * @param {boolean} [feminino] concorda com unidade feminina (uma, duas, duzentas)
   */
  function numero(valor, feminino) {
    var n = Math.floor(Math.abs(Number(valor) || 0));
    if (n === 0) return 'zero';
    var grupos = [];
    while (n > 0) { grupos.push(n % 1000); n = Math.floor(n / 1000); }
    var textos = [];
    for (var i = grupos.length - 1; i >= 0; i--) {
      var g = grupos[i];
      if (!g) continue;
      var t;
      /* Milhares concordam com o substantivo (duas mil sacas); milhão/bilhão
         são masculinos e não mudam (dois milhões de sacas). */
      if (i === 1) t = g === 1 ? 'mil' : ate999(g, feminino) + ' mil';
      else if (i === 0) t = ate999(g, feminino);
      else t = ate999(g, false) + ' ' + ESCALAS[i][g === 1 ? 0 : 1];
      textos.push({texto: t, grupo: g});
    }
    /* Liga com "e" quando o último grupo é menor que 100 ou centena redonda
       (ex.: "mil e cinquenta", "dois milhões e quinhentos mil"); senão, só espaço. */
    var saida = '';
    textos.forEach(function (p, idx) {
      if (idx === 0) { saida = p.texto; return; }
      var ultimo = idx === textos.length - 1;
      var usaE = ultimo && (p.grupo < 100 || p.grupo % 100 === 0);
      saida += (usaE ? ' e ' : ' ') + p.texto;
    });
    return saida;
  }

  /** Valor em reais por extenso, com centavos. */
  function reais(valor) {
    var v = Math.round(Math.abs(Number(valor) || 0) * 100);
    var inteiro = Math.floor(v / 100), centavos = v % 100, partes = [];
    if (inteiro) {
      var t = numero(inteiro);
      /* "um milhão de reais", "dois bilhões de reais" */
      var redondoMilhao = inteiro >= 1000000 && inteiro % 1000000 === 0;
      partes.push(t + (redondoMilhao ? ' de' : '') + (inteiro === 1 ? ' real' : ' reais'));
    }
    if (centavos) partes.push(numero(centavos) + (centavos === 1 ? ' centavo' : ' centavos'));
    return partes.length ? partes.join(' e ') : 'zero reais';
  }

  /**
   * Quantidade por extenso com a unidade no fim (sacas, toneladas, quilos...).
   * Decimais entram com "vírgula": 1333,33 sacas -> "mil trezentas e trinta e
   * três vírgula trinta e três sacas".
   * @param {number} valor
   * @param {string} [nomeUnidade] plural, ex.: 'sacas', 'toneladas', 'quilos'
   * @param {number} [casas] casas decimais consideradas (padrão 2)
   */
  function quantidade(valor, nomeUnidade, casas) {
    var u = String(nomeUnidade || '').trim();
    var fem = !!FEMININAS[u.toLowerCase()];
    var c = casas == null ? 2 : casas;
    var v = Math.abs(Number(valor) || 0);
    var inteiro = Math.floor(v), frac = Math.round((v - inteiro) * Math.pow(10, c));
    if (frac >= Math.pow(10, c)) { inteiro += 1; frac = 0; }
    /* Zeros à direita não se falam: 2,50 -> "duas vírgula cinco". */
    while (frac && frac % 10 === 0) frac = frac / 10;
    var texto = numero(inteiro, fem) + (frac ? ' vírgula ' + numero(frac, fem) : '');
    if (!u) return texto;
    /* "um milhão de sacas" */
    var redondoMilhao = !frac && inteiro >= 1000000 && inteiro % 1000000 === 0;
    var singular = !frac && inteiro === 1;
    var nome = singular ? u.replace(/s$/i, '') : u;
    return texto + (redondoMilhao ? ' de ' : ' ') + nome;
  }

  /** #QUANTIDADEPOREXTENSO#: só o número, no feminino (sacas, toneladas, caixas);
      a unidade é digitada no contrato logo após a macro. */
  function sacas(valor, casas) {
    return quantidade(valor, 'sacas', casas).replace(/( de)? sacas?$/, '');
  }

  /** #DATARODAPE#: "Pilar do Sul, 22 de Setembro de 2024" (mês com inicial maiúscula). */
  var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  function dataRodape(cidade, data) {
    var d = data instanceof Date ? data : new Date();
    return (cidade ? String(cidade).trim() + ', ' : '') + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
  }

  window.FacilAppExtenso = {numero: numero, reais: reais, quantidade: quantidade, sacas: sacas, dataRodape: dataRodape};
})();
