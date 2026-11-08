# 90 — Padrão do Treinamento "?" e do Botão IA (FastPousada)

Adaptado para o curso, em 08/11/2026, do prompt que a FacilApp usa no Gourmet ("faz um prompt como você faz e usa, com
exemplo, do treinamento para clientes, botões, e indica um HTML exemplo; o mesmo para os botões IA").
Serve para o Claude Code (ou qualquer pessoa) criar o treinamento guiado ou a IA de uma tela do FastPousada.
Use depois que a tela já funciona (prompts 02 a 15).

**No FastPousada as peças ainda não existem: o primeiro uso de cada parte cria a peça (motor) e a primeira tela
(exemplo). Depois, cada tela nova só ganha o roteiro ou o manifesto.**

- Treinamento: `HTML/assets/js/Treinamento.js`, `HTML/assets/css/Treinamento.css`, `HTML/assets/js/AjudaTela.js` e a pasta
  `HTML/TREINAMENTOS/` (`_modelo/`, `novo_treinamento.py`, `mapear_tela.py`, `ajudas.js`, `Hospedes/` como exemplo).
- IA: `HTML/assets/js/BotaoIA.js`, `HTML/assets/js/IACadastro.js`, `HTML/assets/js/IATelas.js` e `HTML/assets/js/IATarifas.js`
  como exemplo.
- O "?" e a IA aparecem sozinhos porque o `avisos.js` (carregado por todas as telas) carrega `AjudaTela.js` e `IATelas.js`.
- Camada de dados: sempre as funções do `ApiCurso.js` (nunca fetch solto na tela).
- A IA chama `POST http://127.0.0.1:7777/api/ia/chat` com o Bearer da sessão. A chave do provedor de IA fica SÓ na
  FacilApp API SQL (variável de ambiente ou arquivo em ProgramData). Nunca coloque a chave no JS.
  Sem chave configurada, a rota responde "IA não configurada" e o botão IA aparece desabilitado — o resto do sistema
  funciona normalmente (o curso não exige assinatura de IA).

---

## PARTE 1 — Treinamento guiado "?" (apresentação com voz)

### Prompt para usar

```
Crie o treinamento guiado ("?") da tela <arquivo>.html do FastPousada, no padrão fixo do curso.
(Se HTML/assets/js/Treinamento.js ainda não existe, crie primeiro o motor e o modelo descritos em
PROMPTS/90_TREINAMENTO_E_BOTAO_IA.md, Parte 1 — tabelas "Peças" e "Campos de cada passo".)
1. python HTML/TREINAMENTOS/novo_treinamento.py <Pasta> <arquivo>.html "<Título>"
   (cria HTML/TREINAMENTOS/<Pasta>/ com Apresentacao_<Pasta>.html, gerar_audios.py, roteiro.js vazio e MAPA.md com
   TODOS os controles da tela).
2. Leia o MAPA.md e a tela e escreva o roteiro.js. O treino FAZ a operação de verdade: clica, digita como o
   usuário digita, abre a janela, preenche, e no fim cancela. "Só mouse sem interação fica frio."
3. python HTML/TREINAMENTOS/mapear_tela.py <Pasta>  → nenhum ❌ (todo alvo existe na tela).
4. python HTML/TREINAMENTOS/<Pasta>/gerar_audios.py  (edge-tts, voz pt-BR-FranciscaNeural, +3%; não trocar a voz).
5. Registre a tela em HTML/TREINAMENTOS/ajudas.js (o "?" nasce ligado).
6. Abra a tela no navegador, clique no "?" e assista até o fim: cada passo destaca o alvo certo e a fala bate.
Regras: "?" sempre ao lado do ✕ (tela sem ✕: canto direito do topo, com ancora + depois:true); nada é gravado
(modo treinamento trava toda gravação na API — as funções de gravar do ApiCurso viram simulação);
frases curtas, linguagem da recepção da pousada, sem termo técnico.
```

### Peças

| Peça | Onde | Papel |
|---|---|---|
| `assets/js/AjudaTela.js` | carregado pelo `avisos.js` | cria o "?" na tela registrada em `ajudas.js` |
| `assets/js/Treinamento.js` + `assets/css/Treinamento.css` | motor | abre a tela num palco, cursor, destaque, legenda, voz |
| `TREINAMENTOS/ajudas.js` | lista | quais telas têm treino pronto e onde fica o "?" |
| `TREINAMENTOS/<Pasta>/roteiro.js` | por tela | os passos |
| `TREINAMENTOS/<Pasta>/audio/stepN.mp3` | por tela | a voz de cada passo |
| `TREINAMENTOS/_modelo/` | modelo | `Apresentacao_MODELO.html` e `gerar_audios.py` |

### Campos de cada passo

| Campo | O que faz |
|---|---|
| `alvo` | seletor CSS do que é destacado (aceita lista "a, b": vale o 1º que existir) |
| `texto` / `audio` | a fala (legenda) e o mp3 gerado a partir dela |
| `clicar` | `true` = clica no alvo; ou um seletor de outro elemento |
| `digitar` | texto digitado no alvo, letra a letra |
| `escolher` | valor escolhido num combo |
| `antes` | ação executada antes do passo |
| `aguardar` | ms de espera antes (ex.: janela abrindo) |
| `fechar` | seletor clicado para fechar a janela no fim do passo |
| `limpar` | seletor de campo esvaziado (ex.: tirar o filtro digitado antes) |

### Exemplo — `HTML/TREINAMENTOS/Hospedes/roteiro.js` (trecho)

```js
window.TREINAMENTO = {
  titulo: 'Cadastro de Hóspedes',
  tela: '../../hospedes.html',
  ignorar: [],
  passos: [
    {alvo: '#grade, body', audio: 'audio/step1.mp3',
     texto: 'Olá! Este é o Cadastro de Hóspedes. Vamos pesquisar e cadastrar um hóspede juntos; nada será gravado.'},
    {alvo: '#inputFiltro', digitar: 'Maria', audio: 'audio/step2.mp3',
     texto: 'A busca acha o hóspede pelo nome, documento, telefone ou cidade. Digitamos Maria e a lista filtra na hora.'},
    {alvo: '#selSituacao', limpar: '#inputFiltro', audio: 'audio/step3.mp3',
     texto: 'Este filtro mostra só os hóspedes ativos ou só os inativos.'},
    {alvo: 'button[onclick="abrirUpdate()"]', clicar: true, audio: 'audio/step4.mp3',
     texto: 'Novo Hóspede abre o cadastro no meio da tela. Vamos preencher.'},
    {alvo: '#janelaUpdate iframe', aguardar: 600, audio: 'audio/step5.mp3',
     texto: 'Nome e telefone são obrigatórios. O telefone é como a recepção confirma a reserva.'},
    {alvo: '#janelaUpdate .btn-fechar', clicar: true, audio: 'audio/step6.mp3',
     texto: 'Gravar salva o hóspede. Aqui vamos fechar sem gravar.'},
    {alvo: '.btn-fechar, body', audio: 'audio/step7.mp3',
     texto: 'Pronto! Sempre que precisar, clique no botão de interrogação para ver este treinamento de novo.'}
  ]
};
```

### Registro em `HTML/TREINAMENTOS/ajudas.js`

Código da tela = `HTML_` + nome do arquivo sem `.html`, em maiúsculas.

```js
HTML_HOSPEDES: { titulo: 'Cadastro de Hóspedes', url: 'TREINAMENTOS/Hospedes/Apresentacao_Hospedes.html' },
// tela sem ✕ ou "?" em outro lugar:
HTML_MAPA_OCUPACAO: { titulo: 'Mapa de Ocupação', url: 'TREINAMENTOS/Mapa/Apresentacao_Mapa.html',
                      ancora: 'button[onclick="recarregar()"]', depois: true },
```

### Checklist de pronto
- [ ] `mapear_tela.py` sem ❌.
- [ ] Assistido do começo ao fim: a tela muda junto com a fala, e nada foi gravado no banco (conferir no Swagger).
- [ ] "?" no lugar certo, 26×26, sem negrito, igual ao botão vizinho.

---

## PARTE 2 — Botão IA (a pessoa escreve ou fala e a IA executa na tela)

### Prompt para usar

```
Ligue o botão IA na tela <arquivo>.html do FastPousada, no padrão fixo do curso.
(Se HTML/assets/js/BotaoIA.js ainda não existe, crie primeiro a rota POST /api/ia/chat na FacilApp API SQL — chave do
provedor só no servidor, nunca no JS — e o BotaoIA.js descrito em PROMPTS/90_TREINAMENTO_E_BOTAO_IA.md, Parte 2.)
1. Crie HTML/assets/js/IA<Tela>.js (manifesto), copiando o modelo do IATarifas.js:
   {tela, titulo, descricao, exemplo, preparar() -> dados de apoio, ferramentas: {...}}.
2. Cada ferramenta usa A MESMA função que a tela usa (ApiCurso.listar/incluir/alterar/excluir<X>) — a IA só ESCOLHE
   a ferramenta e os parâmetros; quem grava é o código da tela, e a regra de verdade continua na API.
3. Ferramenta que grava: grava:true + validar() (devolve a pergunta quando falta dado) + resumo() (o que VAI fazer)
   → o BotaoIA mostra Confirmar/Cancelar. Depois de gravar, conferir na API e só então dizer "cadastrado".
4. Excluir: só com ferramenta exclui:true (o BotaoIA libera só para administrador, botão vermelho, recusa registrada).
   Receber, estornar e mexer em caixa NÃO entram pela IA.
5. Ligar: (a) tela livre → 2 <script> + BotaoIA.ligarNaTela antes do </body>;
   (b) cadastro simples de uma tabela → 1 linha em HTML/assets/js/IATelas.js (TELAS ou CADASTROS).
6. Testar na tela: consulta, cadastro (Confirmar), pergunta quando falta dado, e excluir com um usuário comum (deve recusar).
Regras: botão IA no grupo IA, ?, ✕ no cabeçalho; nasce LIGADO em toda tela; nunca diálogo nativo do navegador.
```

### Peças

| Peça | Papel |
|---|---|
| `assets/js/BotaoIA.js` | botão no cabeçalho, janela de conversa (microfone, foto, Corrigir/Enviar), chama a IA, mostra o resumo com Confirmar, controla o excluir |
| `assets/js/IA<Tela>.js` | manifesto da tela, com as ferramentas permitidas |
| `assets/js/IACadastro.js` | manifesto genérico para cadastro de uma tabela (`IACadastro.criar(cfg)`) |
| `assets/js/IATelas.js` | liga a IA sozinho pelo `avisos.js`, sem editar a tela; listas TELAS e CADASTROS |
| Rota `POST /api/ia/chat` | na FacilApp API SQL: recebe a conversa + ferramentas, chama o provedor com a chave guardada no servidor, devolve a ferramenta escolhida e os parâmetros |

### Formato de uma ferramenta (do `BotaoIA.js`)

```
nome: { descricao, parametros: {campo: 'explicação'}, grava: true|false, exclui?: true, interativo?: true,
        antes?(p, apoio), validar?(p, apoio) -> 'pergunta' | '', resumo?(p, apoio) -> texto,
        executar(p, apoio[, ui]) -> texto, depois?(p, apoio, ui, resultado) }
```

### Exemplo — `HTML/assets/js/IATarifas.js` (resumido)

```js
window.IATarifas = {
  tela: 'TARIFAS',
  titulo: 'Tarifas',
  descricao: 'Posso consultar, cadastrar ou alterar a diária de um tipo de quarto. Ex.: "a diária do Luxo na alta passa para 320".',
  exemplo: 'Ex.: cadastre a tarifa Feriado do Standard de 20/04 a 22/04 por 240 reais',
  preparar: async function () {                       // dados que a IA recebe para escolher
    var tipos = (await ApiCurso.listarQuartosTipos()) || [];
    var tarifas = (await ApiCurso.listarTarifas()) || [];
    return { tipos: tipos.map(t => ({ id: t.id_tipo, nome: t.nome })),
             tarifas: tarifas.map(t => ({ id: t.id_tarifa, tipo: t.tipo, descricao: t.descricao, diaria: Number(t.valor_diaria), inicio: t.inicio, fim: t.fim })) };
  },
  ferramentas: {
    consultar_tarifa: { descricao: 'Procura tarifas. Não grava.', parametros: { texto: 'tipo ou descrição' }, grava: false,
      executar: async (p, apoio) => '...lista...' },
    cadastrar_tarifa: { descricao: 'Cadastra UMA tarifa. Obrigatórios: id_tipo, descricao, valor_diaria, inicio, fim.',
      parametros: { id_tipo: 'id do tipo', descricao: 'nome', valor_diaria: 'valor', inicio: 'AAAA-MM-DD', fim: 'AAAA-MM-DD' }, grava: true,
      validar: (p, apoio) => !p.id_tipo ? 'Para qual tipo de quarto?' : (!p.valor_diaria ? 'Qual o valor da diária?' : ''),
      resumo: (p, apoio) => 'Cadastrar tarifa:\n• ' + p.descricao + '\n• Diária: R$ ' + p.valor_diaria + '\n• ' + p.inicio + ' a ' + p.fim,
      executar: async (p) => { await ApiCurso.incluirTarifa({ /* mesmos campos da tela */ });
        /* confere na API antes de responder */ return 'Tarifa cadastrada.'; } },
    excluir_tarifa: { descricao: 'EXCLUI UMA tarifa. Só administrador.', parametros: { id: 'id' },
      grava: true, exclui: true,                      // BotaoIA confere o perfil da sessão
      executar: async (p) => { await ApiCurso.excluirTarifa(Number(p.id)); return 'Tarifa excluída.'; } }
  }
};
```

### Ligar na tela livre — fim do `tarifas.html`

```html
<script src="assets/js/BotaoIA.js"></script>
<script src="assets/js/IATarifas.js"></script>
<script>
  window.addEventListener('load', function () {
    if (window.BotaoIA && window.IATarifas) BotaoIA.ligarNaTela({ manifesto: IATarifas,
      aoConcluir: function () { try { return typeof carregar === 'function' ? carregar() : null; } catch (e) { return null; } } });
  });
</script>
```

### Ligar sem editar a tela — linha no `HTML/assets/js/IATelas.js`

```js
// manifesto próprio
'reservas.html': { arquivo: 'IAReservas.js', manifesto: 'IAReservas', recarga: 'carregar' },
// cadastro simples de uma tabela (campos reais conferidos na API)
'formas_pagamento.html': { recarga: 'carregar', cfg: { tela: 'FORMAS_PAGAMENTO', titulo: 'Formas de Pagamento',
  recurso: 'formas-pagamento', chave: 'id_forma', principal: 'descricao', rotulo: 'forma de pagamento',
  exemplo: 'Ex.: cadastre a forma "Vale-viagem" com 30 dias para receber',
  campos: { descricao: ['txt', 'nome da forma'], tipo: ['txt', 'dinheiro, pix, debito, credito, transferencia ou outro'],
            dias_para_receber: ['num', 'dias'], ativo: ['bool', 'ativo'] },
  obrigatorios: ['descricao', 'tipo'], padroes: { ativo: 1, dias_para_receber: 0 } } },
```

### Checklist de pronto
- [ ] Botão IA aparece no grupo IA, ?, ✕, com 26px e sem negrito.
- [ ] Consulta responde sem gravar.
- [ ] Cadastro e alteração mostram o resumo; o Confirmar grava; a resposta só vem depois de conferir na API.
- [ ] Falta de dado gera pergunta, nunca gravação incompleta.
- [ ] Excluir com usuário comum é recusado.
- [ ] Sem chave de IA configurada: botão desabilitado com a dica, e a tela funciona normalmente.
- [ ] Comentário estruturado em cada ferramenta (O QUE FAZ, DEPENDÊNCIAS, REGRAS), conforme o CLAUDE.md.
