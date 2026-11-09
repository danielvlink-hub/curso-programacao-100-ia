/* ==========================================================================
   IAHospedes.js — manifesto do Botão IA da tela BrowseHospedes.html (aula gravada de 08/11/2026).
   Daniel: "ela executa o CRUD, listagens e filtros solicitados".

   O QUE FAZ: diz à IA o que a tela de Hóspedes faz e quais ferramentas ela pode usar. Cada ferramenta chama AS MESMAS
     funções da tela (ApiCurso.*Hospede*, filtrar, exportar, abrirRelatorio). A IA só escolhe a ferramenta e os dados;
     quem grava é a tela, com o login do usuário — a regra de verdade continua na API (Hospedes.cs).
   DEPENDÊNCIAS: ApiCurso.js, BotaoIA.js e as funções globais do BrowseHospedes.html (grade, filtrar, carregar,
     exportarCSV, exportarExcel, abrirRelatorio).
   REGRAS: incluir/alterar/cadastrar por CNPJ mostram o resumo e pedem Confirmar; excluir pede confirmação em vermelho
     (e a API ainda confere a permissão do usuário). Depois de gravar, conferimos na API antes de dizer "feito".
   ========================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var dig = function (v) { return String(v || '').replace(/\D/g, ''); };
  var tipoTxt = function (t) { return t === 'PJ' ? 'Empresa' : 'Pessoa'; };

  /** resumo de um hóspede para a IA (curto, sem campos vazios). */
  function curto(h) {
    var r = { id: h.id_hospede, tipo: tipoTxt(h.tipo), nome: h.nome };
    ['nome_fantasia', 'documento', 'telefone', 'email', 'cidade', 'uf'].forEach(function (c) { if (h[c]) r[c] = h[c]; });
    r.situacao = h.ativo ? 'ativo' : 'inativo';
    return r;
  }

  /** aplica os filtros também NA TELA (a grade mostra o que a IA listou). */
  function filtrarNaTela(p) {
    if (!$('inputFiltro')) return;
    $('inputFiltro').value = p.busca || p.cidade || '';
    $('selTipo').value = p.tipo === 'PJ' || p.tipo === 'PF' ? p.tipo : '';
    $('selSituacao').value = p.situacao === 'ativos' ? '1' : p.situacao === 'inativos' ? '0' : '';
    if (typeof window.filtrar === 'function') window.filtrar();
  }

  /** linhas do resumo de confirmação (só os campos informados). */
  function linhas(p) {
    var rot = { tipo: 'Tipo', nome: 'Nome', nome_fantasia: 'Fantasia', documento: 'CPF/CNPJ', telefone: 'Telefone', email: 'E-mail',
      data_nascimento: 'Nascimento', cep: 'CEP', logradouro: 'Endereço', numero: 'Número', complemento: 'Complemento', bairro: 'Bairro',
      cidade: 'Cidade', uf: 'UF', observacao: 'Observação', ativo: 'Situação' };
    return Object.keys(rot).filter(function (k) { return p[k] !== undefined && p[k] !== null && p[k] !== ''; })
      .map(function (k) { return '• ' + rot[k] + ': ' + (k === 'ativo' ? (p[k] ? 'Ativo' : 'Inativo') : k === 'tipo' ? tipoTxt(p[k]) : p[k]); }).join('\n');
  }

  var CAMPOS = {
    tipo: { type: 'string', enum: ['PF', 'PJ'], description: 'PF = pessoa, PJ = empresa' },
    nome: 'nome completo (pessoa) ou razão social (empresa)',
    nome_fantasia: 'nome fantasia (só empresa)',
    documento: 'CPF ou CNPJ',
    telefone: 'telefone com DDD, ex.: (15) 99700-1234',
    email: 'e-mail',
    data_nascimento: 'nascimento no formato AAAA-MM-DD (só pessoa)',
    cep: 'CEP com 8 números (o endereço pode vir sozinho)',
    logradouro: 'rua/avenida', numero: 'número', complemento: 'complemento', bairro: 'bairro',
    cidade: 'cidade', uf: 'UF com 2 letras', observacao: 'observação',
    ativo: { type: 'boolean', description: 'true = ativo, false = inativo' }
  };

  /** completa o endereço pelo CEP quando a IA só mandou o CEP. */
  async function completarCep(d) {
    if (dig(d.cep).length === 8 && !d.logradouro) {
      try { var c = await ApiCurso.consultarCepHospede(d.cep); d.logradouro = c.endereco || ''; d.bairro = d.bairro || c.bairro || ''; d.cidade = d.cidade || c.cidade || ''; d.uf = d.uf || c.uf || ''; }
      catch (e) { /* sem CEP a gravação segue com o que veio */ }
    }
    return d;
  }

  window.IAHospedes = {
    tela: 'HOSPEDES',
    titulo: 'Hóspedes',
    descricao: 'Cadastro de hóspedes da pousada: pessoas (PF) e empresas (PJ). Você pode pesquisar e filtrar a lista da tela, ' +
      'mostrar um hóspede, cadastrar, alterar (inclusive ativar/inativar), excluir, cadastrar empresa só pelo CNPJ, exportar e abrir o relatório.',
    regras: 'Para alterar ou excluir, primeiro use listar_hospedes para achar o id certo; se houver mais de um com o mesmo nome, pergunte qual. ' +
      'Pessoa precisa de nome e telefone com DDD; empresa precisa de razão social (ou use cadastrar_empresa_cnpj quando o usuário der o CNPJ). ' +
      'Prefira inativar a excluir quando o usuário parecer em dúvida.',
    saudacao: 'Posso pesquisar, filtrar, cadastrar, alterar, excluir e cadastrar empresa pelo CNPJ — e também conversar, ver a previsão do tempo e pesquisar na internet.',
    exemplo: 'Ex.: "mostra só as empresas de SP", "cadastra a Ana Lima, telefone 15 99123-4567, de Sorocaba", "inativa o João".',

    ferramentas: {
      listar_hospedes: {
        descricao: 'Pesquisa hóspedes e APLICA o filtro na lista da tela. Não grava. Use também para achar o id antes de alterar/excluir.',
        parametros: { busca: 'parte do nome, fantasia, documento ou telefone', tipo: { type: 'string', enum: ['PF', 'PJ', ''], description: 'PF pessoas, PJ empresas, vazio todos' },
          situacao: { type: 'string', enum: ['ativos', 'inativos', 'todos'], description: 'situação' }, cidade: 'cidade', uf: 'UF' },
        grava: false,
        executar: async function (p) {
          var lista = await ApiCurso.listarHospedes({ busca: p.busca, tipo: p.tipo, ativo: p.situacao === 'ativos' ? 1 : p.situacao === 'inativos' ? 0 : '', cidade: p.cidade, uf: p.uf });
          filtrarNaTela(p);
          return { total: lista.length, mostrando: Math.min(lista.length, 30), hospedes: lista.slice(0, 30).map(curto) };
        }
      },
      limpar_filtros: {
        descricao: 'Tira todos os filtros da lista da tela. Não grava.', parametros: {}, grava: false,
        executar: async function () { filtrarNaTela({}); return 'Filtros limpos: a tela mostra todos os hóspedes.'; }
      },
      obter_hospede: {
        descricao: 'Mostra todos os dados de um hóspede pelo id. Não grava.', parametros: { id: { type: 'integer', description: 'id do hóspede' } },
        obrigatorios: ['id'], grava: false,
        executar: async function (p) { return await ApiCurso.obterHospede(p.id); }
      },
      incluir_hospede: {
        descricao: 'Cadastra UM hóspede (pessoa ou empresa). Obrigatórios: tipo e nome; pessoa também telefone com DDD.',
        parametros: CAMPOS, obrigatorios: ['tipo', 'nome'], grava: true,
        validar: function (p) {
          if (!p.nome || String(p.nome).trim().length < 3) return p.tipo === 'PJ' ? 'Qual a razão social da empresa?' : 'Qual o nome completo do hóspede?';
          if (p.tipo !== 'PJ' && dig(p.telefone).length < 10) return 'Qual o telefone do hóspede, com DDD?';
          return '';
        },
        resumo: function (p) { return 'Cadastrar ' + tipoTxt(p.tipo).toLowerCase() + ':\n' + linhas(p); },
        executar: async function (p) {
          var d = await completarCep(Object.assign({ ativo: true }, p));
          var id = await ApiCurso.incluirHospede(d);
          var h = await ApiCurso.obterHospede(id);                 // confere na API antes de dizer "cadastrado"
          if (typeof window.carregar === 'function') await window.carregar(id);
          return 'Cadastrado com sucesso: ' + JSON.stringify(curto(h));
        }
      },
      alterar_hospede: {
        descricao: 'Altera UM hóspede pelo id. Mande só os campos que mudam (ex.: { id: 3, ativo: false } para inativar).',
        parametros: Object.assign({ id: { type: 'integer', description: 'id do hóspede (use listar_hospedes antes)' } }, CAMPOS),
        obrigatorios: ['id'], grava: true,
        validar: function (p) { return p.id ? '' : 'Qual hóspede? (não achei o id)'; },
        resumo: function (p) { var c = Object.assign({}, p); delete c.id; return 'Alterar o hóspede nº ' + p.id + ':\n' + linhas(c); },
        executar: async function (p) {
          var atual = await ApiCurso.obterHospede(p.id), mudar = Object.assign({}, p); delete mudar.id;
          var d = await completarCep(Object.assign({}, atual, mudar));
          await ApiCurso.alterarHospede(p.id, d);
          var h = await ApiCurso.obterHospede(p.id);
          if (typeof window.carregar === 'function') await window.carregar(p.id);
          return 'Alterado com sucesso: ' + JSON.stringify(curto(h));
        }
      },
      excluir_hospede: {
        descricao: 'EXCLUI UM hóspede pelo id. A API recusa hóspede com reserva ou usuário sem permissão.',
        parametros: { id: { type: 'integer', description: 'id do hóspede' }, nome: 'nome do hóspede (para o resumo)' },
        obrigatorios: ['id'], grava: true, exclui: true,
        resumo: function (p) { return 'EXCLUIR o hóspede nº ' + p.id + (p.nome ? ' — ' + p.nome : '') + '?\nIsso não pode ser desfeito.'; },
        executar: async function (p) {
          await ApiCurso.excluirHospede(p.id);
          if (typeof window.carregar === 'function') await window.carregar();
          return 'Hóspede nº ' + p.id + ' excluído.';
        }
      },
      cadastrar_empresa_cnpj: {
        descricao: 'Cadastra uma EMPRESA só pelo CNPJ: o sistema busca os dados na Receita e grava sozinho.',
        parametros: { cnpj: 'CNPJ com 14 números' }, obrigatorios: ['cnpj'], grava: true,
        validar: function (p) { return dig(p.cnpj).length === 14 ? '' : 'Qual o CNPJ da empresa (14 números)?'; },
        resumo: function (p) { return 'Cadastrar a empresa do CNPJ ' + p.cnpj + ' com os dados da Receita?'; },
        executar: async function (p) {
          var h = await ApiCurso.cadastrarEmpresaPorCnpj(p.cnpj);
          if (typeof window.carregar === 'function') await window.carregar(h && h.id_hospede);
          return 'Empresa cadastrada: ' + JSON.stringify(curto(h));
        }
      },
      exportar_lista: {
        descricao: 'Baixa a lista da tela, do jeito que está filtrada, em XLSX (Excel) ou CSV.',
        parametros: { formato: { type: 'string', enum: ['xlsx', 'csv'], description: 'formato do arquivo' } }, obrigatorios: ['formato'], grava: false,
        executar: async function (p) { if (p.formato === 'csv') window.exportarCSV(); else window.exportarExcel(); return 'Arquivo ' + p.formato.toUpperCase() + ' baixado.'; }
      },
      abrir_relatorio: {
        descricao: 'Abre o relatório "Relação de Hóspedes" (PDF).', parametros: {}, grava: false,
        executar: async function () { setTimeout(function () { window.abrirRelatorio(); }, 800); return 'Abrindo o relatório.'; }
      }
    }
  };
})();
