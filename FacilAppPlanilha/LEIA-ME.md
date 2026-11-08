# FacilApp Planilha — kit para outros projetos

Planilha do FacilApp (13/09/2026) sobre o FortuneSheet. Pasta autocontida: copie a
pasta `FacilAppPlanilha` inteira para o projeto e abra
`FacilAppPlanilha/FacilAppPlanilha.html`. Caminhos relativos, sem internet e sem API.

## O que faz
- Fórmulas, formatação, bordas, mesclar, congelar, filtro, classificação,
  formatação condicional, validação, comentários, imagens, links, localizar e várias abas.
- Tudo em português (`js/PlanilhaLocalePt.js`), formatos de data e moeda do Brasil.
- Abrir `.xlsx`, `.xlsm`, `.xls`, `.ods`, `.csv` e `.json`; arrastar o arquivo para a grade também abre.
- Gravar como pela janela do Windows (Chrome/Edge), Ctrl+S:
  - `.xlsx` — valores, fórmulas, formatos, fontes, cores, bordas, mesclas, larguras, congelamento e links;
  - `.csv` — só a aba ativa, sem formatação;
  - `.json` — formato próprio, guarda todos os recursos.

## Estrutura
| Pasta | Conteúdo |
|---|---|
| `FacilAppPlanilha.html` | a tela |
| `js/` | `Planilha.js` (tela), `PlanilhaExcel.js` (xlsx/xls/ods/csv), `PlanilhaLocalePt.js` (português), `browse.js`, `TemaInicial.js`, `TemaBrowseBalanca.js` |
| `css/` | `TemaFacilApp.css`, `browse.css`, `Planilha.css` |
| `fontes/` | fontes e ícones offline |
| `dependencias/` | react-18.3.1, fortune-sheet-1.0.4, exceljs-4.4.0, sheetjs-0.20.3 |

O `fortune-sheet-1.0.4/index.umd.min.js` tem ajustes do FacilApp (idioma, barra
em 2 linhas, textos em chinês): ver `dependencias/fortune-sheet-1.0.4/LEIA-ME-FACILAPP.txt`.
Não troque por uma cópia baixada da internet.

## Ao instalar em outro projeto
1. Copie a pasta inteira.
2. Menu: aponte o item para `FacilAppPlanilha/FacilAppPlanilha.html`. Dentro do menu, o X
   pede para fechar com `postMessage({origem:'FACILAPP_FECHAR_TELA'})`.

## Origem
Cópia de `HTML/Planilha.html` e `assets/` do FacilApp Cereais. Corrigir no Cereais
e copiar de novo, para as duas versões não se separarem.
