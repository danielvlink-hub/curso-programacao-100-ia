/* config.js do kit FacilApp Doc (13/09/2026).
   So a camada SQL (SQL.js) le isto. O FacilApp Doc abre, edita, importa e grava
   pela janela "Salvar como" do Windows sem API nenhuma; a API so e usada na
   reserva do Gravar como (janela do FacilApp, grava no servidor) e nas funcoes
   de modelo de contrato.

   Ao colocar em outro projeto (Gourmet etc.): se o projeto ja tem um config.js
   que define window.FacilAppConfig, apague este arquivo e aponte o <script> do
   FacilAppDoc.html para o config.js do projeto. */
window.FacilAppConfig = Object.assign({
  Endpoint_FacilApp_SQL: 'http://127.0.0.1',
  Porta_FacilApp_SQL: 5050,
  IP_API: 'http://127.0.0.1:5050',
  Endpoint_FacilApp_Services: 'http://127.0.0.1',
  Porta_FacilApp_Services: 7070,
  Tipo_Banco: 'sqlserver',      /* sqlserver | postgresql | sqlite */
  tipo_banco: 'sqlserver',
  Banco_Api: 'VLINK',
  Timeout_Ms: 20000,
  Sistema: 'CEREAIS'
}, window.FacilAppConfig || {});
