# 100 — Telas e CSS para celular Android e o APK com tudo embutido (prompt final da aula)

Construído ao vivo na aula de 08/11/2026, depois dos Blocos 1 a 5. Primeiro as telas se adaptam a qualquer celular
(do pequeno de 360 px ao iPhone Pro Max de 430 px, com o Samsung A55 de 384 px como referência); depois o FastPousada
vira um aplicativo Android (APK, Android 5.0 ou superior) com todas as telas dentro, falando com a API do PC pelo Wi-Fi.

## O prompt

```
Deixe o FastPousada pronto para o celular e gere o APK Android com tudo embutido. Use SOMENTE a FacilApp API SQL do curso
(7777). Mostre um plano curto e espere o "pode". Faça backup antes de mudar. Comente cada função como um prompt e
indente para humanos. Não instale nada sem me pedir antes.

=== PARTE 1 — Telas e CSS para celular (sem mudar nada no computador) ===
1. Todas as regras novas ficam dentro de @media (max-width: 760px), no CSS comum (CadastroPadrao.css) que todas as
   telas já carregam, com "html body" na frente para valer sobre o <style> de cada tela. No computador, nada muda.
2. Cabeçalho: o título encolhe, o subtítulo some, e IA · VOZ · × ficam sempre visíveis. Barra de ferramentas quebra em
   linhas; a busca ocupa a linha inteira. Botões e campos com 30 px de altura (alvo de toque).
3. Listas (Tabulator): responsiveLayout "hide" no celular — as colunas da direita somem primeiro; a 1ª coluna e as
   Ações (editar, excluir, estornar) nunca somem.
4. Formulários: 2 colunas; campo pequeno (Número, Complemento, Cidade, UF) divide a linha. No formulário da reserva:
   Entrada | Saída, Adultos | Crianças, quartos livres em 2 colunas iguais e Valor total | Origem | Sinal + Pago na mesma
   linha (grade de 12 partes: 3 · 4 · 3 · 2).
5. Janela central (formulário sobre a lista): tela cheia no celular; a barra do título em cima e o formulário no resto;
   a PÁGINA rola (html com overflow auto), para os botões Cancelar e Gravar nunca sumirem.
6. Telas de duas colunas viram uma coluna que rola: Check-in/Estadia/Check-out (lista em cima, conta embaixo; ao tocar
   num hóspede, rola até a conta), Caixa, Painel de Hoje e Relatórios (cartões 2 por linha). Os quadros não encolhem
   dentro da coluna que rola (flex-shrink: 0). Gráficos e tabelas largas rolam de lado (SVG no tamanho real, sem
   esticar). O mapa de ocupação rola de lado como no computador.
7. Menu (index.html): no topo só ☰, logo e os atalhos (que rolam de lado); tema, selo e nome do usuário somem. O menu
   geral abre na tela toda, em 2 colunas.
8. Painel de Hoje: botão "Nova reserva" e toque num quarto livre já abre a reserva com o quarto, de hoje para amanhã
   (o mesmo formulário da lista e do mapa, na janela central).
9. Teste com print em 360, 384 e 430 px ao mesmo tempo (as telas dentro de molduras do tamanho exato de cada celular,
   com os dados reais da API) e confira que no computador (1280 px) tudo continua igual.

=== PARTE 2 — A API aceitar o Wi-Fi (opcional e desligado por padrão) ===
10. A API só escuta no próprio PC (127.0.0.1). Ela passa a escutar na rede (0.0.0.0) SOMENTE se existir o arquivo
    rede.txt com "1" na pasta de dados (ProgramData\FacilApp\CursoApiSqlite). Sem o arquivo, nada muda.
11. O login e o ApiCurso.js aceitam localhost OU o IP do PC na rede local (10.x, 172.16–31.x, 192.168.x) com porta —
    nunca um endereço da internet.
12. Me avise dos cuidados: trocar a senha do usuário facilapp antes de ligar a rede; liberar a porta 7777 no Firewall
    do Windows só no perfil Particular (o comando é meu, você só me mostra); usar só em Wi-Fi de confiança (é http).

=== PARTE 3 — O APK (pasta C:\CURSO\APK) ===
13. Projeto .NET para Android (C#) com WebView: SupportedOSPlatformVersion 21 (Android 5.0), ApplicationId
    br.com.facilapp.fastpousada, ARM 32/64 e x86_64 (emulador). Permissões: INTERNET, RECORD_AUDIO (Botão VOZ);
    usesCleartextTraffic (http na rede local). Ícone próprio.
14. As telas vão DENTRO do APK: o script copia C:\CURSO\HTML para Assets\html (sem arquivos de teste) e o app abre
    file:///android_asset/html/login_Geral.html?api=http://IP:porta.
15. 1º uso: pede o endereço do PC (ex.: 192.168.0.10:7777), aceita só IP da rede local, confere se a API responde
    (GET /status) e só então abre o login. Sem resposta: painel com o que conferir (PC ligado, mesmo Wi-Fi, rede.txt,
    firewall) + "Tentar de novo" e "Trocar endereço do PC".
16. Botão VOZ: o WebChromeClient pede o microfone ao Android (6.0+) e libera para a tela. Voltar: volta a tela; na
    primeira, pergunta Sair / Trocar endereço do PC / Ficar. Links externos abrem no navegador. Depuração pelo
    chrome://inspect ligada.
17. compilar.ps1: copia as telas, cria a chave de assinatura na 1ª vez (senha aleatória), compila em Release, assina,
    confere com apksigner (--min-sdk-version 21) e deixa C:\CURSO\APK\FastPousada.apk com o SHA-256.
18. A pasta signing é SECRETA: fica fora do GitHub (.gitignore e o script de publicação), junto com bin, obj e Assets.
19. LEIA-ME.md: preparar o PC, instalar no celular, trocar o endereço, limites (exportar e imprimir ficam no computador)
    e como compilar de novo (aumentar ApplicationVersion e usar a mesma chave).
20. No fim, me mostre: Android mínimo, permissões, quantas telas foram para dentro do APK e a assinatura conferida.
```

## Conferir no fim
- [ ] F12 no navegador → Samsung A55 (ou 384 × 832): nada vaza para a direita; IA · VOZ · × aparecem em todas as telas.
- [ ] Nova reserva no celular: Entrada | Saída na mesma linha, quartos em 2 colunas, rola até o Gravar.
- [ ] No computador, tudo igual a antes.
- [ ] `rede.txt` + firewall + reiniciar o serviço → o celular no mesmo Wi-Fi abre o FastPousada pelo APK.
- [ ] Botão VOZ no celular pede o microfone e a Luninha fala.
