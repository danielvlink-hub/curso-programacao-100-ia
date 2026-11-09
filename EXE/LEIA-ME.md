# FastPousada.exe — o sistema do curso numa janela do Windows

Um arquivo só, com **todas as telas dentro**. Ao lado dele fica apenas o **`config.js`**.

| Arquivo | O que é |
|---|---|
| `FastPousada.exe` | o sistema (telas, .NET e o servidor local, tudo dentro) |
| `config.js` | a configuração: endereço da API e o nome da janela — **o único arquivo fora do exe** |
| `Fonte\` | o código-fonte em C# (`Program.cs`, `FastPousada.Desktop.csproj`, ícone) |
| `compilar.ps1` | gera o exe de novo a partir de `C:\CURSO\HTML` |

## Runtimes (o que o computador precisa)

- **.NET / C#:** já vem **dentro** do exe (publicado *self-contained*). Não precisa instalar .NET.
- **Microsoft Edge WebView2 Runtime:** é o motor que mostra as telas. Já vem no **Windows 11** e nos **Windows 10**
  atualizados. Se faltar, o FastPousada avisa e abre a página oficial da Microsoft para instalar (gratuito, ~2 MB).
- **API do curso (FacilAppCursoSqlite):** precisa estar rodando — local (`http://127.0.0.1:7777`) ou em outro PC da rede.
- Windows 10 ou 11, 64 bits.

## Usar

1. Deixe `FastPousada.exe` e `config.js` **na mesma pasta**.
2. Abra o `FastPousada.exe` e entre com o seu usuário.

Para usar a API de outro computador da rede, troque em `config.js` (ex.: `api: 'http://192.168.0.10:7777'`) — aquele PC
precisa do `rede.txt` e da porta liberada no firewall (ver `C:\CURSO\APK\LEIA-ME.md`). Mudou o config? Feche e abra de novo.
Nunca coloque senha, token ou chave no `config.js`.

## Como funciona (para quem vai mexer)

As telas viram recursos do exe; um servidor local em `http://127.0.0.1:58901` (ou a próxima porta livre) as entrega ao
WebView2. O `config.js` é lido de fora e injetado em toda tela antes dos scripts dela (`FASTPOUSADA_CONFIG.api`). A API
aceita essa origem local (CORS só para `127.0.0.1`/`localhost`). Exportar CSV/XLSX e imprimir funcionam como no navegador;
o microfone do Botão VOZ é liberado só para a própria origem local.

## Gerar de novo

```powershell
.\compilar.ps1
```

Copia as telas de `C:\CURSO\HTML` para `Fonte\Conteudo`, publica e coloca o novo `FastPousada.exe` aqui (o `config.js` não
é sobrescrito). Feche o FastPousada antes de compilar.
