# 94 — Bloco 1: cadastros da hospedagem (prompt final da aula)

Construído ao vivo na aula de 08/11/2026. Substitui os prompts 03 a 06 (mantidos só como referência): em vez de cinco
telas copiadas, um **motor de cadastro** (na API e nas telas) e uma **ficha** por cadastro.

**O que você vai ter no fim:** Tipos de quarto, Quartos (com geração em lote), Tarifas (com cálculo noite a noite),
Serviços e produtos e Formas de pagamento — cada um com Browse, Update e Rpt, IA e VOZ da Luninha, ligados no menu.

| Arquivo | O que é |
|---|---|
| `API FACILAPP SQLite\Cadastros.cs` | motor de cadastro por ficha (ICadastroRepository + CadastroSqlite), as 5 fichas, quartos em lote, diárias noite a noite |
| `HTML\assets\js\CadastroPadrao.js` + `assets\css\CadastroPadrao.css` | motor das telas: browse, update, relatório e manifesto da Luninha |
| `HTML\assets\js\cadastros\<Nome>.js` | a ficha de cada cadastro (campos, colunas, filtros, extras, IA) |
| `HTML\Browse/Update/Rpt<Nome>.html` | 15 telas pequenas, cada uma com o comentário-prompt no topo |

## O prompt

```
Crie o Bloco 1 do FastPousada — Tipos de quarto, Quartos, Tarifas, Serviços e produtos e Formas de pagamento — com
UX minimalista (só os campos necessários), inspirado em PMS sofisticados (HITS e similares), já pensando no motor de
reservas on-line e nas reservas com agenda de arrastar do Bloco 2. Use SOMENTE a FacilApp API SQL do curso (7777).
Mostre um plano curto e espere o "pode". Comente cada função como um prompt e indente para humanos.

=== PARTE 1 — API: motor de cadastro por FICHA (Cadastros.cs) ===
1. Ficha = tabela, chave, rota, código do item de menu, campos (texto/inteiro/decimal/data/bool, obrigatório, tamanho,
   opções, mínimo, padrão), únicos (sem diferenciar maiúsculas), busca, ordem, usos que impedem excluir e validação extra.
2. Interface ICadastroRepository (multibanco) com a implementação CadastroSqlite: cria a tabela e acrescenta colunas
   novas sem apagar nada; nomes de tabela/coluna só da ficha (nunca do usuário); consultas parametrizadas.
3. Rotas por ficha: GET /api/<rota> (?busca= e filtros por campo), GET /{id}, POST, PUT /{id}, DELETE /{id}.
   Corpo lido como JSON livre e convertido campo a campo (aceita "180,00"); permissão pelo item de menu; mensagens em
   português; excluir registro em uso → "inative em vez de excluir".
4. Fichas:
   - Tipos de quarto (quartos_tipos): nome*, sigla*, capacidade_adultos*, capacidade_criancas, diaria_base*,
     comodidades (separadas por ;), descricao (para o site), ativo. Únicos: nome, sigla.
   - Quartos: numero*, id_tipo*, andar, situacao* (LIVRE, SUJO, MANUTENCAO, BLOQUEADO), observacao, ativo. Único: numero.
   - Tarifas: id_tipo*, descricao*, inicio*, fim*, dias_semana (0-6, 0=domingo), valor_diaria*, minimo_noites, ativo.
     Regra: sem outra tarifa ATIVA do mesmo tipo com período e dia da semana em comum (dizer qual conflita).
   - Serviços e produtos: nome*, categoria* (FRIGOBAR, RESTAURANTE, LAVANDERIA, PASSEIO, OUTROS), preco*, unidade, ativo.
   - Formas de pagamento: nome*, tipo* (DINHEIRO, PIX, CARTAO_DEBITO, CARTAO_CREDITO, TRANSFERENCIA, FATURADO),
     taxa_percentual, prazo_dias, ativo.
5. POST /api/quartos/lote {de, ate, id_tipo, andar}: cria os números que faltam (no máximo 200 por vez).
6. GET /api/tarifas/calcular?id_tipo&entrada&saida: valor de CADA noite (tarifa ativa que cobre a data e o dia da
   semana — a de período mais curto vence; sem tarifa, a diária base), total e mínimo de noites. Base do Bloco 2.
7. CORS para as rotas novas (lista RotasDasTelas no Program.cs) e menu ligado sozinho (cad_tipos_quarto,
   cad_quartos, cad_tarifas, cad_servicos, cad_pagamentos → Browse<Nome>.html).
8. Teste numa cópia da API (incluir, repetido, obrigatório, opção inválida, tipo inexistente, lote, tarifa que
   cruza, cálculo quinta→domingo, excluir em uso), publique e me peça para rodar o PS1 do serviço.

=== PARTE 2 — Telas: motor CadastroPadrao.js + uma ficha por cadastro ===
9. browse(ficha): cabeçalho 35px; Novo, extras da ficha, busca, filtros da ficha, situação; Relatório, CSV, XLSX,
   Recarregar; Tabulator (dados só no tableBuilt) com as colunas da ficha (moeda, data, dias, lista, ref, badge
   colorido da situação do quarto), Situação e Ações; duplo clique altera; janela do update central e arrastável que
   ajusta a altura ao conteúdo; botões IA e VOZ.
10. update(ficha): Sim/Não (Ativo) na LINHA 1; campos em grade de 6 colunas; tipos: texto, textarea, inteiro,
    decimal/moeda (vírgula), data, lista, ref (combo de outro cadastro), dias (chips Dom..Sáb), tags (chips com Enter);
    3px entre blocos; sem barra; valida obrigatórios; grava pela API e só depois avisa a lista.
11. relatorio(ficha): filtros (com o título do filtro), situação, prévia A4 na altura do conteúdo, Gerar PDF (jsPDF,
    cabeçalho repetido, Página X de Y), Imprimir, CSV, XLSX; ✕ volta para a lista (?de=browse).
12. manifesto(ficha): ferramentas da Luninha geradas da ficha (listar_x filtrando a grade, obter, incluir, alterar,
    excluir com confirmação vermelha, exportar_lista, abrir_relatorio) + extras da ficha (gerar_quartos_lote,
    calcular_diarias). Referências (tipos) vão como dados de apoio.
13. Fichas em assets/js/cadastros/ e as 15 telas Browse/Update/Rpt<Nome>.html (pequenas, com comentário-prompt).
14. Confira com print (dados simulados) a lista, o formulário e o relatório antes de entregar.
```

## Conferir no fim
- [ ] Menu: Tipos de quarto, Quartos, Tarifas, Serviços e produtos e Formas de pagamento ativos (sair e entrar de novo).
- [ ] Tipos: Standard (STD, 2 adultos, R$ 180,00) e Luxo; "standard" de novo → recusado.
- [ ] Quartos → Gerar em lote 101 a 110, tipo STD, 1º andar → 10 quartos; marcar o 102 como Sujo → etiqueta amarela.
- [ ] Tarifas: Fim de semana do Standard (sex e sáb, R$ 220, mínimo 2 noites); um feriado que cruza → recusado.
- [ ] Luninha (IA ou VOZ) na tela de Tarifas: "quanto fica o Standard de quinta a domingo?" → noite a noite.
- [ ] Serviços: Água mineral (Frigobar, R$ 5,50). Formas: Pix, Dinheiro, Cartão de crédito (taxa 3,2%, 30 dias).
- [ ] Excluir o tipo Standard (em uso) → "inative em vez de excluir". Relatório de Quartos → PDF.
