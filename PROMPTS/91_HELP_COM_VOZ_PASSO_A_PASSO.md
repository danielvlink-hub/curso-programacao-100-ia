# 91 — Help "?" com voz em qualquer tela (passo a passo para o aluno)

O botão **"?"** fica ao lado do **✕** da tela. Quem clica vê uma apresentação: a própria tela abre, um cursor anda
sozinho, destaca cada campo, digita como se fosse a recepcionista, e uma voz (a **Francisca**) explica cada passo.
Nada é gravado durante o treinamento.

**Tela pronta para você ver funcionando:** abra `HTML/modelo_browse.html` e clique no **"?"**.

---

## Antes de começar (só na primeira vez)

1. Tenha o **Python** instalado (no terminal, `python --version` precisa responder).
2. Instale o gerador de voz (é ele que cria os arquivos .mp3 da Francisca):
   ```
   pip install edge-tts
   ```
   Precisa de internet só para gerar a voz. Depois o .mp3 toca sem internet.

As peças já vêm no curso, você **não** precisa criar:

| Peça | O que é |
|---|---|
| `HTML/assets/js/avisos.js` | carrega o "?" em todas as telas e trava a gravação durante o treino |
| `HTML/assets/js/AjudaTela.js` | cria o botão "?" e a janela da ajuda |
| `HTML/assets/js/Treinamento.js` + `HTML/assets/css/Treinamento.css` | o motor: cursor, destaque, legenda e voz |
| `HTML/TREINAMENTOS/ajudas.js` | a lista das telas que têm "?" |
| `HTML/TREINAMENTOS/novo_treinamento.py` | cria a pasta do treino de uma tela |
| `HTML/TREINAMENTOS/mapear_tela.py` | confere se nenhum botão ou campo ficou de fora |
| `HTML/TREINAMENTOS/Hospedes/` | o exemplo completo (roteiro, vozes) |

---

## O prompt — copie, troque o que está entre < > e cole na sua IA (Claude Code)

```
Crie o Help "?" com voz da tela HTML/<arquivo>.html do FastPousada, igual ao exemplo pronto
HTML/TREINAMENTOS/Hospedes/ (tela HTML/modelo_browse.html). Leia o exemplo antes de começar.
Use as peças que já existem no projeto; não crie outro motor e não mude a voz.

Faça nesta ordem e me mostre o resultado de cada passo:

1. Dentro da pasta HTML, rode:
   python TREINAMENTOS/novo_treinamento.py <Pasta> <arquivo>.html "<Título da tela>"
   Isso cria HTML/TREINAMENTOS/<Pasta>/ com a apresentação, o roteiro.js vazio, o gerar_audios.py
   e o MAPA.md com todos os botões e campos da tela.

2. Leia o MAPA.md e o código da tela e escreva o roteiro.js:
   - o treino FAZ a operação de verdade: digita na busca, escolhe no filtro, clica em Novo,
     preenche os campos obrigatórios e no fim fecha SEM gravar;
   - um passo por ação, frase curta, linguagem da recepção da pousada, sem termo técnico;
   - em cada passo: audio ANTES de texto (audio: 'audio/stepN.mp3', texto: '...');
   - campo que fica dentro da janela do update (iframe): use quadro: '#janelaUpdate iframe'
     e coloque a tela do update em quadros: ['../../<update>.html'];
   - o 1º passo diz que nada será gravado; o último lembra do botão de interrogação ao lado do X.

3. Rode: python TREINAMENTOS/mapear_tela.py <Pasta>
   Não pode sobrar nenhum ❌. Campo que não vale explicar vai em ignorar: ['id'] no roteiro.

4. Rode: python TREINAMENTOS/<Pasta>/gerar_audios.py
   (gera um .mp3 por passo com a voz pt-BR-FranciscaNeural, ritmo +3%).

5. Registre a tela em HTML/TREINAMENTOS/ajudas.js:
   HTML_<NOME_DO_ARQUIVO_EM_MAIUSCULAS>: { titulo: '<Título>', url: 'TREINAMENTOS/<Pasta>/Apresentacao_<Pasta>.html' }
   (se o X da tela não for encontrado sozinho, informe ancora: '<seletor do X>').

6. Me diga como testar: abrir a tela, clicar no "?", clicar em Iniciar e assistir até o fim.
```

---

## Campos de um passo do roteiro

| Campo | O que faz | Exemplo |
|---|---|---|
| `alvo` | o que fica destacado (seletor CSS; "a, b" = vale o 1º que existir) | `'#inputFiltro'` |
| `audio` / `texto` | o arquivo da voz e a frase que ela fala (aparece na legenda) | `'audio/step2.mp3'` |
| `digitar` | digita no campo, letra por letra | `'Maria'` |
| `escolher` | escolhe uma opção do combo (pelo começo do texto) | `'Ativos'` |
| `clicar` | `true` clica no alvo; ou um seletor de outro botão | `true` |
| `quadro` | o alvo está dentro de um iframe da tela (a janela do update) | `'#janelaUpdate iframe'` |
| `aguardar` | espera (ms) antes do passo, ex.: a janela abrindo | `900` |
| `fechar` | clica neste seletor no fim do passo (fecha a janela) | `'#janelaUpdate .btn-fechar'` |
| `limpar` | esvazia campos no fim do passo (tira o filtro digitado) | `'#inputFiltro'` |

Exemplo de um passo:
```js
{alvo: '#telefone', quadro: '#janelaUpdate iframe', digitar: '(15) 99123-4567', audio: 'audio/step8.mp3',
 texto: 'O telefone, com DDD, também é obrigatório. É por ele que a recepção confirma a reserva.'},
```

---

## Conferir antes de dar como pronto

- [ ] `mapear_tela.py` sem nenhum ❌.
- [ ] O "?" aparece ao lado do ✕ da tela, do mesmo tamanho.
- [ ] Assisti do começo ao fim: o cursor vai ao campo certo e a fala bate com o que aparece.
- [ ] Depois do treino, a lista continua igual: **nada foi gravado**.

## Se der problema

| Problema | O que fazer |
|---|---|
| O "?" não aparece | a linha da tela está em `ajudas.js`? O código é `HTML_` + nome do arquivo em maiúsculas. Recarregue com Ctrl+F5. |
| Sem voz | rodou o `gerar_audios.py`? Existe a pasta `audio` com os .mp3? No passo, `audio` vem antes de `texto`? |
| Cursor não acha o campo | o `id` do campo está certo? Campo dentro do update precisa de `quadro`. Aumente o `aguardar`. |
| Mudei uma frase | rode o `gerar_audios.py` de novo. |
