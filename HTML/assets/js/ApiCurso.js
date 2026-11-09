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
 *   - Endereço da API: localhost/127.0.0.1 ou o IP do PC na rede local, sempre com porta (mesma regra do login).
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
  // endereço padrão: o do config.js do EXE (FASTPOUSADA_CONFIG.api, fica FORA do exe e o exe injeta em toda tela) ou o PC
  var API_PADRAO = (window.FASTPOUSADA_CONFIG && window.FASTPOUSADA_CONFIG.api) || 'http://127.0.0.1:7777';

  function ler(chave) { try { return sessionStorage.getItem(chave) || ''; } catch (e) { return ''; } }

  /** Endereço da API desta sessão (sem barra no fim). */
  function base() {
    var url = (ler(CHAVE_API) || API_PADRAO).replace(/\/+$/, '');
    // localhost ou IP da rede local (10.x, 172.16–31.x, 192.168.x) — o APK no celular usa o IP do PC (Bloco APK, 08/11/2026)
    return /^http:\/\/(127\.0\.0\.1|localhost|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}):\d+$/.test(url) ? url : API_PADRAO;
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
      // o erro leva o status e a resposta: ex. 409 com confirmar=true (check-in em quarto sujo) para a tela perguntar
      var falha = new Error((dados && dados.erro) || ('A API respondeu ' + resposta.status + ' em ' + rota));
      falha.status = resposta.status;
      falha.dados = dados;
      throw falha;
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
    salvarPermissoesDoUsuario: async function (id, lista) { return (await chamar('PUT', '/api/menu/usuarios/' + encodeURIComponent(id), lista)).gravadas; },

    // ------------------------------------------------------------- hóspedes (aula de 08/11/2026 — Hospedes.cs na API)
    /**
     * listarHospedes(filtros) — lista de hóspedes. filtros (todos opcionais): { busca, ativo: 1|0, tipo: 'PF'|'PJ', cidade, uf }.
     * SAÍDA: array de hóspedes ({ id_hospede, tipo, nome, nome_fantasia, documento, telefone, email, cidade, uf, ativo, ... }).
     */
    listarHospedes: async function (filtros) {
      var f = filtros || {}, q = [];
      ['busca', 'ativo', 'tipo', 'cidade', 'uf'].forEach(function (k) {
        if (f[k] !== undefined && f[k] !== null && String(f[k]) !== '') q.push(k + '=' + encodeURIComponent(f[k]));
      });
      return (await chamar('GET', '/api/hospedes' + (q.length ? '?' + q.join('&') : ''))).dados || [];
    },
    /** obterHospede(id) — um hóspede (lança erro "Hóspede não encontrado." quando não existe). */
    obterHospede: async function (id) { return (await chamar('GET', '/api/hospedes/' + encodeURIComponent(id))).dados; },
    /** incluirHospede(dados) — devolve o id criado. A API valida (nome, telefone, documento repetido, e-mail, UF). */
    incluirHospede: async function (dados) { return (await chamar('POST', '/api/hospedes', dados)).id_hospede; },
    /** alterarHospede(id, dados) — grava a alteração (mesmas regras da inclusão). */
    alterarHospede: async function (id, dados) { return chamar('PUT', '/api/hospedes/' + encodeURIComponent(id), dados); },
    /** excluirHospede(id) — exclui; hóspede com reserva é recusado ("inative em vez de excluir"). */
    excluirHospede: async function (id) { return chamar('DELETE', '/api/hospedes/' + encodeURIComponent(id)); },
    /** cadastrarEmpresaPorCnpj(cnpj) — a API busca os dados públicos do CNPJ e cadastra a empresa. Devolve o hóspede criado. */
    cadastrarEmpresaPorCnpj: async function (cnpj) { return (await chamar('POST', '/api/hospedes/empresa-por-cnpj', { cnpj: cnpj })).dados; },
    /** consultarCepHospede(cep) — { cep, uf, cidade, bairro, endereco } para preencher o endereço. Não grava. */
    consultarCepHospede: async function (cep) { return (await chamar('GET', '/api/hospedes/cep/' + encodeURIComponent(String(cep).replace(/\D/g, '')))).dados; },

    // ------------------------------------------------------------- cadastros do Bloco 1 (Cadastros.cs na API)
    // Daniel, 08/11/2026: "gere todas as telas faltantes". recurso = rota da ficha: 'tipos-quarto', 'quartos', 'tarifas',
    // 'servicos-produtos', 'formas-pagamento'. As regras (obrigatórios, repetidos, em uso) ficam na API.

    /** cadastroListar(recurso, filtros) — lista; filtros opcionais { busca, ativo: 1|0, <campo>: valor }. */
    cadastroListar: async function (recurso, filtros) {
      var f = filtros || {}, q = [];
      Object.keys(f).forEach(function (k) {
        if (f[k] !== undefined && f[k] !== null && String(f[k]) !== '') q.push(encodeURIComponent(k) + '=' + encodeURIComponent(f[k]));
      });
      return (await chamar('GET', '/api/' + recurso + (q.length ? '?' + q.join('&') : ''))).dados || [];
    },
    /** cadastroObter(recurso, id) — um registro (erro "não encontrado" quando não existe). */
    cadastroObter: async function (recurso, id) { return (await chamar('GET', '/api/' + recurso + '/' + encodeURIComponent(id))).dados; },
    /** cadastroIncluir(recurso, dados) — devolve o id criado. */
    cadastroIncluir: async function (recurso, dados) { return (await chamar('POST', '/api/' + recurso, dados)).id; },
    /** cadastroAlterar(recurso, id, dados) — grava a alteração (mesmas regras da inclusão). */
    cadastroAlterar: async function (recurso, id, dados) { return chamar('PUT', '/api/' + recurso + '/' + encodeURIComponent(id), dados); },
    /** cadastroExcluir(recurso, id) — exclui; registro em uso é recusado ("inative em vez de excluir"). */
    cadastroExcluir: async function (recurso, id) { return chamar('DELETE', '/api/' + recurso + '/' + encodeURIComponent(id)); },
    /** gerarQuartosEmLote(de, ate, idTipo, andar) — { criados, ja_existiam }. */
    gerarQuartosEmLote: async function (de, ate, idTipo, andar) {
      return chamar('POST', '/api/quartos/lote', { de: Number(de), ate: Number(ate), id_tipo: Number(idTipo), andar: andar || '' });
    },
    /** calcularDiarias(idTipo, entrada, saida) — { noites, total, minimo_noites, atende_minimo, dias:[{data, valor, tarifa}] }. */
    calcularDiarias: async function (idTipo, entrada, saida) {
      return (await chamar('GET', '/api/tarifas/calcular?id_tipo=' + encodeURIComponent(idTipo) + '&entrada=' + encodeURIComponent(entrada) +
        '&saida=' + encodeURIComponent(saida))).dados;
    },

    // ------------------------------------------------------------- reservas e mapa (Bloco 2 — Reservas.cs na API)
    // Daniel, 08/11/2026: "as reservas devem ser sofisticadas, agendas de arrastar". A lista usa cadastroListar('reservas').
    /**
     * reservaGravar(id, dados) — inclui (id vazio) ou altera. SAÍDA: { id, codigo?, avisos[] } — avisos não impedem
     * (ex.: mínimo de noites da tarifa). Erro = regra da API (conflito, capacidade, hóspede inativo...).
     */
    reservaGravar: async function (id, dados) {
      return id ? chamar('PUT', '/api/reservas/' + encodeURIComponent(id), dados) : chamar('POST', '/api/reservas', dados);
    },
    /** reservaDisponibilidade(entrada, saida, adultos, criancas, ignorarId) — { noites, quartos:[{numero, tipo, total, ...}] } livres. */
    reservaDisponibilidade: async function (entrada, saida, adultos, criancas, ignorarId) {
      return (await chamar('GET', '/api/reservas/disponibilidade?entrada=' + encodeURIComponent(entrada) + '&saida=' + encodeURIComponent(saida) +
        '&adultos=' + (Number(adultos) || 1) + '&criancas=' + (Number(criancas) || 0) + (ignorarId ? '&ignorar=' + encodeURIComponent(ignorarId) : ''))).dados;
    },
    /** reservaMover(id, idQuarto, entrada, saida) — arrastar no mapa; recalcula o total. SAÍDA: { valor_total, avisos }. */
    reservaMover: async function (id, idQuarto, entrada, saida) {
      return chamar('PUT', '/api/reservas/' + encodeURIComponent(id) + '/mover', { id_quarto: idQuarto, entrada: entrada, saida: saida });
    },
    /** reservaCancelar(id, motivo) — motivo obrigatório. */
    reservaCancelar: async function (id, motivo) { return chamar('POST', '/api/reservas/' + encodeURIComponent(id) + '/cancelar', { motivo: motivo }); },
    /** reservaNoShow(id) — o hóspede não veio (só a partir do dia da entrada). */
    reservaNoShow: async function (id) { return chamar('POST', '/api/reservas/' + encodeURIComponent(id) + '/no-show'); },
    /** mapa(de, dias) — { de, dias, quartos[], reservas[], ocupacao:[{data, ocupados, total, pct}] } numa chamada. */
    mapa: async function (de, dias) { return chamar('GET', '/api/mapa?de=' + encodeURIComponent(de) + '&dias=' + (Number(dias) || 14)); },

    // ------------------------------------------------------------- operação do dia (Bloco 3 — Operacao.cs na API)
    /** operacaoHoje() — { hoje, chegadas[], atrasadas[], saidas[], hospedados[], quartos_sujos[], total_quartos }. */
    operacaoHoje: async function () { return chamar('GET', '/api/operacao/hoje'); },
    /**
     * fazerCheckin(id, forcar, observacao) — a reserva vira HOSPEDADO. Quarto sujo/manutenção: a API responde 409 com
     * confirmar=true; aí a tela pergunta e chama de novo com forcar=true.
     */
    fazerCheckin: async function (id, forcar, observacao) {
      return chamar('POST', '/api/reservas/' + encodeURIComponent(id) + '/checkin', { forcar: !!forcar, observacao: observacao || '' });
    },
    /** contaHospede(id) — { reserva, diarias, consumos[], recebimentos[], total_consumos, total_recebido, sinal_pago_antes, total, saldo }. */
    contaHospede: async function (id) { return (await chamar('GET', '/api/reservas/' + encodeURIComponent(id) + '/conta')).dados; },
    /** lancarConsumo(id, idItem, quantidade, valorUnitario) — preço vazio = o do cadastro. SAÍDA: { total, saldo }. */
    lancarConsumo: async function (id, idItem, quantidade, valorUnitario) {
      return chamar('POST', '/api/reservas/' + encodeURIComponent(id) + '/consumos',
        { id_item: Number(idItem), quantidade: Number(quantidade) || 1, valor_unitario: valorUnitario == null || valorUnitario === '' ? null : Number(valorUnitario) });
    },
    /** estornarConsumo(idConsumo, motivo) — marca como estornado (nada é apagado). */
    estornarConsumo: async function (id, motivo) { return chamar('POST', '/api/consumos/' + encodeURIComponent(id) + '/estornar', { motivo: motivo }); },
    /** receber(id, idForma, valor, observacao) — recebimento na conta (não passa do saldo). SAÍDA: { saldo }. */
    receber: async function (id, idForma, valor, observacao) {
      return chamar('POST', '/api/reservas/' + encodeURIComponent(id) + '/recebimentos', { id_forma: Number(idForma), valor: Number(valor), observacao: observacao || '' });
    },
    /** estornarRecebimento(idRecebimento, motivo) — marca como estornado. */
    estornarRecebimento: async function (id, motivo) { return chamar('POST', '/api/recebimentos/' + encodeURIComponent(id) + '/estornar', { motivo: motivo }); },
    /** fazerCheckout(id) — só com saldo zero; reserva ENCERRADA e quarto SUJO. SAÍDA: { mensagem, avisos }. */
    fazerCheckout: async function (id) { return chamar('POST', '/api/reservas/' + encodeURIComponent(id) + '/checkout'); },

    // ------------------------------------------------------------- caixa e recebimentos (Bloco 4 — Caixa.cs na API)
    /**
     * caixaAtual() — o caixa do usuário logado: { aberto, usuario, dados } — dados = { caixa, por_forma[], total_recebido,
     * recebido_dinheiro, suprimentos, sangrias, esperado_dinheiro, movimentos[], recebimentos[] } (null se fechado).
     */
    caixaAtual: async function () { return chamar('GET', '/api/caixa/atual'); },
    /** abrirCaixa(saldoInicial) — abre o caixa do usuário com o troco inicial. */
    abrirCaixa: async function (saldoInicial) { return chamar('POST', '/api/caixa/abrir', { saldo_inicial: Number(saldoInicial) || 0 }); },
    /** movimentoCaixa(tipo, valor, motivo) — 'SUPRIMENTO' (entra dinheiro) ou 'SANGRIA' (sai dinheiro), com motivo. */
    movimentoCaixa: async function (tipo, valor, motivo) { return chamar('POST', '/api/caixa/movimentos', { tipo: tipo, valor: Number(valor), motivo: motivo }); },
    /** fecharCaixa(contado, observacao) — fecha conferindo o dinheiro. SAÍDA: { esperado, informado, diferenca, mensagem }. */
    fecharCaixa: async function (contado, observacao) { return chamar('POST', '/api/caixa/fechar', { saldo_informado: Number(contado), observacao: observacao || '' }); },
    /** caixas(de, ate) — histórico de caixas (o administrador vê todos). */
    caixas: async function (de, ate) { return (await chamar('GET', '/api/caixas?de=' + encodeURIComponent(de || '') + '&ate=' + encodeURIComponent(ate || ''))).dados; },
    /** caixa(id) — o resumo de um caixa (mesmo formato do caixaAtual().dados). */
    caixa: async function (id) { return (await chamar('GET', '/api/caixas/' + encodeURIComponent(id))).dados; },
    /** recebimentos(filtros) — { de, ate, id_forma, busca, situacao: ATIVO|ESTORNADO } → lista de recebimentos. */
    recebimentos: async function (filtros) {
      var f = filtros || {}, q = [];
      Object.keys(f).forEach(function (k) { if (f[k] !== undefined && f[k] !== null && String(f[k]) !== '') q.push(encodeURIComponent(k) + '=' + encodeURIComponent(f[k])); });
      return (await chamar('GET', '/api/recebimentos' + (q.length ? '?' + q.join('&') : ''))).dados;
    },

    // ------------------------------------------------------------- gestão (Bloco 5 — Gestao.cs na API)
    /** configuracoes() — { nome_pousada, documento, ..., horario_checkin, horario_checkout, sinal_percentual, ... }. */
    configuracoes: async function () { return (await chamar('GET', '/api/configuracoes')).dados; },
    /** salvarConfiguracoes(valores) — só administrador; grava as chaves enviadas e devolve todas. */
    salvarConfiguracoes: async function (valores) { return (await chamar('PUT', '/api/configuracoes', valores)).dados; },
    /** relatorioOcupacao(de, ate, idTipo) — { dias[{data, disponiveis, ocupados, taxa, receita, adr, revpar}], totais }. */
    relatorioOcupacao: async function (de, ate, idTipo) {
      return (await chamar('GET', '/api/relatorios/ocupacao?de=' + de + '&ate=' + ate + (idTipo ? '&id_tipo=' + encodeURIComponent(idTipo) : ''))).dados;
    },
    /** relatorioFaturamento(de, ate) — { totais, dias[], por_tipo[], por_categoria[], por_forma[] }. */
    relatorioFaturamento: async function (de, ate) { return (await chamar('GET', '/api/relatorios/faturamento?de=' + de + '&ate=' + ate)).dados; },
    /** painel() — o dia de hoje numa chamada (chegadas, saídas, quartos, próximos 7 dias, recebido hoje, caixa). */
    painel: async function () { return chamar('GET', '/api/painel'); },
    /** liberarQuarto(id) — quarto SUJO limpo → LIVRE (governança). */
    liberarQuarto: async function (id) { return chamar('POST', '/api/quartos/' + encodeURIComponent(id) + '/liberar'); },

    // ------------------------------------------------------------- IA (aula de 08/11/2026 — IA.cs na API)
    // A chave da OpenAI fica SÓ na API (criptografada). Estas funções nunca recebem a chave de volta.
    /** iaStatus() — { configurada, modelo }: liga ou desliga o botão IA. */
    iaStatus: async function () { return chamar('GET', '/api/ia/status'); },
    /** iaConfig() — { configurada, modelo, final } (final = 4 últimos dígitos da chave). Só administrador. */
    iaConfig: async function () { return chamar('GET', '/api/ia/config'); },
    /**
     * salvarIaConfig(chave, modelo, nome, modeloVoz, voz) — grava a configuração da IA. Só administrador.
     * REGRAS: campo vazio mantém o valor gravado (a chave principalmente: ela nunca volta para a tela).
     */
    salvarIaConfig: async function (chave, modelo, nome, modeloVoz, voz) {
      return chamar('PUT', '/api/ia/config', {
        chave: chave || '',
        modelo: modelo,
        nome: nome || '',
        modelo_voz: modeloVoz || '',
        voz: voz || ''
      });
    },
    /** apagarIaConfig() — remove a chave. Só administrador. */
    apagarIaConfig: async function () { return chamar('DELETE', '/api/ia/config'); },
    /** testarIa(chave) — { modelos (texto), modelos_voz } liberados para a chave (vazia = a gravada). Só administrador. */
    testarIa: async function (chave) { return chamar('POST', '/api/ia/testar', { chave: chave || '' }); },
    /**
     * vozConectar(sdp, tela) — Botão VOZ: manda a proposta de áudio (SDP) do navegador para a API, que abre a conversa
     * na OpenAI com a chave do servidor e devolve a resposta (SDP). A chave nunca passa pelo navegador.
     * SAÍDA: { sdp, nome }.
     */
    vozConectar: async function (sdp, tela) { return chamar('POST', '/api/ia/voz/conectar', { sdp: sdp, tela: tela || '' }); },
    /** iaConversar(mensagens, ferramentas) — uma rodada da conversa; devolve a mensagem da IA { content, tool_calls }. */
    iaConversar: async function (mensagens, ferramentas) { return (await chamar('POST', '/api/ia/chat', { mensagens: mensagens, ferramentas: ferramentas || [] })).mensagem; },
    /** previsaoTempo(cidade, dias) — previsão diária (Open-Meteo, até 7 dias), ferramenta geral da IA. Só consulta. */
    /** pesquisarInternet(pergunta) — { resposta, fontes:[{titulo,url}] } pela pesquisa na web da OpenAI. Só consulta. */
    pesquisarInternet: async function (pergunta) { return (await chamar('POST', '/api/ia/pesquisar', { pergunta: pergunta })).dados; },
    previsaoTempo: async function (cidade, dias) { return (await chamar('GET', '/api/ia/tempo?cidade=' + encodeURIComponent(cidade || '') + '&dias=' + (Number(dias) || 3))).dados; }
  };
})();
