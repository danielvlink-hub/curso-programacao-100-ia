using System.Text;
using System.Text.Json;
using System.Threading.Channels;

namespace FacilApp.Sqlite.Api;

/*
 * LOG DE ERROS E FALHAS EM ARQUIVO (.log)
 * Daniel, 08/11/2026 (aula gravada): "crie logs de monitoramento dos erros e falhas para gravar em .log".
 *
 * ONDE: %ProgramData%\FacilApp\CursoApiSqlite\logs\api-AAAA-MM-DD.log — um arquivo por dia; guarda 30 dias.
 * O QUE GRAVA (uma linha por evento, com data e hora):
 *   - FALHA: exceção não tratada (tipo, mensagem e onde aconteceu);
 *   - ERRO/RECUSA: requisição com status 400+ (método, rota SEM a query, status, tempo, id do usuário e a mensagem
 *     "erro" que a API devolveu — ex.: documento repetido, Bearer inválido, OpenAI recusou a chave);
 *   - AVISO: avisos do ASP.NET (porta ocupada, serviço iniciando/parando, falhas internas).
 * O QUE NUNCA GRAVA: senha, token/Bearer, chave da OpenAI, corpo das requisições (dados pessoais) e a query string
 *   (a busca pode ter nome/CPF). A mensagem de erro passa por um filtro que corta qualquer coisa parecida com chave/token.
 * COMO: fila em memória (Channel) + uma tarefa em segundo plano que escreve no arquivo — não deixa a API lenta.
 * CUIDADOS: sem pacote novo (Daniel: "pacote novo só com ok"). Se o disco falhar, o log é perdido, nunca a requisição.
 */
public static class LogArquivo
{
    private static readonly Channel<string> Fila = Channel.CreateUnbounded<string>(new UnboundedChannelOptions { SingleReader = true });
    private static string pasta = "";

    /// <summary>Liga o gravador (pasta de dados da API). Apaga logs com mais de 30 dias.</summary>
    public static void Iniciar(string dataDir)
    {
        pasta = Path.Combine(dataDir, "logs");
        Directory.CreateDirectory(pasta);
        foreach (var f in Directory.GetFiles(pasta, "api-*.log"))
            if (File.GetLastWriteTime(f) < DateTime.Now.AddDays(-30)) { try { File.Delete(f); } catch (IOException) { } }
        _ = Task.Run(Gravador);
    }

    public static string Pasta => pasta;

    /// <summary>Põe uma linha na fila (nivel: FALHA, ERRO, RECUSA, AVISO, INFO).</summary>
    public static void Escrever(string nivel, string texto)
    {
        if (pasta.Length == 0) return;
        Fila.Writer.TryWrite($"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} [{nivel}] {Limpar(texto)}");
    }

    private static async Task Gravador()
    {
        await foreach (var linha in Fila.Reader.ReadAllAsync())
        {
            try { await File.AppendAllTextAsync(Path.Combine(pasta, $"api-{DateTime.Now:yyyy-MM-dd}.log"), linha + Environment.NewLine, Encoding.UTF8); }
            catch (IOException) { /* disco ocupado: perde a linha, nunca a requisição */ }
        }
    }

    /// <summary>Uma linha só, curta, sem nada parecido com chave ou token.</summary>
    public static string Limpar(string? texto)
    {
        var t = (texto ?? "").Replace('\r', ' ').Replace('\n', ' ');
        t = System.Text.RegularExpressions.Regex.Replace(t, @"(sk-[A-Za-z0-9_\-]{6,}|Bearer\s+[A-Za-z0-9_\-\.]{16,}|eyJ[A-Za-z0-9_\-\.]{10,})", "[oculto]");
        return t.Length > 600 ? t[..600] + "..." : t;
    }

    /// <summary>Últimas linhas do log do dia (tela de consulta do administrador).</summary>
    public static IReadOnlyList<string> Ler(DateOnly dia, int maximo = 500)
    {
        var arquivo = Path.Combine(pasta, $"api-{dia:yyyy-MM-dd}.log");
        if (!File.Exists(arquivo)) return [];
        using var fs = new FileStream(arquivo, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        using var sr = new StreamReader(fs, Encoding.UTF8);
        var linhas = new List<string>();
        while (sr.ReadLine() is { } l) linhas.Add(l);
        return linhas.Skip(Math.Max(0, linhas.Count - maximo)).ToList();
    }

    /// <summary>Filtro de cada requisição: grava as respostas 400+ (com a mensagem "erro" da API) e as exceções.</summary>
    public static IApplicationBuilder UseLogDeErros(this IApplicationBuilder app, Func<HttpRequest, long?> usuario)
    {
        return app.Use(async (ctx, next) =>
        {
            var inicio = DateTime.UtcNow;
            var original = ctx.Response.Body;
            using var copia = new MemoryStream();
            ctx.Response.Body = copia;
            try
            {
                await next();
            }
            catch (Exception ex)
            {
                Escrever("FALHA", $"{ctx.Request.Method} {ctx.Request.Path} usuario={usuario(ctx.Request)?.ToString() ?? "-"} " +
                                  $"{ex.GetType().Name}: {ex.Message} | {ex.StackTrace?.Split('\n').FirstOrDefault()?.Trim()}");
                throw;
            }
            finally
            {
                var status = ctx.Response.StatusCode;
                if (status >= 400)
                {
                    var erro = "";
                    try
                    {
                        if (copia.Length > 0 && copia.Length < 20000 && (ctx.Response.ContentType ?? "").Contains("json"))
                        {
                            using var doc = JsonDocument.Parse(copia.ToArray());
                            if (doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty("erro", out var e)) erro = e.GetString() ?? "";
                        }
                    }
                    catch (JsonException) { }
                    var ms = (int)(DateTime.UtcNow - inicio).TotalMilliseconds;
                    Escrever(status >= 500 ? "ERRO" : "RECUSA",
                        $"{ctx.Request.Method} {ctx.Request.Path} -> {status} em {ms} ms usuario={usuario(ctx.Request)?.ToString() ?? "-"}" +
                        (erro.Length > 0 ? $" | {erro}" : ""));
                }
                copia.Position = 0;
                ctx.Response.Body = original;
                if (copia.Length > 0) await copia.CopyToAsync(original);
            }
        });
    }
}

/// <summary>Leva os avisos e erros do próprio ASP.NET (nível Warning+) para o mesmo arquivo.</summary>
public sealed class LogArquivoProvider : ILoggerProvider
{
    public ILogger CreateLogger(string categoria) => new Gravador(categoria);
    public void Dispose() { }

    private sealed class Gravador(string categoria) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel nivel) => nivel >= LogLevel.Warning;
        public void Log<TState>(LogLevel nivel, EventId id, TState estado, Exception? ex, Func<TState, Exception?, string> formatar)
        {
            if (!IsEnabled(nivel)) return;
            // a falha de requisição já é gravada pelo filtro (com rota e usuário): evita linha repetida
            if (categoria.StartsWith("Microsoft.AspNetCore.Diagnostics", StringComparison.Ordinal)) return;
            var curta = categoria[(categoria.LastIndexOf('.') + 1)..];
            LogArquivo.Escrever(nivel >= LogLevel.Error ? "ERRO" : "AVISO", $"{curta}: {formatar(estado, ex)}" + (ex is null ? "" : $" | {ex.GetType().Name}: {ex.Message}"));
        }
    }
}
