/*
  DADOS_DEMO — camada de dados de DEMONSTRAÇÃO dos modelos (modelo_browse.html + modelo_browse_update.html).
  Daniel, 08/11/2026: modelos de browse/update para os alunos copiarem.
  O QUE FAZ: guarda uma lista de hóspedes no localStorage do navegador, para o modelo funcionar sem a API.
  COMO TROCAR PELA API: cada função tem a mesma forma de uma chamada da FacilApp API SQL (async, devolve dados ou
    lança Error com a mensagem). Na tela real, crie no ApiCurso.js listarHospedes/obterHospede/incluirHospede/
    alterarHospede/excluirHospede (GET/POST/PUT/DELETE /api/hospedes) e troque DADOS_DEMO.x por ApiCurso.x.
  CUIDADOS: é só exemplo — nada aqui vai para o banco. Limpar: localStorage.removeItem('fastpousada_modelo_hospedes').
*/
window.DADOS_DEMO = (function () {
  var CHAVE = 'fastpousada_modelo_hospedes';
  var INICIAIS = [
    { id: '1', nome: 'Maria da Silva', documento: '123.456.789-09', telefone: '(15) 99700-1234', email: 'maria@email.com', cidade: 'Sorocaba', uf: 'SP', observacao: 'Prefere quarto no térreo', ativo: true },
    { id: '2', nome: 'João Pereira', documento: '987.654.321-00', telefone: '(11) 98888-2222', email: '', cidade: 'São Paulo', uf: 'SP', observacao: '', ativo: true },
    { id: '3', nome: 'Ana Souza', documento: '', telefone: '(19) 97777-3333', email: 'ana.souza@email.com', cidade: 'Campinas', uf: 'SP', observacao: 'Viaja com pet', ativo: false }
  ];
  function ler() {
    try { var t = localStorage.getItem(CHAVE); if (t) return JSON.parse(t); } catch (e) {}
    gravar(INICIAIS); return INICIAIS.slice();
  }
  function gravar(lista) { try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch (e) { throw new Error('Não foi possível gravar no navegador.'); } }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  return {
    listar: async function () { return copia(ler()); },
    obter: async function (id) { var h = ler().find(function (x) { return x.id === String(id); }); return h ? copia(h) : null; },
    incluir: async function (d) {
      var lista = ler();
      if (d.documento && lista.some(function (x) { return x.documento === d.documento; })) throw new Error('Já existe hóspede com esse documento.');
      var novo = Object.assign({}, d, { id: String(Date.now()) }); lista.push(novo); gravar(lista); return novo.id;
    },
    alterar: async function (id, d) {
      var lista = ler(), i = lista.findIndex(function (x) { return x.id === String(id); });
      if (i < 0) throw new Error('Hóspede não encontrado.');
      if (d.documento && lista.some(function (x) { return x.documento === d.documento && x.id !== String(id); })) throw new Error('Já existe hóspede com esse documento.');
      lista[i] = Object.assign({}, lista[i], d, { id: String(id) }); gravar(lista);
    },
    excluir: async function (id) { gravar(ler().filter(function (x) { return x.id !== String(id); })); }
  };
})();
