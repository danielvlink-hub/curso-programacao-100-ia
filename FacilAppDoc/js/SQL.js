/* =========================================================================
 * CAMADA DE DADOS — FACILAPP CEREAIS
 * -------------------------------------------------------------------------
 * A CONFIGURAÇÃO NÃO MORA AQUI: endereço da API, tipo de banco, banco, CNPJ
 * e afins ficam em config.js (window.FacilAppConfig). Carregue config.js
 * ANTES deste arquivo.
 *
 * BANCO: SQL SERVER EM 95% DAS INSTALAÇÕES
 * ----------------------------------------
 * Desenvolva e teste contra SQL Server — é o caso real da esmagadora
 * maioria. Os outros dois motores existem e precisam continuar funcionando:
 *   sqlserver   — padrão, 95% das instalações (Express nos portes menores)
 *   sqlite      — cliente pequeno, base local da própria API
 *   postgresql  — instalações grandes
 * Quem decide é Tipo_Banco no config.js. Ainda assim, NENHUMA tela pode
 * assumir um banco: é o que mantém os outros 5% vivos sem retrabalho.
 *
 * REGRA DE OURO — MULTIBANCO PRIMEIRO
 * -----------------------------------
 * Toda leitura e escrita passa por /multibanco/{consultar,inserir,alterar,
 * excluir}: a tela não escreve SQL e a própria API gera o dialeto correto.
 *
 * SQL livre só quando o multibanco não dá conta (JOIN, CASE, agregação).
 * Nesse caso o comando fica AQUI, nos CONTRATOS no fim do arquivo, e sempre
 * prevendo os três bancos:
 *   SQL.consultaLivre({ sqlite: '...', sqlserver: '...', postgresql: '...' })
 * NÃO escreva SQL dentro de arquivo .html — concentrando aqui, achar e
 * revisar as regras de banco continua fácil.
 *
 * AUTENTICAÇÃO: LoginVlink devolve o Bearer, exigido por /executar e pelo
 * multibanco. O Bearer fica em memória (window.FACILAPP_TOKEN) e também em
 * sessionStorage, porque o login é uma PÁGINA SEPARADA do index.html: ao
 * navegar de uma para a outra a memória se perde, e sem isso o índice não
 * encontraria a sessão e devolveria ao login em laço.
 * sessionStorage é por aba e morre ao fechá-la. NUNCA use localStorage para
 * o token, que persistiria na máquina.
 * ========================================================================= *
 * -------------------------------------------------------------------------
 * MODULOS E A TELA DE CADA UM
 *
 * Um modulo por assunto. A tela chama o modulo dela; nenhuma tela monta SQL.
 *
 *   SQL              conexao, token, os tres dialetos, CRUD multibanco
 *                    base de todos os outros
 *   SQLBalanca       pesagem, data e hora Clarion, patio, permissoes
 *                    ScrArmazenagem, app.js, TabArmazem, TabProdutos
 *   SQLArmazem       armazens                  Armazem, UpdateArmazem
 *   SQLVeiculos      veiculos                  Veiculos, UpdateVeiculos
 *   SQLArmazemMov    movimentacao de armazem e de produto
 *                    TabArmazem, TabProdutos
 *   SQLUnidades      filiais                   Unidades, UpdateUnidade
 *                    tambem descobre a tabela da filial para o CRT
 *   SQLFiscais       grupos de tributos        DadosFiscais (pela ponte)
 *   SQLGrupos        grupos de produto         Grupos, UpdateProdutos
 *   SQLTabelas       tabelas de desconto e faixas
 *                    Tabelas, UpdateTabela, UpdateFaixa, UpdateProdutos
 *   SQLProdutos      produtos, NCM, tributos   Produtos, UpdateProdutos
 *
 * Nao ha codigo de tela aqui: nada de createElement, iframe, postMessage ou
 * getElementById. Se aparecer, esta no arquivo errado.
 */

if (!window.FacilAppConfig) {
  console.error('SQL.js: config.js não foi carregado antes deste arquivo.');
}

(function (window) {
  'use strict';

  var SQL = window.SQL || {};

  // =====================================================================
  // Configuração e sessão
  // =====================================================================

  SQL.obterConfiguracao = function () {
    return window.FacilAppConfig || {};
  };

  SQL.montarBaseURL = function (cfg) {
    var c = cfg || SQL.obterConfiguracao();
    var endpoint = String(c.Endpoint_FacilApp_SQL || '').replace(/\/+$/, '');
    var porta = Number(c.Porta_FacilApp_SQL || 0);
    var montada = endpoint ? endpoint + (porta ? ':' + porta : '') : '';
    return String(c.IP_API || montada || c.baseURL || '').replace(/\/+$/, '');
  };

  /* API Services (23/09/2026): CNPJ, CPF, CEP, mapas, WhatsApp, RDL etc. --
     saiu da API SQL, agora e' um servico proprio. Contrato so' em
     config.js: Endpoint_FacilApp_Services + Porta_FacilApp_Services. */
  SQL.montarBaseURLServices = function (cfg) {
    var c = cfg || SQL.obterConfiguracao();
    var endpoint = String(c.Endpoint_FacilApp_Services || 'http://127.0.0.1').replace(/\/+$/, '');
    var porta = Number(c.Porta_FacilApp_Services || 7070);
    return (endpoint + (porta ? ':' + porta : '')).replace(/\/+$/, '');
  };

  SQL.obterSistemaId = function () {
    return String(SQL.obterConfiguracao().Sistema || '');
  };

  SQL.obterCnpjEmpresa = function () {
    return String(SQL.obterConfiguracao().CNPJ || '');
  };

  /* URL de um arquivo local publicado pela Ponte, que funciona como um
     servidor web: /HTML/{caminho-absoluto}?token={token}. Não confundir com
     a API de dados (IP_API), que autentica por Bearer. */
  SQL.montarURLPonte = function (caminhoAbsoluto) {
    var cfg = SQL.obterConfiguracao();
    var endpoint = String(cfg.Ponte_EndPoint || '').replace(/\/+$/, '');
    var porta = Number(cfg.Ponte_Porta || 0);
    var base = String(cfg.Ponte_URL || (endpoint ? endpoint + (porta ? ':' + porta : '') : '')).replace(/\/+$/, '');
    if (!base) return String(caminhoAbsoluto || '');
    var caminho = String(caminhoAbsoluto || '').split('\\').join('/');
    return base + '/HTML/' + encodeURI(caminho) +
      '?token=' + encodeURIComponent(cfg.Ponte_Token || '');
  };

  var CHAVE_TOKEN = 'facilapp_access_token';

  /* Memória primeiro; o sessionStorage cobre a troca de página entre o
     login2.html e o index.html. */
  SQL.obterAccessToken = function () {
    if (window.FACILAPP_TOKEN) return String(window.FACILAPP_TOKEN);
    try {
      var guardado = sessionStorage.getItem(CHAVE_TOKEN);
      if (guardado) {
        window.FACILAPP_TOKEN = guardado;
        return guardado;
      }
    } catch (e) {}
    return '';
  };

  SQL.definirAccessToken = function (token) {
    window.FACILAPP_TOKEN = String(token || '');
    try {
      if (window.FACILAPP_TOKEN) sessionStorage.setItem(CHAVE_TOKEN, window.FACILAPP_TOKEN);
      else sessionStorage.removeItem(CHAVE_TOKEN);
    } catch (e) {}
  };

  /* Identidade da sessão: id, login e nome. Nunca guarda senha nem
     permissões — as permissões vêm do banco a cada abertura. */
  SQL.obterSessaoAtiva = function () {
    var usuario = window.FACILAPP_USUARIO_ATIVO;
    if (!usuario) {
      try {
        usuario = JSON.parse(sessionStorage.getItem('facilapp_usuario_logado') || 'null');
      } catch (e) { usuario = null; }
    }
    if (!usuario || !Number(usuario.idUsuario || 0)) return null;
    return {
      sessao_id: String(usuario.idUsuario),
      dados_usuario: {
        idUsuario: Number(usuario.idUsuario),
        login: String(usuario.login || ''),
        nome: String(usuario.nome || ''),
        administrador: Boolean(usuario.administrador),
        idFilial: Number(usuario.idFilial || 0) || SQL.filialDaSessao(),
        sistema_id: SQL.obterSistemaId()
      }
    };
  };

  /* A FILIAL e do USUARIO, nao do arquivo de configuracao. Cada operador
     entra com a sua, e todo cadastro feito naquela sessao pertence a ela —
     e dela sai o contador que monta o codigo do fornecedor.

     Fica aqui, junto do token e do id do usuario, porque o login e uma
     PAGINA separada: o valor precisa atravessar a troca de pagina para o
     index.html e chegar as telas, que rodam em iframe. */
  var CHAVE_FILIAL = 'facilapp_id_filial';

  SQL.definirFilialAtiva = function (id) {
    var n = Number(id || 0);
    window.FACILAPP_ID_FILIAL = n > 0 ? n : 0;
    try {
      if (n > 0) sessionStorage.setItem(CHAVE_FILIAL, String(n));
      else sessionStorage.removeItem(CHAVE_FILIAL);
    } catch (e) {}
    return window.FACILAPP_ID_FILIAL;
  };

  /** A filial ja conhecida, sem ir ao banco. Zero quando ainda nao se sabe. */
  SQL.filialDaSessao = function () {
    if (Number(window.FACILAPP_ID_FILIAL || 0) > 0) return Number(window.FACILAPP_ID_FILIAL);
    try {
      var guardado = Number(sessionStorage.getItem(CHAVE_FILIAL) || 0);
      if (guardado > 0) {
        window.FACILAPP_ID_FILIAL = guardado;
        return guardado;
      }
    } catch (e) {}
    return 0;
  };

  /**
   * A filial para gravar em cadastro e movimento.
   *
   * Ordem: o que o login guardou; se faltar, o ID_FILIAL do usuario lido da
   * tabela usuarios; e, so entao, o Glo_Filial do config.js — que existe para
   * a Balanca aberta sem login.
   *
   * @returns {Promise<number>}
   */
  SQL.filialAtiva = async function () {
    var daSessao = SQL.filialDaSessao();
    if (daSessao > 0) return daSessao;

    var sessao = SQL.obterSessaoAtiva();
    var idUsuario = sessao ? Number(sessao.dados_usuario.idUsuario || 0) : 0;
    if (idUsuario > 0) {
      try {
        var cfg = SQL.obterConfiguracao();
        var linhas = await SQL.consultar(cfg.Login_Tabela || 'usuarios', '*',
          { ID_usuario: idUsuario });
        if (Array.isArray(linhas) && linhas.length) {
          var lido = SQL.filialDoUsuario(linhas[0]);
          if (lido > 0) return SQL.definirFilialAtiva(lido);
        }
      } catch (e) {
        console.warn('[FILIAL] nao foi possivel ler a filial do usuario:', e && e.message);
      }
    }
    var cfg2 = SQL.obterConfiguracao();
    return Number(cfg2.Glo_Filial || cfg2.Filial || 0);
  };

  /** O ID_FILIAL de uma linha da tabela usuarios, seja qual for a grafia. */
  SQL.filialDoUsuario = function (linhaUsuario) {
    var u = linhaUsuario || {};
    var nomes = ['ID_FILIAL', 'id_filial', 'Id_Filial', 'idFilial', 'FILIAL', 'filial'];
    for (var i = 0; i < nomes.length; i++) {
      var v = Number(u[nomes[i]] || 0);
      if (v > 0) return v;
    }
    return 0;
  };

  SQL.salvarDadosLogin = function (dados) {
    var d = dados || {};
    var usuario = d.usuario || {};
    window.FACILAPP_USUARIO_ATIVO = {
      idUsuario: Number(usuario.idUsuario || 0),
      login: String(usuario.login || d.login || ''),
      nome: String(usuario.nome || ''),
      administrador: Boolean(usuario.administrador),
      idFilial: Number(usuario.idFilial || usuario.ID_FILIAL || SQL.filialDaSessao() || 0)
    };
    if (Number(window.FACILAPP_USUARIO_ATIVO.idFilial) > 0) {
      SQL.definirFilialAtiva(window.FACILAPP_USUARIO_ATIVO.idFilial);
    }
    if (d.access_token) SQL.definirAccessToken(d.access_token);
    try {
      sessionStorage.setItem('facilapp_usuario_logado',
        JSON.stringify(window.FACILAPP_USUARIO_ATIVO));
    } catch (e) {}
    return window.FACILAPP_USUARIO_ATIVO;
  };

  SQL.encerrarSessao = function () {
    window.FACILAPP_TOKEN = '';
    window.FACILAPP_USUARIO_ATIVO = null;
    try {
      sessionStorage.removeItem(CHAVE_TOKEN);
      sessionStorage.removeItem('facilapp_usuario_logado');
      sessionStorage.removeItem(CHAVE_FILIAL);
    } catch (e) {}
    window.FACILAPP_ID_FILIAL = 0;
  };

  // =====================================================================
  // Dialeto — tudo que muda entre sqlite, sqlserver e postgresql
  // =====================================================================

  /** 'sqlite' | 'sqlserver' | 'postgresql', sempre vindo do config.js. */
  SQL.dialeto = function () {
    var cfg = SQL.obterConfiguracao();
    var tipo = String(cfg.tipo_banco || cfg.Tipo_Banco || '').trim().toLowerCase();
    if (tipo === 'postgres' || tipo === 'postgresql') return 'postgresql';
    if (tipo === 'sqlite' || tipo === 'sqlite3') return 'sqlite';
    if (tipo === 'sqlserver') return 'sqlserver';
    throw new Error('tipo_banco ausente ou não suportado: ' + (tipo || '(vazio)') + '.');
  };

  /* Só o SQL Server usa o esquema dbo.; o SQLite não tem esquema e o
     PostgreSQL resolve pelo search_path. */
  SQL.tabela = function (nome) {
    return SQL.dialeto() === 'sqlserver' ? 'dbo.' + nome : nome;
  };

  /* Delimitador de identificador de cada dialeto. */
  SQL.ident = function (nome) {
    return SQL.dialeto() === 'sqlserver' ? '[' + nome + ']' : '"' + nome + '"';
  };

  /**
   * Corta a quantidade de linhas no dialeto certo.
   * O multibanco IGNORA o campo `limite`, então quem precisa cortar de
   * verdade usa isto junto com SQL livre.
   * @param {string} sql  comando começando por SELECT
   * @param {number} n
   */
  SQL.limitar = function (sql, n) {
    var quantidade = Number(n || 0);
    if (!quantidade) return sql;
    return SQL.dialeto() === 'sqlserver'
      ? String(sql).replace(/^\s*SELECT\s+/i, 'SELECT TOP ' + quantidade + ' ')
      : String(sql) + ' LIMIT ' + quantidade;
  };

  // =====================================================================
  // Autenticação
  // =====================================================================

  /**
   * Login público da API. A senha nunca entra em comando SQL.
   *
   * Dois caminhos, conforme Login_Modo do config.js:
   *   'vlink'   — tabela usuarios DENTRO do banco VLINK, no motor que
   *               Tipo_Banco indicar (sqlserver, postgresql ou sqlite), por
   *               funcao 'LoginVlink'. Exclusivo dos projetos grandes, que
   *               já têm o cadastro de usuários do ERP.
   *   'console' — cadastro do console da API, na base SQLite dela — modelo
   *               do FacilApp Gourmet. Para os clientes menores.
   *
   * Nos dois casos a resposta traz `access_token` e, quando a API fiscal
   * está instalada, `access_token_nfe`.
   */
  SQL.login = async function (usuario, senha) {
    var cfg = SQL.obterConfiguracao();
    var base = SQL.montarBaseURL(cfg);
    var modo = String(cfg.Login_Modo || 'vlink').toLowerCase();

    var rota, corpoEnvio;
    if (modo === 'console') {
      rota = '/oauth/usuario';
      corpoEnvio = { usuario: usuario, senha: senha };
    } else {
      rota = '/executar';
      corpoEnvio = {
        funcao: 'LoginVlink',
        tipo_banco: SQL.dialeto(),
        banco: cfg.Banco_Api,
        tabela_usuario: cfg.Login_Tabela || 'usuarios',
        campo_usuario: cfg.Login_Campo_Usuario || 'LOGIN',
        campo_senha: cfg.Login_Campo_Senha || 'SENHA',
        usuario: usuario,
        senha: senha
      };
    }

    /* Com tempo limite: este fetch era o unico da tela sem limite, e quando a
       API aceitava a conexao mas nao respondia, o botao ficava em
       "AUTENTICANDO..." para sempre — sem erro e sem sinal do que houve. */
    var limiteLogin = Number(cfg.Timeout_Ms || 0) || 20000;
    var cancelador = new AbortController();
    var relogio = setTimeout(function () { cancelador.abort(); }, limiteLogin);
    var resposta;
    try {
      resposta = await fetch(base + rota, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpoEnvio),
        signal: cancelador.signal
      });
    } catch (erro) {
      if (erro && erro.name === 'AbortError') {
        throw new Error('A API não respondeu em ' + Math.round(limiteLogin / 1000) +
          ' segundos. Confira se o serviço está no ar.');
      }
      throw erro;
    } finally {
      clearTimeout(relogio);
    }
    var corpo = await resposta.json().catch(function () { return {}; });

    /* O console devolve access_token_sql em algumas versões; a API de dados
       sempre usa o access_token. */
    var token = corpo.access_token || corpo.access_token_sql;
    if (!resposta.ok || !token) {
      throw new Error(corpo.erro || corpo.error || ('HTTP ' + resposta.status));
    }
    corpo.access_token = token;
    SQL.definirAccessToken(token);
    return corpo;
  };

  // =====================================================================
  // Transporte
  // =====================================================================

  function conexao() {
    var cfg = SQL.obterConfiguracao();
    return {
      tipo_banco: SQL.dialeto(),
      banco: cfg.Banco_Api,
      servidor: cfg.Servidor || ''
    };
  }

  /**
   * Chamada a API com tempo limite.
   *
   * Sem limite, uma requisicao que nunca responde deixa a tela parada em
   * "Gravando..." ou "Carregando..." para sempre, sem erro e sem sinal de que
   * algo deu errado — o usuario fica olhando uma tela travada. Com limite, a
   * espera vira uma mensagem que diz o que aconteceu.
   *
   * O tempo sai do config.js (Timeout_Ms); 20 segundos por padrao, que ja
   * cobre consulta pesada em rede lenta.
   */
  async function chamar(rota, corpo) {
    var cfg = SQL.obterConfiguracao ? SQL.obterConfiguracao() : {};
    var limite = Number(cfg.Timeout_Ms || 0) || 20000;
    var cancelador = new AbortController();
    var relogio = setTimeout(function () { cancelador.abort(); }, limite);
    var resposta;
    try {
      resposta = await fetch(SQL.montarBaseURL() + rota, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + SQL.obterAccessToken()
        },
        body: JSON.stringify(Object.assign(conexao(), corpo)),
        signal: cancelador.signal
      });
    } catch (erro) {
      if (erro && erro.name === 'AbortError') {
        throw new Error('A API não respondeu em ' + Math.round(limite / 1000) +
          ' segundos (' + rota + '). Confira se o serviço está no ar.');
      }
      throw erro;
    } finally {
      clearTimeout(relogio);
    }
    var retorno = await resposta.json().catch(function () { return {}; });
    if (!resposta.ok || retorno.ok === false) {
      throw new Error(retorno.erro || ('HTTP ' + resposta.status));
    }
    return retorno;
  }

  /**
   * Consulta de CNPJ na fonte pública, pela própria API FacilApp SQL.
   * Rota GET, sem corpo e sem dialeto — não é consulta ao banco do cliente.
   * Devolve o objeto `empresa` já normalizado pela API:
   * cnpj, razaoSocial, nomeFantasia, inscricaoEstadual, email, telefone,
   * cep, codigoIbge, uf, cidade, endereco, numero, complemento, bairro.
   * Falha de rede, HTTP ou `ok:false` sobe como erro real, para a tela
   * mostrar a mensagem da API em vez de preencher campo com valor inventado.
   * @param {string} cnpj  com ou sem máscara; só os dígitos são enviados
   * @returns {Promise<object>} dados da empresa
   */
  /**
   * Consulta de CEP pela API FacilApp SQL.
   * Rota: GET /api/console/enderecos/consultar-cep/{cep}
   * A base vem do config.js, entao a porta acompanha a configuracao e nao
   * fica cravada aqui. Em 10/09/2026 a rota ainda respondia 404: a API
   * precisa ser instalada antes de a tela usar esta funcao.
   * Devolve o objeto de endereco como a API entregar, sem renomear campo:
   * o mapeamento para os campos da tela so pode ser escrito depois de ver
   * a resposta real, para nao inventar nome de campo.
   * @param {string} cep  com ou sem mascara; so os digitos sao enviados
   * @returns {Promise<object>} endereco devolvido pela API
   */
  /* Municipios — tabela Cadastros_Municipios.
     Os nomes das colunas nao foram confirmados no banco, entao nada e
     chutado: a primeira chamada le o catalogo da tabela e escolhe a coluna
     de nome entre as que realmente existem. Se nenhuma servir, o erro diz
     quais colunas a tabela tem, para o ajuste ser feito com informacao e
     nao por tentativa. O catalogo e lido uma vez por carregamento da tela;
     nao e cache: nada fica no navegador entre sessoes. */
  var catalogoMunicipios = null;

  async function descobrirMunicipios() {
    if (catalogoMunicipios) return catalogoMunicipios;
    var linhas = await SQL.consultaLivre({
      sqlserver: "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Cadastros_Municipios'",
      postgresql: "SELECT column_name AS COLUMN_NAME FROM information_schema.columns WHERE LOWER(table_name)='cadastros_municipios'",
      sqlite: 'PRAGMA table_info(Cadastros_Municipios)'
    });
    var nomes = linhas.map(function (linha) {
      return String(linha.COLUMN_NAME || linha.column_name || linha.name || '').trim();
    }).filter(Boolean);
    if (!nomes.length) throw new Error('A tabela Cadastros_Municipios não devolveu colunas. Confirme o nome da tabela no banco ativo.');
    var achar = function (candidatas) {
      return nomes.find(function (coluna) { return candidatas.indexOf(coluna.toUpperCase()) >= 0; }) || '';
    };
    var nome = achar(['NOME_MUNICIPIO', 'MUNICIPIO', 'CIDADE', 'NOME', 'DESCRICAO']);
    if (!nome) throw new Error('Não encontrei a coluna do nome do município em Cadastros_Municipios. Colunas existentes: ' + nomes.join(', ') + '.');
    catalogoMunicipios = {
      nome: nome,
      /* A tabela nao tem sigla de UF: NOME_ESTADO traz o nome por extenso
         (RONDONIA). E o codigo nao comeca com ID, e CODIGO_MUNICIPIO. */
      uf: achar(['UF', 'SIGLA_UF', 'NOME_ESTADO', 'ESTADO', 'UF_MUNICIPIO']),
      id: achar(['CODIGO_MUNICIPIO', 'ID_MUNICIPIO', 'CODIGO_IBGE']) ||
        (nomes.find(function (coluna) { return /^ID[_A-Z]*$/i.test(coluna); }) || '')
    };
    return catalogoMunicipios;
  }

  /**
   * Municipios para o combo, filtrados pelo que foi digitado.
   * @param {string} [termo]
   * @returns {Promise<Array<{nome:string, uf:string, id:(number|string)}>>}
   */
  SQL.buscarMunicipios = async function (termo) {
    var cat = await descobrirMunicipios();
    var busca = String(termo || '').trim().replace(/'/g, "''");
    var campos = [cat.nome].concat(cat.uf ? [cat.uf] : []).concat(cat.id ? [cat.id] : []).join(',');
    var onde = busca ? " WHERE " + cat.nome + " LIKE '%" + busca + "%'" : '';
    var ordem = ' ORDER BY ' + cat.nome;
    var linhas = await SQL.consultaLivre({
      sqlserver: 'SELECT TOP 50 ' + campos + ' FROM Cadastros_Municipios' + onde + ordem,
      postgresql: 'SELECT ' + campos + ' FROM Cadastros_Municipios' + onde + ordem + ' LIMIT 50',
      sqlite: 'SELECT ' + campos + ' FROM Cadastros_Municipios' + onde + ordem + ' LIMIT 50'
    });
    return linhas.map(function (linha) {
      var pegar = function (coluna) {
        if (!coluna) return '';
        return linha[coluna] !== undefined ? linha[coluna]
          : (linha[coluna.toUpperCase()] !== undefined ? linha[coluna.toUpperCase()] : linha[coluna.toLowerCase()]);
      };
      return {
        nome: String(pegar(cat.nome) || '').trim(),
        uf: String(pegar(cat.uf) || '').trim(),
        id: pegar(cat.id)
      };
    }).filter(function (item) { return item.nome; });
  };
  /**
   * Impressao textual/ESC-POS pelo agente local.
   * Servico separado da API SQL: POST /imprime em http://127.0.0.1:4000,
   * com Authorization: Bearer, conforme o Swagger da 5050.
   * O destino sai do config.js — tipo, ip, porta, share, nome ou COM —,
   * nada fica cravado aqui.
   * @param {string} texto
   * @param {number} [vias]  quantas vias; por padrao o Vias_Ticket do config
   * @returns {Promise<number>} quantas vias foram aceitas pelo agente
   */
  /**
   * Grava um arquivo no disco do servidor, por caminho absoluto.
   * E funcao do /executar, nao rota propria — por isso nao aparece como
   * caminho separado no Swagger:
   *   { funcao: 'arquivo_salvar', nome_arquivo, conteudo_base64 }
   * O conteudo vai em base64 de UTF-8, para acento e quebra de linha
   * chegarem intactos.
   * @param {string} caminho   ex.: 'C:\PASTAEXE\CONFIG.JS'
   * @param {string} conteudo  texto do arquivo
   * @returns {Promise<object>} retorno da API
   */
  SQL.salvarArquivo = async function (caminho, conteudo) {
    var nome = String(caminho || '').trim();
    if (!nome) throw new Error('Informe o caminho do arquivo a gravar.');

    /* Aceita texto e binario. Texto vai como UTF-8; binario vai byte a byte,
       sem passar por codificacao — e o que PDF, XML assinado e imagem exigem.
       Passar binario por TextEncoder corrompe o arquivo. */
    var bytes;
    if (conteudo instanceof Blob) {
      bytes = new Uint8Array(await conteudo.arrayBuffer());
    } else if (conteudo instanceof ArrayBuffer) {
      bytes = new Uint8Array(conteudo);
    } else if (ArrayBuffer.isView(conteudo)) {
      bytes = new Uint8Array(conteudo.buffer, conteudo.byteOffset, conteudo.byteLength);
    } else {
      bytes = new TextEncoder().encode(String(conteudo == null ? '' : conteudo));
    }

    /* Fatiado para nao estourar a pilha em arquivo grande. */
    var pedacos = [];
    for (var p = 0; p < bytes.length; p += 8192) {
      pedacos.push(String.fromCharCode.apply(null, bytes.subarray(p, p + 8192)));
    }
    var base64 = btoa(pedacos.join(''));
    var url = SQL.montarBaseURL() + '/executar';
    var resposta;
    try {
      resposta = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SQL.obterAccessToken()},
        body: JSON.stringify({funcao: 'arquivo_salvar', nome_arquivo: nome, conteudo_base64: base64})
      });
    } catch (erro) {
      throw new Error('Falha de conexão com a API em ' + url + ': ' + (erro.message || erro));
    }
    var retorno = await resposta.json().catch(function () { return {}; });
    if (!resposta.ok || retorno.ok === false) {
      throw new Error(retorno.erro || retorno.mensagem || ('A gravação de ' + nome + ' respondeu HTTP ' + resposta.status + '.'));
    }
    return retorno;
  };
  SQL.imprimirTexto = async function (texto, vias) {
    var cfg = SQL.obterConfiguracao();
    var base = String(cfg.Impressao_URL || '').replace(/\/+$/, '');
    if (!base) throw new Error('Impressao_URL não definida no config.js.');
    var tipo = String(cfg.Impressora_Tipo || '');
    if (!tipo) throw new Error('Impressora_Tipo não definido no config.js.');

    var corpo = {tipo: tipo, texto: String(texto == null ? '' : texto), cortar: cfg.Impressora_Cortar !== false};
    if (tipo === 'network_ip') {
      if (!cfg.Impressora_IP) throw new Error('Impressora_IP não definido no config.js para o tipo network_ip.');
      corpo.ip = String(cfg.Impressora_IP);
      corpo.porta = Number(cfg.Impressora_Porta || 9100);
    } else if (tipo === 'windows_share') {
      if (!cfg.Impressora_Share) throw new Error('Impressora_Share não definido no config.js.');
      corpo.share = String(cfg.Impressora_Share);
    } else if (tipo === 'windows_installed') {
      if (!cfg.Impressora_Nome) throw new Error('Impressora_Nome não definido no config.js.');
      corpo.nome = String(cfg.Impressora_Nome);
    } else if (tipo === 'serial_com') {
      if (!cfg.Impressora_COM) throw new Error('Impressora_COM não definido no config.js.');
      corpo.porta_com = String(cfg.Impressora_COM);
    }

    var quantas = Number(vias || cfg.Vias_Ticket || 1);
    if (!Number.isFinite(quantas) || quantas < 1) quantas = 1;
    var url = base + '/imprime';
    for (var i = 0; i < quantas; i++) {
      var resposta;
      try {
        resposta = await fetch(url, {
          method: 'POST',
          headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SQL.obterAccessToken()},
          body: JSON.stringify(corpo)
        });
      } catch (erro) {
        throw new Error('Falha de conexão com o agente de impressão em ' + url + ': ' + (erro.message || erro));
      }
      if (resposta.status === 401) throw new Error('O agente de impressão recusou o Bearer (HTTP 401).');
      if (!resposta.ok) {
        var detalhe = await resposta.text().catch(function () { return ''; });
        throw new Error('Agente de impressão respondeu HTTP ' + resposta.status + (detalhe ? ': ' + detalhe.slice(0, 200) : '') + '.');
      }
    }
    return quantas;
  };
  /**
   * CEP em oito digitos, do jeito que a coluna guarda.
   *
   * O retorno da Receita vem furado: quando a fonte manda o CEP como NUMERO,
   * o zero da esquerda se perde e sobram sete digitos — 01234000 chega como
   * 1234000, e formatado vira "12340-00". Aqui ele volta a ter oito.
   *
   * Menos de sete digitos nao da para adivinhar: fica como veio, e quem olha
   * a tela ve que esta incompleto em vez de receber um CEP inventado.
   *
   * @param {string|number} valor
   * @returns {string} so digitos
   */
  SQL.cepDigitos = function (valor) {
    var d = String(valor == null ? '' : valor).replace(/\D+/g, '');
    if (!d) return '';
    if (d.length > 8) return d.slice(0, 8);
    if (d.length === 7) return '0' + d;
    return d;
  };

  SQL.consultarCep = async function (cep) {
    var digitos = String(cep || '').replace(/\D+/g, '');
    if (digitos.length !== 8) throw new Error('CEP deve ter 8 dígitos. Recebido: ' + (digitos.length || 0) + '.');
    // Rota migrou da API SQL pra API Services (23/09/2026).
    var url = SQL.montarBaseURLServices() + '/api/cep/' + digitos;
    var resposta;
    try {
      resposta = await fetch(url, { headers: { 'Authorization': 'Bearer ' + SQL.obterAccessToken() } });
    } catch (erro) {
      throw new Error('Falha de conexão com a API em ' + url + ': ' + (erro.message || erro));
    }
    var retorno = await resposta.json().catch(function () { return {}; });
    if (resposta.status === 404) {
      throw new Error('A rota de consulta de CEP não existe nesta API (' + url + '). Instale a versão que a publica.');
    }
    if (!resposta.ok || retorno.ok === false) {
      throw new Error(retorno.erro || retorno.mensagem || ('A consulta de CEP respondeu HTTP ' + resposta.status + '.'));
    }
    return retorno.dados || retorno.endereco || retorno;
  };
  SQL.consultarCnpjReceita = async function (cnpj) {
    var digitos = String(cnpj || '').replace(/\D+/g, '');
    if (digitos.length !== 14) throw new Error('CNPJ deve ter 14 dígitos. Recebido: ' + (digitos.length || 0) + '.');
    // 24/09/2026: CNPJ saiu da API SQL (5050) e mora na FacilApp Services (7070): GET /api/cnpj/{cnpj}.
    var url = SQL.montarBaseURLServices() + '/api/cnpj/' + digitos;
    var resposta;
    try {
      resposta = await fetch(url, { headers: { 'Authorization': 'Bearer ' + SQL.obterAccessToken() } });
    } catch (erro) {
      throw new Error('Falha de conexão com a API em ' + url + ': ' + (erro.message || erro));
    }
    var retorno = await resposta.json().catch(function () { return {}; });
    var empresa = retorno.dados || retorno.empresa || (retorno.cnpj || retorno.razao_social || retorno.razaoSocial ? retorno : null);
    if (!resposta.ok || retorno.ok === false || !empresa) {
      throw new Error(retorno.erro || retorno.mensagem || ('A consulta de CNPJ respondeu HTTP ' + resposta.status + '.'));
    }
    // A Services devolve camelCase; as telas (UpdateCliente/Fornecedor) leem snake_case: entrega os dois.
    var alias = {razaoSocial:'razao_social', nomeFantasia:'nome_fantasia', inscricaoEstadual:'inscricao_estadual',
      codigoIbge:'codigo_ibge', endereco:'logradouro', cidade:'municipio', telefone:'fone'};
    Object.keys(alias).forEach(function (k) { if (empresa[k] != null && empresa[alias[k]] == null) empresa[alias[k]] = empresa[k]; });
    if (empresa.nome == null) empresa.nome = empresa.razao_social || '';
    if (empresa.fantasia == null) empresa.fantasia = empresa.nome_fantasia || '';
    if (empresa.ie == null) empresa.ie = empresa.inscricao_estadual || '';
    return empresa;
  };

  // =====================================================================
  // CRUD — multibanco. É por aqui que as telas falam com o banco.
  // =====================================================================

  /**
   * SELECT parametrizado; a API monta o dialeto.
   * @param {string} tabela
   * @param {string} [campos]  '*' ou 'a,b,c'
   * @param {object} [where]   { coluna: valor } combinados com AND
   * @returns {Promise<Array>} sempre um array de linhas
   */
  SQL.consultar = async function (tabela, campos, where) {
    var retorno = await chamar('/multibanco/consultar', {
      tabela: tabela,
      campos: (!campos || campos === '*') ? '*' : String(campos),
      where: where || {}
    });
    return Array.isArray(retorno.dados) ? retorno.dados : [];
  };

  SQL.inserir = async function (tabela, dados) {
    if (!dados || !Object.keys(dados).length) {
      throw new Error('Nada a inserir em ' + tabela + '.');
    }
    await chamar('/multibanco/inserir', { tabela: tabela, dados: dados });
    return true;
  };

  SQL.alterar = async function (tabela, dados, where) {
    if (!dados || !Object.keys(dados).length) {
      throw new Error('Nada a alterar em ' + tabela + '.');
    }
    if (!where || !Object.keys(where).length) {
      throw new Error('UPDATE sem where bloqueado em ' + tabela + '.');
    }
    await chamar('/multibanco/alterar', { tabela: tabela, dados: dados, where: where });
    return true;
  };

  SQL.excluir = async function (tabela, where) {
    if (!where || !Object.keys(where).length) {
      throw new Error('DELETE sem where bloqueado em ' + tabela + '.');
    }
    await chamar('/multibanco/excluir', { tabela: tabela, where: where });
    return true;
  };

  // =====================================================================
  // SQL livre — último recurso, sempre prevendo os três bancos
  // =====================================================================

  /* Lê os três argumentos de DATEADD respeitando parênteses aninhados e
     devolve o equivalente do dialeto. Fora do SQL Server não existe DATEADD. */
  function trocarDateAdd(sql, dialeto) {
    var saida = '', i = 0;
    while (i < sql.length) {
      var achou = sql.slice(i).search(/\bDATEADD\s*\(/i);
      if (achou < 0) { saida += sql.slice(i); break; }

      var inicio = i + achou;
      saida += sql.slice(i, inicio);

      var abre = sql.indexOf('(', inicio);
      var nivel = 0, fim = -1, args = [], atual = '';
      for (var j = abre; j < sql.length; j++) {
        var c = sql[j];
        if (c === '(') { nivel++; if (nivel === 1) continue; }
        else if (c === ')') { nivel--; if (nivel === 0) { args.push(atual); fim = j; break; } }
        else if (c === ',' && nivel === 1) { args.push(atual); atual = ''; continue; }
        atual += c;
      }
      if (fim < 0 || args.length < 3) { saida += sql.slice(inicio); break; }

      var unidade = args[0].trim().toLowerCase().replace(/s$/, '');
      var quantidade = args[1].trim();
      var data = args[2].trim();

      saida += dialeto === 'sqlite'
        ? "datetime(" + data + ", (" + quantidade + ") || ' " + unidade + "')"
        : "(" + data + " + (" + quantidade + ") * interval '1 " + unidade + "')";
      i = fim + 1;
    }
    return saida;
  }

  /**
   * Porta um SELECT escrito em SQL Server para o dialeto em uso.
   *
   * Existe porque as telas herdadas trazem centenas de consultas em T-SQL e
   * reescrever cada uma três vezes seria inviável e propenso a divergir.
   * Traduz só o que é ambíguo entre os três bancos, de forma determinística:
   *
   *   ISNULL(a,b)  -> COALESCE(a,b)      válido nos três, sempre aplicado
   *   SELECT TOP n -> LIMIT n no fim     sqlite e postgresql
   *   DATEADD(u,n,d) -> equivalente      sqlite: date(d,'+n u')
   *                                      postgresql: d + interval 'n u'
   *   dbo.tabela   -> tabela             fora do sql server
   *
   * O que NÃO é traduzido, por não ter equivalente seguro e automático:
   * CONVERT com estilo, FORMAT, PIVOT, funções de janela específicas e
   * tipos proprietários. Nesses casos escreva o comando por dialeto no mapa
   * de SQL.consultaLivre().
   *
   * @param {string} sql  comando em T-SQL
   * @returns {string} comando no dialeto de SQL.dialeto()
   */
  SQL.portarSelect = function (sql) {
    var comando = String(sql || '');
    var dialeto = SQL.dialeto();

    // COALESCE é padrão nos três; ISNULL só existe no SQL Server.
    comando = comando.replace(/\bISNULL\s*\(/gi, 'COALESCE(');

    if (dialeto === 'sqlserver') return comando;

    // Sem esquema dbo. fora do SQL Server.
    comando = comando.replace(/\bdbo\./gi, '');

    // TOP n vira LIMIT n no fim do comando.
    var limite = null;
    comando = comando.replace(/\bSELECT\s+TOP\s+(\d+)\s+/i, function (todo, n) {
      limite = Number(n);
      return 'SELECT ';
    });

    // GETDATE() é do SQL Server; CURRENT_TIMESTAMP vale nos três.
    comando = comando.replace(/\bGETDATE\s*\(\s*\)/gi, 'CURRENT_TIMESTAMP');

    // DATEADD(unidade, quantidade, data). O terceiro argumento costuma ter
    // parênteses — GETDATE(), CAST(...) —, então a leitura é por contagem de
    // parênteses, e não por expressão regular.
    comando = trocarDateAdd(comando, dialeto);

    if (limite) comando = comando.replace(/\s*;?\s*$/, '') + ' LIMIT ' + limite;
    return comando;
  };

  /**
   * SELECT livre já portado para o banco em uso. É o que as telas herdadas
   * devem chamar no lugar de montar a requisição por conta própria.
   */
  SQL.selecionar = function (sql) {
    return SQL.consultaLivre(SQL.portarSelect(sql));
  };

  /**
   * Executa SQL livre. Aceita uma string, quando o comando é idêntico nos
   * três bancos, ou um mapa por dialeto:
   *   SQL.consultaLivre({ sqlite: '...', sqlserver: '...', postgresql: '...' })
   * O mapa aceita `padrao` para cobrir os dialetos não listados.
   *
   * ATENÇÃO: a API rejeita lotes acima de ~9 KB (HTTP 500) e não devolve
   * identity entre comandos do mesmo lote.
   */
  SQL.consultaLivre = async function (comando) {
    var sql = comando;
    if (comando && typeof comando === 'object') {
      var dialeto = SQL.dialeto();
      sql = comando[dialeto] || comando.padrao;
      if (!sql) throw new Error('SQL livre não definido para o dialeto ' + dialeto + '.');
    }
    var retorno = await chamar('/executar', { funcao: 'consulta_livre', sql: sql });
    return Array.isArray(retorno.dados) ? retorno.dados : [];
  };

  /* Compatibilidade: páginas antigas chamam executarSQL e leem .dados. */
  SQL.executarSQL = function (sql) {
    return chamar('/executar', { funcao: 'consulta_livre', sql: sql });
  };

  // =====================================================================
  // CONTRATOS DE MENU
  // O que o multibanco não cobre (LEFT JOIN + CASE) fica concentrado aqui,
  // e não espalhado pelas telas.
  // =====================================================================

  /* Confere que o catálogo existe. Cada banco guarda isso num lugar. */
  SQL.garantirEstruturaCatalogoMenu = async function () {
    var linhas = await SQL.consultaLivre({
      sqlserver: "SELECT COUNT(*) AS n FROM sys.tables " +
        "WHERE name IN ('menu_catalogo_itens','menu_usuarios')",
      sqlite: "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' " +
        "AND name IN ('menu_catalogo_itens','menu_usuarios')",
      postgresql: "SELECT COUNT(*) AS n FROM information_schema.tables " +
        "WHERE table_name IN ('menu_catalogo_itens','menu_usuarios')"
    });
    if (!linhas.length || Number(linhas[0].n || 0) < 2) {
      throw new Error('Tabelas de menu ausentes no banco. Rode FONTES/aplicar_menu_sql.js.');
    }
    return true;
  };

  /**
   * Catálogo do menu com as exceções do usuário já aplicadas.
   *
   * Regra LISTA NEGRA: sem linha em menu_usuarios vale o padrão do
   * catálogo; havendo linha, ela sobrepõe o item para aquele usuário.
   *
   * LEFT JOIN, CASE e COALESCE têm a mesma escrita nos três bancos; o que
   * muda é só o prefixo de esquema, resolvido por SQL.tabela(). Por isso um
   * comando só atende sqlite, sqlserver e postgresql.
   *
   * @param {number} idUsuario
   * @returns {Promise<Array>} linhas do catálogo, na ordem de exibição
   */
  SQL.consultarMenuDoUsuario = function (idUsuario) {
    var id = Number(idUsuario || 0);
    var catalogo = SQL.tabela('menu_catalogo_itens');
    var permissoes = SQL.tabela('menu_usuarios');

    function efetivo(coluna, colunaPadrao, padrao) {
      var doCatalogo = 'COALESCE(m.' + colunaPadrao + ',' + padrao + ')';
      return 'CASE WHEN u.id_item IS NULL THEN ' + doCatalogo +
        ' ELSE COALESCE(u.' + coluna + ',' + doCatalogo + ') END AS ' + coluna;
    }

    var sql =
      'SELECT m.id_item,m.tipo_menu,m.id_pai,m.ordem,m.coluna,m.codigo,m.rotulo,' +
      'm.tipo,m.arquivo_destino,m.nomeprocedure,m.icone,m.icone_tipo,m.button_id,m.subtitulo,' +
      efetivo('ativo', 'ativo_padrao', '1') + ',' +
      efetivo('desabilitado', 'desabilitado_padrao', '0') + ',' +
      'CASE WHEN u.id_item IS NULL THEN 0 ELSE COALESCE(u.oculto,0) END AS oculto,' +
      efetivo('incluir', 'incluir', '1') + ',' +
      efetivo('alterar', 'alterar', '1') + ',' +
      efetivo('excluir', 'excluir', '1') + ' ' +
      'FROM ' + catalogo + ' m LEFT JOIN ' + permissoes + ' u ' +
      'ON u.id_item=m.id_item AND u.id_usuario=' + id + ' ' +
      'ORDER BY m.tipo_menu,COALESCE(m.id_pai,0),m.ordem';

    return SQL.consultaLivre(sql);
  };

  /**
   * Monta os três blocos do menu no formato que as telas consomem — o
   * mesmo dos JS MenuData / MenuSuperiorData / DashboardData.
   * @param {Array} linhas  retorno de consultarMenuDoUsuario()
   */
  SQL.montarMenu = function (linhas) {
    function numero(valor, padrao) {
      var n = Number(valor);
      return isFinite(n) ? n : padrao;
    }

    function item(linha) {
      var incluir = numero(linha.incluir, 1);
      var alterar = numero(linha.alterar, 1);
      var excluir = numero(linha.excluir, 1);
      var ativo = numero(linha.ativo, 1);
      var destino = linha.arquivo_destino || '';
      return {
        id: String(linha.codigo || '').toLowerCase(),
        title: linha.rotulo || '',
        type: linha.tipo || '',
        path: destino,
        url: destino,
        arquivo: destino,
        NOMEPROCEDURE: linha.nomeprocedure || '',
        icon: linha.icone || '',
        iconType: linha.icone_tipo || 'material',
        buttonId: linha.button_id || '',
        subtitle: linha.subtitulo || '',
        column: numero(linha.coluna, 0) || undefined,
        Ativo: ativo,
        ativo: ativo,
        hide: numero(linha.oculto, 0),
        disable: numero(linha.desabilitado, ativo ? 0 : 1),
        incluir: incluir,
        alterar: alterar,
        excluir: excluir,
        permissao: { incluir: incluir, alterar: alterar, excluir: excluir }
      };
    }

    var lateral = [], superior = [], dashboards = [], modulos = {};

    (linhas || []).forEach(function (linha) {
      if (linha.tipo_menu !== 'lateral') return;
      if (linha.id_pai !== null && linha.id_pai !== undefined) return;
      var modulo = item(linha);
      modulo.module = modulo.title;
      modulo.submenu = [];
      delete modulo.title;
      modulos[linha.id_item] = modulo;
      lateral.push(modulo);
    });

    (linhas || []).forEach(function (linha) {
      if (linha.tipo_menu === 'superior') { superior.push(item(linha)); return; }
      if (linha.tipo_menu === 'dashboard') { dashboards.push(item(linha)); return; }
      var pai = modulos[linha.id_pai];
      if (pai) pai.submenu.push(item(linha));
    });

    return { lateral: lateral, superior: superior, dashboards: dashboards };
  };

  /** Atalho: consulta e monta numa chamada só. */
  SQL.carregarMenuDoUsuario = async function (idUsuario) {
    return SQL.montarMenu(await SQL.consultarMenuDoUsuario(idUsuario));
  };

  /**
   * Identifica o usuário autenticado no cadastro. Sem senha em SQL: quem
   * validou foi o LoginVlink. Usa multibanco, sem dialeto próprio.
   */
  /**
   * Quem administra acessos: FLAG_ADMINISTRADOR ou FLAG_DIRETOR da tabela
   * usuarios do VLINK. No Gourmet isso era um cargo em texto (GERENTE/DONO),
   * que aqui não existe.
   *
   * As colunas são char(1) e vêm como texto: "1" para ligado e " " (espaço)
   * para desligado. Por isso a comparação é feita sobre o valor aparado, e
   * não com Number(), que trataria "S" como zero.
   */
  SQL.ehAdministrador = function (linhaUsuario) {
    var u = linhaUsuario || {};
    function ligada(valor) {
      var v = String(valor === undefined || valor === null ? '' : valor).trim().toUpperCase();
      return v === '1' || v === 'S' || v === 'X' || v === 'T' || v === 'TRUE';
    }
    return ligada(u.FLAG_ADMINISTRADOR) || ligada(u.FLAG_DIRETOR);
  };

  SQL.consultarUsuarioPorLogin = async function (login) {
    var cfg = SQL.obterConfiguracao();
    var campoLogin = cfg.Login_Campo_Usuario || 'LOGIN';
    var linhas = await SQL.consultar(cfg.Login_Tabela || 'usuarios', '*');
    var procurado = String(login || '').trim().toUpperCase();
    var achado = linhas.filter(function (linha) {
      return String(linha[campoLogin] || '').trim().toUpperCase() === procurado &&
        Number(linha.FLAG_ATIVO === undefined ? 1 : linha.FLAG_ATIVO) === 1;
    })[0] || null;

    /* O login passa por aqui com a linha inteira em maos. E o momento de
       guardar a FILIAL do operador para o resto do sistema. */
    if (achado) SQL.definirFilialAtiva(SQL.filialDoUsuario(achado));
    return achado;
  };

  // =====================================================================
  // CONTRATOS DE CREDENCIAIS DE API
  // Cada usuário guarda somente as credenciais da API FacilApp SQL usadas
  // pela Balança.
  // =====================================================================

  var CAMPOS_CREDENCIAIS =
    'ID_usuario,CLIENT_ID_SQL,CLIENT_SECRET_SQL,ACCESS_TOKEN_SQL,ACCESS_TOKEN_SQL_EXPIRA';

  /**
   * Credenciais da API SQL para um usuário.
   * @param {number} idUsuario
   * @returns {Promise<{sql:object}|null>}
   */
  SQL.consultarCredenciais = async function (idUsuario) {
    var cfg = SQL.obterConfiguracao();
    var linhas = await SQL.consultar(cfg.Login_Tabela || 'usuarios',
      CAMPOS_CREDENCIAIS, { ID_usuario: Number(idUsuario || 0) });
    var linha = linhas[0];
    if (!linha) return null;
    return {
      sql: {
        clientId: linha.CLIENT_ID_SQL || '',
        clientSecret: linha.CLIENT_SECRET_SQL || '',
        accessToken: linha.ACCESS_TOKEN_SQL || '',
        expiraEm: linha.ACCESS_TOKEN_SQL_EXPIRA || null
      }
    };
  };

  /* Data para gravação nos três bancos.
     MANTENHA O "T": 'AAAA-MM-DDTHH:MM:SS' é ISO 8601 e o SQL Server o lê sem
     ambiguidade. Com espaço no lugar do T, ele interpreta conforme o idioma
     do servidor — aqui isso trocou mês por dia (2026-10-08 virou 2026-08-10).
     SQLite e PostgreSQL aceitam a forma com T do mesmo jeito. */
  function dataISO(segundos) {
    var quando = new Date(Date.now() + (Number(segundos || 0) * 1000));
    return quando.toISOString().slice(0, 19);
  }

  /**
   * Grava as credenciais informadas. Só o que vier no objeto é alterado.
   * @param {number} idUsuario
   * @param {object} credenciais  { sql:{clientId,clientSecret,accessToken,expiraEm} }
   */
  SQL.salvarCredenciais = async function (idUsuario, credenciais) {
    var cfg = SQL.obterConfiguracao();
    var c = credenciais || {};
    var dados = {};

    function juntar(bloco) {
      if (!bloco) return;
      if (bloco.clientId !== undefined) dados.CLIENT_ID_SQL = bloco.clientId;
      if (bloco.clientSecret !== undefined) dados.CLIENT_SECRET_SQL = bloco.clientSecret;
      if (bloco.accessToken !== undefined) dados.ACCESS_TOKEN_SQL = bloco.accessToken;
      if (bloco.expiraEm !== undefined) dados.ACCESS_TOKEN_SQL_EXPIRA = bloco.expiraEm;
    }
    juntar(c.sql);

    if (!Object.keys(dados).length) return false;
    return SQL.alterar(cfg.Login_Tabela || 'usuarios', dados,
      { ID_usuario: Number(idUsuario || 0) });
  };

  /**
   * Guarda o token SQL que o LoginVlink acabou de devolver.
   * @param {number} idUsuario
   * @param {object} retornoLogin  resposta de SQL.login()
   */
  /**
   * Registro completo feito pelo próprio login.
   *
   * Na API SQL, as credenciais seguem o mesmo par usado no login:
   *   login  == client_id
   *   senha  == client_secret
   * (`/oauth/login-simples` autentica com o par do usuário do mesmo jeito
   * que o `LoginVlink` autentica com usuário e senha.)
   *
   * Por isso o login preenche Client ID, Client Secret e access token SQL.
   *
   * @param {number} idUsuario
   * @param {string} login   vira CLIENT_ID_SQL
   * @param {string} senha   vira CLIENT_SECRET_SQL
   * @param {object} retornoLogin  resposta de SQL.login()
   */
  SQL.registrarCredenciaisDoLogin = function (idUsuario, login, senha, retornoLogin) {
    var r = retornoLogin || {};
    var credenciais = {
      sql: {
        clientId: String(login || ''),
        clientSecret: String(senha || '')
      }
    };
    if (r.access_token) {
      credenciais.sql.accessToken = String(r.access_token);
      credenciais.sql.expiraEm = dataISO(r.expires_in);
    }
    return SQL.salvarCredenciais(idUsuario, credenciais);
  };

  SQL.salvarTokensDoLogin = function (idUsuario, retornoLogin) {
    var r = retornoLogin || {};
    var credenciais = {};
    if (r.access_token) {
      credenciais.sql = {
        accessToken: String(r.access_token),
        expiraEm: dataISO(r.expires_in)
      };
    }
    if (!credenciais.sql) return Promise.resolve(false);
    return SQL.salvarCredenciais(idUsuario, credenciais);
  };

  window.SQL = SQL;
})(window);
