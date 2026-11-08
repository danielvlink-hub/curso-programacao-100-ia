/* ==========================================================================
   SQLModeloContrato — modelo de contrato por produto (CER_PRODUTOS)

   Janela WinDev WIN_Contrato_Modelo, aberta pelos botões C, CF, V, VF e CPR
   da lista de produtos (Open(WIN_Contrato_Modelo, tipo, código)). O código
   que o Daniel enviou em 12/09/2026:

     FetchManual(CER_PRODUTOS,"ID_PRODUTOS",pCodProduto)
     pTipo="C"   -> WP_Contrato = CER_PRODUTOS.CONTRATO_C
     pTipo="CF"  -> CONTRATO_CF      pTipo="V"  -> CONTRATO_V
     pTipo="VF"  -> CONTRATO_VF      pTipo="CPR"-> CONTRATO_CPR

     C = Compra, CF = Compra Futura, V = Venda, VF = Venda Futura,
     CPR = Barter (troca) — forma de venda futura com contrato próprio.

   ATENÇÃO: no banco atual esses campos guardam o CAMINHO de um .docx (o
   controle de processador de texto do WinDev abre o arquivo). A web grava o
   texto do contrato (HTML) no MESMO campo; a tela avisa e pede confirmação
   antes de substituir um caminho, porque depois disso o WinDev deixa de
   abrir aquele arquivo.

   Tela: ModeloContrato.html (aberta por Produtos.html)
   Depende do SQL.js — carregar ANTES.
   ========================================================================== */
(function () {
  'use strict';
  var SQLModeloContrato = {};

  var CAMPO_POR_TIPO = {C: 'CONTRATO_C', CF: 'CONTRATO_CF', V: 'CONTRATO_V', VF: 'CONTRATO_VF', CPR: 'CONTRATO_CPR'};
  SQLModeloContrato.NOME_TIPO = {C: 'Compra', CF: 'Compra Futura', V: 'Venda', VF: 'Venda Futura', CPR: 'Barter (CPR)'};

  function campoDoTipo(tipo) {
    var campo = CAMPO_POR_TIPO[String(tipo || '').trim().toUpperCase()];
    if (!campo) throw new Error('Tipo de contrato inválido: ' + tipo + ' (use C, CF, V, VF ou CPR).');
    return campo;
  }
  function sessao() {
    if (!window.SQL || !SQL.montarBaseURL()) throw new Error('Configuração da API SQL indisponível.');
  }
  function valorDoCampo(linha, campo) {
    var chave = Object.keys(linha || {}).filter(function (k) { return k.toUpperCase() === campo; })[0];
    return chave ? linha[chave] : null;
  }

  /** Caminho de arquivo (C:\..., \\servidor\...) terminando em .doc/.docx/.rtf/.odt. */
  SQLModeloContrato.ehCaminhoDeArquivo = function (valor) {
    var t = String(valor == null ? '' : valor).trim();
    return /^([A-Za-z]:[\\/]|\\\\)/.test(t) && /\.(docx?|rtf|odt)$/i.test(t) && t.indexOf('<') < 0;
  };

  /**
   * @returns {Promise<{produto:string, conteudo:string, caminho:string}>}
   *   caminho preenchido quando o campo guarda um arquivo do WinDev.
   */
  SQLModeloContrato.obter = async function (idProduto, tipo) {
    sessao();
    var campo = campoDoTipo(tipo);
    if (!Number(idProduto)) throw new Error('Produto inválido.');
    var linhas = await SQL.consultar('CER_PRODUTOS', '*', {ID_PRODUTOS: Number(idProduto)});
    if (!Array.isArray(linhas) || !linhas.length) throw new Error('Produto não localizado: ' + idProduto);
    var valor = valorDoCampo(linhas[0], campo);
    var texto = valor == null ? '' : String(valor);
    var arquivo = SQLModeloContrato.ehCaminhoDeArquivo(texto);
    return {
      produto: String(valorDoCampo(linhas[0], 'DESCRICAO') || '').trim(),
      conteudo: arquivo ? '' : texto,
      caminho: arquivo ? texto.trim() : ''
    };
  };

  /**
   * Abre o .docx do caminho gravado (13/09/2026): a API lê o arquivo do disco
   * (funcao arquivo_ler, base64) e o mammoth.js (dependencias/mammoth-1.8.0)
   * converte o Word em HTML para o editor. A API só lê extensões listadas em
   * [Arquivos] ExtensoesPermitidas do FacilAppSQL.ini — precisa ter docx.
   * @returns {Promise<string>} HTML do documento
   */
  SQLModeloContrato.lerWord = async function (caminho) {
    sessao();
    if (!window.mammoth) throw new Error('Biblioteca mammoth.js não carregada.');
    var resposta = await fetch(SQL.montarBaseURL() + '/executar', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SQL.obterAccessToken()},
      body: JSON.stringify({funcao: 'arquivo_ler', nome_arquivo: String(caminho || '').trim()})
    });
    var r = await resposta.json().catch(function () { return {}; });
    if (!resposta.ok || r.ok === false) throw new Error(r.erro || r.mensagem || ('Leitura do arquivo respondeu HTTP ' + resposta.status + '.'));
    var d = r.dados && !Array.isArray(r.dados) ? r.dados : r;
    var base64 = d.conteudo_base64 || d.base64 || d.conteudo || '';
    if (!base64) throw new Error('A API não devolveu o conteúdo do arquivo.');
    var binario = atob(String(base64).replace(/^data:[^,]*,/, ''));
    var bytes = new Uint8Array(binario.length);
    for (var i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    var conv = await window.mammoth.convertToHtml({arrayBuffer: bytes.buffer});
    return conv.value || '';
  };

  /** Grava o texto do modelo no campo do tipo. */
  SQLModeloContrato.gravar = async function (idProduto, tipo, conteudo) {
    sessao();
    var campo = campoDoTipo(tipo);
    if (!Number(idProduto)) throw new Error('Produto inválido.');
    var envio = {};
    envio[campo] = String(conteudo == null ? '' : conteudo);
    await SQL.alterar('CER_PRODUTOS', envio, {ID_PRODUTOS: Number(idProduto)});
    return true;
  };

  /* ---------------------------------------------------------------- .docx
     Gera um .docx de verdade sem biblioteca (13/09/2026): o arquivo Word é um
     zip; aqui ele é montado sem compressão, com o HTML do editor como
     "altChunk" — o Word abre e converte o HTML com a formatação. */
  var TABELA_CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zipSemCompressao(arquivos) {
    var enc = new TextEncoder(), partes = [], central = [], deslocamento = 0;
    function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
    function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }
    arquivos.forEach(function (a) {
      var nome = enc.encode(a.nome), dados = typeof a.dados === 'string' ? enc.encode(a.dados) : a.dados;
      var crc = crc32(dados);
      var local = [].concat([0x50, 0x4B, 0x03, 0x04], u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc),
        u32(dados.length), u32(dados.length), u16(nome.length), u16(0));
      partes.push(new Uint8Array(local), nome, dados);
      central.push(new Uint8Array([].concat([0x50, 0x4B, 0x01, 0x02], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
        u32(crc), u32(dados.length), u32(dados.length), u16(nome.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(deslocamento))), nome);
      deslocamento += local.length + nome.length + dados.length;
    });
    var tamCentral = central.reduce(function (s, p) { return s + p.length; }, 0);
    var fim = new Uint8Array([].concat([0x50, 0x4B, 0x05, 0x06], u16(0), u16(0), u16(arquivos.length), u16(arquivos.length),
      u32(tamCentral), u32(deslocamento), u16(0)));
    var todas = partes.concat(central, [fim]);
    var total = todas.reduce(function (s, p) { return s + p.length; }, 0), saida = new Uint8Array(total), pos = 0;
    todas.forEach(function (p) { saida.set(p, pos); pos += p.length; });
    return saida;
  }

  /** @param {string} htmlCompleto documento HTML inteiro (com head/@page) */
  SQLModeloContrato.gerarDocx = function (htmlCompleto) {
    var ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    return zipSemCompressao([
      {nome: '[Content_Types].xml', dados: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/afchunk.htm" ContentType="text/html"/></Types>'},
      {nome: '_rels/.rels', dados: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
      {nome: 'word/document.xml', dados: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document ' + ns + '><w:body><w:altChunk r:id="htmlChunk"/>' +
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="992" w:bottom="1417" w:left="992" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
        '</w:body></w:document>'},
      {nome: 'word/_rels/document.xml.rels', dados: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="htmlChunk" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.htm"/></Relationships>'},
      {nome: 'word/afchunk.htm', dados: htmlCompleto}
    ]);
  };

  SQLModeloContrato.PASTA_PADRAO = 'C:\\FACILAPP_CEREAIS\\CONTRATOS';

  /**
   * Grava o .docx com o nome padrão "<PRODUTO>-<TIPO>.docx" (ex.: SOJA GRANEL-C.docx,
   * SOJA GRANEL-VF.docx), sempre o mesmo nome por produto e tipo. Nunca grava
   * por cima do arquivo original do modelo (pedido do Daniel, 13/09/2026).
   * @returns {Promise<string>} caminho gravado
   */
  SQLModeloContrato.gravarArquivoPadrao = async function (produto, tipo, htmlCompleto, pasta, caminhoOriginal) {
    sessao();
    var nome = String(produto || 'PRODUTO').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'PRODUTO';
    var dir = String(pasta || SQLModeloContrato.PASTA_PADRAO).replace(/[\\/]+$/, '');
    var caminho = dir + '\\' + nome + '-' + String(tipo || '').trim().toUpperCase() + '.docx';
    if (caminhoOriginal && caminho.toUpperCase() === String(caminhoOriginal).trim().toUpperCase()) {
      caminho = dir + '\\' + nome + '-' + String(tipo || '').trim().toUpperCase() + ' (modelo).docx';
    }
    await SQL.salvarArquivo(caminho, SQLModeloContrato.gerarDocx(htmlCompleto));
    return caminho;
  };

  window.SQLModeloContrato = SQLModeloContrato;
})();
