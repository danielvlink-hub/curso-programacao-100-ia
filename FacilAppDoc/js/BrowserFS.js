/**
 * browser-fs-access — Biblioteca do Google Chrome Labs (Standalone Bundle)
 * Acesso ao Sistema de Arquivos Local (File System Access API Nativa)
 * Permite listar pastas reais (C:, G:, Pendrives) e Salvar/Gravar arquivos diretamente no Windows.
 */
(function (global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    const res = factory();
    global.BrowserFS = res;
    global.BrowserFsAccess = res;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function obterJanelaPicker() {
    try {
      if (typeof window !== 'undefined' && window.top && typeof window.top.showSaveFilePicker === 'function') {
        return window.top;
      }
    } catch (e) {}
    try {
      if (typeof window !== 'undefined' && window.parent && typeof window.parent.showSaveFilePicker === 'function') {
        return window.parent;
      }
    } catch (e) {}
    return typeof window !== 'undefined' ? window : null;
  }

  const winAtiva = obterJanelaPicker();
  const hasNativeFS = !!winAtiva && 'showDirectoryPicker' in winAtiva && 'showSaveFilePicker' in winAtiva;

  /**
   * Abre o seletor de pasta do Windows e lista os arquivos/pastas reais
   * @param {Object} options
   */
  async function escolherPasta(options = {}) {
    const win = obterJanelaPicker() || window;
    if (!win || typeof win.showDirectoryPicker !== 'function') {
      throw new Error('Seu navegador não suporta a API de Acesso ao Sistema de Arquivos (Use Chrome ou Edge).');
    }

    try {
      const dirHandle = await win.showDirectoryPicker({
        id: options.id || 'facilapp-dir',
        mode: options.mode || 'readwrite',
        startIn: options.startIn || 'documents'
      });

      const pastas = [];
      const arquivos = [];

      for await (const [nome, handle] of dirHandle.entries()) {
        if (nome.startsWith('.') || nome.startsWith('$')) continue;

        if (handle.kind === 'directory') {
          pastas.push({
            nome: nome,
            handle: handle
          });
        } else if (handle.kind === 'file') {
          const file = await handle.getFile();
          arquivos.push({
            nome: nome,
            tamanho: file.size,
            tipo: file.type,
            modificado: file.lastModified,
            file: file,
            handle: handle
          });
        }
      }

      pastas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      arquivos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

      return {
        pastaNome: dirHandle.name,
        caminho: dirHandle.name,
        handle: dirHandle,
        pastas: pastas,
        arquivos: arquivos
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Lê o conteúdo de um subdiretório através de seu DirectoryHandle
   */
  async function listarSubdiretorio(dirHandle) {
    const pastas = [];
    const arquivos = [];

    for await (const [nome, handle] of dirHandle.entries()) {
      if (nome.startsWith('.') || nome.startsWith('$')) continue;

      if (handle.kind === 'directory') {
        pastas.push({
          nome: nome,
          handle: handle
        });
      } else if (handle.kind === 'file') {
        const file = await handle.getFile();
        arquivos.push({
          nome: nome,
          tamanho: file.size,
          tipo: file.type,
          modificado: file.lastModified,
          file: file,
          handle: handle
        });
      }
    }

    pastas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    arquivos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    return {
      pastaNome: dirHandle.name,
      handle: dirHandle,
      pastas: pastas,
      arquivos: arquivos
    };
  }

  /**
   * Salva um arquivo diretamente no Windows usando a janela nativa "Salvar Como" (showSaveFilePicker)
   * @param {Blob|string|ArrayBuffer} conteudo
   * @param {Object} options { fileName, extensions, description }
   * @returns {Promise<{sucesso: boolean, nome: string, handle?: any}>}
   */
  async function salvarArquivo(conteudo, options = {}) {
    const nomeSugerido = options.fileName || options.nome || 'projeto-studio-canvas';
    const ext = (options.extension || options.ext || (nomeSugerido.match(/\.([a-z0-9]+)$/i) || [])[1] || 'json').toLowerCase().replace(/^\./, '');
    const nomeFinal = nomeSugerido.endsWith('.' + ext) ? nomeSugerido : `${nomeSugerido}.${ext}`;

    const tiposMime = {
      json: 'application/json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      pdf: 'application/pdf',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      xml: 'text/xml',
      txt: 'text/plain',
      rtf: 'application/rtf',
      html: 'text/html'
    };

    let blob;
    if (conteudo instanceof Blob) {
      blob = conteudo;
    } else if (conteudo instanceof ArrayBuffer || ArrayBuffer.isView(conteudo)) {
      blob = new Blob([conteudo], { type: tiposMime[ext] || 'application/octet-stream' });
    } else if (typeof conteudo === 'string' && conteudo.startsWith('data:')) {
      const arr = conteudo.split(',');
      const mime = (arr[0].match(/:(.*?);/) || [])[1] || tiposMime[ext] || 'image/png';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      blob = new Blob([u8arr], { type: mime });
    } else {
      blob = new Blob([String(conteudo || '')], { type: (tiposMime[ext] || 'text/plain') + ';charset=utf-8' });
    }

    const win = obterJanelaPicker() || window;
    if (!win || typeof win.showSaveFilePicker !== 'function') {
      throw new Error('Seu navegador não suporta a janela nativa Salvar Como (showSaveFilePicker).');
    }

    const pickerOptions = {
      suggestedName: nomeFinal
    };

    if (tiposMime[ext]) {
      pickerOptions.types = [{
        description: options.description || `Arquivo ${ext.toUpperCase()}`,
        accept: {
          [tiposMime[ext]]: [`.${ext}`]
        }
      }];
    }

    try {
      const handle = await win.showSaveFilePicker(pickerOptions);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      return {
        sucesso: true,
        nome: handle.name,
        caminho: handle.name,
        handle: handle
      };
    } catch (err) {
      if (err && err.name === 'AbortError') return null; // Cancelado pelo usuário
      try {
        const handle = await win.showSaveFilePicker({ suggestedName: nomeFinal });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return {
          sucesso: true,
          nome: handle.name,
          caminho: handle.name,
          handle: handle
        };
      } catch (err2) {
        if (err2 && err2.name === 'AbortError') return null;
        throw err2;
      }
    }
  }

  return {
    suportado: hasNativeFS,
    supported: hasNativeFS,
    escolherPasta: escolherPasta,
    directoryOpen: escolherPasta,
    listarSubdiretorio: listarSubdiretorio,
    salvarArquivo: salvarArquivo,
    fileSave: salvarArquivo
  };
});
