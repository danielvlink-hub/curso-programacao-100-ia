using System.Globalization;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace FacilApp.Sqlite.Api;

/*
 * MOTOR DE CADASTRO — Bloco 1 do FastPousada (aula gravada de 08/11/2026).
 * Daniel: "gere todas as telas faltantes, use do minimalismo em campos, não coloque o que não seja necessário ...
 *          coloque os campos que você julgar necessários à fiel execução do sistema" / "sim, inicia" (Bloco 1).
 *
 * O QUE FAZ
 *   Cada cadastro simples é descrito por uma FICHA (Entidade): tabela, chave, rota, campos (tipo, obrigatório, tamanho,
 *   opções), o que não pode repetir, onde buscar, regras especiais e o que impede a exclusão. Com a ficha, o motor cria a
 *   tabela e as rotas GET/POST/PUT/DELETE em /api/<rota>, com validação, permissão por item de menu e mensagens claras.
 * CADASTROS DO BLOCO 1
 *   Tipos de quarto (quartos_tipos), Quartos (quartos), Tarifas (tarifas), Serviços e produtos (servicos_produtos),
 *   Formas de pagamento (formas_pagamento). Extras: tarifa calculada noite a noite e geração de quartos em lote.
 * MULTIBANCO
 *   As rotas só conhecem ICadastroRepository. Hoje: CadastroSqlite. SQL Server/PostgreSQL = outra implementação.
 * REGRAS GERAIS
 *   Consultas parametrizadas; nomes de tabela/coluna vêm SÓ da ficha (código), nunca do usuário. Nenhuma rota recebe SQL.
 *   Campo desconhecido no JSON é ignorado. Exclusão recusada quando o registro está em uso ("inative em vez de excluir").
 */

// ------------------------------------------------------------------ fichas
/// <summary>Um campo da ficha. Tipo: texto | inteiro | decimal | data | bool.</summary>
public sealed record Campo(string Nome, string Tipo, string Rotulo, bool Obrigatorio = false, int Max = 120,
    string[]? Opcoes = null, double? Minimo = null, string? Padrao = null);

/// <summary>Uso que impede excluir: tabela e coluna que apontam para este registro (verificado só se a tabela existir).</summary>
public sealed record Uso(string Tabela, string Coluna, string Descricao);

/// <summary>Ficha de um cadastro simples.</summary>
public sealed record Entidade(
    string Tabela, string Chave, string Rota, string CodigoMenu, string Singular, Campo[] Campos,
    string[] Unicos, string[] Busca, string OrdemPor, Uso[] Usos,
    Func<Dictionary<string, object?>, long, ICadastroRepository, string?>? Validar = null,
    Dictionary<string, Entidade>? Referencias = null);

// ------------------------------------------------------------------ repositório (multibanco)
/// <summary>O que qualquer banco precisa oferecer ao motor de cadastro.</summary>
public interface ICadastroRepository
{
    void Initialize(Entidade e);
    IReadOnlyList<Dictionary<string, object?>> Listar(Entidade e, string? busca, Dictionary<string, string> filtros);
    Dictionary<string, object?>? Obter(Entidade e, long id);
    /// <summary>Outro registro com o mesmo valor (sem diferenciar maiúsculas), ignorando o id atual; null = livre.</summary>
    Dictionary<string, object?>? PorValor(Entidade e, string coluna, object valor, long ignorarId);
    long Incluir(Entidade e, Dictionary<string, object?> dados);
    void Alterar(Entidade e, long id, Dictionary<string, object?> dados);
    void Excluir(Entidade e, long id);
    /// <summary>Quantos registros de outra tabela usam este id (0 se a tabela ainda não existe).</summary>
    long ContarUso(Uso uso, long id);
}

/// <summary>Motor de cadastro no SQLite (banco das aulas). Todo SQL específico do SQLite fica aqui.</summary>
public sealed class CadastroSqlite(string databasePath) : ICadastroRepository
{
    private SqliteConnection Open()
    {
        var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = databasePath }.ToString());
        db.Open();
        return db;
    }

    private static string TipoSql(string tipo) => tipo switch
    {
        "inteiro" or "bool" => "INTEGER",
        "decimal" => "REAL",
        _ => "TEXT"
    };

    /// <summary>Cria a tabela (se não existir) e acrescenta colunas novas da ficha (nunca apaga nada).</summary>
    public void Initialize(Entidade e)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        var cols = string.Join(", ", e.Campos.Select(c =>
            $"{c.Nome} {TipoSql(c.Tipo)}" + (c.Tipo == "texto" || c.Tipo == "data" ? " NOT NULL DEFAULT ''" : " NULL")));
        cmd.CommandText = $"CREATE TABLE IF NOT EXISTS {e.Tabela} ({e.Chave} INTEGER PRIMARY KEY AUTOINCREMENT, {cols}, " +
                          "criado_em TEXT NOT NULL DEFAULT '', alterado_em TEXT NOT NULL DEFAULT '')";
        cmd.ExecuteNonQuery();
        cmd.CommandText = $"PRAGMA table_info({e.Tabela})";
        var existentes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using (var r = cmd.ExecuteReader()) while (r.Read()) existentes.Add(r.GetString(1));
        foreach (var c in e.Campos.Where(c => !existentes.Contains(c.Nome)))
        {
            cmd.CommandText = $"ALTER TABLE {e.Tabela} ADD COLUMN {c.Nome} {TipoSql(c.Tipo)}" + (c.Tipo is "texto" or "data" ? " NOT NULL DEFAULT ''" : "");
            cmd.ExecuteNonQuery();
        }
    }

    private static Dictionary<string, object?> Ler(Entidade e, SqliteDataReader r)
    {
        var d = new Dictionary<string, object?> { [e.Chave] = r.GetInt64(0) };
        for (var i = 0; i < e.Campos.Length; i++)
        {
            var c = e.Campos[i];
            var v = r.IsDBNull(i + 1) ? null : r.GetValue(i + 1);
            d[c.Nome] = c.Tipo switch
            {
                "bool" => v is not null && Convert.ToInt64(v) != 0,
                "inteiro" => v is null ? null : Convert.ToInt64(v),
                "decimal" => v is null ? null : Convert.ToDouble(v),
                _ => v?.ToString() ?? ""
            };
        }
        d["criado_em"] = r.GetString(e.Campos.Length + 1);
        d["alterado_em"] = r.GetString(e.Campos.Length + 2);
        return d;
    }

    private static string Colunas(Entidade e) => $"{e.Chave}, " + string.Join(", ", e.Campos.Select(c => c.Nome)) + ", criado_em, alterado_em";

    public IReadOnlyList<Dictionary<string, object?>> Listar(Entidade e, string? busca, Dictionary<string, string> filtros)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        var where = new List<string>();
        if (!string.IsNullOrWhiteSpace(busca) && e.Busca.Length > 0)
        {
            where.Add("(" + string.Join(" OR ", e.Busca.Select(b => $"{b} LIKE $busca")) + ")");
            cmd.Parameters.AddWithValue("$busca", "%" + busca.Trim() + "%");
        }
        var i = 0;
        foreach (var (campo, valor) in filtros)
        {
            var c = e.Campos.FirstOrDefault(x => x.Nome == campo);       // só campos da ficha
            if (c is null || valor.Length == 0) continue;
            where.Add($"{c.Nome} = $f{i}");
            cmd.Parameters.AddWithValue($"$f{i}", c.Tipo == "bool" ? (valor is "1" or "true" ? 1 : 0) : valor);
            i++;
        }
        cmd.CommandText = $"SELECT {Colunas(e)} FROM {e.Tabela}" + (where.Count > 0 ? " WHERE " + string.Join(" AND ", where) : "") +
                          $" ORDER BY {e.OrdemPor}";
        using var r = cmd.ExecuteReader();
        var lista = new List<Dictionary<string, object?>>();
        while (r.Read()) lista.Add(Ler(e, r));
        return lista;
    }

    public Dictionary<string, object?>? Obter(Entidade e, long id)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = $"SELECT {Colunas(e)} FROM {e.Tabela} WHERE {e.Chave} = $id";
        cmd.Parameters.AddWithValue("$id", id);
        using var r = cmd.ExecuteReader();
        return r.Read() ? Ler(e, r) : null;
    }

    public Dictionary<string, object?>? PorValor(Entidade e, string coluna, object valor, long ignorarId)
    {
        if (!e.Campos.Any(c => c.Nome == coluna)) return null;
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = $"SELECT {Colunas(e)} FROM {e.Tabela} WHERE {coluna} = $v COLLATE NOCASE AND {e.Chave} <> $id LIMIT 1";
        cmd.Parameters.AddWithValue("$v", valor);
        cmd.Parameters.AddWithValue("$id", ignorarId);
        using var r = cmd.ExecuteReader();
        return r.Read() ? Ler(e, r) : null;
    }

    private static void Bind(SqliteCommand cmd, Entidade e, Dictionary<string, object?> dados)
    {
        foreach (var c in e.Campos)
        {
            var v = dados.GetValueOrDefault(c.Nome);
            cmd.Parameters.AddWithValue("$" + c.Nome, c.Tipo switch
            {
                "bool" => v is true ? 1 : 0,
                "texto" or "data" => v?.ToString() ?? "",
                _ => v ?? DBNull.Value
            });
        }
        cmd.Parameters.AddWithValue("$agora", DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss"));
    }

    public long Incluir(Entidade e, Dictionary<string, object?> dados)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        var nomes = e.Campos.Select(c => c.Nome).ToList();
        cmd.CommandText = $"INSERT INTO {e.Tabela} ({string.Join(", ", nomes)}, criado_em, alterado_em) " +
                          $"VALUES ({string.Join(", ", nomes.Select(n => "$" + n))}, $agora, $agora); SELECT last_insert_rowid();";
        Bind(cmd, e, dados);
        return Convert.ToInt64(cmd.ExecuteScalar());
    }

    public void Alterar(Entidade e, long id, Dictionary<string, object?> dados)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = $"UPDATE {e.Tabela} SET {string.Join(", ", e.Campos.Select(c => $"{c.Nome} = ${c.Nome}"))}, alterado_em = $agora " +
                          $"WHERE {e.Chave} = $id";
        Bind(cmd, e, dados);
        cmd.Parameters.AddWithValue("$id", id);
        cmd.ExecuteNonQuery();
    }

    public void Excluir(Entidade e, long id)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = $"DELETE FROM {e.Tabela} WHERE {e.Chave} = $id";
        cmd.Parameters.AddWithValue("$id", id);
        cmd.ExecuteNonQuery();
    }

    public long ContarUso(Uso uso, long id)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM pragma_table_info($t) WHERE name = $c";
        cmd.Parameters.AddWithValue("$t", uso.Tabela);
        cmd.Parameters.AddWithValue("$c", uso.Coluna);
        if (Convert.ToInt64(cmd.ExecuteScalar()) == 0) return 0;
        cmd.Parameters.Clear();
        cmd.CommandText = $"SELECT COUNT(*) FROM {uso.Tabela} WHERE {uso.Coluna} = $id";   // nomes vêm da ficha (código)
        cmd.Parameters.AddWithValue("$id", id);
        return Convert.ToInt64(cmd.ExecuteScalar());
    }
}

// ------------------------------------------------------------------ as fichas do Bloco 1
public static class FichasBloco1
{
    public static readonly string[] SituacoesQuarto = ["LIVRE", "SUJO", "MANUTENCAO", "BLOQUEADO"];
    public static readonly string[] CategoriasItem = ["FRIGOBAR", "RESTAURANTE", "LAVANDERIA", "PASSEIO", "OUTROS"];
    public static readonly string[] TiposPagamento = ["DINHEIRO", "PIX", "CARTAO_DEBITO", "CARTAO_CREDITO", "TRANSFERENCIA", "FATURADO"];

    /// <summary>Tipos de quarto: o que se vende (capacidade, diária base, comodidades). Também alimenta o motor de reservas on-line.</summary>
    public static readonly Entidade TiposQuarto = new(
        "quartos_tipos", "id_tipo", "tipos-quarto", "cad_tipos_quarto", "tipo de quarto",
        [
            new("nome", "texto", "Nome", Obrigatorio: true, Max: 60),
            new("sigla", "texto", "Sigla", Obrigatorio: true, Max: 6),
            new("capacidade_adultos", "inteiro", "Adultos", Obrigatorio: true, Minimo: 1, Padrao: "2"),
            new("capacidade_criancas", "inteiro", "Crianças", Minimo: 0, Padrao: "0"),
            new("diaria_base", "decimal", "Diária base", Obrigatorio: true, Minimo: 0.01),
            new("comodidades", "texto", "Comodidades", Max: 300),
            new("descricao", "texto", "Descrição", Max: 500),
            new("ativo", "bool", "Ativo", Padrao: "true")
        ],
        Unicos: ["nome", "sigla"], Busca: ["nome", "sigla", "comodidades"], OrdemPor: "nome COLLATE NOCASE",
        Usos: [new("quartos", "id_tipo", "quartos"), new("tarifas", "id_tipo", "tarifas")]);

    /// <summary>Quartos: as unidades físicas. Situação do dia a dia: Livre, Sujo, Manutenção, Bloqueado.</summary>
    public static readonly Entidade Quartos = new(
        "quartos", "id_quarto", "quartos", "cad_quartos", "quarto",
        [
            new("numero", "texto", "Número", Obrigatorio: true, Max: 10),
            new("id_tipo", "inteiro", "Tipo", Obrigatorio: true),
            new("andar", "texto", "Andar / bloco", Max: 30),
            new("situacao", "texto", "Situação", Obrigatorio: true, Max: 12, Opcoes: SituacoesQuarto, Padrao: "LIVRE"),
            new("observacao", "texto", "Observação", Max: 300),
            new("ativo", "bool", "Ativo", Padrao: "true")
        ],
        Unicos: ["numero"], Busca: ["numero", "andar", "observacao"], OrdemPor: "CAST(numero AS INTEGER), numero",
        Usos: [new("reservas", "id_quarto", "reservas")],
        Validar: (d, id, repo) => repo.Obter(TiposQuarto, Convert.ToInt64(d["id_tipo"])) is null ? "Tipo de quarto não encontrado." : null);

    /// <summary>Tarifas: preço por tipo, período e dias da semana (alta temporada, fim de semana, feriado).</summary>
    public static readonly Entidade Tarifas = new(
        "tarifas", "id_tarifa", "tarifas", "cad_tarifas", "tarifa",
        [
            new("id_tipo", "inteiro", "Tipo", Obrigatorio: true),
            new("descricao", "texto", "Descrição", Obrigatorio: true, Max: 60),
            new("inicio", "data", "De", Obrigatorio: true),
            new("fim", "data", "Até", Obrigatorio: true),
            new("dias_semana", "texto", "Dias da semana", Max: 7, Padrao: "0123456"),
            new("valor_diaria", "decimal", "Diária", Obrigatorio: true, Minimo: 0.01),
            new("minimo_noites", "inteiro", "Mínimo de noites", Minimo: 1, Padrao: "1"),
            new("ativo", "bool", "Ativo", Padrao: "true")
        ],
        Unicos: [], Busca: ["descricao"], OrdemPor: "inicio DESC, descricao COLLATE NOCASE",
        Usos: [],
        Validar: ValidarTarifa);

    /// <summary>Serviços e produtos: o que se lança na conta do quarto (frigobar, restaurante, lavanderia, passeio).</summary>
    public static readonly Entidade ServicosProdutos = new(
        "servicos_produtos", "id_item", "servicos-produtos", "cad_servicos", "item",
        [
            new("nome", "texto", "Nome", Obrigatorio: true, Max: 80),
            new("categoria", "texto", "Categoria", Obrigatorio: true, Max: 15, Opcoes: CategoriasItem, Padrao: "OUTROS"),
            new("preco", "decimal", "Preço", Obrigatorio: true, Minimo: 0),
            new("unidade", "texto", "Unidade", Max: 10, Padrao: "UN"),
            new("ativo", "bool", "Ativo", Padrao: "true")
        ],
        Unicos: ["nome"], Busca: ["nome", "categoria"], OrdemPor: "categoria, nome COLLATE NOCASE",
        Usos: [new("consumos", "id_item", "consumos lançados")]);

    /// <summary>Formas de pagamento: como a pousada recebe (taxa e prazo servem ao financeiro).</summary>
    public static readonly Entidade FormasPagamento = new(
        "formas_pagamento", "id_forma", "formas-pagamento", "cad_pagamentos", "forma de pagamento",
        [
            new("nome", "texto", "Nome", Obrigatorio: true, Max: 40),
            new("tipo", "texto", "Tipo", Obrigatorio: true, Max: 15, Opcoes: TiposPagamento),
            new("taxa_percentual", "decimal", "Taxa %", Minimo: 0, Padrao: "0"),
            new("prazo_dias", "inteiro", "Prazo (dias)", Minimo: 0, Padrao: "0"),
            new("ativo", "bool", "Ativo", Padrao: "true")
        ],
        Unicos: ["nome"], Busca: ["nome", "tipo"], OrdemPor: "nome COLLATE NOCASE",
        Usos: [new("recebimentos", "id_forma", "recebimentos")]);

    public static readonly Entidade[] Todas = [TiposQuarto, Quartos, Tarifas, ServicosProdutos, FormasPagamento];

    /*
     * ValidarTarifa — regras da tarifa:
     *   - tipo existe; fim >= início; dias da semana só com 0..6 (0 = domingo) e pelo menos um;
     *   - não pode haver outra tarifa ATIVA do mesmo tipo com período E dia da semana em comum (diz qual conflita).
     */
    private static string? ValidarTarifa(Dictionary<string, object?> d, long id, ICadastroRepository repo)
    {
        var idTipo = Convert.ToInt64(d["id_tipo"]);
        if (repo.Obter(TiposQuarto, idTipo) is null) return "Tipo de quarto não encontrado.";
        var ini = d["inicio"]?.ToString() ?? "";
        var fim = d["fim"]?.ToString() ?? "";
        if (string.CompareOrdinal(fim, ini) < 0) return "A data final deve ser igual ou depois da inicial.";
        var dias = new string((d["dias_semana"]?.ToString() ?? "").Where(c => c is >= '0' and <= '6').Distinct().OrderBy(c => c).ToArray());
        if (dias.Length == 0) return "Escolha pelo menos um dia da semana.";
        d["dias_semana"] = dias;
        if (d["ativo"] is not true) return null;
        var outras = repo.Listar(Tarifas, null, new() { ["id_tipo"] = idTipo.ToString(), ["ativo"] = "1" });
        foreach (var t in outras.Where(t => Convert.ToInt64(t["id_tarifa"]) != id))
        {
            var cruzaPeriodo = string.CompareOrdinal(ini, t["fim"]!.ToString()) <= 0 && string.CompareOrdinal(fim, t["inicio"]!.ToString()) >= 0;
            var cruzaDias = dias.Any(c => (t["dias_semana"]?.ToString() ?? "").Contains(c));
            if (cruzaPeriodo && cruzaDias)
                return $"Já existe a tarifa \"{t["descricao"]}\" deste tipo no mesmo período e dias da semana ({t["inicio"]} a {t["fim"]}).";
        }
        return null;
    }
}

// ------------------------------------------------------------------ rotas
public static class CadastrosEndpoints
{
    /// <summary>Objeto(corpo) — os campos do JSON recebido (corpo que não é objeto vira vazio → "Informe ...").</summary>
    private static Dictionary<string, JsonElement> Objeto(JsonElement corpo) =>
        corpo.ValueKind == JsonValueKind.Object ? corpo.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.Clone()) : [];

    /// <summary>Converte o JSON recebido para os tipos da ficha. Devolve (dados, erro). Campo desconhecido é ignorado.</summary>
    private static (Dictionary<string, object?> dados, string? erro) Converter(Entidade e, Dictionary<string, JsonElement> json)
    {
        var d = new Dictionary<string, object?>();
        foreach (var c in e.Campos)
        {
            json.TryGetValue(c.Nome, out var v);
            var vazio = v.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null || (v.ValueKind == JsonValueKind.String && v.GetString()!.Trim().Length == 0);
            if (vazio && c.Padrao is not null) v = JsonDocument.Parse(c.Tipo is "texto" or "data" ? JsonSerializer.Serialize(c.Padrao) : c.Padrao).RootElement;
            vazio = v.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null || (v.ValueKind == JsonValueKind.String && v.GetString()!.Trim().Length == 0);
            if (vazio)
            {
                if (c.Obrigatorio) return (d, $"Informe {c.Rotulo.ToLowerInvariant()}.");
                d[c.Nome] = c.Tipo is "texto" or "data" ? "" : c.Tipo == "bool" ? false : null;
                continue;
            }
            var texto = v.ValueKind == JsonValueKind.String ? v.GetString()!.Trim() : v.ToString();
            switch (c.Tipo)
            {
                case "bool":
                    d[c.Nome] = v.ValueKind == JsonValueKind.True || texto is "1" or "true" or "sim";
                    break;
                case "inteiro":
                    if (!long.TryParse(texto, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n)) return (d, $"{c.Rotulo}: número inteiro inválido.");
                    if (c.Minimo is { } minI && n < minI) return (d, $"{c.Rotulo}: mínimo {minI}.");
                    d[c.Nome] = n;
                    break;
                case "decimal":
                    if (!double.TryParse(texto.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var x)) return (d, $"{c.Rotulo}: valor inválido.");
                    if (c.Minimo is { } minD && x < minD) return (d, $"{c.Rotulo}: mínimo {minD.ToString(CultureInfo.GetCultureInfo("pt-BR"))}.");
                    d[c.Nome] = Math.Round(x, 2);
                    break;
                case "data":
                    if (!DateOnly.TryParseExact(texto, "yyyy-MM-dd", out _)) return (d, $"{c.Rotulo}: data inválida (AAAA-MM-DD).");
                    d[c.Nome] = texto;
                    break;
                default:
                    if (texto.Length > c.Max) return (d, $"{c.Rotulo}: no máximo {c.Max} caracteres.");
                    if (c.Opcoes is { } op)
                    {
                        texto = texto.ToUpperInvariant();
                        if (!op.Contains(texto)) return (d, $"{c.Rotulo}: use {string.Join(", ", op)}.");
                    }
                    d[c.Nome] = texto;
                    break;
            }
        }
        return (d, null);
    }

    /// <summary>
    /// MapCadastros — cria as rotas de todas as fichas + os extras do Bloco 1.
    /// logado: (id, administrador) do Bearer; permissao: (idUsuario, codigoMenu) → exceções do item (null = sem restrição).
    /// </summary>
    public static void MapCadastros(this WebApplication app, ICadastroRepository repo,
        Func<HttpRequest, (long id, bool admin)?> logado, Func<long, string, MenuPermission?> permissao)
    {
        foreach (var e in FichasBloco1.Todas) repo.Initialize(e);

        IResult Nao401() => Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
        IResult? Checar(HttpRequest req, Entidade e, string? acao)
        {
            if (logado(req) is not { } u) return Nao401();
            if (u.admin || acao is null) return null;
            if (permissao(u.id, e.CodigoMenu) is not { } p) return null;
            var negado = (p.ativo == 0 || p.oculto == 1 || p.desabilitado == 1) ||
                         (acao == "incluir" && p.incluir == 0) || (acao == "alterar" && p.alterar == 0) || (acao == "excluir" && p.excluir == 0);
            return negado ? Results.Json(new { ok = false, erro = $"Seu usuário não tem permissão para {acao} {e.Singular}." }, statusCode: 403) : null;
        }
        string? Unicos(Entidade e, Dictionary<string, object?> d, long id)
        {
            foreach (var u in e.Unicos)
                if (d.GetValueOrDefault(u) is { } v && v.ToString()!.Length > 0 && repo.PorValor(e, u, v, id) is not null)
                    return $"Já existe {e.Singular} com {e.Campos.First(c => c.Nome == u).Rotulo.ToLowerInvariant()} \"{v}\".";
            return null;
        }

        foreach (var e in FichasBloco1.Todas)
        {
            var ent = e;
            var rota = "/api/" + ent.Rota;

            app.MapGet(rota, (HttpRequest req) =>
            {
                if (Checar(req, ent, null) is { } negado) return negado;
                var filtros = req.Query.Where(q => q.Key != "busca").ToDictionary(q => q.Key, q => q.Value.ToString());
                return Results.Ok(new { ok = true, dados = repo.Listar(ent, req.Query["busca"], filtros) });
            });

            app.MapGet(rota + "/{id:long}", (HttpRequest req, long id) =>
            {
                if (Checar(req, ent, null) is { } negado) return negado;
                return repo.Obter(ent, id) is { } d ? Results.Ok(new { ok = true, dados = d })
                    : Results.NotFound(new { ok = false, erro = $"{char.ToUpper(ent.Singular[0]) + ent.Singular[1..]} não encontrado." });
            });

            app.MapPost(rota, (HttpRequest req, JsonElement corpo) =>
            {
                if (Checar(req, ent, "incluir") is { } negado) return negado;
                var (d, erro) = Converter(ent, Objeto(corpo));
                erro ??= Unicos(ent, d, 0) ?? ent.Validar?.Invoke(d, 0, repo);
                if (erro is not null) return Results.BadRequest(new { ok = false, erro });
                return Results.Ok(new { ok = true, id = repo.Incluir(ent, d) });
            });

            app.MapPut(rota + "/{id:long}", (HttpRequest req, long id, JsonElement corpo) =>
            {
                if (Checar(req, ent, "alterar") is { } negado) return negado;
                if (repo.Obter(ent, id) is null) return Results.NotFound(new { ok = false, erro = "Registro não encontrado." });
                var (d, erro) = Converter(ent, Objeto(corpo));
                erro ??= Unicos(ent, d, id) ?? ent.Validar?.Invoke(d, id, repo);
                if (erro is not null) return Results.BadRequest(new { ok = false, erro });
                repo.Alterar(ent, id, d);
                return Results.Ok(new { ok = true, id });
            });

            app.MapDelete(rota + "/{id:long}", (HttpRequest req, long id) =>
            {
                if (Checar(req, ent, "excluir") is { } negado) return negado;
                if (repo.Obter(ent, id) is null) return Results.NotFound(new { ok = false, erro = "Registro não encontrado." });
                foreach (var uso in ent.Usos)
                    if (repo.ContarUso(uso, id) is var n and > 0)
                        return Results.Conflict(new { ok = false, erro = $"Não dá para excluir: está em uso em {n} {uso.Descricao}. Inative em vez de excluir." });
                repo.Excluir(ent, id);
                return Results.Ok(new { ok = true, id });
            });
        }

        /* QUARTOS EM LOTE — "101 a 110, tipo Standard, 1º andar": cria os números que ainda não existem.
         * Daniel, 08/11/2026 (Bloco 1). Só administrador ou quem pode incluir quartos. */
        app.MapPost("/api/quartos/lote", (HttpRequest req, LoteQuartosInput input) =>
        {
            if (Checar(req, FichasBloco1.Quartos, "incluir") is { } negado) return negado;
            if (input.de is null || input.ate is null || input.ate < input.de) return Results.BadRequest(new { ok = false, erro = "Informe a faixa de números (de / até)." });
            if (input.ate - input.de > 200) return Results.BadRequest(new { ok = false, erro = "No máximo 200 quartos por vez." });
            if (repo.Obter(FichasBloco1.TiposQuarto, input.id_tipo ?? 0) is null) return Results.BadRequest(new { ok = false, erro = "Tipo de quarto não encontrado." });
            int criados = 0, existentes = 0;
            for (var n = input.de.Value; n <= input.ate.Value; n++)
            {
                if (repo.PorValor(FichasBloco1.Quartos, "numero", n.ToString(), 0) is not null) { existentes++; continue; }
                repo.Incluir(FichasBloco1.Quartos, new()
                {
                    ["numero"] = n.ToString(), ["id_tipo"] = input.id_tipo, ["andar"] = (input.andar ?? "").Trim(),
                    ["situacao"] = "LIVRE", ["observacao"] = "", ["ativo"] = true
                });
                criados++;
            }
            return Results.Ok(new { ok = true, criados, ja_existiam = existentes });
        });

        /* DIÁRIAS NOITE A NOITE — base do motor de reservas (Bloco 2) e do motor on-line.
         * Para cada noite: a tarifa ATIVA do tipo que cobre a data e o dia da semana (se houver mais de uma, a de período
         * mais curto, a mais específica); sem tarifa, a diária base do tipo. Avisa quando o mínimo de noites não é cumprido. */
        app.MapGet("/api/tarifas/calcular", (HttpRequest req, long id_tipo, string entrada, string saida) =>
        {
            if (logado(req) is null) return Nao401();
            var r = CalcularDiarias(repo, id_tipo, entrada, saida, out var erro);
            return erro is null ? Results.Ok(new { ok = true, dados = r }) : Results.BadRequest(new { ok = false, erro });
        });
    }

    /// <summary>
    /// CalcularDiarias — total e valor de cada noite (entrada inclusa, saída não). Usado pela rota acima e pelo Bloco 2.
    /// SAÍDA: { noites, total, minimo_noites, atende_minimo, dias:[{data, valor, tarifa}] } ou erro.
    /// </summary>
    public static object? CalcularDiarias(ICadastroRepository repo, long idTipo, string entrada, string saida, out string? erro)
    {
        erro = null;
        if (repo.Obter(FichasBloco1.TiposQuarto, idTipo) is not { } tipo) { erro = "Tipo de quarto não encontrado."; return null; }
        if (!DateOnly.TryParseExact(entrada, "yyyy-MM-dd", out var ini) || !DateOnly.TryParseExact(saida, "yyyy-MM-dd", out var fim) || fim <= ini)
        { erro = "Período inválido: a saída deve ser depois da entrada (AAAA-MM-DD)."; return null; }
        if (fim.DayNumber - ini.DayNumber > 90) { erro = "No máximo 90 noites."; return null; }
        var tarifas = repo.Listar(FichasBloco1.Tarifas, null, new() { ["id_tipo"] = idTipo.ToString(), ["ativo"] = "1" });
        var dias = new List<object>();
        double total = 0;
        long minimo = 1;
        for (var d = ini; d < fim; d = d.AddDays(1))
        {
            var iso = d.ToString("yyyy-MM-dd");
            var dow = ((int)d.DayOfWeek).ToString();
            var t = tarifas.Where(x => string.CompareOrdinal(x["inicio"]!.ToString(), iso) <= 0 && string.CompareOrdinal(x["fim"]!.ToString(), iso) >= 0
                                       && (x["dias_semana"]?.ToString() ?? "").Contains(dow))
                           .OrderBy(x => DateOnly.ParseExact(x["fim"]!.ToString()!, "yyyy-MM-dd").DayNumber - DateOnly.ParseExact(x["inicio"]!.ToString()!, "yyyy-MM-dd").DayNumber)
                           .FirstOrDefault();
            var valor = t is not null ? Convert.ToDouble(t["valor_diaria"]) : Convert.ToDouble(tipo["diaria_base"] ?? 0d);
            if (t is not null) minimo = Math.Max(minimo, Convert.ToInt64(t["minimo_noites"] ?? 1L));
            total += valor;
            dias.Add(new { data = iso, valor = Math.Round(valor, 2), tarifa = t?["descricao"]?.ToString() ?? "Diária base" });
        }
        var noites = fim.DayNumber - ini.DayNumber;
        return new { noites, total = Math.Round(total, 2), minimo_noites = minimo, atende_minimo = noites >= minimo, dias };
    }
}

public sealed record LoteQuartosInput(int? de, int? ate, long? id_tipo, string? andar);
