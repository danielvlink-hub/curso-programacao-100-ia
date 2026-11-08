/*
 * ApiCurso.js — camada central de acesso à API do curso (porta 7777)
 * ===========================================================================
 * Daniel, 03/11/2026: "deve pegar o menu do Gourmet e adaptar para o curso" / "temos de usar a API 7777 para criar o
 * cadastro de menus igual está no SQL".
 *
 * O QUE FAZ
 *   É o "SQL.js" do FastPousada: o ÚNICO lugar que sabe o endereço da API, guarda a sessão da aba e chama as rotas.
 *   Nenhuma tela faz fetch direto na API — chama ApiCurso.*.
 *
 * COMO FAZ
 *   - Sessão na aba (sessionStorage), gravada pelo login_Geral.html: fastpousada_api_url, fastpousada_token,
 *     fastpousada_usuario (JSON do /auth/me). Nada em localStorage: fechou a aba, acabou a sessão.
 *   - Toda chamada leva "Authorization: Bearer <token>". Resposta 401 = token vencido (1 h) ou usuário desativado:
 *     limpa a sessão e manda para o login (na janela de cima, mesmo se a tela estiver no palco).
 *   - Respostas da API seguem { ok, dados | erro }. Erro vira exceção com a mensagem da API, para a tela mostrar.
 *
 * ENTRADAS / SAÍDAS — ver cada função abaixo.
 *
 * DEPENDÊNCIAS
 *   API FACILAPP SQLite (C:\CURSO\API FACILAPP SQLite), rotas /auth/*, /api/menu*, /users*. A API só aceita chamadas de
 *   telas abertas do disco (Origin null) nessas rotas.
 *
 * REGRAS
 *   - Endereço da API só localhost/127.0.0.1 com porta (mesma regra do login).
 *   - Nunca guardar senha. O token não vai para log nem para a tela.
 *
 * CUIDADOS
 *   Telas dentro do palco (iframe) usam a mesma sessão: em file:// o sessionStorage é o mesmo da aba.
 */
(function () {
  'use strict';

  var CHAVE_API = 'fastpousada_api_url';
  var CHAVE_TOKEN = 'fastpousada_token';
  var CHAVE_USUARIO = 'fastpousada_usuario';
  var API_PADRAO = 'http://127.0.0.1:7777';

  function ler(chave) { try { return sessionStorage.getItem(chave) || ''; } catch (e) { return ''; } }

  /** Endereço da API desta sessão (sem barra no fim). */
  function base() {
    var url = (ler(CHAVE_API) || API_PADRAO).replace(/\/+$/, '');
    return /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url) ? url : API_PADRAO;
  }

  /** Token da sessão ('' quando não há login). */
  function token() { return ler(CHAVE_TOKEN); }

  /** Usuário logado: { id, nome, login, administrador } ou null. */
  function usuario() {
    try { var u = JSON.parse(ler(CHAVE_USUARIO) || 'null'); return u && typeof u === 'object' ? u : null; } catch (e) { return null; }
  }

  /**
   * sair(motivo) — encerra a sessão da aba e abre o login.
   * EFEITOS: apaga as 3 chaves da sessão; navega a janela de cima para login_Geral.html.
   */
  function sair(motivo) {
    try { sessionStorage.removeItem(CHAVE_TOKEN); sessionStorage.removeItem(CHAVE_USUARIO); } catch (e) {}
    var destino = 'login_Geral.html' + (motivo ? '?motivo=' + encodeURIComponent(motivo) : '');
    try {
      if (window.top !== window && window.top.ApiCurso) { window.top.ApiCurso.sair(motivo); return; }
    } catch (e) { /* janela de cima de outra origem: navega esta mesma */ }
    window.location.replace(caminhoRaiz() + destino);
  }

  // Telas em subpastas (ex.: DASHBOARDS/) precisam voltar à raiz do HTML para achar o login.
  function caminhoRaiz() {
    var p = String(window.location.pathname || '');
    return /\/DASHBOARDS\//i.test(p) ? '../' : '';
  }

  /**
   * chamar(metodo, rota, corpo) — chamada genérica com Bearer.
   * ENTRADAS: metodo 'GET'|'POST'|'PUT'|'DELETE'; rota começando com '/'; corpo (objeto/array) opcional.
   * SAÍDAS: Promise com o JSON da API. Lança Error(mensagem da API) quando ok=false ou status de erro.
   * EFEITOS: 401 encerra a sessão (sair).
   */
  async function chamar(metodo, rota, corpo) {
    var t = token();
    if (!t) { sair('sessao'); throw new Error('Sessão encerrada. Faça o login.'); }
    var opcoes = { method: metodo, headers: { Authorization: 'Bearer ' + t } };
    if (corpo !== undefined && corpo !== null) {
      opcoes.headers['Content-Type'] = 'application/json';
      opcoes.body = JSON.stringify(corpo);
    }
    var resposta;
    try { resposta = await fetch(base() + rota, opcoes); }
    catch (e) { throw new Error('A API do curso não respondeu em ' + base() + '. Verifique se o serviço FacilAppCursoSqlite está rodando.'); }
    if (resposta.status === 401) { sair('sessao'); throw new Error('Sessão expirada. Faça o login de novo.'); }
    var dados = null;
    try { dados = await resposta.json(); } catch (e) { dados = null; }
    if (!resposta.ok || !dados || dados.ok === false) {
      throw new Error((dados && dados.erro) || ('A API respondeu ' + resposta.status + ' em ' + rota));
    }
    return dados;
  }

  window.ApiCurso = {
    base: base,
    token: token,
    usuario: usuario,
    sair: sair,
    chamar: chamar,
    /** Administrador = equivalente a Dono/Gerente do Gourmet (vê Configurações, Acessos e Usuários). */
    ehAdministrador: function () { var u = usuario(); return !!(u && u.administrador); },

    // ------------------------------------------------------------- menu
    /** Menu do usuário logado: { lateral:[módulos com submenu], superior:[...], dashboards:[...] }. */
    menu: async function () { return (await chamar('GET', '/api/menu')).dados; },
    /** Exceções do próprio usuário (incluir/alterar/excluir por id_item). */
    minhasPermissoes: async function () { return (await chamar('GET', '/api/menu/minhas-permissoes')).dados || []; },

    // ------------------------------------------------------------- catálogo (tela Acessos, só administrador)
    listarCatalogo: async function () { return (await chamar('GET', '/api/menu/catalogo')).dados || []; },
    incluirItemMenu: async function (item) { return (await chamar('POST', '/api/menu/catalogo', item)).id_item; },
    alterarItemMenu: async function (id, item) { return chamar('PUT', '/api/menu/catalogo/' + encodeURIComponent(id), item); },
    excluirItemMenu: async function (id) { return chamar('DELETE', '/api/menu/catalogo/' + encodeURIComponent(id)); },

    // ------------------------------------------------------------- usuários (tela Usuários, só administrador)
    listarUsuarios: async function () { return (await chamar('GET', '/users')).usuarios || []; },
    incluirUsuario: async function (u) { return chamar('POST', '/users', u); },
    alterarUsuario: async function (id, u) { return chamar('PUT', '/users/' + encodeURIComponent(id), u); },
    excluirUsuario: async function (id) { return chamar('DELETE', '/users/' + encodeURIComponent(id)); },
    permissoesDoUsuario: async function (id) { return (await chamar('GET', '/api/menu/usuarios/' + encodeURIComponent(id))).dados || []; },
    salvarPermissoesDoUsuario: async function (id, lista) { return (await chamar('PUT', '/api/menu/usuarios/' + encodeURIComponent(id), lista)).gravadas; }
  };
})();
