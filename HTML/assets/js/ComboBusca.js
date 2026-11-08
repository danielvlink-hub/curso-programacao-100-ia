/**
 * COMBO COM BUSCA (padrao do Daniel) - FacilApp Gourmet
 * ---------------------------------------------------------------------------
 * Mesmo modelo do frete_update2.html: um <input> dentro de .comboBuscaWrap e
 * uma lista .comboBuscaDrop com itens .comboBuscaItem. Abre ao focar/clicar,
 * filtra ao digitar e o item escolhido vira o texto do campo. O texto livre
 * tambem vale (ex.: grupo novo que ainda nao existe).
 *
 * Cores e medidas vem do tema (--fa-*), em assets/css/TemaFacilApp.css.
 * NAO usar <datalist> nem <select> nativo para "digite ou escolha".
 *
 * USO:
 *   FacilAppComboBusca.ligar('idDoInput', {
 *     itens: function () { return ['Financeiro', 'Estoque']; },   // ou array fixo
 *     vazio: 'Nenhum grupo. Sera criado ao gravar.',              // texto sem resultado
 *     aoEscolher: function (texto) {}                             // opcional
 *   });
 * Se o input ainda nao estiver dentro de .comboBuscaWrap, o proprio ligar()
 * cria o wrap, a lista e a setinha.
 */
(function () {
  'use strict';


  // Estilo do componente (so' variaveis do tema; nenhuma cor fixa).
  var estilo = document.createElement('style');
  estilo.id = 'comboBuscaEstilo';
  estilo.textContent = [
    '.comboBuscaWrap{position:relative;min-width:0}',
    '.comboBuscaWrap .comboBuscaInput{width:100%;padding-right:26px!important;box-sizing:border-box}',
    '.comboBuscaSeta{position:absolute;right:9px;top:50%;transform:translateY(-50%);font-size:13px;line-height:1;color:var(--fa-muted,#596044);pointer-events:none}',
    '.comboBuscaDrop{display:none;position:absolute;left:0;right:0;top:100%;z-index:3000;max-height:190px;overflow:auto;margin-top:3px;background:var(--fa-panel,#d8e9c5);border:1px solid var(--fa-border,#9caf77);border-radius:5px;box-shadow:0 8px 22px rgba(0,0,0,.18)}',
    '.comboBuscaDrop.aberto{display:block}',
    '.comboBuscaItem{box-sizing:border-box;height:19px;line-height:19px;padding:0 8px;font-size:12px;color:var(--fa-text,#171a10);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.comboBuscaItem:hover,.comboBuscaItem.ativo{background:var(--fa-panel-alt,#c9ddb0)}',
    // 02/11/2026: modo em colunas (opcional, cfg.colunas) — dados alinhados um embaixo do outro
    '.comboBuscaItem.emColunas{display:grid;column-gap:10px}',
    '.comboBuscaItem.emColunas>span,.comboBuscaCab>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.comboBuscaCab{display:grid;column-gap:10px;position:sticky;top:0;z-index:1;height:20px;line-height:20px;padding:0 8px;font-size:11px;font-weight:700;text-transform:uppercase;background:var(--fa-panel-alt,#c9ddb0);color:var(--fa-muted,#596044);border-bottom:1px solid var(--fa-border,#9caf77)}',
    '.comboBuscaVazio{padding:7px 8px;font-size:12px;color:var(--fa-muted,#596044)}'
  ].join(' ');
  if (!document.getElementById('comboBuscaEstilo')) document.head.appendChild(estilo);

  function normalizar(t) {
    // Tira acentos (marcas combinantes U+0300 a U+036F) sem depender de regex com escape.
    return String(t == null ? '' : t)
      .normalize('NFD').split('').filter(function (c) { var n = c.charCodeAt(0); return n < 768 || n > 879; }).join('')
      .toLowerCase().split(' ').filter(Boolean).join(' ');
  }

  function escapar(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function ligar(idOuInput, opcoes) {
    var input = typeof idOuInput === 'string' ? document.getElementById(idOuInput) : idOuInput;
    if (!input || input.__comboBusca) return;
    input.__comboBusca = true;
    var cfg = opcoes || {};

    var wrap = input.closest('.comboBuscaWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'comboBuscaWrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
    }
    var drop = wrap.querySelector('.comboBuscaDrop');
    if (!drop) {
      drop = document.createElement('div');
      drop.className = 'comboBuscaDrop';
      wrap.appendChild(drop);
    }
    if (!wrap.querySelector('.comboBuscaSeta')) {
      var seta = document.createElement('span');
      seta.className = 'comboBuscaSeta';
      seta.textContent = '▾';
      wrap.appendChild(seta);
    }
    input.setAttribute('autocomplete', 'off');
    input.classList.add('comboBuscaInput');

    var ativo = -1;

    function itens() {
      var l = typeof cfg.itens === 'function' ? cfg.itens() : cfg.itens;
      return Array.isArray(l) ? l.map(String) : [];
    }

    function desenhar(filtrar) {
      var termo = filtrar ? normalizar(input.value) : '';
      // 24/10/2026 (hotel: "tem que puxar pelo CPF, fone, nome"): só números (3 ou mais) também procura nos números do item,
      // ignorando pontos, traços, parênteses e espaços — "50395542812" acha "503.955.428-12", "15997986091" acha "(15) 99798-6091".
      var digitos = /^[\d.\-\/() ]+$/.test(termo) ? termo.replace(/\D/g, '') : '';
      var lista = itens().filter(function (t) {
        if (!termo || normalizar(t).indexOf(termo) >= 0) return true;
        return digitos.length >= 3 && String(t).replace(/\D/g, '').indexOf(digitos) >= 0;
      });
      ativo = -1;
      if (!lista.length) {
        drop.innerHTML = '<div class="comboBuscaVazio">' + escapar(cfg.vazio || 'Nenhum registro para selecionar.') + '</div>';
        return;
      }
      // cfg.colunas (opcional): { larguras: '1fr 120px 150px', cabecalho: ['Nome', ...], celulas: texto => [c1, c2, c3] }.
      // O valor escolhido continua sendo o texto inteiro (data-valor); só o desenho da linha muda.
      var col = cfg.colunas && typeof cfg.colunas.celulas === 'function' ? cfg.colunas : null;
      var grade = col ? ' style="grid-template-columns:' + escapar(col.larguras || 'repeat(auto-fit,minmax(0,1fr))') + '"' : '';
      var cab = col && Array.isArray(col.cabecalho)
        ? '<div class="comboBuscaCab"' + grade + '>' + col.cabecalho.map(function (h) { return '<span>' + escapar(h) + '</span>'; }).join('') + '</div>'
        : '';
      drop.innerHTML = cab + lista.map(function (t) {
        if (!col) return '<div class="comboBuscaItem" data-valor="' + escapar(t) + '">' + escapar(t) + '</div>';
        var cel = col.celulas(t) || [t];
        return '<div class="comboBuscaItem emColunas" data-valor="' + escapar(t) + '"' + grade + '>' +
          cel.map(function (c) { return '<span>' + escapar(c == null ? '' : c) + '</span>'; }).join('') + '</div>';
      }).join('');
    }

    function abrir(filtrar) { desenhar(filtrar); drop.classList.add('aberto'); }
    function fechar() { drop.classList.remove('aberto'); }

    function escolher(texto) {
      input.value = texto;
      fechar();
      input.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof cfg.aoEscolher === 'function') cfg.aoEscolher(texto);
    }

    function marcar(indice) {
      var els = drop.querySelectorAll('.comboBuscaItem');
      if (!els.length) return;
      ativo = (indice + els.length) % els.length;
      els.forEach(function (e, i) { e.classList.toggle('ativo', i === ativo); });
      els[ativo].scrollIntoView({ block: 'nearest' });
    }

    // Abre com TODOS os itens ao focar/clicar; filtra so' quando o usuario digita.
    input.addEventListener('focus', function () { abrir(false); });
    input.addEventListener('click', function () { if (!drop.classList.contains('aberto')) abrir(false); });
    // Duplo clique SEMPRE abre a lista completa, tenha ou nao texto no campo.
    input.addEventListener('dblclick', function () { abrir(false); });
    input.addEventListener('input', function () { abrir(true); });
    input.addEventListener('blur', function () { setTimeout(fechar, 120); });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); if (!drop.classList.contains('aberto')) abrir(false); marcar(ativo + 1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); marcar(ativo - 1); }
      else if (ev.key === 'Enter' && drop.classList.contains('aberto') && ativo >= 0) {
        ev.preventDefault();
        var el = drop.querySelectorAll('.comboBuscaItem')[ativo];
        if (el) escolher(el.getAttribute('data-valor'));
      }
      else if (ev.key === 'Escape') { fechar(); }
    });
    // mousedown (nao click): acontece antes do blur do input, como no frete_update2.
    drop.addEventListener('mousedown', function (ev) {
      var el = ev.target.closest('.comboBuscaItem');
      if (!el) return;
      ev.preventDefault();
      escolher(el.getAttribute('data-valor'));
    });
  }

  window.FacilAppComboBusca = { ligar: ligar };
})();
