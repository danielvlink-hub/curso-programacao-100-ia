/*
 * avisos.js do CURSO (FastPousada) — Daniel, 03/11/2026: "pegar o menu do Gourmet e adaptar para o curso".
 * O QUE FAZ: só as janelas de aviso (FacilAppAviso / alert), confirmação (FacilAppConfirmar) e pergunta (FacilAppPerguntar).
 * ORIGEM: cópia das linhas 1–335 do assets/js/avisos.js do Gourmet. Ficaram de fora, por serem do restaurante: liberação
 *   gerencial por senha/token, ajuste de celular, ajuda "?", botão IA, alerta "Corre!", tempos de entrega e log de exclusões.
 * CUIDADOS: corrigir no Gourmet não atualiza aqui; se copiar de novo, manter só este trecho.
 */

/*
 * avisos.js — Substitui os alert() do sistema por avisos flutuantes
 * ===========================================================================
 * PARA QUE SERVE
 * O sistema usa alert() em mais de uma centena de lugares (29 só no PDV, 25 no
 * Kanban). O alert do navegador TRAVA a tela: some o cursor, exige um clique em
 * "OK" e, num tablet de balcão, interrompe o atendimento por um recado que
 * quase sempre é só informativo ("Pedido #104 confirmado").
 *
 * Este arquivo troca o alert por um aviso que aparece num canto, some sozinho
 * e não bloqueia nada.
 *
 * COMO FUNCIONA
 * Substitui window.alert. Nenhuma chamada existente precisa ser alterada:
 * quem faz alert('Salvo!') continua fazendo, e o que aparece é o aviso novo.
 *
 * ONDE COLOCAR
 * Como uma das primeiras tags <script> da página:
 *     <script src="avisos.js"></script>
 *
 * O QUE NÃO TOCA — E POR QUÊ
 * confirm() e prompt() continuam originais, de propósito. Os dois DEVOLVEM
 * resposta e o código decide o rumo com base nela ("confirma excluir?").
 * Trocá-los por algo que não bloqueia faria o código seguir como se o usuário
 * tivesse respondido — e apagaria coisas sem confirmação. Só o alert(), que
 * não devolve nada, é seguro de substituir.
 *
 * TOM DO AVISO
 * A cor é escolhida pelo texto: mensagem com "erro", "falha" ou "não foi
 * possível" sai em vermelho; o resto sai neutro. É uma heurística simples,
 * suficiente para o operador saber se precisa agir.
 *
 * DESLIGAR
 * Trocar ATIVO para false abaixo devolve o alert original do navegador.
 */
(function () {
  'use strict';

  // Vire para false para voltar ao alert() padrão do navegador.
  const ATIVO = true;

  if (!ATIVO || window.__avisosFacilAppInstalado) return;
  window.__avisosFacilAppInstalado = true;

  const alertOriginal = window.alert.bind(window);
  const TEMPO_NA_TELA = 4000;   // ms
  const MAXIMO_VISIVEL = 4;     // avisos empilhados ao mesmo tempo

  let caixa = null;

  /** Cria (uma vez) o container onde os avisos são empilhados. */
  function obterCaixa() {
    if (caixa && document.body.contains(caixa)) return caixa;

    caixa = document.createElement('div');
    caixa.className = 'facilapp-avisos';
    caixa.setAttribute('role', 'status');
    caixa.setAttribute('aria-live', 'polite');
    // Estilo inline de propósito: assim o arquivo funciona em qualquer tela
    // sem depender de CSS externo nem esbarrar nas regras do TemaFacilApp.
    caixa.style.cssText = [
      'position:fixed',
      'top:14px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:2147483000',        // acima de modais e overlays do sistema
      'display:flex',
      'flex-direction:column',
      'gap:7px',
      'align-items:center',
      'pointer-events:none',       // não rouba clique do que está atrás
      'max-width:min(92vw, 460px)'
    ].join(';');

    document.body.appendChild(caixa);
    return caixa;
  }

  /**
   * Decide a cor pelo conteúdo da mensagem.
   * @param {string} texto
   * @returns {{fundo:string, borda:string}}
   */
  function tomDoAviso(texto) {
    const t = String(texto || '').toLowerCase();
    const ehProblema = /erro|falha|não foi possível|nao foi possivel|inválid|invalid|obrigat|informe |selecione /.test(t);
    return ehProblema
      ? { fundo: '#7f1d1d', borda: '#b91c1c' }
      : { fundo: '#1f2937', borda: '#4b5563' };
  }

  /**
   * Mostra um aviso flutuante.
   * @param {string} mensagem
   */
  function mostrarAviso(mensagem) {
    const texto = String(mensagem == null ? '' : mensagem);
    if (!texto.trim()) return;

    const área = obterCaixa();

    // Não empilhar infinitamente: o mais antigo sai para o novo entrar.
    while (área.childElementCount >= MAXIMO_VISIVEL) {
      área.removeChild(área.firstElementChild);
    }

    const tom = tomDoAviso(texto);
    const aviso = document.createElement('div');
    aviso.style.cssText = [
      'pointer-events:auto',       // permite fechar no clique
      'cursor:pointer',
      'padding:10px 14px',
      'border-radius:7px',
      'background:' + tom.fundo,
      'border:1px solid ' + tom.borda,
      'color:#f8fafc',
      'font:600 12.5px/1.45 system-ui, -apple-system, Segoe UI, sans-serif',
      'box-shadow:0 8px 22px rgba(0,0,0,.28)',
      'text-align:center',
      'white-space:pre-wrap',      // preserva as quebras de linha das mensagens
      'opacity:0',
      'transform:translateY(-8px)',
      'transition:opacity .18s ease, transform .18s ease'
    ].join(';');
    aviso.textContent = texto;

    // "remover" é local a cada aviso de propósito: se fosse compartilhado
    // entre chamadas, um aviso novo sequestraria o fechamento do anterior e o
    // primeiro ficaria preso na tela.
    let jaRemovido = false;
    const remover = () => {
      if (jaRemovido) return;
      jaRemovido = true;
      aviso.style.opacity = '0';
      aviso.style.transform = 'translateY(-8px)';
      setTimeout(() => aviso.remove(), 200);
    };
    aviso.onclick = remover;

    área.appendChild(aviso);

    // Deixa o navegador pintar antes de animar a entrada.
    requestAnimationFrame(() => {
      aviso.style.opacity = '1';
      aviso.style.transform = 'translateY(0)';
    });

    setTimeout(remover, TEMPO_NA_TELA);
  }

  window.alert = function (mensagem) {
    try {
      mostrarAviso(mensagem);
    } catch (e) {
      // Se algo falhar (body ainda inexistente, por exemplo), o recado não
      // pode se perder: cai no alert original.
      alertOriginal(mensagem);
    }
  };

  // Deixa acessível para quem quiser avisar sem passar por alert().
  window.FacilAppAviso = mostrarAviso;

  /* =========================================================================
   * CONFIRMAÇÃO NA PRÓPRIA PÁGINA
   * -------------------------------------------------------------------------
   * O confirm() do navegador tem os mesmos defeitos do alert — trava a tela,
   * mostra o endereço "127.0.0.1:3000 diz" e não acompanha o tema do sistema.
   *
   * POR QUE ISTO NÃO SUBSTITUI window.confirm AUTOMATICAMENTE (como foi feito
   * com o alert): confirm() é SÍNCRONO e devolve true/false na hora — o código
   * que chama decide o rumo com aquele retorno. Uma versão em tela precisa
   * esperar o clique, ou seja, devolve Promise. Trocar por baixo faria todo
   * "if (confirm(...))" existente receber um objeto Promise, que é sempre
   * verdadeiro — e o sistema passaria a excluir tudo sem perguntar.
   * Por isso a função é nova e quem quiser usá-la precisa usar await.
   *
   * @param {string} mensagem  texto da pergunta
   * @param {object} [opcoes]  { confirmar, cancelar, perigo }
   * @returns {Promise<boolean>}
   */
  window.FacilAppConfirmar = function (mensagem, opcoes) {
    const cfg = opcoes || {};
    return new Promise(function (resolver) {
      const fundo = document.createElement('div');
      fundo.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:2147483100',
        'background:color-mix(in srgb, var(--fa-background, #d6ead1) 72%, transparent)',
        'display:flex', 'align-items:center', 'justify-content:center',
        'padding:16px'
      ].join(';');

      const caixa = document.createElement('div');
      caixa.style.cssText = [
        'background:var(--fa-panel, #ffffff)',
        'color:var(--fa-text, #1e293b)',
        'border:1px solid var(--fa-border, #cbd5e1)',
        'border-radius:9px',
        'box-shadow:0 18px 46px rgba(0,0,0,.32)',
        'max-width:min(92vw, 430px)',
        'padding:16px 18px',
        'font:13px/1.5 system-ui, -apple-system, Segoe UI, sans-serif'
      ].join(';');

      const texto = document.createElement('div');
      texto.style.cssText = 'white-space:pre-wrap; margin-bottom:14px;';
      texto.textContent = String(mensagem == null ? '' : mensagem);

      const acoes = document.createElement('div');
      acoes.style.cssText = 'display:flex; justify-content:flex-end; gap:7px;';

      // <div role="button"> e não <button>: o TemaFacilApp.css repinta todo
      // <button> com !important e especificidade que regra local não vence.
      function criarBotao(rotulo, principal) {
        const b = document.createElement('div');
        b.setAttribute('role', 'button');
        b.setAttribute('tabindex', '0');
        b.textContent = rotulo;
        b.style.cssText = [
          'display:flex', 'align-items:center', 'justify-content:center',
          'height:26px', 'padding:0 14px', 'border-radius:5px',
          'font-size:11.5px', 'font-weight:800', 'cursor:pointer',
          'user-select:none',
          principal
            ? ('background:' + (cfg.perigo ? 'var(--fa-danger, #a63232)' : 'var(--fa-button-bg, #59651f)') +
               ';color:var(--fa-button-text, #eef2e5)')
            : ('background:var(--fa-field-bg, #eef5e5);color:var(--fa-text, #171a10);' +
               'border:1px solid var(--fa-border, #9caf77)')
        ].join(';');
        return b;
      }

      let respondido = false;
      function fechar(resposta) {
        if (respondido) return;
        respondido = true;
        document.removeEventListener('keydown', aoTeclar, true);
        fundo.remove();
        resolver(resposta);
      }

      function aoTeclar(ev) {
        if (ev.key === 'Escape') { ev.preventDefault(); fechar(false); }
        if (ev.key === 'Enter') { ev.preventDefault(); fechar(true); }
      }

      const btnCancelar = criarBotao(cfg.cancelar || 'Cancelar', false);
      const btnConfirmar = criarBotao(cfg.confirmar || 'Confirmar', true);
      btnCancelar.onclick = () => fechar(false);
      btnConfirmar.onclick = () => fechar(true);

      // Clique fora cancela — mesma expectativa de qualquer modal do sistema.
      fundo.onclick = (ev) => { if (ev.target === fundo) fechar(false); };
      document.addEventListener('keydown', aoTeclar, true);

      acoes.append(btnCancelar, btnConfirmar);
      caixa.append(texto, acoes);
      fundo.appendChild(caixa);
      document.body.appendChild(fundo);
      btnConfirmar.focus();
    });
  };

  /**
   * FacilAppPerguntar — pergunta com campo para digitar, no lugar do prompt() do navegador.
   * Daniel, 27/10/2026 (recado do Claude SQL Linux: "telas nunca usam confirm, alert ou prompt; sempre modal interno" —
   * o prompt/confirm é descartado no painel do Claude, no WebView dos apps e no WinDev, e a tela segue como se tivessem
   * cancelado). Mesmo visual do FacilAppConfirmar. Também é assíncrona: quem usa precisa de await.
   *
   * @param {string} mensagem  texto da pergunta
   * @param {object} [opcoes]  { valor: texto inicial, senha: true = campo de senha, tipo: 'number'|'text',
   *                            confirmar, cancelar }
   * @returns {Promise<string|null>}  o texto digitado, ou null se cancelou (igual ao prompt())
   */
  window.FacilAppPerguntar = function (mensagem, opcoes) {
    const cfg = opcoes || {};
    return new Promise(function (resolver) {
      const fundo = document.createElement('div');
      fundo.style.cssText = 'position:fixed;inset:0;z-index:2147483100;' +
        'background:color-mix(in srgb, var(--fa-background, #d6ead1) 72%, transparent);' +
        'display:flex;align-items:center;justify-content:center;padding:16px';
      const caixa = document.createElement('div');
      caixa.style.cssText = 'background:var(--fa-panel, #ffffff);color:var(--fa-text, #1e293b);' +
        'border:1px solid var(--fa-border, #cbd5e1);border-radius:9px;box-shadow:0 18px 46px rgba(0,0,0,.32);' +
        'width:min(92vw, 430px);padding:16px 18px;font:13px/1.5 system-ui, -apple-system, Segoe UI, sans-serif';
      const texto = document.createElement('div');
      texto.style.cssText = 'white-space:pre-wrap; margin-bottom:8px;';
      texto.textContent = String(mensagem == null ? '' : mensagem);
      const campo = document.createElement('input');
      campo.type = cfg.senha ? 'password' : (cfg.tipo || 'text');
      campo.autocomplete = cfg.senha ? 'new-password' : 'off';
      campo.value = cfg.valor == null ? '' : String(cfg.valor);
      campo.style.cssText = 'width:100%;box-sizing:border-box;height:28px;padding:0 8px;margin-bottom:14px;' +
        'border:1px solid var(--fa-border, #9caf77);border-radius:5px;background:var(--fa-field-bg, #eef5e5);' +
        'color:var(--fa-text, #171a10);font:inherit';
      const acoes = document.createElement('div');
      acoes.style.cssText = 'display:flex; justify-content:flex-end; gap:7px;';
      // <div role="button"> pelo mesmo motivo do FacilAppConfirmar (o tema repinta todo <button>)
      function criarBotao(rotulo, principal) {
        const b = document.createElement('div');
        b.setAttribute('role', 'button');
        b.setAttribute('tabindex', '0');
        b.textContent = rotulo;
        b.style.cssText = 'display:flex;align-items:center;justify-content:center;height:26px;padding:0 14px;' +
          'border-radius:5px;font-size:11.5px;font-weight:800;cursor:pointer;user-select:none;' +
          (principal ? 'background:var(--fa-button-bg, #59651f);color:var(--fa-button-text, #eef2e5)'
                     : 'background:var(--fa-field-bg, #eef5e5);color:var(--fa-text, #171a10);border:1px solid var(--fa-border, #9caf77)');
        return b;
      }
      let respondido = false;
      function fechar(resposta) {
        if (respondido) return;
        respondido = true;
        document.removeEventListener('keydown', aoTeclar, true);
        fundo.remove();
        resolver(resposta);
      }
      function aoTeclar(ev) {
        if (ev.key === 'Escape') { ev.preventDefault(); fechar(null); }
        if (ev.key === 'Enter') { ev.preventDefault(); fechar(campo.value); }
      }
      const btnCancelar = criarBotao(cfg.cancelar || 'Cancelar', false);
      const btnConfirmar = criarBotao(cfg.confirmar || 'OK', true);
      btnCancelar.onclick = () => fechar(null);
      btnConfirmar.onclick = () => fechar(campo.value);
      fundo.onclick = (ev) => { if (ev.target === fundo) fechar(null); };
      document.addEventListener('keydown', aoTeclar, true);
      acoes.append(btnCancelar, btnConfirmar);
      caixa.append(texto, campo, acoes);
      fundo.appendChild(caixa);
      document.body.appendChild(fundo);
      campo.focus();
      campo.select();
    });
  };
})();

