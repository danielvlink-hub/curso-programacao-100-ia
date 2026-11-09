# 95 — Bloco 2: motor de reservas, Reservas e Mapa com arrastar (prompt final da aula)

Construído ao vivo na aula de 08/11/2026, depois do Bloco 1 (prompt 94). Substitui os prompts 07 e 08 (mantidos só como
referência). Inspirado em PMS sofisticados (HITS e similares), com UX minimalista e já preparado para o motor de
reservas on-line.

**O que você vai ter no fim:** o motor de reservas na API (a regra única), a lista de reservas, o formulário com os
quartos livres e o preço, o **mapa de ocupação com agenda de arrastar** e a Luninha das reservas (IA e VOZ).

| Arquivo | O que é |
|---|---|
| `API FACILAPP SQLite\Reservas.cs` | IReservasRepository/ReservasSqlite, regras, disponibilidade, mover, cancelar, no-show, mapa e a rota pública |
| `HTML\BrowseReservas.html` + `RptReservas.html` + `assets\js\cadastros\Reservas.js` | lista e relatório pelo motor de telas (sem "Ativo"; lixeira = "Cancelar reserva") |
| `HTML\UpdateReservas.html` | o formulário da reserva (quartos livres com preço, hóspede novo na hora) |
| `HTML\mapa_ocupacao.html` | a agenda de arrastar |
| `HTML\assets\js\IAReservas.js` | a Luninha das reservas (lista e mapa) |

## O prompt

```
Crie o Bloco 2 do FastPousada: motor de reservas, Reservas e Mapa de ocupação com agenda de arrastar, sofisticado como
os bons PMS (HITS), com UX minimalista, já preparado para o motor de reservas on-line. Use SOMENTE a FacilApp API SQL
do curso (7777). Mostre um plano curto e espere o "pode". Comente cada função como um prompt e indente para humanos.

=== PARTE 1 — API: o motor de reservas (Reservas.cs) ===
1. Tabela reservas: id, codigo público (FP- + 5 letras/números sem 0/O/1/I), id_hospede, id_quarto, entrada, saida,
   adultos, criancas, situacao (PRE_RESERVA, CONFIRMADA, HOSPEDADO, ENCERRADA, CANCELADA, NO_SHOW), origem (BALCAO,
   TELEFONE, WHATSAPP, SITE, BOOKING, OUTRO), valor_diaria, valor_total, sinal_valor, sinal_pago, contato (nome,
   e-mail, telefone), observacao, expira_em, cancelado_motivo, checkin_em, checkout_em, criado_em, alterado_em.
   Interface IReservasRepository (multibanco) e ReservasSqlite.
2. Regras (na API): saída depois da entrada (máx. 90 noites); REGRA DO MEIO-DIA (conflito = entrada < outra.saida
   E saida > outra.entrada — a saída de um pode ser a entrada de outro); ocupam o quarto: confirmada, hospedado e
   pré-reserva dentro do prazo (24 h, se o sinal não foi pago); quarto ativo e não bloqueado (manutenção = aviso);
   hóspede ativo; capacidade do tipo; total = informado ou calculado noite a noite pelas tarifas do Bloco 1; mínimo de
   noites = AVISO (não barra o balcão); encerrada/cancelada não se altera; hospedado só pelo check-out (Bloco 3).
3. Rotas: GET /api/reservas (?de&ate&situacao&busca&id_quarto&id_hospede, com nome do hóspede, quarto e tipo),
   GET /{id}, POST (devolve id, código e avisos), PUT /{id}, PUT /{id}/mover {id_quarto, entrada, saida}
   (recalcula o total), POST /{id}/cancelar {motivo obrigatório}, POST /{id}/no-show (só a partir da entrada),
   GET /api/reservas/disponibilidade (quartos livres que cabem as pessoas, com o total de cada um),
   GET /api/mapa?de&dias (quartos, reservas do período e ocupação % por dia, numa chamada) e a PÚBLICA
   GET /api/publico/disponibilidade (tipos disponíveis e preço, sem dados pessoais, sem login — para o site).
4. CORS (RotasDasTelas) e menu ligado: op_reservas e sup_reservas → BrowseReservas.html; op_ocupacao e sup_ocupacao →
   mapa_ocupacao.html.
5. Teste numa cópia: reserva, meio-dia, conflito (dizendo quem ocupa), capacidade, aviso de mínimo, disponibilidade,
   mover, mover em conflito, cancelar sem/com motivo, mapa, pública sem login, privada sem login → 401. Publique.

=== PARTE 2 — Lista e relatório (motor de telas do Bloco 1) ===
6. Motor de telas com opções novas: semAtivo (sem coluna/filtro Ativo), excluir (troca a lixeira por outra ação) e
   manifestoIA (Luninha própria). Ficha Reservas: código, hóspede, quarto, tipo, entrada, saída, noites, situação
   (etiqueta colorida), origem, total; filtros situação e origem; botão Mapa; lixeira = "Cancelar reserva" (pede o
   motivo com FacilAppPerguntar).

=== PARTE 3 — Formulário da reserva (UpdateReservas.html) ===
7. Hóspede (busca digitando; "+" cadastra hóspede novo na hora só com nome e telefone), situação (confirmada ou
   pré-reserva), entrada, saída, adultos, crianças → QUARTOS LIVRES em cartões com o preço total (um clique escolhe;
   aviso de mínimo de noites no cartão), valor total (calculado, pode ajustar), origem, sinal + pago, observação;
   resumo: noites, quarto, diária média, total. Rodapé com o código. Aceita vir do mapa com id_quarto, entrada e saída.
   Hospedado/encerrada/cancelada = só consulta. Avisos da API aparecem sem impedir. 3px, sem barra.

=== PARTE 4 — Mapa de ocupação com arrastar (mapa_ocupacao.html) ===
8. Grade quartos × dias (14/21/30/60), colunas esticam para ocupar a tela, fim de semana sombreado, hoje destacado com
   linha vermelha, % de ocupação colorida por dia, ícone da situação do quarto (sujo, manutenção), quarto bloqueado
   hachurado, filtro por tipo, ◀ Hoje ▶, legenda.
9. Barras do MEIO-DIA da entrada ao MEIO-DIA da saída, cor pela situação (pré roxa, confirmada verde, hospedado
   laranja, encerrada cinza).
10. Gestos: clique num dia livre → reserva nova; ARRASTAR pelos dias livres → reserva nova no período (para no
    primeiro dia ocupado); ARRASTAR A BARRA → mover de quarto/data (fantasma tracejado + confirmação; a API decide);
    PUXAR A PONTA DIREITA → mudar a saída; clique na barra → abre a reserva. Formulário na janela central.
11. Luninha (IA e VOZ) no mapa e na lista com IAReservas.js: buscar_hospede, disponibilidade, listar_reservas,
    criar_reserva, alterar_reserva, mover_reserva, cancelar_reserva (motivo, vermelho), marcar_no_show, abrir_reserva.
12. Crie reservas de teste pela API em volta de hoje e confira com print o mapa, a lista e o formulário.
```

## Conferir no fim
- [ ] Menu e barra de cima: Reservas e Mapa ativos (sair e entrar de novo).
- [ ] Mapa: barras do meio-dia ao meio-dia; no 101 a Maria sai e o Carlos entra no mesmo dia.
- [ ] Arrastar por 3 dias livres do 107 → formulário com o 107 e as datas → escolher o hóspede → Gravar → barra nova.
- [ ] Arrastar uma barra para outro quarto livre → confirmar → muda e recalcula; para um quarto ocupado → recusado.
- [ ] Puxar a ponta de uma barra → muda a saída.
- [ ] Lista: filtro "Pré-reserva"; "Cancelar reserva" pede o motivo.
- [ ] Luninha: "tem quarto para 2 de sexta a domingo?" e "reserva o 108 para o João de 20 a 22".
