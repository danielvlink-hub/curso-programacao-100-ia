# 101 — O EXE com tudo embutido em C# e conferindo o APK gerado (prompt final da aula)

Construído ao vivo na aula de 08/11/2026, depois do prompt 100 (telas para celular e o APK). O FastPousada vira um
programa Windows de um arquivo só, com todas as telas dentro, e o APK ganha o ícone e é conferido por dentro.

## O prompt

```
Gere o FastPousada.exe em C# com TODAS as telas embutidas e deixe só o config.js fora do exe. Coloque o ícone
HTML\icon_facilapp_ambar.ico no exe e no APK. Use SOMENTE a FacilApp API SQL do curso (7777). Mostre um plano curto e
espere o "pode". Faça backup antes de mudar. Comente cada função como um prompt e indente para humanos. Não instale nem
baixe nada sem me pedir antes (confira primeiro o que já está no cache do NuGet).

=== PARTE 1 — O EXE (pasta C:\CURSO\EXE, código em C:\CURSO\EXE\Fonte) ===
1. Projeto WinForms + WebView2 (.NET 10, net10.0-windows), AssemblyName FastPousada, ApplicationIcon com o ícone âmbar.
   Publicação self-contained, um arquivo só, win-x64 (o .NET vai DENTRO: ninguém instala .NET).
2. As telas (C:\CURSO\HTML, sem os arquivos de teste) viram EmbeddedResource, um por arquivo, com nome lógico
   "Conteudo/<caminho com barra normal>". Nada de pasta HTML ao lado do exe.
3. Servidor local (HttpListener) em http://127.0.0.1:<porta> entrega os recursos embutidos ao WebView2 — porta a
   partir de 58901, a primeira livre (mais de uma cópia aberta convive). Tipo de cada arquivo (MIME) certo; .html e
   config.js sem cache, o resto com cache; arquivo que não existe → 404; nunca sai da lista de recursos.
4. O config.js FICA FORA do exe, ao lado dele: var FASTPOUSADA_CONFIG = { api: 'http://127.0.0.1:7777', nome:
   'FastPousada' }. O exe injeta o config.js em TODA tela e iframe antes dos scripts dela
   (AddScriptToExecuteOnDocumentCreatedAsync). O ApiCurso.js e o login usam FASTPOUSADA_CONFIG.api quando existir
   (no navegador, sem config, tudo continua igual). O título da janela vem do nome (sem repetir o nome da tela).
5. A API aceita a origem local do exe: CORS para "null" (arquivo e APK) e para http://127.0.0.1:<porta> e
   localhost:<porta> — devolvendo a própria origem; qualquer origem de fora do PC continua recusada. Publique a API.
6. WebView2: microfone (Botão VOZ) liberado só para a própria origem local; links externos abrem no navegador padrão;
   janela 1360x860 centralizada (ou maximizada se não couber; lembra a última escolha); fundo na cor do login.
7. RUNTIMES: o .NET vai dentro. O WebView2 Runtime vem no Windows 11/10 atualizado; se faltar, o exe AVISA e abre a
   página oficial da Microsoft para instalar (não baixa nada sozinho).
8. compilar.ps1: copia as telas para Fonte\Conteudo, copia o ícone, publica e coloca C:\CURSO\EXE\FastPousada.exe ao
   lado do config.js (que nunca é sobrescrito). LEIA-ME.md com runtimes, uso e como gerar de novo.
9. Teste com o exe aberto: o servidor local entrega login, config.js (de fora), ApiCurso.js e uma tela; arquivo
   inexistente dá 404; o login na API com a origem do exe volta com o CORS certo; abrir e fechar 3 vezes.
10. GitHub: Fonte\Conteudo, saida, bin e obj ficam de fora (são gerados no build).

=== PARTE 2 — O APK com o ícone e conferido por dentro ===
11. Converta o ícone âmbar em PNG para Resources\drawable do APK, aumente ApplicationVersion (atualização instala por
    cima com a mesma chave) e recompile com o compilar.ps1 do APK.
12. Me mostre o APK por dentro (aapt2 dump badging e a lista do pacote): nome do pacote, versão, Android mínimo
    (minSdk 21 = Android 5.0), permissões (internet e microfone), processadores, o ícone embutido e quantas telas
    foram para dentro; e a assinatura conferida pelo apksigner.
13. Explique: o Windows não mostra o ícone de um .apk (para ele é só um pacote) — o ícone aparece no celular instalado.
```

## Conferir no fim
- [ ] `C:\CURSO\EXE` tem só `FastPousada.exe` + `config.js` (+ LEIA-ME, compilar.ps1 e a Fonte); o exe tem o ícone âmbar.
- [ ] Abrir o exe → tela de login; entrar e navegar pelo menu como no navegador.
- [ ] Trocar `nome` no config.js → fechar e abrir → o título da janela muda.
- [ ] No celular, o APK novo instala por cima do anterior e mostra o ícone âmbar.
