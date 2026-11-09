using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace FacilApp.Sqlite.Api;

/*
 * IA — chave da OpenAI guardada na API e a conversa do Botão IA das telas.
 * Daniel, 08/11/2026 (aula gravada): "Botão IA ... é a conversa com a IA e ela executa o CRUD, listagens e filtros
 * solicitados; antes disso crie um local na área da API para cadastrar a chave da OpenAI".
 *
 * O QUE FAZ
 *   - Guarda a chave e o modelo SÓ no servidor: arquivo ia.config.dpapi em ProgramData, criptografado pelo Windows
 *     (DPAPI, mesma proteção da chave dos tokens). A chave nunca volta em resposta, log ou tela (só os 4 últimos dígitos).
 *   - /api/ia/chat repassa a conversa + as ferramentas que a TELA oferece ao provedor e devolve a resposta dele:
 *     um texto ou "chame a ferramenta X com estes parâmetros". QUEM EXECUTA A FERRAMENTA É A TELA, com o login e as
 *     permissões do usuário (as mesmas rotas do cadastro). A IA não grava nada sozinha.
 * ROTAS
 *   GET /api/ia/status (logado)            → { configurada, modelo }  (a tela liga ou desliga o botão IA)
 *   GET /api/ia/config (administrador)     → { configurada, modelo, final }  (final = 4 últimos dígitos da chave)
 *   PUT /api/ia/config (administrador)     { chave?, modelo }  (chave vazia = mantém a atual)
 *   DELETE /api/ia/config (administrador)  apaga a chave
 *   POST /api/ia/testar (administrador)    { chave? } → modelos liberados para a conta (para escolher no combo)
 *   POST /api/ia/chat (logado)             { mensagens:[...], ferramentas:[...] } → { mensagem:{ content, tool_calls } }
 * MULTIBANCO / MULTIPROVEDOR
 *   O provedor fica atrás de IProvedorIA. Hoje: OpenAI (chat/completions com tools). Outro provedor = outra classe.
 * CUIDADOS
 *   Limites para não estourar custo: até 40 mensagens e 20 ferramentas por chamada, 60 s de espera.
 */
public interface IProvedorIA
{
    /// <summary>Lista os modelos liberados para a chave (usado no "Testar chave").</summary>
    Task<IReadOnlyList<string>> ModelosAsync(string chave, CancellationToken ct);
    /// <summary>Uma rodada de conversa. Devolve a mensagem do assistente (texto e/ou chamadas de ferramenta).</summary>
    Task<JsonNode> ConversarAsync(string chave, string modelo, JsonArray mensagens, JsonArray ferramentas, CancellationToken ct);
    /// <summary>Pesquisa na internet e devolve { resposta, fontes[] }.</summary>
    Task<object> PesquisarAsync(string chave, string modelo, string pergunta, CancellationToken ct);
    /// <summary>Todos os ids de modelo da conta (para separar os de conversa por voz).</summary>
    Task<IReadOnlyList<string>> TodosModelosAsync(string chave, CancellationToken ct);
    /// <summary>Conversa por VOZ ao vivo: recebe a proposta de áudio (SDP) do navegador e devolve a resposta (SDP).</summary>
    Task<string> ConectarVozAsync(string chave, string modeloVoz, string voz, string instrucoes, string sdpOferta, CancellationToken ct);
}

/// <summary>Erro do provedor de IA com mensagem segura para mostrar ao usuário (sem chave).</summary>
public sealed class IaException(string mensagem, int status = 502) : Exception(mensagem)
{
    public int Status { get; } = status;
}

/// <summary>OpenAI — https://api.openai.com/v1 (models e chat/completions).</summary>
public sealed class OpenAiProvedor(IHttpClientFactory clients) : IProvedorIA
{
    private HttpRequestMessage Pedido(HttpMethod metodo, string rota, string chave)
    {
        var req = new HttpRequestMessage(metodo, "https://api.openai.com/v1/" + rota);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", chave);
        return req;
    }

    private static async Task<JsonNode> Ler(HttpResponseMessage resp, CancellationToken ct)
    {
        var texto = await resp.Content.ReadAsStringAsync(ct);
        JsonNode? json = null;
        try { json = JsonNode.Parse(texto); } catch (JsonException) { }
        if (resp.IsSuccessStatusCode && json is not null) return json;
        var msg = json?["error"]?["message"]?.GetValue<string>() ?? $"resposta {(int)resp.StatusCode}";
        throw (int)resp.StatusCode switch
        {
            401 => new IaException("Chave da OpenAI recusada (inválida ou revogada). Confira em Inteligência Artificial.", 400),
            429 => new IaException("Limite ou crédito da OpenAI esgotado agora: " + msg, 429),
            _ => new IaException("A OpenAI respondeu erro: " + msg)
        };
    }

    public async Task<IReadOnlyList<string>> TodosModelosAsync(string chave, CancellationToken ct)
    {
        using var resp = await clients.CreateClient("ia").SendAsync(Pedido(HttpMethod.Get, "models", chave), ct);
        var json = await Ler(resp, ct);
        return (json["data"]?.AsArray() ?? []).Select(m => m?["id"]?.GetValue<string>() ?? "").Where(id => id.Length > 0).OrderBy(id => id).ToList();
    }

    public async Task<IReadOnlyList<string>> ModelosAsync(string chave, CancellationToken ct)
    {
        // Todos os modelos da conta, menos os que não conversam por texto (Daniel, 08/11/2026: "iremos usar a Luna 6.0" —
        // o nome do modelo não precisa começar com "gpt").
        string[] fora = ["audio", "realtime", "live", "tts", "transcribe", "whisper", "image", "dall-e", "embedding", "moderation", "search", "davinci", "babbage"];
        return (await TodosModelosAsync(chave, ct)).Where(id => !fora.Any(f => id.Contains(f, StringComparison.OrdinalIgnoreCase))).ToList();
    }

    /// <summary>Modelos de conversa por voz ao vivo (realtime / live).</summary>
    public static IReadOnlyList<string> SoVoz(IEnumerable<string> todos) =>
        todos.Where(id => (id.Contains("realtime", StringComparison.OrdinalIgnoreCase) || id.Contains("live", StringComparison.OrdinalIgnoreCase))
                          && !id.Contains("transcribe", StringComparison.OrdinalIgnoreCase)).ToList();

    /*
     * ConectarVozAsync — liga a conversa por voz (Realtime/Live, WebRTC). Daniel, 08/11/2026: "crie o Botão VOZ, usando
     * Live, conversa humana, ligue ele com os mesmos poderes da Luninha".
     * O navegador manda a proposta de áudio (SDP); aqui ela vai à OpenAI (POST /v1/realtime/calls, multipart: sdp + session)
     * com a chave do SERVIDOR — a chave nunca vai para o navegador, nem temporária. A OpenAI devolve a resposta (SDP) e o
     * áudio passa a ir direto entre o navegador e a OpenAI.
     */
    public async Task<string> ConectarVozAsync(string chave, string modeloVoz, string voz, string instrucoes, string sdpOferta, CancellationToken ct)
    {
        var sessao = new JsonObject
        {
            ["type"] = "realtime",
            ["model"] = modeloVoz,
            ["instructions"] = instrucoes,
            ["audio"] = new JsonObject { ["output"] = new JsonObject { ["voice"] = voz } }
        };
        var form = new MultipartFormDataContent
        {
            { new StringContent(sdpOferta, Encoding.UTF8, "application/sdp"), "sdp" },
            { new StringContent(sessao.ToJsonString(), Encoding.UTF8, "application/json"), "session" }
        };
        var req = Pedido(HttpMethod.Post, "realtime/calls", chave);
        req.Content = form;
        using var resp = await clients.CreateClient("ia").SendAsync(req, ct);
        var texto = await resp.Content.ReadAsStringAsync(ct);
        if (resp.IsSuccessStatusCode && texto.TrimStart().StartsWith("v=")) return texto;
        string msg;
        try { msg = JsonNode.Parse(texto)?["error"]?["message"]?.GetValue<string>() ?? $"resposta {(int)resp.StatusCode}"; }
        catch (JsonException) { msg = $"resposta {(int)resp.StatusCode}"; }
        throw (int)resp.StatusCode switch
        {
            401 => new IaException("Chave da OpenAI recusada (inválida ou revogada).", 400),
            429 => new IaException("Limite ou crédito da OpenAI esgotado agora: " + msg, 429),
            // 08/11/2026: o gpt-live-1 respondeu "not supported in realtime mode" — orienta a escolher um modelo realtime
            _ when msg.Contains("realtime mode", StringComparison.OrdinalIgnoreCase) => new IaException(
                "O modelo de voz " + modeloVoz + " não funciona na conversa ao vivo. Em Inteligência Artificial, clique em Testar chave " +
                "e escolha um Modelo de voz com \"realtime\" no nome (ex.: gpt-realtime).", 400),
            _ => new IaException("A OpenAI não abriu a conversa por voz (modelo de voz " + modeloVoz + "): " + msg)
        };
    }

    // Modelos que só aceitam ferramentas no chat/completions com reasoning_effort = "none" (ex.: gpt-6-luna).
    // Descoberto na 1ª resposta da OpenAI e lembrado enquanto a API estiver no ar.
    // Daniel, 08/11/2026 (aula): erro "Function tools with reasoning_effort are not supported for gpt-6-luna".
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, bool> SemRaciocinio = new();

    public async Task<JsonNode> ConversarAsync(string chave, string modelo, JsonArray mensagens, JsonArray ferramentas, CancellationToken ct)
    {
        async Task<JsonNode> Enviar(bool raciocinioNone)
        {
            var corpo = new JsonObject { ["model"] = modelo, ["messages"] = mensagens.DeepClone() };
            if (ferramentas.Count > 0) { corpo["tools"] = ferramentas.DeepClone(); corpo["tool_choice"] = "auto"; }
            if (raciocinioNone) corpo["reasoning_effort"] = "none";
            var req = Pedido(HttpMethod.Post, "chat/completions", chave);
            req.Content = new StringContent(corpo.ToJsonString(), Encoding.UTF8, "application/json");
            using var resp = await clients.CreateClient("ia").SendAsync(req, ct);
            var json = await Ler(resp, ct);
            return json["choices"]?[0]?["message"]?.DeepClone() ?? throw new IaException("A OpenAI não devolveu resposta.");
        }
        var usarNone = ferramentas.Count > 0 && SemRaciocinio.ContainsKey(modelo);
        try { return await Enviar(usarNone); }
        catch (IaException e) when (!usarNone && ferramentas.Count > 0 && e.Message.Contains("reasoning_effort", StringComparison.OrdinalIgnoreCase))
        {
            SemRaciocinio[modelo] = true;
            LogArquivo.Escrever("INFO", $"IA: o modelo {modelo} usa reasoning_effort=none com ferramentas (ajustado sozinho).");
            return await Enviar(true);
        }
    }

    /*
     * PesquisarAsync — pesquisa na internet com a ferramenta web_search da OpenAI (API "responses").
     * Daniel, 08/11/2026: "a ideia é ela poder consultar igual você e dar retorno sobre qualquer coisa".
     * Devolve o texto da resposta e as fontes (links citados). O modelo escolhido precisa aceitar web_search.
     */
    public async Task<object> PesquisarAsync(string chave, string modelo, string pergunta, CancellationToken ct)
    {
        var corpo = new JsonObject
        {
            ["model"] = modelo,
            ["tools"] = new JsonArray { new JsonObject { ["type"] = "web_search" } },
            ["input"] = "Responda em português do Brasil, de forma curta e objetiva, citando as fontes. Pergunta: " + pergunta
        };
        var req = Pedido(HttpMethod.Post, "responses", chave);
        req.Content = new StringContent(corpo.ToJsonString(), Encoding.UTF8, "application/json");
        JsonNode json;
        try
        {
            using var resp = await clients.CreateClient("ia").SendAsync(req, ct);
            json = await Ler(resp, ct);
        }
        catch (IaException e) when (e.Status == 502)
        {
            throw new IaException("A pesquisa na internet não está disponível para o modelo escolhido (" + modelo + "). Detalhe: " + e.Message);
        }
        var textos = new List<string>();
        var fontes = new List<object>();
        var urls = new HashSet<string>();
        foreach (var item in json["output"]?.AsArray() ?? [])
        {
            if (item?["type"]?.GetValue<string>() != "message") continue;
            foreach (var c in item["content"]?.AsArray() ?? [])
            {
                if (c?["text"]?.GetValue<string>() is { } t) textos.Add(t);
                foreach (var a in c?["annotations"]?.AsArray() ?? [])
                    if (a?["url"]?.GetValue<string>() is { } url && urls.Add(url))
                        fontes.Add(new { titulo = a["title"]?.GetValue<string>() ?? url, url });
            }
        }
        if (textos.Count == 0) throw new IaException("A pesquisa não trouxe resposta.");
        return new { resposta = string.Join("\n", textos), fontes = fontes.Take(8).ToList() };
    }
}

/// <summary>Chave e modelo guardados na pasta de dados: Windows criptografa (DPAPI); Linux usa arquivo 600 (Segredos.cs).</summary>
public sealed class IaConfigStore(string dataDir)
{
    // nome da assistente (Daniel, 08/11/2026: "dê o nome de Luninha e coloca na API local um lugar de pôr o nome")
    public const string NomePadrao = "Luninha";
    public const string VozPadrao = "marin";
    // modelo_voz/voz: conversa por VOZ ao vivo (Daniel, 08/11/2026: "crie o Botão VOZ, usando Live")
    private sealed record Dados(string chave, string modelo, string? nome = null, string? modelo_voz = null, string? voz = null);

    private Dados? Ler()
    {
        // variável de ambiente (desenvolvimento) tem prioridade sobre o arquivo
        var env = Environment.GetEnvironmentVariable("FACILAPP_OPENAI_KEY");
        var modeloEnv = Environment.GetEnvironmentVariable("FACILAPP_OPENAI_MODEL") ?? "";
        if (!string.IsNullOrWhiteSpace(env)) return new(env.Trim(), modeloEnv);
        var bytes = Segredos.Ler(dataDir, "ia.config");   // Windows: ia.config.dpapi · Linux: ia.config.segredo
        if (bytes == null) return null;
        try { return JsonSerializer.Deserialize<Dados>(bytes); }
        catch (JsonException) { return null; }
    }

    public (string chave, string modelo)? Atual() => Ler() is { } d && d.chave.Length > 0 ? (d.chave, d.modelo) : null;

    /// <summary>Nome da assistente (padrão "Luninha" quando não foi gravado).</summary>
    public string Nome() => Ler()?.nome is { Length: > 0 } n ? n : NomePadrao;

    /// <summary>Modelo e voz da conversa por VOZ ("" = voz desligada).</summary>
    public (string modeloVoz, string voz) Voz() { var d = Ler(); return (d?.modelo_voz ?? "", d?.voz is { Length: > 0 } v ? v : VozPadrao); }

    public object Resumo()
    {
        var d = Ler();
        var ok = d is not null && d.chave.Length > 0;
        var (mv, voz) = Voz();
        return new { ok = true, configurada = ok, modelo = d?.modelo ?? "", final = ok ? d!.chave[^Math.Min(4, d.chave.Length)..] : "",
            nome = Nome(), modelo_voz = mv, voz };
    }

    /// <summary>Grava. Campos vazios mantêm o valor atual (chave, nome, modelo de voz e voz).</summary>
    public void Gravar(string? chave, string modelo, string? nome = null, string? modeloVoz = null, string? voz = null)
    {
        var atual = Ler();
        string Manter(string? novo, string? velho, string padrao = "") =>
            string.IsNullOrWhiteSpace(novo) ? (string.IsNullOrWhiteSpace(velho) ? padrao : velho) : novo.Trim();
        var bytes = JsonSerializer.SerializeToUtf8Bytes(new Dados(Manter(chave, atual?.chave), modelo.Trim(), Manter(nome, atual?.nome, NomePadrao),
            Manter(modeloVoz, atual?.modelo_voz), Manter(voz, atual?.voz, VozPadrao)));
        Segredos.Gravar(dataDir, "ia.config", bytes);
    }

    public void Apagar() => Segredos.Apagar(dataDir, "ia.config");
}

/*
 * PREVISÃO DO TEMPO — ferramenta geral da IA (todas as telas).
 * Daniel, 08/11/2026: "se perguntar qual a previsão do tempo, dê liberdade para ela consultar".
 * Fonte: Open-Meteo (público, gratuito, sem chave): geocoding (cidade → lat/long) + forecast diário (até 7 dias).
 * Só consulta; nada é gravado. Fuso America/Sao_Paulo.
 */
public static class PrevisaoTempo
{
    private static readonly Dictionary<int, string> Codigos = new()
    {
        [0] = "céu limpo", [1] = "poucas nuvens", [2] = "parcialmente nublado", [3] = "nublado", [45] = "neblina", [48] = "neblina com geada",
        [51] = "garoa fraca", [53] = "garoa", [55] = "garoa forte", [61] = "chuva fraca", [63] = "chuva", [65] = "chuva forte",
        [66] = "chuva congelante", [67] = "chuva congelante forte", [71] = "neve fraca", [73] = "neve", [75] = "neve forte",
        [80] = "pancadas de chuva fracas", [81] = "pancadas de chuva", [82] = "pancadas de chuva fortes",
        [95] = "trovoadas", [96] = "trovoadas com granizo", [99] = "trovoadas fortes com granizo"
    };

    public static async Task<object> ConsultarAsync(IHttpClientFactory clients, string cidade, int dias, CancellationToken ct)
    {
        cidade = (cidade ?? "").Trim();
        if (cidade.Length < 2) throw new ArgumentException("Informe a cidade.");
        dias = Math.Clamp(dias, 1, 7);
        var http = clients.CreateClient("public-lookup");
        var geo = JsonNode.Parse(await http.GetStringAsync(
            "https://geocoding-api.open-meteo.com/v1/search?count=1&language=pt&format=json&name=" + Uri.EscapeDataString(cidade), ct));
        var lugar = geo?["results"]?[0] ?? throw new KeyNotFoundException($"Cidade \"{cidade}\" não encontrada.");
        var lat = lugar["latitude"]!.GetValue<double>().ToString(System.Globalization.CultureInfo.InvariantCulture);
        var lon = lugar["longitude"]!.GetValue<double>().ToString(System.Globalization.CultureInfo.InvariantCulture);
        var prev = JsonNode.Parse(await http.GetStringAsync(
            $"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&timezone=America%2FSao_Paulo&forecast_days={dias}" +
            "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max", ct));
        var d = prev?["daily"] ?? throw new IaException("Previsão do tempo indisponível agora.");
        var lista = new List<object>();
        for (var i = 0; i < (d["time"]?.AsArray().Count ?? 0); i++)
        {
            var cod = d["weather_code"]?[i]?.GetValue<int>() ?? -1;
            lista.Add(new
            {
                data = d["time"]![i]!.GetValue<string>(),
                tempo = Codigos.TryGetValue(cod, out var t) ? t : "sem descrição",
                minima = d["temperature_2m_min"]?[i]?.GetValue<double>(),
                maxima = d["temperature_2m_max"]?[i]?.GetValue<double>(),
                chance_chuva_pct = d["precipitation_probability_max"]?[i] is JsonNode p ? (int?)Math.Round(p.GetValue<double>()) : null
            });
        }
        return new
        {
            cidade = lugar["name"]?.GetValue<string>(), estado = lugar["admin1"]?.GetValue<string>(), pais = lugar["country"]?.GetValue<string>(),
            fonte = "Open-Meteo", dias = lista
        };
    }
}

public sealed record IaPesquisaInput(string? pergunta);
public sealed record IaConfigInput(string? chave, string? modelo, string? nome = null, string? modelo_voz = null, string? voz = null);
public sealed record IaVozInput(string? sdp, string? tela);
public sealed record IaTestarInput(string? chave);
public sealed record IaChatInput(JsonArray? mensagens, JsonArray? ferramentas);

public static class IaEndpoints
{
    // Regras fixas de toda conversa (a tela acrescenta as dela: o que a tela faz e as ferramentas).
    // Daniel, 08/11/2026: "dê liberdade da Luna conversar" — conversa livre (dúvidas, explicações, sugestões, bate-papo),
    // mas dados do sistema só pelas ferramentas e gravação só com o Confirmar da tela.
    private const string Sistema = """
        Você é a assistente do FastPousada (sistema de pousada do curso Programação 100% IA) e conversa em português do Brasil,
        de forma natural, simpática e prestativa. Você tem liberdade para conversar: tirar dúvidas, explicar como usar a tela,
        dar sugestões de atendimento e de gestão da pousada, e bater papo quando o usuário quiser.
        Sobre os DADOS do sistema (hóspedes, cadastros, listas): use SOMENTE as ferramentas oferecidas; nunca invente dados.
        Se faltar um dado obrigatório para gravar, pergunte antes de chamar a ferramenta.
        Para incluir, alterar ou excluir, chame a ferramenta: a tela mostra o resumo e o usuário confirma.
        Depois que uma ferramenta responder, conte o resultado de forma clara e curta.
        """;

    /// <param name="logado">devolve (id, administrador) do Bearer, ou null.</param>
    public static void MapIa(this WebApplication app, IaConfigStore config, Func<HttpRequest, (long id, bool admin)?> logado)
    {
        IResult? SoAdmin(HttpRequest req) => logado(req) switch
        {
            null => Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401),
            { admin: false } => Results.Json(new { ok = false, erro = "Apenas administrador cuida da chave da IA." }, statusCode: 403),
            _ => null
        };
        IResult Falha(IaException e) => Results.Json(new { ok = false, erro = e.Message }, statusCode: e.Status);

        app.MapGet("/api/ia/status", (HttpRequest req) =>
        {
            if (logado(req) is null) return Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
            var a = config.Atual();
            var (mv, _) = config.Voz();
            return Results.Ok(new { ok = true, configurada = a is not null && a.Value.modelo.Length > 0, modelo = a?.modelo ?? "", nome = config.Nome(),
                voz_configurada = a is not null && mv.Length > 0 });
        });

        app.MapGet("/api/ia/config", (HttpRequest req) => SoAdmin(req) ?? Results.Ok(config.Resumo()));

        app.MapPut("/api/ia/config", (HttpRequest req, IaConfigInput input) =>
        {
            if (SoAdmin(req) is { } negado) return negado;
            var modelo = (input.modelo ?? "").Trim();
            if (modelo.Length is < 2 or > 80) return Results.BadRequest(new { ok = false, erro = "Escolha o modelo da IA." });
            var chave = (input.chave ?? "").Trim();
            if (chave.Length > 0 && (chave.Length < 20 || chave.Contains(' '))) return Results.BadRequest(new { ok = false, erro = "Chave da OpenAI inválida." });
            if (chave.Length == 0 && config.Atual() is null) return Results.BadRequest(new { ok = false, erro = "Informe a chave da OpenAI." });
            var nome = (input.nome ?? "").Trim();
            if (nome.Length > 40) return Results.BadRequest(new { ok = false, erro = "Nome da assistente com no máximo 40 letras." });
            var modeloVoz = (input.modelo_voz ?? "").Trim();
            var voz = (input.voz ?? "").Trim();
            if (modeloVoz.Length > 80 || voz.Length > 30 || voz.Contains(' ')) return Results.BadRequest(new { ok = false, erro = "Modelo de voz ou voz inválidos." });
            config.Gravar(chave, modelo, nome, modeloVoz, voz);
            return Results.Ok(config.Resumo());
        });

        app.MapDelete("/api/ia/config", (HttpRequest req) =>
        {
            if (SoAdmin(req) is { } negado) return negado;
            config.Apagar();
            return Results.Ok(config.Resumo());
        });

        app.MapPost("/api/ia/testar", async (HttpRequest req, IaTestarInput input, IProvedorIA ia, CancellationToken ct) =>
        {
            if (SoAdmin(req) is { } negado) return negado;
            var chave = string.IsNullOrWhiteSpace(input.chave) ? config.Atual()?.chave : input.chave.Trim();
            if (string.IsNullOrWhiteSpace(chave)) return Results.BadRequest(new { ok = false, erro = "Informe a chave da OpenAI." });
            try
            {
                var todos = await ia.TodosModelosAsync(chave, ct);
                return Results.Ok(new { ok = true, modelos = await ia.ModelosAsync(chave, ct), modelos_voz = OpenAiProvedor.SoVoz(todos) });
            }
            catch (IaException e) { return Falha(e); }
            catch (HttpRequestException) { return Results.Json(new { ok = false, erro = "Sem conexão com a OpenAI (internet?)." }, statusCode: 502); }
            catch (TaskCanceledException) { return Results.Json(new { ok = false, erro = "A OpenAI demorou demais para responder." }, statusCode: 504); }
        });

        /* CONVERSA POR VOZ AO VIVO (Botão VOZ). Daniel, 08/11/2026: "crie o Botão VOZ, usando Live, conversa humana, ligue ele
         * com os mesmos poderes da Luninha" / "se ficar sem falar por 30 segundos, desligar sozinho" (o desligar é na tela).
         * Recebe a proposta de áudio (SDP) do navegador e devolve a resposta da OpenAI. A chave fica aqui. As ferramentas da
         * tela entram depois pelo canal de dados da própria conversa (session.update), executadas pela TELA. */
        app.MapPost("/api/ia/voz/conectar", async (HttpRequest req, IaVozInput input, IProvedorIA ia, CancellationToken ct) =>
        {
            if (logado(req) is null) return Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
            var (modeloVoz, voz) = config.Voz();
            if (config.Atual() is not { } cfg || modeloVoz.Length == 0)
                return Results.Json(new { ok = false, erro = "Voz não configurada: um administrador escolhe o modelo de voz em Inteligência Artificial." }, statusCode: 409);
            var sdp = input.sdp ?? "";
            if (!sdp.TrimStart().StartsWith("v=") || sdp.Length > 20000) return Results.BadRequest(new { ok = false, erro = "Proposta de áudio inválida." });
            var instrucoes = $"Seu nome é {config.Nome()}.\n" + Sistema + """

                Esta é uma conversa por VOZ, ao vivo: fale de forma natural e calorosa, como numa ligação.
                SEJA CURTA: no máximo 2 frases por resposta. Nunca repita uma resposta que você já deu.
                Você está disponível para CONVERSAR. O que você sabe fazer fica guardado só para você: NUNCA liste suas
                capacidades por conta própria. Se perguntarem o que você faz, resuma em UMA frase.
                Não leia listas longas: resuma em uma frase e ofereça mostrar na tela. Números e documentos, fale de forma clara.
                (Daniel, 08/11/2026, no teste: "você está falando muito, falou demais".)
                CONFIRMAÇÃO: quando uma ferramenta responder "AGUARDANDO CONFIRMAÇÃO", leia o resumo em voz alta, pergunte
                "Confirma?" e, quando o usuário responder, chame confirmar_acao com resposta "sim" ou "nao".
                """ + (string.IsNullOrWhiteSpace(input.tela) ? "" : "\nTela aberta: " + input.tela.Trim()[..Math.Min(80, input.tela.Trim().Length)] + ".");
            try { return Results.Ok(new { ok = true, sdp = await ia.ConectarVozAsync(cfg.chave, modeloVoz, voz, instrucoes, sdp, ct), nome = config.Nome() }); }
            catch (IaException e) { return Falha(e); }
            catch (HttpRequestException) { return Results.Json(new { ok = false, erro = "Sem conexão com a OpenAI (internet?)." }, statusCode: 502); }
            catch (TaskCanceledException) { return Results.Json(new { ok = false, erro = "A OpenAI demorou demais para abrir a conversa por voz." }, statusCode: 504); }
        });

        // ferramenta geral da IA: previsão do tempo (qualquer usuário logado; só consulta)
        app.MapGet("/api/ia/tempo", async (HttpRequest req, string? cidade, int? dias, IHttpClientFactory clients, CancellationToken ct) =>
        {
            if (logado(req) is null) return Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
            try { return Results.Ok(new { ok = true, dados = await PrevisaoTempo.ConsultarAsync(clients, cidade ?? "", dias ?? 3, ct) }); }
            catch (ArgumentException e) { return Results.BadRequest(new { ok = false, erro = e.Message }); }
            catch (KeyNotFoundException e) { return Results.NotFound(new { ok = false, erro = e.Message }); }
            catch (IaException e) { return Falha(e); }
            catch (HttpRequestException) { return Results.Json(new { ok = false, erro = "Previsão do tempo indisponível (sem internet?)." }, statusCode: 502); }
            catch (TaskCanceledException) { return Results.Json(new { ok = false, erro = "A previsão do tempo demorou demais." }, statusCode: 504); }
        });

        // ferramenta geral da IA: pesquisa na internet (qualquer usuário logado; só consulta; usa a chave/modelo da API)
        app.MapPost("/api/ia/pesquisar", async (HttpRequest req, IaPesquisaInput input, IProvedorIA ia, CancellationToken ct) =>
        {
            if (logado(req) is null) return Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
            if (config.Atual() is not { } cfg || cfg.modelo.Length == 0) return Results.Json(new { ok = false, erro = "IA não configurada." }, statusCode: 409);
            var pergunta = (input.pergunta ?? "").Trim();
            if (pergunta.Length is < 3 or > 500) return Results.BadRequest(new { ok = false, erro = "Pergunta vazia ou longa demais." });
            try { return Results.Ok(new { ok = true, dados = await ia.PesquisarAsync(cfg.chave, cfg.modelo, pergunta, ct) }); }
            catch (IaException e) { return Falha(e); }
            catch (HttpRequestException) { return Results.Json(new { ok = false, erro = "Sem conexão com a OpenAI (internet?)." }, statusCode: 502); }
            catch (TaskCanceledException) { return Results.Json(new { ok = false, erro = "A pesquisa demorou demais." }, statusCode: 504); }
        });

        app.MapPost("/api/ia/chat", async (HttpRequest req, IaChatInput input, IProvedorIA ia, CancellationToken ct) =>
        {
            if (logado(req) is null) return Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
            if (config.Atual() is not { } cfg || cfg.modelo.Length == 0)
                return Results.Json(new { ok = false, erro = "IA não configurada. Um administrador cadastra a chave em Administração → Inteligência Artificial." }, statusCode: 409);
            var mensagens = input.mensagens ?? [];
            var ferramentas = input.ferramentas ?? [];
            if (mensagens.Count is 0 or > 40) return Results.BadRequest(new { ok = false, erro = "Conversa vazia ou longa demais: comece uma nova." });
            if (ferramentas.Count > 20) return Results.BadRequest(new { ok = false, erro = "Ferramentas demais nesta tela." });
            var todas = new JsonArray { new JsonObject { ["role"] = "system", ["content"] =
                $"Seu nome é {config.Nome()}. Apresente-se por esse nome quando fizer sentido.\n" + Sistema } };
            foreach (var m in mensagens) todas.Add(m?.DeepClone());
            try { return Results.Ok(new { ok = true, mensagem = await ia.ConversarAsync(cfg.chave, cfg.modelo, todas, ferramentas, ct) }); }
            catch (IaException e) { return Falha(e); }
            catch (HttpRequestException) { return Results.Json(new { ok = false, erro = "Sem conexão com a OpenAI (internet?)." }, statusCode: 502); }
            catch (TaskCanceledException) { return Results.Json(new { ok = false, erro = "A OpenAI demorou demais para responder." }, statusCode: 504); }
        });
    }
}
