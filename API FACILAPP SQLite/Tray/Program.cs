using System.Diagnostics;
using System.ServiceProcess;

namespace FacilApp.Curso.Tray;

internal static class Program
{
    private const string ServiceName = "FacilAppCursoSqlite";

    [STAThread]
    private static void Main(string[] args)
    {
        if (args.Length == 2 && args[0] == "--service")
        {
            Environment.ExitCode = ControlService(args[1]);
            return;
        }
        using var mutex = new Mutex(true, "Local\\FacilAppCursoSqliteTray", out var first);
        if (!first) return;
        ApplicationConfiguration.Initialize();
        Application.Run(new CursoTrayContext());
    }

    private static int ControlService(string action)
    {
        if (action is not ("start" or "stop" or "restart")) return 2;
        try
        {
            using var service = new ServiceController(ServiceName);
            service.Refresh();
            if (action is "stop" or "restart" && service.Status != ServiceControllerStatus.Stopped)
            {
                service.Stop();
                service.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(30));
            }
            if (action is "start" or "restart")
            {
                service.Refresh();
                if (service.Status != ServiceControllerStatus.Running)
                {
                    service.Start();
                    service.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(30));
                }
            }
            return 0;
        }
        catch { return 1; }
    }

    private sealed class CursoTrayContext : ApplicationContext
    {
        private readonly NotifyIcon icon;
        private readonly ContextMenuStrip menu = new();
        private readonly ToolStripMenuItem state = new("Verificando...") { Enabled = false };
        private readonly HttpClient client = new() { Timeout = TimeSpan.FromSeconds(2) };
        private readonly System.Windows.Forms.Timer timer = new() { Interval = 5000 };
        private bool refreshing;

        public CursoTrayContext()
        {
            icon = new NotifyIcon { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application,
                Text = "FastPousada API - verificando", ContextMenuStrip = menu, Visible = true };
            menu.Items.Add(state);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Abrir console de testes", null, (_, _) => Open("/TesteDaApi.html"));
            menu.Items.Add("Abrir Swagger", null, (_, _) => Open("/swagger"));
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Iniciar API", null, (_, _) => RunElevated("start"));
            menu.Items.Add("Parar API", null, (_, _) => RunElevated("stop"));
            menu.Items.Add("Reiniciar API", null, (_, _) => RunElevated("restart"));
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Sair da bandeja", null, (_, _) => ExitThread());
            icon.DoubleClick += (_, _) => Open("/TesteDaApi.html");
            timer.Tick += async (_, _) => await RefreshAsync();
            timer.Start();
            _ = RefreshAsync();
        }

        private static int Port()
        {
            var path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "FacilApp", "CursoApiSqlite", "porta.txt");
            return File.Exists(path) && int.TryParse(File.ReadAllText(path).Trim(), out var port) && port is >= 1 and <= 65535 ? port : 7777;
        }

        private static void Open(string path)
        {
            Process.Start(new ProcessStartInfo($"http://127.0.0.1:{Port()}{path}") { UseShellExecute = true });
        }

        private void RunElevated(string action)
        {
            try
            {
                using var process = Process.Start(new ProcessStartInfo(Application.ExecutablePath, "--service " + action)
                { UseShellExecute = true, Verb = "runas", WindowStyle = ProcessWindowStyle.Hidden });
                process?.WaitForExit(35000);
                if (process?.ExitCode != 0) MessageBox.Show("Não foi possível " + action + " a API. Verifique o serviço Windows.", "FastPousada", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            catch { MessageBox.Show("Operação cancelada ou não autorizada.", "FastPousada", MessageBoxButtons.OK, MessageBoxIcon.Information); }
            _ = RefreshAsync();
        }

        private async Task RefreshAsync()
        {
            if (refreshing) return;
            refreshing = true;
            try
            {
                using var service = new ServiceController(ServiceName);
                var serviceRunning = service.Status == ServiceControllerStatus.Running;
                var online = false;
                if (serviceRunning)
                {
                    try { using var response = await client.GetAsync($"http://127.0.0.1:{Port()}/status"); online = response.IsSuccessStatusCode; }
                    catch { }
                }
                state.Text = online ? $"API online · porta {Port()}" : serviceRunning ? "Serviço iniciado · API sem resposta" : "API parada";
                icon.Text = online ? $"FastPousada API online: {Port()}" : "FastPousada API offline";
            }
            catch { state.Text = "Serviço não instalado"; icon.Text = "FastPousada API não instalada"; }
            finally { refreshing = false; }
        }

        protected override void ExitThreadCore()
        {
            timer.Stop();
            icon.Visible = false;
            icon.Dispose();
            client.Dispose();
            menu.Dispose();
            base.ExitThreadCore();
        }
    }
}
