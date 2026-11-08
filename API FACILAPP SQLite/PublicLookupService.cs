using System.Collections.Concurrent;
using System.Net;
using System.Text.Json;

namespace FacilApp.Sqlite.Api;

public sealed class PublicLookupService(IHttpClientFactory clients)
{
    private sealed record CacheItem<T>(T Value, DateTimeOffset ExpiresAt);
    private readonly ConcurrentDictionary<string, CacheItem<PublicCompanyView>> cnpjCache = new();
    private readonly ConcurrentDictionary<string, CacheItem<PublicCnpjRawResponse>> rawCache = new();

    public async Task<PublicCompanyView> CnpjAsync(string value, CancellationToken token)
    {
        var cnpj = Digits(value);
        if (!ValidCnpj(cnpj)) throw new ArgumentException("CNPJ inválido.");
        if (cnpjCache.TryGetValue(cnpj, out var cached) && cached.ExpiresAt > DateTimeOffset.UtcNow) return cached.Value;
        var raw = await CnpjRawAsync(cnpj, token);
        var result = raw.Fonte.Equals("CNPJ.ws", StringComparison.OrdinalIgnoreCase)
            ? MapCnpjWs(cnpj, raw.Dados) : MapBrasilApi(cnpj, raw.Dados);
        cnpjCache[cnpj] = new(result, DateTimeOffset.UtcNow.AddHours(12));
        return result;
    }

    public async Task<PublicCnpjRawResponse> CnpjRawAsync(string value, CancellationToken token)
    {
        var cnpj = Digits(value);
        if (!ValidCnpj(cnpj)) throw new ArgumentException("CNPJ inválido.");
        if (rawCache.TryGetValue(cnpj, out var cached) && cached.ExpiresAt > DateTimeOffset.UtcNow) return cached.Value;
        var client = clients.CreateClient("public-lookup");
        var unavailable = false;
        foreach (var source in new[] { (Name: "BrasilAPI", Url: "https://brasilapi.com.br/api/cnpj/v1/"), (Name: "CNPJ.ws", Url: "https://publica.cnpj.ws/cnpj/") })
        {
            try
            {
                using var response = await client.GetAsync(source.Url + cnpj, token);
                if (response.StatusCode == HttpStatusCode.NotFound) continue;
                if (!response.IsSuccessStatusCode) { unavailable = true; continue; }
                using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(token));
                var result = new PublicCnpjRawResponse(cnpj, source.Name, document.RootElement.Clone());
                rawCache[cnpj] = new(result, DateTimeOffset.UtcNow.AddHours(12));
                return result;
            }
            catch (HttpRequestException) when (!token.IsCancellationRequested) { unavailable = true; }
            catch (TaskCanceledException) when (!token.IsCancellationRequested) { unavailable = true; }
        }
        if (unavailable) throw new HttpRequestException("Fontes públicas de CNPJ indisponíveis.");
        throw new KeyNotFoundException("CNPJ não encontrado nas fontes públicas.");
    }

    public async Task<PublicCepView> CepAsync(string value, CancellationToken token)
    {
        var cep = Digits(value);
        if (cep.Length != 8) throw new ArgumentException("CEP inválido. Informe 8 dígitos.");
        using var response = await clients.CreateClient("public-lookup").GetAsync("https://brasilapi.com.br/api/cep/v2/" + cep, token);
        if (response.StatusCode == HttpStatusCode.NotFound) throw new KeyNotFoundException("CEP não encontrado.");
        response.EnsureSuccessStatusCode();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(token));
        var root = document.RootElement;
        var ibge = root.TryGetProperty("ibge", out var i) ? Text(i, "city") : "";
        return new(Text(root, "cep"), Text(root, "state").ToUpperInvariant(), Text(root, "city"),
            Text(root, "neighborhood"), Text(root, "street"), ibge);
    }

    private static string Text(JsonElement root, string name) => root.ValueKind == JsonValueKind.Object && root.TryGetProperty(name, out var value) && value.ValueKind != JsonValueKind.Null ? value.ToString().Trim() : "";
    private static JsonElement Child(JsonElement root, string name) => root.ValueKind == JsonValueKind.Object && root.TryGetProperty(name, out var value) ? value : default;
    private static string Digits(string? value) => new((value ?? "").Where(c => c is >= '0' and <= '9').ToArray());

    private static bool ValidCnpj(string value)
    {
        if (value.Length != 14 || value.All(c => c == value[0])) return false;
        int Digit(int length)
        {
            int weight = length - 7, sum = 0;
            for (var i = 0; i < length; i++) { sum += (value[i] - '0') * weight; weight = weight < 3 ? 9 : weight - 1; }
            var mod = sum % 11;
            return mod < 2 ? 0 : 11 - mod;
        }
        return Digit(12) == value[12] - '0' && Digit(13) == value[13] - '0';
    }

    private static PublicCompanyView MapBrasilApi(string cnpj, JsonElement root) => new(
        cnpj, Text(root, "razao_social"), Text(root, "nome_fantasia"), Text(root, "inscricao_estadual"), Text(root, "email"),
        Text(root, "ddd_telefone_1"), Text(root, "cep"), Text(root, "codigo_municipio_ibge"), Text(root, "uf").ToUpperInvariant(),
        Text(root, "municipio"), Text(root, "logradouro"), Text(root, "numero"), Text(root, "complemento"), Text(root, "bairro"));

    private static PublicCompanyView MapCnpjWs(string cnpj, JsonElement root)
    {
        var establishment = Child(root, "estabelecimento");
        var city = Child(establishment, "cidade");
        var state = Child(establishment, "estado");
        var registrations = Child(establishment, "inscricoes_estaduais");
        var stateRegistration = registrations.ValueKind == JsonValueKind.Array && registrations.GetArrayLength() > 0
            ? Text(registrations[0], "inscricao_estadual") : "";
        var address = string.Join(' ', new[] { Text(establishment, "tipo_logradouro"), Text(establishment, "logradouro") }.Where(x => x.Length > 0));
        var phone = Text(establishment, "ddd1") + Text(establishment, "telefone1");
        return new(cnpj, Text(root, "razao_social"), Text(establishment, "nome_fantasia"), stateRegistration,
            Text(establishment, "email"), phone, Text(establishment, "cep"), Text(city, "ibge_id"), Text(state, "sigla").ToUpperInvariant(),
            Text(city, "nome"), address, Text(establishment, "numero"), Text(establishment, "complemento"), Text(establishment, "bairro"));
    }
}

public sealed record PublicCompanyView(string Cnpj, string RazaoSocial, string NomeFantasia, string InscricaoEstadual,
    string Email, string Telefone, string Cep, string CodigoIbge, string Uf, string Cidade, string Endereco,
    string Numero, string Complemento, string Bairro);
public sealed record PublicCnpjRawResponse(string Cnpj, string Fonte, JsonElement Dados);
public sealed record PublicCepView(string Cep, string Uf, string Cidade, string Bairro, string Endereco, string CodigoIbge);
