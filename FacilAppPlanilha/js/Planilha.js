/* FacilApp Planilha (13/09/2026) — FortuneSheet com todos os recursos
   (fórmulas, formatação, bordas, mesclar, congelar, filtro, classificação,
   formatação condicional, validação, comentários, imagens, links, localizar,
   várias abas) e gravação no estilo do FacilApp Doc:
     Novo / Abrir (.xlsx .xlsm .xls .ods .csv .json) / Gravar como pela janela
     "Salvar como" do Windows (showSaveFilePicker) — qualquer pasta, inclusive G:.
   Tipos do Gravar como: Excel (.xlsx), CSV (.csv) e Planilha FacilApp (.json,
   guarda tudo o que o FortuneSheet tem). Sem alert, sem internet, sem cache de dado. */
'use strict';
(function () {
  const B = window.FacilAppBrowse;
  const X = window.FacilAppPlanilhaExcel;
  const $ = id => document.getElementById(id);
  const h = React.createElement;

  let raiz = null;
  let refPlanilha = React.createRef();
  let versao = 0;
  let abasIniciais = [X.abaVazia('Planilha1')];
  let alterado = false;
  let nomeArquivo = '';
  let montando = false;

  function aviso(texto, titulo) {
    if (B && B.mensagem) return B.mensagem(texto, {titulo: titulo || 'FacilApp Planilha'});
    console.warn(texto);
  }
  async function confirmar(texto, titulo) {
    if (B && B.confirmar) return B.confirmar(texto, {titulo: titulo || 'FacilApp Planilha'});
    return true;
  }
  function status(texto) { $('status').textContent = texto || ''; }
  function titulo() {
    $('arquivoAtual').textContent = (nomeArquivo || 'Planilha nova') + (alterado ? ' •' : '');
  }

  function fechar() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({origem: 'FACILAPP_FECHAR_TELA', tela: 'Planilha'}, '*');
      return;
    }
    window.close();
  }

  /* ------------------------------------------------------------ montar a grade */
  function montar(abas) {
    abasIniciais = abas && abas.length ? abas : [X.abaVazia('Planilha1')];
    abasIniciais.forEach((a, i) => { a.order = i; a.status = i === 0 ? 1 : 0; });
    refPlanilha = React.createRef();
    versao++;
    const Workbook = window.react && window.react.Workbook;
    if (!Workbook) { aviso('FortuneSheet não carregou (dependencias/fortune-sheet-1.0.4).'); return; }
    if (!raiz) raiz = ReactDOM.createRoot($('planilha'));
    montando = true;
    setTimeout(() => { montando = false; }, 800);
    raiz.render(h(Workbook, {
      key: 'planilha-' + versao,
      ref: refPlanilha,
      data: abasIniciais,
      lang: 'pt',
      currency: 'R$',
      allowEdit: true,
      showToolbar: true,
      showFormulaBar: true,
      showSheetTabs: true,
      /* A grade dispara onChange ao montar: só conta como alteração depois disso. */
      onChange: () => { if (!montando && !alterado) { alterado = true; titulo(); } }
    }));
    alterado = false;
    titulo();
  }

  /* As abas atuais, do jeito que estão na tela. */
  function abasAtuais() {
    const inst = refPlanilha.current;
    return inst && inst.getAllSheets ? inst.getAllSheets() : abasIniciais;
  }
  function abaAtiva(abas) {
    return abas.find(a => a.status === 1 || a.status === '1') || abas[0];
  }

  /* ------------------------------------------------------------------- novo */
  async function novo() {
    if (alterado && !(await confirmar('A planilha tem alterações não gravadas.\nDescartar e começar outra?', 'Novo'))) return;
    nomeArquivo = '';
    montar([X.abaVazia('Planilha1')]);
  }

  /* ------------------------------------------------------------------ abrir */
  async function abrirArquivo(arquivo) {
    if (!arquivo) return;
    const nome = arquivo.name || '';
    const ext = (nome.split('.').pop() || '').toLowerCase();
    if (alterado && !(await confirmar('A planilha tem alterações não gravadas.\nDescartar e abrir ' + nome + '?', 'Abrir'))) return;
    try {
      status('Abrindo ' + nome + '...');
      const bytes = await arquivo.arrayBuffer();
      let abas;
      if (ext === 'xlsx' || ext === 'xlsm') abas = await X.lerXlsx(bytes);
      else if (ext === 'xls' || ext === 'ods') abas = X.lerOutros(bytes);
      else if (ext === 'csv' || ext === 'txt') abas = X.lerCsv(new TextDecoder('utf-8').decode(bytes), nome);
      else if (ext === 'json') {
        const obj = JSON.parse(new TextDecoder('utf-8').decode(bytes));
        abas = Array.isArray(obj) ? obj : obj && Array.isArray(obj.abas) ? obj.abas : null;
        if (!abas) throw new Error('O .json não é uma planilha do FacilApp.');
      } else {
        aviso('Formato não suportado: ' + nome + '\nUse .xlsx, .xls, .ods, .csv ou .json.', 'Abrir');
        status('');
        return;
      }
      nomeArquivo = nome;
      montar(abas);
      status('');
    } catch (err) {
      status('');
      aviso('Não foi possível abrir ' + nome + ':\n' + (err.message || err), 'Abrir');
    }
  }

  /* ------------------------------------------------------------ gravar como */
  const TIPOS = {
    xlsx: {description: 'Pasta de Trabalho do Excel (*.xlsx)', accept: {'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']}},
    csv: {description: 'CSV separado por ponto e vírgula (*.csv)', accept: {'text/csv': ['.csv']}},
    json: {description: 'Planilha FacilApp — guarda todos os recursos (*.json)', accept: {'application/json': ['.json']}}
  };

  async function dadosDoArquivo(tipo, abas) {
    if (tipo === 'csv') return X.gerarCsv(abaAtiva(abas));
    if (tipo === 'json') return JSON.stringify({programa: 'FacilApp Planilha', versao: 1, abas: abas});
    return X.gerarXlsx(abas);
  }

  async function gravarComo() {
    /* Sai do modo de edição da célula para o último valor digitado entrar. */
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (typeof window.showSaveFilePicker !== 'function') {
      aviso('Este navegador não abre a janela Salvar como do Windows.\nUse o Chrome ou o Edge.', 'Gravar como');
      return;
    }
    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: (nomeArquivo || 'Planilha').replace(/\.[a-z0-9]{2,5}$/i, '') + '.xlsx',
        types: [TIPOS.xlsx, TIPOS.csv, TIPOS.json]
      });
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      aviso('Não foi possível abrir a janela Salvar como:\n' + (err.message || err), 'Gravar como');
      return;
    }
    const ext = ((handle.name.match(/\.([a-z0-9]+)$/i) || [])[1] || 'xlsx').toLowerCase();
    const tipo = TIPOS[ext] ? ext : 'xlsx';
    try {
      status('Gravando...');
      const dados = await dadosDoArquivo(tipo, abasAtuais());
      const w = await handle.createWritable();
      await w.write(dados);
      await w.close();
      nomeArquivo = handle.name;
      alterado = false;
      titulo();
      status(tipo === 'csv' ? 'CSV grava só a aba ativa, sem formatação' : '');
    } catch (err) {
      status('');
      aviso('Não foi possível gravar a planilha:\n' + (err.message || err), 'Gravar como');
    }
  }

  /* ---------------------------------------------------------------- eventos */
  $('novo').addEventListener('click', novo);
  $('abrir').addEventListener('click', () => { $('arquivo').value = ''; $('arquivo').click(); });
  $('arquivo').addEventListener('change', e => abrirArquivo(e.target.files && e.target.files[0]));
  $('gravarComo').addEventListener('click', gravarComo);
  $('fechar').addEventListener('click', fechar);
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); gravarComo(); }
  });
  /* Arrastar um arquivo do Windows para a planilha também abre. */
  $('planilha').addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  $('planilha').addEventListener('drop', e => {
    const arq = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!arq) return;
    e.preventDefault();
    abrirArquivo(arq);
  });
  if (B && typeof B.habilitarArrasto === 'function') B.habilitarArrasto($('arrasto'), $('janela'));

  montar(abasIniciais);
})();
