using Android.App;
using Android.Content;
using Android.Content.PM;
using Android.Graphics;
using Android.OS;
using Android.Text;
using Android.Views;
using Android.Webkit;
using Android.Widget;
using System.Text.RegularExpressions;

namespace FacilApp.FastPousada;

/*
 * FASTPOUSADA NO CELULAR (APK do curso) — Daniel, 08/11/2026: "gere aqui o apk para android 5 ou superior";
 * escolheu "mesmo Wi-Fi": o celular fala com a API 7777 do PC pela rede local.
 *
 * O QUE FAZ
 *   - As telas do curso vão DENTRO do APK (Assets\html). Nada é baixado da internet.
 *   - 1º uso: pede o endereço do PC na rede (ex.: 192.168.0.10:7777), confere se a API responde e abre o login.
 *   - Botão VOZ (Luninha fala): pede a permissão do microfone ao Android e libera para a tela.
 *   - Voltar: volta a tela; na primeira, pergunta se quer sair (e oferece "Trocar endereço do PC").
 *   - Erro de conexão: painel com o que conferir (PC ligado, mesmo Wi-Fi, rede.txt, firewall) + Tentar de novo / Trocar.
 * ENTRADAS: o endereço do PC (guardado no aparelho). SAÍDAS: nenhuma; a sessão das telas fica no próprio WebView.
 * REGRAS: só endereço de rede LOCAL (10.x, 172.16–31.x, 192.168.x) — nunca internet; links externos abrem no navegador.
 * LIMITES: exportar CSV/XLSX e imprimir/PDF são do computador (o WebView não baixa nem imprime).
 */
[Activity(Label = "FastPousada", MainLauncher = true, Exported = true,
    WindowSoftInputMode = SoftInput.AdjustResize,
    ConfigurationChanges = ConfigChanges.Orientation | ConfigChanges.ScreenSize | ConfigChanges.KeyboardHidden)]
public sealed class MainActivity : Activity
{
    private const string Entrada = "file:///android_asset/html/login_Geral.html";
    private const int PedidoMicrofone = 77;
    // IP da rede local + porta (o mesmo filtro do login_Geral.html e do ApiCurso.js)
    private static readonly Regex EnderecoLocal = new(
        @"^(10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}):\d{2,5}$", RegexOptions.Compiled);

    private WebView web = null!;
    private LinearLayout painelErro = null!;
    private TextView textoErro = null!;
    private ISharedPreferences preferencias = null!;
    private PermissionRequest? pedidoPendente;

    /** OnCreate — monta a tela (WebView + painel de erro) e abre o sistema (ou pergunta o endereço no 1º uso). */
    protected override void OnCreate(Bundle? savedInstanceState)
    {
        base.OnCreate(savedInstanceState);
        preferencias = GetSharedPreferences("fastpousada", FileCreationMode.Private)!;
        // depurar pelo Chrome do PC (chrome://inspect) — útil nas aulas
        WebView.SetWebContentsDebuggingEnabled(true);

        var raiz = new LinearLayout(this) { Orientation = Orientation.Vertical };
        raiz.SetBackgroundColor(Color.Rgb(214, 234, 209));

        painelErro = new LinearLayout(this) { Orientation = Orientation.Vertical, Visibility = ViewStates.Gone };
        painelErro.SetPadding(40, 60, 40, 24);
        textoErro = new TextView(this) { TextSize = 16 };
        textoErro.SetTextColor(Color.Rgb(30, 41, 59));
        painelErro.AddView(textoErro);
        var tentar = new Button(this) { Text = "Tentar de novo" };
        tentar.Click += (_, _) => AbrirSistema();
        painelErro.AddView(tentar);
        var trocar = new Button(this) { Text = "Trocar endereço do PC" };
        trocar.Click += (_, _) => PedirEndereco(cancelavel: true);
        painelErro.AddView(trocar);
        raiz.AddView(painelErro);

        web = new WebView(this);
        var s = web.Settings!;
        s.JavaScriptEnabled = true;
        s.DomStorageEnabled = true;
        s.DatabaseEnabled = true;
        // as telas são arquivos do próprio APK que se abrem em iframes e falam com a API do PC
        s.AllowFileAccess = true;
#pragma warning disable CS0618, CA1422
        s.AllowFileAccessFromFileURLs = true;
        s.AllowUniversalAccessFromFileURLs = true;
#pragma warning restore CS0618, CA1422
        s.MediaPlaybackRequiresUserGesture = false;   // a voz da Luninha toca sem outro toque
        s.LoadWithOverviewMode = true;
        s.UseWideViewPort = true;
        s.TextZoom = 100;                              // ignora a fonte grande do sistema (as telas já são para celular)
        web.SetWebViewClient(new Cliente(this));
        web.SetWebChromeClient(new Cromo(this));
        raiz.AddView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        SetContentView(raiz);

        if (savedInstanceState != null && web.RestoreState(savedInstanceState) != null) return;
        if (string.IsNullOrEmpty(Servidor)) PedirEndereco(cancelavel: false); else AbrirSistema();
    }

    private string? Servidor => preferencias.GetString("servidor", null);

    /** PedirEndereco — caixa para digitar o IP:porta do PC; confere o formato e guarda no aparelho. */
    private void PedirEndereco(bool cancelavel)
    {
        var campo = new EditText(this)
        {
            Hint = "Ex.: 192.168.0.10:7777",
            Text = Servidor ?? "",
            InputType = InputTypes.ClassText | InputTypes.TextVariationUri
        };
        var caixa = new LinearLayout(this) { Orientation = Orientation.Vertical };
        caixa.SetPadding(48, 16, 48, 0);
        caixa.AddView(campo);
        var construtor = new AlertDialog.Builder(this)!
            .SetTitle("Endereço do PC")!
            .SetMessage("Digite o IP do computador onde roda a API do curso e a porta (o celular e o PC no MESMO Wi-Fi).\n\n" +
                        "No PC: Prompt de Comando → ipconfig → \"Endereço IPv4\".")!
            .SetView(caixa)!
            .SetCancelable(cancelavel)!
            .SetPositiveButton("Conectar", (_, _) => { })!;
        if (cancelavel) construtor.SetNegativeButton("Cancelar", (_, _) => { });
        var dialogo = construtor.Create()!;
        dialogo.Show();
        dialogo.GetButton((int)DialogButtonType.Positive)!.Click += (_, _) =>
        {
            var texto = (campo.Text ?? "").Trim().Replace("http://", "").TrimEnd('/');
            if (!texto.Contains(':')) texto += ":7777";
            if (!EnderecoLocal.IsMatch(texto)) { campo.Error = "Use o IP da rede local e a porta (ex.: 192.168.0.10:7777)."; return; }
            preferencias.Edit()!.PutString("servidor", texto)!.Commit();
            dialogo.Dismiss();
            AbrirSistema();
        };
    }

    /**
     * AbrirSistema — antes de abrir, confere se a API do PC responde (GET /status, 5 s). Respondeu → abre o login com
     * o endereço (?api=); não respondeu → painel de erro com o que conferir.
     */
    private void AbrirSistema()
    {
        var servidor = Servidor;
        if (string.IsNullOrEmpty(servidor)) { PedirEndereco(cancelavel: false); return; }
        textoErro.Text = "Procurando a API em " + servidor + "...";
        web.Visibility = ViewStates.Gone;
        painelErro.Visibility = ViewStates.Visible;
        Task.Run(async () =>
        {
            string? falha = null;
            try
            {
                using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
                var r = await http.GetAsync("http://" + servidor + "/status");
                if (!r.IsSuccessStatusCode) falha = "A API respondeu " + (int)r.StatusCode + ".";
            }
            catch (Exception) { falha = "A API não respondeu."; }
            RunOnUiThread(() =>
            {
                if (falha != null) { MostrarErro(falha); return; }
                painelErro.Visibility = ViewStates.Gone;
                web.Visibility = ViewStates.Visible;
                web.LoadUrl(Entrada + "?api=" + Android.Net.Uri.Encode("http://" + servidor));
            });
        });
    }

    private void MostrarErro(string motivo)
    {
        web.Visibility = ViewStates.Gone;
        textoErro.Text = "Não consegui falar com o FastPousada em " + Servidor + ".\n" + motivo + "\n\nConfira:\n" +
            "• o PC está ligado e a API do curso rodando;\n" +
            "• o celular está no MESMO Wi-Fi do PC;\n" +
            "• no PC existe o arquivo C:\\ProgramData\\FacilApp\\CursoApiSqlite\\rede.txt com 1 (e a API foi reiniciada);\n" +
            "• o Firewall do Windows libera a porta 7777 na rede Particular.";
        painelErro.Visibility = ViewStates.Visible;
    }

    /** Navegar — as telas do APK abrem aqui; qualquer outro endereço (site, WhatsApp, e-mail) abre fora. */
    private bool Navegar(string? url)
    {
        if (string.IsNullOrEmpty(url) || url.StartsWith("file:///android_asset/", StringComparison.Ordinal) ||
            url.StartsWith("about:", StringComparison.Ordinal) || url.StartsWith("blob:", StringComparison.Ordinal)) return false;
        try { StartActivity(new Intent(Intent.ActionView, Android.Net.Uri.Parse(url))); }
        catch (ActivityNotFoundException) { Toast.MakeText(this, "Nenhum aplicativo para abrir este link.", ToastLength.Long)?.Show(); }
        return true;
    }

    /** PedirMicrofone — a tela (Botão VOZ) pediu o microfone: pede ao Android (6.0+) e libera para a tela. */
    private void PedirMicrofone(PermissionRequest pedido)
    {
        var querAudio = pedido.GetResources()?.Contains(PermissionRequest.ResourceAudioCapture) == true;
        if (!querAudio) { pedido.Deny(); return; }
        if (!OperatingSystem.IsAndroidVersionAtLeast(23) ||
            CheckSelfPermission(Android.Manifest.Permission.RecordAudio) == Permission.Granted)
        {
            pedido.Grant(new[] { PermissionRequest.ResourceAudioCapture });
            return;
        }
        pedidoPendente = pedido;
        RequestPermissions(new[] { Android.Manifest.Permission.RecordAudio }, PedidoMicrofone);
    }

    public override void OnRequestPermissionsResult(int requestCode, string[] permissions, Permission[] grantResults)
    {
        base.OnRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != PedidoMicrofone || pedidoPendente == null) return;
        if (grantResults.Length > 0 && grantResults[0] == Permission.Granted)
            pedidoPendente.Grant(new[] { PermissionRequest.ResourceAudioCapture });
        else
        {
            pedidoPendente.Deny();
            Toast.MakeText(this, "Sem o microfone, o Botão VOZ não funciona.", ToastLength.Long)?.Show();
        }
        pedidoPendente = null;
    }

    /** PerguntarSaida — na primeira tela, Voltar pergunta: Sair / Trocar endereço do PC / Ficar. */
    private void PerguntarSaida()
    {
        new AlertDialog.Builder(this)!
            .SetTitle("Sair do FastPousada?")!
            .SetPositiveButton("Sair", (_, _) => Finish())!
            .SetNeutralButton("Trocar endereço do PC", (_, _) => PedirEndereco(cancelavel: true))!
            .SetNegativeButton("Ficar", (_, _) => { })!
            .Show();
    }

#pragma warning disable CS0672, CA1422
    public override void OnBackPressed()
    {
        if (painelErro.Visibility != ViewStates.Visible && web.CanGoBack()) web.GoBack();
        else PerguntarSaida();
    }
#pragma warning restore CS0672, CA1422

    protected override void OnSaveInstanceState(Bundle outState)
    {
        web.SaveState(outState);
        base.OnSaveInstanceState(outState);
    }

    protected override void OnPause() { web.OnPause(); base.OnPause(); }
    protected override void OnResume() { base.OnResume(); web?.OnResume(); }

    protected override void OnDestroy()
    {
        (web.Parent as ViewGroup)?.RemoveView(web);
        web.Destroy();
        base.OnDestroy();
    }

    /** Cliente — decide o que abre dentro do APK e avisa quando a tela principal não carrega. */
    private sealed class Cliente(MainActivity dono) : WebViewClient
    {
        public override bool ShouldOverrideUrlLoading(WebView? view, IWebResourceRequest? request)
            => request?.IsForMainFrame == true && dono.Navegar(request.Url?.ToString());

#pragma warning disable CS0672, CA1422
        public override bool ShouldOverrideUrlLoading(WebView? view, string? url) => dono.Navegar(url);
#pragma warning restore CS0672, CA1422
    }

    /** Cromo — microfone do Botão VOZ e mensagens do console (aparecem no chrome://inspect). */
    private sealed class Cromo(MainActivity dono) : WebChromeClient
    {
        public override void OnPermissionRequest(PermissionRequest? request)
        {
            if (request != null) dono.RunOnUiThread(() => dono.PedirMicrofone(request));
        }
    }
}
