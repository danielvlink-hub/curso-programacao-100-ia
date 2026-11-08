# FacilApp Doc — kit para outros projetos

Editor de texto do FacilApp (13/09/2026). Pasta autocontida: copie a pasta
`FacilAppDoc` inteira para o projeto e abra `FacilAppDoc/FacilAppDoc.html`.
Todos os caminhos são relativos e nada vem da internet.

## O que faz
- Abrir `.docx`, `.rtf`, `.doc` (HTML), `.html` e `.pdf` (o PDF é convertido em DOCX pela API FacilApp: `POST /api/documentos/pdf-para-docx`).
- Editor Jodit 4 com régua, margens, papel e orientação.
- Macros de data: `#DATA#`, `#DATARODAPE#`, `#DIA#`, `#MES#`, `#ANO#`.
- Preview e impressão.
- Gravar como pela janela do Windows (`showSaveFilePicker`, Chrome/Edge):
  `.docx`, `.doc`, `.rtf`, `.html` e `.pdf` — qualquer pasta, inclusive o G: do Google Drive.
  Sem essa janela, usa a janela do FacilApp que grava no servidor pela API.

## Estrutura
| Pasta | Conteúdo |
|---|---|
| `FacilAppDoc.html` | a tela |
| `js/` | `browse.js` (moldura, mensagens, arrasto), `SQL.js` + `config.js` (API), `SQLModeloContrato.js` (gera .docx), `SQLArquivos.js` + `SalvarComo.js` (janela Salvar como do FacilApp), `HtmlParaRtf.js`, `PdfFacilApp.js`, `Extenso.js`, `ImpressaoBalanca.js`, `TemaInicial.js`, `TemaBrowseBalanca.js` |
| `css/` | `TemaFacilApp.css` (temas), `browse.css`, `SalvarComo.css` |
| `fontes/` | fontes e ícones offline (Inter, Material Symbols...) |
| `dependencias/` | jodit-4, mammoth-1.8.0, rtfjs-3.0.9, pdf-lib-1.17.1 (todas MIT/Apache) |

## Ao instalar em outro projeto
1. Copie a pasta inteira.
2. `js/config.js`: ajuste `IP_API` e `Tipo_Banco`, ou use o config do projeto (ver o topo do arquivo).
3. Menu: aponte o item para `FacilAppDoc/FacilAppDoc.html`. Dentro do menu, o X pede
   para fechar com `postMessage({origem:'FACILAPP_FECHAR_TELA'})`.
4. O tema vem do `localStorage` do usuário (`TemaInicial.js`) e do menu pai (`TemaBrowseBalanca.js`).

## Origem
Cópia de `HTML/FacilAppDoc.html` e `assets/` do FacilApp Cereais. Corrigir no
Cereais e copiar de novo, para as duas versões não se separarem.
