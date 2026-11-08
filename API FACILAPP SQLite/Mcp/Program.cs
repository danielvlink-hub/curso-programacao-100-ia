using System.ComponentModel;
using System.Net.Http.Headers;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ModelContextProtocol.Server;

var builder = Host.CreateApplicationBuilder(args);
builder.Logging.AddConsole(options => options.LogToStandardErrorThreshold = LogLevel.Trace);
builder.Services.AddMcpServer().WithStdioServerTransport().WithToolsFromAssembly();
await builder.Build().RunAsync();

[McpServerToolType]
public static class FacilAppSqliteTools
{
    private static readonly HttpClient Client = new() { Timeout = TimeSpan.FromSeconds(10) };

    private static Uri BaseUri()
    {
        var configured = Environment.GetEnvironmentVariable("FACILAPP_MCP_API_URL");
        var address = string.IsNullOrWhiteSpace(configured) ? "http://127.0.0.1:7777/" : configured.TrimEnd('/') + "/";
        if (!Uri.TryCreate(address, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))
            throw new InvalidOperationException("FACILAPP_MCP_API_URL deve ser uma URL HTTP(S) absoluta.");
        return uri;
    }

    [McpServerTool, Description("Consulta a disponibilidade da API FacilApp SQLite. Não lê dados privados.")]
    public static async Task<string> ApiStatus()
    {
        using var response = await Client.GetAsync(new Uri(BaseUri(), "status"));
        return $"HTTP {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}";
    }

    [McpServerTool, Description("Consulta o usuário associado ao Bearer configurado no ambiente FACILAPP_MCP_BEARER. Não recebe nem retorna o token.")]
    public static async Task<string> UsuarioAtual()
    {
        var token = Environment.GetEnvironmentVariable("FACILAPP_MCP_BEARER");
        if (string.IsNullOrWhiteSpace(token)) return "Bearer não configurado para o MCP.";
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(BaseUri(), "auth/me"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var response = await Client.SendAsync(request);
        return $"HTTP {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}";
    }
}
