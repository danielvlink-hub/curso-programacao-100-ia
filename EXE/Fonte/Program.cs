using System.Diagnostics;
using System.Net;
using System.Reflection;
using System.Text.RegularExpressions;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace FastPousadaDesktop;

/*
 * FASTPOUSADA.EXE — o sistema do curso numa janela Windows, com as telas DENTRO do exe.
 * Daniel, 08/11/2026: "adicione o ícone no apk e no exe que você vai gerar em C#, chamando e embutindo os html,
 * deixando só a js config fora do exe" / "pasta C:\CURSO\EXE, aqui você coloca o exe".
 *
 * COMO FUNCIONA
 *   1. As telas (C:\CURSO\HTML) são recursos do próprio exe ("Conteudo/<caminho>"). Nada de pasta HTML ao lado.
 *   2. Um servidor local (HttpListener) em http://127.0.0.1:<porta> entrega esses recursos ao WebView2 (loopback:
 *      sem resolução de rede, e a página é "contexto seguro" — o microfone do Botão VOZ funciona). Porta: 58901 em
 *      diante, a primeira livre (mais de uma cópia aberta convive).
 *   3. O config.js FICA FORA do exe, ao lado dele. O exe injeta o config.js em TODA tela (e iframe) antes dos scripts
 *      dela; as telas leem FASTPOUSADA_CONFIG.api (endereço da API) e o título vem de FASTPOUSADA_CONFIG.nome.
 *      Também é servido em /config.js. Sem config.js: API http://127.0.0.1:7777 e título "FastPousada".
 *   4. A API 7777 aceita a origem http://127.0.0.1:<porta> (CORS do Program.cs da API — só origens locais).
 * ENTRADAS: config.js ao lado do exe. SAÍDAS: janela; estado (maximizada ou não) em %LOCALAPPDATA%\FacilApp\FastPousada.
 * REGRAS: só serve arquivos embutidos (nunca o disco, fora o config.js); links externos abrem no navegador padrão;
 *   o microfone só é liberado para a própria origem local.
 */
internal static class Program
{
    [STAThread]
    private static void Main()
    {
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new JanelaPrincipal());
    }
}

internal sealed class JanelaPrincipal : Form
{
    private readonly WebView2 _web = new();
    private HttpListener? _servidor;
    private int _porta;
    private const int PortaInicial = 58901, PortaFinal = 58999;
    private static readonly string PastaExe = AppContext.BaseDirectory;
    private static readonly string ArquivoConfig = Path.Combine(PastaExe, "config.js");

    private static readonly Dictionary<string, string> Tipos = new(StringComparer.OrdinalIgnoreCase)
    {
        [".html"] = "text/html; charset=utf-8", [".htm"] = "text/html; charset=utf-8", [".css"] = "text/css; charset=utf-8",
        [".js"] = "text/javascript; charset=utf-8", [".json"] = "application/json; charset=utf-8", [".svg"] = "image/svg+xml",
        [".png"] = "image/png", [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".gif"] = "image/gif", [".webp"] = "image/webp",
        [".ico"] = "image/x-icon", [".woff"] = "font/woff", [".woff2"] = "font/woff2", [".ttf"] = "font/ttf", [".otf"] = "font/otf",
        [".mp3"] = "audio/mpeg", [".mp4"] = "video/mp4", [".webm"] = "video/webm", [".map"] = "application/json; charset=utf-8",
        [".txt"] = "text/plain; charset=utf-8", [".pdf"] = "application/pdf", [".csv"] = "text/csv; charset=utf-8"
    };

    // nome do recurso em minúsculas → nome real (o disco não liga para maiúscula/minúscula; o manifesto liga)
    private static readonly Dictionary<string, string> Recursos = Assembly.GetExecutingAssembly().GetManifestResourceNames()
        .Where(n => n.StartsWith("Conteudo/", StringComparison.Ordinal))
        .ToDictionary(n => n, n => n, StringComparer.OrdinalIgnoreCase);

    public JanelaPrincipal()
    {
        Text = LerNome();
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch (Exception) { /* sem ícone */ }
        // tamanho: 1360x860 centralizado; se não couber na tela (ou a última vez foi maximizada), abre maximizado
        Width = 1360; Height = 860; StartPosition = FormStartPosition.CenterScreen;
        var area = Screen.FromPoint(Cursor.Position).WorkingArea;
        var salvo = LerEstado();
        if (salvo == "max" || (salvo == null && (area.Width < Width || area.Height < Height))) WindowState = FormWindowState.Maximized;
        FormClosing += (_, _) => GravarEstado(WindowState == FormWindowState.Maximized ? "max" : "normal");
        // fundo na cor do login enquanto o WebView2 não desenha a primeira tela
        var cor = Color.FromArgb(0xD6, 0xEA, 0xD1);
        BackColor = cor; _web.DefaultBackgroundColor = cor; _web.Dock = DockStyle.Fill;
        Controls.Add(_web);
        Load += async (_, _) => await IniciarAsync();
    }

    /** LerConfig — o texto do config.js ao lado do exe ("" se não existir). */
    private static string LerConfig()
    {
        try { return File.Exists(ArquivoConfig) ? File.ReadAllText(ArquivoConfig) : ""; } catch (Exception) { return ""; }
    }

    /** LerNome — título da janela a partir de FASTPOUSADA_CONFIG.nome (padrão "FastPousada"). */
    private static string LerNome()
    {
        var m = Regex.Match(LerConfig(), @"nome\s*:\s*['""]([^'""]+)['""]");
        return m.Success ? m.Groups[1].Value.Trim() : "FastPousada";
    }

    private static string ArquivoEstado() =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FacilApp", "FastPousada", "janela.txt");
    private static string? LerEstado()
    {
        try { var v = File.ReadAllText(ArquivoEstado()).Trim(); return v is "max" or "normal" ? v : null; } catch (Exception) { return null; }
    }
    private static void GravarEstado(string estado)
    {
        try { Directory.CreateDirectory(Path.GetDirectoryName(ArquivoEstado())!); File.WriteAllText(ArquivoEstado(), estado); } catch (Exception) { }
    }

    /** IniciarAsync — sobe o servidor local, prepara o WebView2 (config injetado, microfone, links) e abre o login. */
    private async Task IniciarAsync()
    {
        // RUNTIMES (Daniel, 08/11/2026: "não esquecer do runtime C# e .NET"): o .NET já vem DENTRO deste exe (self-contained).
        // O WebView2 (motor das telas) é do Windows: vem no 11 e nos 10 atualizados. Se faltar, avisa e abre o instalador
        // oficial da Microsoft (evergreen) — nada é baixado sem o usuário concordar.
        if (!TemWebView2())
        {
            if (MessageBox.Show("Este computador não tem o Microsoft Edge WebView2 Runtime, que o FastPousada usa para mostrar as telas.\n\n" +
                    "Abrir agora a página oficial da Microsoft para instalar? (gratuito, cerca de 2 MB). Depois de instalar, abra o FastPousada de novo.",
                    "FastPousada", MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
                AbrirFora("https://go.microsoft.com/fwlink/p/?LinkId=2124703");
            Close();
            return;
        }
        try
        {
            IniciarServidor();
            var dados = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FacilApp", "FastPousada", "WebView2");
            Directory.CreateDirectory(dados);
            var ambiente = await CoreWebView2Environment.CreateAsync(userDataFolder: dados);
            await _web.EnsureCoreWebView2Async(ambiente);
            var core = _web.CoreWebView2;

            // o config.js (fora do exe) roda antes dos scripts de TODA tela e iframe
            var config = LerConfig();
            if (config.Length > 0) await core.AddScriptToExecuteOnDocumentCreatedAsync(config);

            // microfone/câmera do Botão VOZ: só para a própria origem local
            core.PermissionRequested += (_, e) =>
            {
                var daCasa = e.Uri.StartsWith($"http://127.0.0.1:{_porta}/", StringComparison.OrdinalIgnoreCase);
                e.State = daCasa && e.PermissionKind == CoreWebView2PermissionKind.Microphone
                    ? CoreWebView2PermissionState.Allow : CoreWebView2PermissionState.Default;
            };
            // links para fora (site, WhatsApp, e-mail) abrem no navegador padrão; telas do sistema ficam aqui
            core.NewWindowRequested += (_, e) =>
            {
                if (EhDaCasa(e.Uri)) return;
                e.Handled = true; AbrirFora(e.Uri);
            };
            core.NavigationStarting += (_, e) =>
            {
                if (EhDaCasa(e.Uri) || e.Uri.StartsWith("about:") || e.Uri.StartsWith("data:") || e.Uri.StartsWith("blob:")) return;
                e.Cancel = true; AbrirFora(e.Uri);
            };
            core.DocumentTitleChanged += (_, _) =>
            {
                var t = core.DocumentTitle;
                if (string.IsNullOrWhiteSpace(t) || t.StartsWith("http", StringComparison.OrdinalIgnoreCase)) return;
                var nome = LerNome();   // "FastPousada — Login" já tem o nome: não repete
                Text = t.Contains(nome, StringComparison.OrdinalIgnoreCase) ? t : nome + " — " + t;
            };
            core.Navigate($"http://127.0.0.1:{_porta}/login_Geral.html");
        }
        catch (Exception ex)
        {
            MessageBox.Show("Não foi possível abrir o FastPousada.\n\n" + ex.Message +
                "\n\nConfira se o Microsoft Edge WebView2 Runtime está instalado.", "FastPousada", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    /** TemWebView2 — o WebView2 Runtime está instalado? (a versão vem vazia ou dá erro quando não está) */
    private static bool TemWebView2()
    {
        try { return !string.IsNullOrEmpty(CoreWebView2Environment.GetAvailableBrowserVersionString()); }
        catch (Exception) { return false; }
    }

    private bool EhDaCasa(string uri) => uri.StartsWith($"http://127.0.0.1:{_porta}/", StringComparison.OrdinalIgnoreCase);
    private static void AbrirFora(string uri)
    {
        if (!Uri.TryCreate(uri, UriKind.Absolute, out var u) || u.Scheme is not ("http" or "https" or "mailto" or "tel" or "whatsapp")) return;
        try { Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true }); } catch (Exception) { }
    }

    // =============================================================================================
    // SERVIDOR LOCAL (só 127.0.0.1) — entrega os recursos embutidos e o config.js de fora
    // =============================================================================================
    /** IniciarServidor — a primeira porta livre de 58901 a 58999. */
    private void IniciarServidor()
    {
        var emUso = new HashSet<int>();
        try { foreach (var ep in System.Net.NetworkInformation.IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners()) emUso.Add(ep.Port); }
        catch (Exception) { }
        for (var porta = PortaInicial; porta <= PortaFinal; porta++)
        {
            if (emUso.Contains(porta)) continue;
            var s = new HttpListener();
            try
            {
                s.Prefixes.Add($"http://127.0.0.1:{porta}/");
                s.Start();
                _servidor = s; _porta = porta;
                s.BeginGetContext(Atender, null);
                return;
            }
            catch (Exception) { try { s.Close(); } catch (Exception) { } }
        }
        throw new InvalidOperationException($"Nenhuma porta livre de {PortaInicial} a {PortaFinal} para o servidor local.");
    }

    /** Atender — um pedido do WebView2: /config.js vem de fora; o resto, dos recursos do exe. */
    private void Atender(IAsyncResult ar)
    {
        if (_servidor is not { IsListening: true }) return;
        HttpListenerContext ctx;
        try { ctx = _servidor.EndGetContext(ar); } catch (Exception) { return; }
        try { _servidor.BeginGetContext(Atender, null); } catch (Exception) { }
        try
        {
            var caminho = Uri.UnescapeDataString(ctx.Request.Url!.AbsolutePath.TrimStart('/'));
            if (caminho == "") caminho = "login_Geral.html";
            byte[]? bytes = caminho.Equals("config.js", StringComparison.OrdinalIgnoreCase)
                ? System.Text.Encoding.UTF8.GetBytes(LerConfig())
                : LerRecurso(caminho);
            if (bytes == null) { ctx.Response.StatusCode = 404; ctx.Response.Close(); return; }
            var ext = Path.GetExtension(caminho);
            ctx.Response.ContentType = Tipos.TryGetValue(ext, out var t) ? t : "application/octet-stream";
            // telas e config sempre frescas; o resto (css, js, fontes, imagens) pode vir do cache
            ctx.Response.Headers["Cache-Control"] = ext is ".html" or ".htm" || caminho.EndsWith("config.js", StringComparison.OrdinalIgnoreCase)
                ? "no-store" : "public, max-age=86400";
            ctx.Response.ContentLength64 = bytes.Length;
            if (ctx.Request.HttpMethod != "HEAD") ctx.Response.OutputStream.Write(bytes, 0, bytes.Length);
            ctx.Response.Close();
        }
        catch (Exception) { try { ctx.Response.StatusCode = 500; ctx.Response.Close(); } catch (Exception) { } }
    }

    /** LerRecurso — os bytes de um arquivo embutido (caminho com barra normal, sem a barra inicial), ou null. */
    private static byte[]? LerRecurso(string caminho)
    {
        if (!Recursos.TryGetValue("Conteudo/" + caminho.Replace('\\', '/'), out var nome)) return null;
        using var r = Assembly.GetExecutingAssembly().GetManifestResourceStream(nome);
        if (r == null) return null;
        using var m = new MemoryStream();
        r.CopyTo(m);
        return m.ToArray();
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        try { _servidor?.Stop(); } catch (Exception) { }
        base.OnFormClosed(e);
    }
}
