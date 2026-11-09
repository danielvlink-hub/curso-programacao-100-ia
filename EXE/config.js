/*
  config.js do FastPousada.exe — o ÚNICO arquivo fora do exe (Daniel, 08/11/2026: "deixando só a js config fora do exe").
  O exe lê este arquivo a cada abertura e o injeta em todas as telas antes dos scripts delas.
    api  → endereço da FacilApp API SQL do curso: o próprio PC (http://127.0.0.1:7777) ou o IP de outro PC na rede local
           (ex.: http://192.168.0.10:7777 — aquele PC precisa do rede.txt e da porta liberada no firewall).
    nome → título da janela.
  Mudou aqui? Feche e abra o FastPousada.exe de novo. Nunca coloque senha, token ou chave neste arquivo.
*/
var FASTPOUSADA_CONFIG = {
  api: 'http://127.0.0.1:7777',
  nome: 'FastPousada'
};
