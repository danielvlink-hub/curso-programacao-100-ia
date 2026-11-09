/* Roteiro do treinamento "?" da tela modelo_browse.html (Cadastro de Hóspedes — modelo do curso). 08/11/2026.
   Cada passo: alvo (o que destaca), audio + texto (a fala), e a ação: digitar, escolher, clicar, limpar, fechar.
   quadro: '#janelaUpdate iframe' = o alvo está DENTRO da janela do update.
   Ao mudar um texto: python TREINAMENTOS/Hospedes/gerar_audios.py (regrava a voz). Nada é gravado no treino. */
window.TREINAMENTO = {
  titulo: 'Cadastro de Hóspedes',
  tela: '../../modelo_browse.html',
  quadros: ['../../modelo_browse_update.html'],
  ignorar: ['ativo', 'email', 'observacao'],
  passos: [
    {alvo: '#grade, body', audio: 'audio/step1.mp3',
     texto: 'Olá! Este é o Cadastro de Hóspedes da pousada. Vamos pesquisar e cadastrar um hóspede juntos. Fique tranquilo: no treinamento nada é gravado.'},
    {alvo: '#inputFiltro', digitar: 'Maria', audio: 'audio/step2.mp3',
     texto: 'A busca acha o hóspede pelo nome, documento, telefone ou cidade. Digitamos Maria e a lista filtra na hora.'},
    {alvo: '#selSituacao', escolher: 'Ativos', limpar: '#inputFiltro', audio: 'audio/step3.mp3',
     texto: 'Este filtro mostra só os hóspedes ativos ou só os inativos. Aqui escolhemos os ativos.'},
    {alvo: 'button[onclick="exportarCSV()"]', limpar: '#selSituacao', audio: 'audio/step4.mp3',
     texto: 'CSV e XLSX levam a lista para a planilha, do jeito que ela está filtrada na tela.'},
    {alvo: 'button[onclick="abrirUpdate()"]', clicar: true, audio: 'audio/step5.mp3',
     texto: 'Novo Hóspede abre o cadastro numa janela no meio da tela. Vamos preencher.'},
    {alvo: '#nome', quadro: '#janelaUpdate iframe', aguardar: 900, digitar: 'Carlos Andrade', audio: 'audio/step6.mp3',
     texto: 'Comece pelo nome completo do hóspede. Ele é obrigatório.'},
    {alvo: '#documento', quadro: '#janelaUpdate iframe', digitar: '321.654.987-00', audio: 'audio/step7.mp3',
     texto: 'O CPF ou documento não se repete: o sistema avisa se já existir outro hóspede com o mesmo.'},
    {alvo: '#telefone', quadro: '#janelaUpdate iframe', digitar: '(15) 99123-4567', audio: 'audio/step8.mp3',
     texto: 'O telefone, com DDD, também é obrigatório. É por ele que a recepção confirma a reserva.'},
    {alvo: '#cidade', quadro: '#janelaUpdate iframe', digitar: 'Sorocaba', audio: 'audio/step9.mp3',
     texto: 'Cidade de onde o hóspede vem.'},
    {alvo: '#uf', quadro: '#janelaUpdate iframe', digitar: 'SP', audio: 'audio/step10.mp3',
     texto: 'E o estado, com duas letras.'},
    {alvo: '#btnGravar', quadro: '#janelaUpdate iframe', fechar: '#janelaUpdate .btn-fechar', audio: 'audio/step11.mp3',
     texto: 'Gravar salva o hóspede e atualiza a lista. Cancelar, ou a tecla Esc, fecha sem gravar. Aqui vamos fechar sem gravar.'},
    {alvo: '.row-btn.edit', audio: 'audio/step12.mp3',
     texto: 'Na linha, o lápis altera o hóspede e a lixeira exclui, sempre pedindo confirmação. O duplo clique na linha também abre para alterar.'},
    {alvo: '.browse-header .btn-fechar, body', audio: 'audio/step13.mp3',
     texto: 'Pronto! Sempre que precisar, clique no botão de interrogação, ao lado do X, para ver este treinamento de novo.'}
  ]
};
