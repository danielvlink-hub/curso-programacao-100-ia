# FastPousada no celular (APK) — Android 5.0 ou superior

Aplicativo Android do curso **Programação 100% IA**. Ele leva **dentro** todas as telas do FastPousada (`C:\CURSO\HTML`) e
conversa com a **API 7777 do seu PC pelo Wi-Fi**. Funciona com Android 5.0 (API 21) ou superior, em celulares ARM de 32 ou
64 bits, e no emulador (x86_64).

## 1. Preparar o PC (uma vez)

A API do curso, por segurança, só aceita o próprio PC. Para o celular entrar:

1. **Troque a senha do usuário `facilapp`** (tela Usuários). Na rede, qualquer aparelho do mesmo Wi-Fi chega na API.
2. Crie o arquivo `C:\ProgramData\FacilApp\CursoApiSqlite\rede.txt` com o conteúdo `1`.
3. Libere a porta no Firewall do Windows **só na rede Particular** (PowerShell como administrador):
   ```powershell
   New-NetFirewallRule -DisplayName 'FacilApp Curso API 7777' -Direction Inbound -Protocol TCP -LocalPort 7777 -Profile Private -Action Allow
   ```
   A rede Wi-Fi do PC precisa estar como **Particular** (Configurações → Rede → Wi-Fi → Perfil de rede).
4. Reinicie o serviço da API (`FacilAppCursoSqlite`).
5. Descubra o IP do PC: Prompt de Comando → `ipconfig` → "Endereço IPv4" (ex.: `192.168.0.10`).

Para desligar: apague o `rede.txt` e reinicie o serviço — a API volta a aceitar só o PC.

## 2. Instalar no celular

1. Copie `FastPousada.apk` para o celular e abra o arquivo. Autorize "instalar apps desconhecidos" se o Android pedir.
2. Abra **FastPousada**, digite o endereço do PC com a porta (ex.: `192.168.0.10:7777`) e toque em **Conectar**.
3. Entre com o seu usuário. O Botão VOZ pede o microfone na primeira vez.

O endereço fica guardado. Para trocar: botão **Voltar** na primeira tela → **Trocar endereço do PC** (ou no painel de erro).

## Limites desta versão

- Exportar CSV/XLSX e imprimir/PDF ficam no computador (o WebView do Android não baixa nem imprime).
- O tráfego é `http` dentro da rede local: use só em Wi-Fi de confiança (casa/pousada), nunca em rede pública.
- Para depurar, conecte o celular no PC e abra `chrome://inspect` no Chrome.

## Compilar de novo

```powershell
.\compilar.ps1
```

O script copia as telas de `C:\CURSO\HTML` para `Assets\html`, compila, assina e confere. Usa as ferramentas portáteis do
APK do Gourmet (nada é instalado). Para uma atualização instalar por cima, aumente `ApplicationVersion` no
`FastPousada.Android.csproj` e use **a mesma chave**.

**A pasta `signing` é secreta** (chave + senha de assinatura): guarde em backup privado, nunca distribua nem publique.
O `Publicar-GitHub.ps1` já deixa `APK\signing`, `bin`, `obj` e `Assets` de fora.
