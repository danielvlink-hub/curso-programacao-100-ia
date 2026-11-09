using System.Globalization;
using Microsoft.Data.Sqlite;

namespace FacilApp.Sqlite.Api;

/*
 * GESTÃO — Bloco 5 do FastPousada (aula gravada de 08/11/2026).
 * Daniel: "Sim, Bloco 5" (relatórios de Ocupação e Faturamento com RevPAR, Configurações da pousada e o painel de Hoje).
 *
 * O QUE FAZ
 *   - CONFIGURAÇÕES da pousada (chave/valor): dados da pousada, horários de check-in/out, % do sinal, prazo da
 *     pré-reserva, política de cancelamento e rodapé do extrato. Qualquer logado lê; só o administrador grava.
 *     O prazo da pré-reserva vale nas Reservas; os dados públicos vão para o motor on-line (GET /api/publico/pousada).
 *   - OCUPAÇÃO por dia: quartos disponíveis, ocupados, taxa %, receita de diárias; totais com taxa média,
 *     ADR (diária média vendida) e RevPAR (receita de diárias ÷ quartos-noite disponíveis).
 *   - FATURAMENTO do período: diárias (por competência, noite a noite), consumos (por categoria), recebido (por forma)
 *     e a série por dia; por tipo de quarto.
 *   - PAINEL DE HOJE: chegadas, saídas, hospedados, quartos por situação, ocupação de hoje e dos próximos 7 dias,
 *     recebido hoje por forma e se o caixa do usuário está aberto. "Liberar" quarto sujo depois da limpeza.
 * REGRAS: ocupam/geram diária as reservas CONFIRMADA, HOSPEDADO e ENCERRADA (pré-reserva ainda não é venda);
 *   disponíveis = quartos ativos e não BLOQUEADOS; estornados não entram em nada.
 * TABELA: configuracoes (no mesmo SQLite). MULTIBANCO: IGestaoRepository; hoje GestaoSqlite (somas com GROUP BY).
 */

/// <summary>Resultado da ocupação: período, quartos considerados, a linha de cada dia e os totais.</summary>
public sealed record OcupacaoResultado(string de, string ate, long? id_tipo, int quartos, List<object> dias, object totais);

public interface IGestaoRepository
{
    void Initialize();
    Dictionary<string, string> Configuracoes();
    void GravarConfiguracoes(Dictionary<string, string> valores, string usuario);
    /// <summary>Consumos (não estornados) do período, somados por dia e categoria: (dia, categoria, total).</summary>
    IReadOnlyList<(string dia, string categoria, double total)> ConsumosPorDia(string de, string ateExclusivo);
    /// <summary>Recebimentos (não estornados) do período, somados por dia e forma: (dia, forma, tipo, total).</summary>
    IReadOnlyList<(string dia, string forma, string tipo, double total)> RecebimentosPorDia(string de, string ateExclusivo);
}

public sealed class GestaoSqlite(string databasePath) : IGestaoRepository
{
    private SqliteConnection Open()
    {
        var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = databasePath }.ToString());
        db.Open();
        return db;
    }

    public void Initialize()
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS configuracoes (
                chave TEXT PRIMARY KEY,
                valor TEXT NOT NULL DEFAULT '',
                alterado_em TEXT NOT NULL DEFAULT '',
                alterado_por TEXT NOT NULL DEFAULT ''
            );
            """;
        cmd.ExecuteNonQuery();
    }

    public Dictionary<string, string> Configuracoes()
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT chave, valor FROM configuracoes";
        using var r = cmd.ExecuteReader();
        var d = new Dictionary<string, string>();
        while (r.Read()) d[r.GetString(0)] = r.GetString(1);
        return d;
    }

    public void GravarConfiguracoes(Dictionary<string, string> valores, string usuario)
    {
        using var db = Open();
        using var tx = db.BeginTransaction();
        foreach (var (k, v) in valores)
        {
            using var cmd = db.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = """
                INSERT INTO configuracoes (chave, valor, alterado_em, alterado_por) VALUES ($k, $v, $agora, $u)
                ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, alterado_em = excluded.alterado_em, alterado_por = excluded.alterado_por
                """;
            cmd.Parameters.AddWithValue("$k", k); cmd.Parameters.AddWithValue("$v", v);
            cmd.Parameters.AddWithValue("$agora", DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss")); cmd.Parameters.AddWithValue("$u", usuario);
            cmd.ExecuteNonQuery();
        }
        tx.Commit();
    }

    public IReadOnlyList<(string dia, string categoria, double total)> ConsumosPorDia(string de, string ateExclusivo)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            SELECT substr(c.lancado_em, 1, 10), COALESCE(s.categoria, 'OUTROS'), ROUND(SUM(c.valor_total), 2)
            FROM consumos c LEFT JOIN servicos_produtos s ON s.id_item = c.id_item
            WHERE c.estornado = 0 AND c.lancado_em >= $de AND c.lancado_em < $ate
            GROUP BY 1, 2 ORDER BY 1
            """;
        cmd.Parameters.AddWithValue("$de", de); cmd.Parameters.AddWithValue("$ate", ateExclusivo);
        using var r = cmd.ExecuteReader();
        var l = new List<(string, string, double)>();
        while (r.Read()) l.Add((r.GetString(0), r.GetString(1), r.GetDouble(2)));
        return l;
    }

    public IReadOnlyList<(string dia, string forma, string tipo, double total)> RecebimentosPorDia(string de, string ateExclusivo)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            SELECT substr(p.recebido_em, 1, 10), COALESCE(f.nome, '?'), COALESCE(f.tipo, ''), ROUND(SUM(p.valor), 2)
            FROM recebimentos p LEFT JOIN formas_pagamento f ON f.id_forma = p.id_forma
            WHERE p.estornado = 0 AND p.recebido_em >= $de AND p.recebido_em < $ate
            GROUP BY 1, 2, 3 ORDER BY 1
            """;
        cmd.Parameters.AddWithValue("$de", de); cmd.Parameters.AddWithValue("$ate", ateExclusivo);
        using var r = cmd.ExecuteReader();
        var l = new List<(string, string, string, double)>();
        while (r.Read()) l.Add((r.GetString(0), r.GetString(1), r.GetString(2), r.GetDouble(3)));
        return l;
    }
}

public static class GestaoEndpoints
{
    private static double R2(double v) => Math.Round(v, 2);
    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    private static bool Data(string? s, out DateOnly d) => DateOnly.TryParseExact(s ?? "", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out d);

    /* as chaves conhecidas, com o valor padrão (chave desconhecida é recusada) */
    public static readonly (string chave, string padrao)[] Chaves =
    [
        ("nome_pousada", "Pousada FastPousada"), ("documento", ""), ("telefone", ""), ("email", ""), ("cep", ""), ("endereco", ""),
        ("cidade", ""), ("uf", ""), ("horario_checkin", "14:00"), ("horario_checkout", "12:00"), ("sinal_percentual", "30"),
        ("prazo_pre_reserva_horas", "24"),
        ("politica_cancelamento", "Cancelamento gratuito até 7 dias antes da entrada. Depois disso, o sinal não é devolvido."),
        ("texto_rodape_extrato", "Obrigado pela preferência! Volte sempre.")
    ];

    /// <summary>Config — todas as chaves (gravadas ou padrão).</summary>
    public static Dictionary<string, string> Config(IGestaoRepository g)
    {
        var gravadas = g.Configuracoes();
        return Chaves.ToDictionary(c => c.chave, c => gravadas.TryGetValue(c.chave, out var v) ? v : c.padrao);
    }

    /* reservas que contam como venda/ocupação (pré-reserva ainda não é venda) */
    private static bool Vendida(Reserva r) => r.situacao is "CONFIRMADA" or "HOSPEDADO" or "ENCERRADA";

    /*
     * Ocupacao — por dia do período [de, ate] (inclusive): disponíveis, ocupados, taxa, receita de diárias (cada noite
     * vale valor_total ÷ noites da reserva). Totais: taxa média, ADR e RevPAR. idTipo filtra um tipo de quarto.
     */
    public static OcupacaoResultado Ocupacao(IReservasRepository reservas, ICadastroRepository cad, DateOnly de, DateOnly ate, long? idTipo)
    {
        var quartos = cad.Listar(FichasBloco1.Quartos, null, new() { ["ativo"] = "1" })
            .Where(q => q["situacao"]?.ToString() != "BLOQUEADO" && (idTipo is not > 0 || Convert.ToInt64(q["id_tipo"]) == idTipo)).ToList();
        var ids = quartos.Select(q => Convert.ToInt64(q["id_quarto"])).ToHashSet();
        var lista = reservas.Listar(null, null, null, null, null, null)
            .Where(r => Vendida(r) && ids.Contains(r.id_quarto) && string.CompareOrdinal(r.entrada, Iso(ate.AddDays(1))) < 0 && string.CompareOrdinal(r.saida, Iso(de)) > 0).ToList();
        var dias = new List<object>();
        double somaReceita = 0; int somaOcup = 0, somaDisp = 0;
        for (var d = de; d <= ate; d = d.AddDays(1))
        {
            var dia = Iso(d);
            var noite = lista.Where(r => string.CompareOrdinal(r.entrada, dia) <= 0 && string.CompareOrdinal(r.saida, dia) > 0).ToList();
            var receita = R2(noite.Sum(r => r.noites > 0 ? r.valor_total / r.noites : 0));
            var disp = quartos.Count;
            dias.Add(new { data = dia, disponiveis = disp, ocupados = noite.Count, taxa = disp == 0 ? 0 : R2(100.0 * noite.Count / disp), receita,
                adr = noite.Count == 0 ? 0 : R2(receita / noite.Count), revpar = disp == 0 ? 0 : R2(receita / disp) });
            somaReceita += receita; somaOcup += noite.Count; somaDisp += disp;
        }
        return new OcupacaoResultado(Iso(de), Iso(ate), idTipo, quartos.Count, dias, new
        {
            quartos_noite_disponiveis = somaDisp, quartos_noite_vendidos = somaOcup, receita_diarias = R2(somaReceita),
            taxa_media = somaDisp == 0 ? 0 : R2(100.0 * somaOcup / somaDisp),
            adr = somaOcup == 0 ? 0 : R2(somaReceita / somaOcup), revpar = somaDisp == 0 ? 0 : R2(somaReceita / somaDisp)
        });
    }

    /*
     * Faturamento — diárias por competência (noite a noite, por tipo de quarto), consumos por categoria, recebido por forma
     * e a série por dia (diárias, consumos, recebido). Ticket médio = (diárias + consumos) ÷ reservas com noite no período.
     */
    public static object Faturamento(IReservasRepository reservas, IGestaoRepository g, DateOnly de, DateOnly ate)
    {
        var ateEx = Iso(ate.AddDays(1));
        var lista = reservas.Listar(null, null, null, null, null, null)
            .Where(r => Vendida(r) && string.CompareOrdinal(r.entrada, ateEx) < 0 && string.CompareOrdinal(r.saida, Iso(de)) > 0).ToList();
        var porDia = new SortedDictionary<string, double[]>();   // dia → [diárias, consumos, recebido]
        for (var d = de; d <= ate; d = d.AddDays(1)) porDia[Iso(d)] = new double[3];
        var porTipo = new Dictionary<string, double>();
        foreach (var r in lista)
        {
            var diaria = r.noites > 0 ? r.valor_total / r.noites : 0;
            foreach (var dia in porDia.Keys)
                if (string.CompareOrdinal(r.entrada, dia) <= 0 && string.CompareOrdinal(r.saida, dia) > 0)
                {
                    porDia[dia][0] += diaria;
                    porTipo[r.tipo_nome] = porTipo.GetValueOrDefault(r.tipo_nome) + diaria;
                }
        }
        var consumos = g.ConsumosPorDia(Iso(de), ateEx);
        foreach (var c in consumos) if (porDia.TryGetValue(c.dia, out var v)) v[1] += c.total;
        var receb = g.RecebimentosPorDia(Iso(de), ateEx);
        foreach (var p in receb) if (porDia.TryGetValue(p.dia, out var v)) v[2] += p.total;

        var diarias = R2(porDia.Values.Sum(v => v[0]));
        var totalConsumos = R2(consumos.Sum(c => c.total));
        return new
        {
            de = Iso(de), ate = Iso(ate),
            totais = new
            {
                diarias, consumos = totalConsumos, faturamento = R2(diarias + totalConsumos), recebido = R2(receb.Sum(p => p.total)),
                reservas = lista.Count, ticket_medio = lista.Count == 0 ? 0 : R2((diarias + totalConsumos) / lista.Count)
            },
            dias = porDia.Select(kv => new { data = kv.Key, diarias = R2(kv.Value[0]), consumos = R2(kv.Value[1]), recebido = R2(kv.Value[2]),
                total = R2(kv.Value[0] + kv.Value[1]) }),
            por_tipo = porTipo.OrderByDescending(kv => kv.Value).Select(kv => new { tipo = kv.Key, diarias = R2(kv.Value) }),
            por_categoria = consumos.GroupBy(c => c.categoria).Select(x => new { categoria = x.Key, total = R2(x.Sum(c => c.total)) }).OrderByDescending(x => x.total),
            por_forma = receb.GroupBy(p => p.forma).Select(x => new { forma = x.Key, total = R2(x.Sum(p => p.total)) }).OrderByDescending(x => x.total)
        };
    }

    /// <summary>MapGestao — rotas do Bloco 5.</summary>
    public static void MapGestao(this WebApplication app, IGestaoRepository g, IReservasRepository reservas, ICadastroRepository cad,
        IOperacaoRepository op, ICaixaRepository cx, Func<HttpRequest, (long id, bool admin, string login)?> logado,
        Func<long, string, MenuPermission?> permissao)
    {
        g.Initialize();
        // o prazo da pré-reserva vem das configurações (Reservas.cs usa este valor)
        ReservasEndpoints.PrazoPreReservaHoras = () => int.TryParse(Config(g)["prazo_pre_reserva_horas"], out var h) && h is >= 1 and <= 168 ? h : 24;

        IResult Nao401() => Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
        IResult Erro(string m) => Results.BadRequest(new { ok = false, erro = m });
        bool Periodo(string? de, string? ate, out DateOnly d1, out DateOnly d2, out string? erro)
        {
            erro = null; d2 = default;
            if (!Data(de, out d1) || !Data(ate, out d2) || d2 < d1) { erro = "Informe o período (de e até, AAAA-MM-DD)."; return false; }
            if (d2.DayNumber - d1.DayNumber > 366) { erro = "Período de no máximo 1 ano."; return false; }
            return true;
        }

        // ---------------- CONFIGURAÇÕES
        app.MapGet("/api/configuracoes", (HttpRequest req) =>
            logado(req) is null ? Nao401() : Results.Ok(new { ok = true, dados = Config(g) }));

        app.MapPut("/api/configuracoes", (HttpRequest req, System.Text.Json.JsonElement corpoJson) =>
        {
            if (logado(req) is not { } u) return Nao401();
            if (!u.admin) return Results.Json(new { ok = false, erro = "Só o administrador altera as configurações." }, statusCode: 403);
            if (corpoJson.ValueKind != System.Text.Json.JsonValueKind.Object) return Erro("Envie as configurações como objeto { chave: valor }.");
            // valores podem vir como texto ou número (ex.: 30) — tudo vira texto
            var corpo = corpoJson.EnumerateObject().ToDictionary(p => p.Name,
                p => p.Value.ValueKind == System.Text.Json.JsonValueKind.String ? p.Value.GetString() : p.Value.ValueKind == System.Text.Json.JsonValueKind.Null ? "" : p.Value.GetRawText());
            var conhecidas = Chaves.Select(c => c.chave).ToHashSet();
            var desconhecida = corpo.Keys.FirstOrDefault(k => !conhecidas.Contains(k));
            if (desconhecida is not null) return Erro($"Configuração desconhecida: {desconhecida}.");
            var v = corpo.ToDictionary(kv => kv.Key, kv => (kv.Value ?? "").Trim());
            foreach (var h in new[] { "horario_checkin", "horario_checkout" })
                if (v.TryGetValue(h, out var x) && !TimeOnly.TryParseExact(x, "HH:mm", out _)) return Erro("Horário no formato HH:MM (ex.: 14:00).");
            if (v.TryGetValue("sinal_percentual", out var s) && (!int.TryParse(s, out var pc) || pc is < 0 or > 100)) return Erro("% do sinal entre 0 e 100.");
            if (v.TryGetValue("prazo_pre_reserva_horas", out var p) && (!int.TryParse(p, out var ph) || ph is < 1 or > 168)) return Erro("Prazo da pré-reserva entre 1 e 168 horas.");
            if (v.TryGetValue("uf", out var uf) && uf.Length is not (0 or 2)) return Erro("UF com 2 letras.");
            if (v.TryGetValue("nome_pousada", out var n) && n.Length < 3) return Erro("Informe o nome da pousada.");
            if (v.TryGetValue("uf", out var uf2)) v["uf"] = uf2.ToUpperInvariant();
            g.GravarConfiguracoes(v, u.login);
            return Results.Ok(new { ok = true, dados = Config(g) });
        });

        // PÚBLICA (motor de reservas on-line): dados da pousada, horários, sinal e política — sem login, só leitura
        app.MapGet("/api/publico/pousada", () =>
        {
            var c = Config(g);
            return Results.Ok(new { ok = true, dados = new { nome = c["nome_pousada"], telefone = c["telefone"], email = c["email"], cidade = c["cidade"],
                uf = c["uf"], horario_checkin = c["horario_checkin"], horario_checkout = c["horario_checkout"], sinal_percentual = c["sinal_percentual"],
                politica_cancelamento = c["politica_cancelamento"] } });
        });

        // ---------------- RELATÓRIOS
        app.MapGet("/api/relatorios/ocupacao", (HttpRequest req, string? de, string? ate, long? id_tipo) =>
        {
            if (logado(req) is null) return Nao401();
            if (!Periodo(de, ate, out var d1, out var d2, out var erro)) return Erro(erro!);
            return Results.Ok(new { ok = true, dados = Ocupacao(reservas, cad, d1, d2, id_tipo) });
        });
        app.MapGet("/api/relatorios/faturamento", (HttpRequest req, string? de, string? ate) =>
        {
            if (logado(req) is null) return Nao401();
            if (!Periodo(de, ate, out var d1, out var d2, out var erro)) return Erro(erro!);
            return Results.Ok(new { ok = true, dados = Faturamento(reservas, g, d1, d2) });
        });

        // ---------------- PAINEL DE HOJE
        app.MapGet("/api/painel", (HttpRequest req) =>
        {
            if (logado(req) is not { } u) return Nao401();
            var hoje = DateOnly.FromDateTime(DateTime.Today);
            var h = Iso(hoje);
            var todas = reservas.Listar(null, null, null, null, null, null);
            bool AEntrar(Reserva r) => r.situacao is "CONFIRMADA" or "PRE_RESERVA";
            var quartos = cad.Listar(FichasBloco1.Quartos, null, new() { ["ativo"] = "1" });
            var hospedadoEm = todas.Where(r => r.situacao == "HOSPEDADO").ToDictionary(r => r.id_quarto, r => r);
            var ocup = Ocupacao(reservas, cad, hoje, hoje.AddDays(6), null);
            var recebHoje = g.RecebimentosPorDia(h, Iso(hoje.AddDays(1)));
            var c = Config(g);
            return Results.Ok(new
            {
                ok = true, hoje = h, pousada = c["nome_pousada"], horario_checkin = c["horario_checkin"], horario_checkout = c["horario_checkout"],
                chegadas = todas.Where(r => AEntrar(r) && r.entrada == h).Select(Curta).ToList(),
                atrasadas = todas.Where(r => AEntrar(r) && string.CompareOrdinal(r.entrada, h) < 0 && string.CompareOrdinal(r.saida, h) > 0).Select(Curta).ToList(),
                saidas = todas.Where(r => r.situacao == "HOSPEDADO" && string.CompareOrdinal(r.saida, h) <= 0).Select(Curta).ToList(),
                hospedados = hospedadoEm.Count,
                quartos = quartos.OrderBy(q => q["numero"]?.ToString()).Select(q =>
                {
                    var id = Convert.ToInt64(q["id_quarto"]);
                    hospedadoEm.TryGetValue(id, out var r);
                    return new { id_quarto = id, numero = q["numero"]?.ToString(), situacao = q["situacao"]?.ToString(), ocupado = r is not null,
                        hospede = r?.hospede_nome ?? "", saida = r?.saida ?? "" };
                }).ToList(),
                proximos_dias = ocup.dias,
                recebido_hoje = R2(recebHoje.Sum(p => p.total)),
                recebido_por_forma = recebHoje.GroupBy(p => p.forma).Select(x => new { forma = x.Key, total = R2(x.Sum(p => p.total)) }).ToList(),
                caixa_aberto = cx.AbertoDe(u.login) is not null
            });
        });
        static object Curta(Reserva r) => new { r.id_reserva, r.hospede_nome, r.quarto_numero, r.entrada, r.saida, r.situacao };

        // governança: quarto SUJO limpo → LIVRE (botão "Liberar" do painel)
        app.MapPost("/api/quartos/{id:long}/liberar", (HttpRequest req, long id) =>
        {
            if (logado(req) is null) return Nao401();
            if (cad.Obter(FichasBloco1.Quartos, id) is not { } q) return Results.NotFound(new { ok = false, erro = "Quarto não encontrado." });
            if (q["situacao"]?.ToString() != "SUJO") return Erro($"O quarto {q["numero"]} não está sujo.");
            op.MarcarQuarto(id, "LIVRE");
            return Results.Ok(new { ok = true, id, mensagem = $"Quarto {q["numero"]} liberado: limpo e pronto." });
        });
    }
}
