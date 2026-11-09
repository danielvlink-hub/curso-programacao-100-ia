using System.Globalization;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace FacilApp.Sqlite.Api;

/*
 * MOTOR DE RESERVAS — Bloco 2 do FastPousada (aula gravada de 08/11/2026).
 * Daniel: "teremos motor de reserva on-line, precisa prever; as reservas devem ser sofisticadas, agendas de arrastar para
 *          reservas" / "Sim, Bloco 2".
 *
 * O QUE FAZ
 *   A regra única das reservas (a mesma que o motor on-line vai usar): disponibilidade, conflito, capacidade, preço noite
 *   a noite (tarifas do Bloco 1), situações, cancelar, no-show, mover (arrastar no mapa) e o mapa de ocupação.
 * SITUAÇÕES
 *   PRE_RESERVA (vence em 24 h se o sinal não for pago) → CONFIRMADA → HOSPEDADO (check-in, Bloco 3) → ENCERRADA
 *   (check-out, Bloco 3) | CANCELADA (com motivo) | NO_SHOW. Ocupam o quarto: pré-reserva no prazo, confirmada, hospedado.
 * REGRAS (a verdade fica aqui)
 *   - saída depois da entrada; no máximo 90 noites;
 *   - REGRA DO MEIO-DIA: a saída de um pode ser a entrada de outro (conflito = entrada < outra.saida E saida > outra.entrada);
 *   - quarto ativo e não BLOQUEADO; hóspede ativo; adultos/crianças dentro da capacidade do tipo;
 *   - valor total: o informado ou, se vazio, o cálculo noite a noite; o mínimo de noites da tarifa vira AVISO;
 *   - reserva encerrada ou cancelada não se altera; hospedado só muda pelo check-out.
 * PREPARADO PARA O MOTOR ON-LINE
 *   codigo público (ex.: FP-7K3Q9), origem (BALCAO, TELEFONE, WHATSAPP, SITE, BOOKING, OUTRO), contato (nome, e-mail,
 *   telefone), sinal (valor e pago) e a rota pública GET /api/publico/disponibilidade (só leitura, sem dados pessoais).
 * MULTIBANCO: as rotas só conhecem IReservasRepository; hoje ReservasSqlite.
 */

public sealed record Reserva(long id_reserva, string codigo, long id_hospede, string hospede_nome, long id_quarto, string quarto_numero,
    long id_tipo, string tipo_nome, string entrada, string saida, int noites, int adultos, int criancas, string situacao, string origem,
    double valor_diaria, double valor_total, double sinal_valor, bool sinal_pago, string contato_nome, string contato_email,
    string contato_telefone, string observacao, string expira_em, string cancelado_motivo, string checkin_em, string checkout_em,
    string criado_em, string alterado_em);

public sealed record ReservaInput(long? id_hospede, long? id_quarto, string? entrada, string? saida, int? adultos, int? criancas,
    string? situacao, string? origem, double? valor_total, double? sinal_valor, bool? sinal_pago, string? contato_nome,
    string? contato_email, string? contato_telefone, string? observacao);

public sealed record MoverInput(long? id_quarto, string? entrada, string? saida);
public sealed record CancelarInput(string? motivo);

/// <summary>O que qualquer banco precisa oferecer ao motor de reservas.</summary>
public interface IReservasRepository
{
    void Initialize();
    IReadOnlyList<Reserva> Listar(string? de, string? ate, string? situacao, string? busca, long? idQuarto, long? idHospede);
    Reserva? Obter(long id);
    /// <summary>Reservas que OCUPAM o quarto no período (meio-dia), ignorando uma (alteração/mover).</summary>
    IReadOnlyList<Reserva> Conflitos(long idQuarto, string entrada, string saida, long ignorarId);
    /// <summary>Ids dos quartos ocupados no período (mesma regra), numa consulta só.</summary>
    HashSet<long> QuartosOcupados(string entrada, string saida, long ignorarId);
    long Incluir(Dictionary<string, object?> d);
    void Alterar(long id, Dictionary<string, object?> d);
    bool CodigoExiste(string codigo);
}

public sealed class ReservasSqlite(string databasePath) : IReservasRepository
{
    // situações que ocupam o quarto (pré-reserva só enquanto não venceu)
    private const string Ocupa = "(r.situacao IN ('CONFIRMADA','HOSPEDADO') OR (r.situacao = 'PRE_RESERVA' AND r.expira_em > $agora))";

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
            CREATE TABLE IF NOT EXISTS reservas (
                id_reserva INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo TEXT NOT NULL,
                id_hospede INTEGER NOT NULL,
                id_quarto INTEGER NOT NULL,
                entrada TEXT NOT NULL,
                saida TEXT NOT NULL,
                adultos INTEGER NOT NULL DEFAULT 1,
                criancas INTEGER NOT NULL DEFAULT 0,
                situacao TEXT NOT NULL,
                origem TEXT NOT NULL DEFAULT 'BALCAO',
                valor_diaria REAL NOT NULL DEFAULT 0,
                valor_total REAL NOT NULL DEFAULT 0,
                sinal_valor REAL NOT NULL DEFAULT 0,
                sinal_pago INTEGER NOT NULL DEFAULT 0,
                contato_nome TEXT NOT NULL DEFAULT '',
                contato_email TEXT NOT NULL DEFAULT '',
                contato_telefone TEXT NOT NULL DEFAULT '',
                observacao TEXT NOT NULL DEFAULT '',
                expira_em TEXT NOT NULL DEFAULT '',
                cancelado_motivo TEXT NOT NULL DEFAULT '',
                checkin_em TEXT NOT NULL DEFAULT '',
                checkout_em TEXT NOT NULL DEFAULT '',
                criado_em TEXT NOT NULL DEFAULT '',
                alterado_em TEXT NOT NULL DEFAULT ''
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ux_reservas_codigo ON reservas(codigo);
            CREATE INDEX IF NOT EXISTS ix_reservas_quarto_periodo ON reservas(id_quarto, entrada, saida);
            CREATE INDEX IF NOT EXISTS ix_reservas_hospede ON reservas(id_hospede);
            """;
        cmd.ExecuteNonQuery();
    }

    private const string Select = """
        SELECT r.id_reserva, r.codigo, r.id_hospede, COALESCE(h.nome,''), r.id_quarto, COALESCE(q.numero,''), COALESCE(q.id_tipo,0),
               COALESCE(t.nome,''), r.entrada, r.saida, CAST(julianday(r.saida) - julianday(r.entrada) AS INTEGER), r.adultos, r.criancas,
               r.situacao, r.origem, r.valor_diaria, r.valor_total, r.sinal_valor, r.sinal_pago, r.contato_nome, r.contato_email,
               r.contato_telefone, r.observacao, r.expira_em, r.cancelado_motivo, r.checkin_em, r.checkout_em, r.criado_em, r.alterado_em
        FROM reservas r
        LEFT JOIN hospedes h ON h.id_hospede = r.id_hospede
        LEFT JOIN quartos q ON q.id_quarto = r.id_quarto
        LEFT JOIN quartos_tipos t ON t.id_tipo = q.id_tipo
        """;

    private static Reserva Ler(SqliteDataReader r) => new(
        r.GetInt64(0), r.GetString(1), r.GetInt64(2), r.GetString(3), r.GetInt64(4), r.GetString(5), r.GetInt64(6), r.GetString(7),
        r.GetString(8), r.GetString(9), r.GetInt32(10), r.GetInt32(11), r.GetInt32(12), r.GetString(13), r.GetString(14),
        r.GetDouble(15), r.GetDouble(16), r.GetDouble(17), r.GetInt64(18) != 0, r.GetString(19), r.GetString(20), r.GetString(21),
        r.GetString(22), r.GetString(23), r.GetString(24), r.GetString(25), r.GetString(26), r.GetString(27), r.GetString(28));

    private static List<Reserva> Todas(SqliteCommand cmd)
    {
        using var r = cmd.ExecuteReader();
        var lista = new List<Reserva>();
        while (r.Read()) lista.Add(Ler(r));
        return lista;
    }

    private static string Agora() => DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss");

    public IReadOnlyList<Reserva> Listar(string? de, string? ate, string? situacao, string? busca, long? idQuarto, long? idHospede)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        var w = new List<string>();
        // período: reservas que TOCAM o período (entrada < ate e saida > de)
        if (!string.IsNullOrWhiteSpace(de)) { w.Add("r.saida > $de"); cmd.Parameters.AddWithValue("$de", de); }
        if (!string.IsNullOrWhiteSpace(ate)) { w.Add("r.entrada < $ate"); cmd.Parameters.AddWithValue("$ate", ate); }
        if (!string.IsNullOrWhiteSpace(situacao)) { w.Add("r.situacao = $sit"); cmd.Parameters.AddWithValue("$sit", situacao.Trim().ToUpperInvariant()); }
        if (idQuarto is > 0) { w.Add("r.id_quarto = $q"); cmd.Parameters.AddWithValue("$q", idQuarto); }
        if (idHospede is > 0) { w.Add("r.id_hospede = $h"); cmd.Parameters.AddWithValue("$h", idHospede); }
        if (!string.IsNullOrWhiteSpace(busca))
        {
            w.Add("(h.nome LIKE $b OR r.codigo LIKE $b OR q.numero LIKE $b OR r.contato_nome LIKE $b)");
            cmd.Parameters.AddWithValue("$b", "%" + busca.Trim() + "%");
        }
        cmd.CommandText = Select + (w.Count > 0 ? " WHERE " + string.Join(" AND ", w) : "") + " ORDER BY r.entrada, q.numero";
        return Todas(cmd);
    }

    public Reserva? Obter(long id)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = Select + " WHERE r.id_reserva = $id";
        cmd.Parameters.AddWithValue("$id", id);
        return Todas(cmd).FirstOrDefault();
    }

    public IReadOnlyList<Reserva> Conflitos(long idQuarto, string entrada, string saida, long ignorarId)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = Select + $" WHERE r.id_quarto = $q AND r.id_reserva <> $id AND r.entrada < $saida AND r.saida > $entrada AND {Ocupa}";
        cmd.Parameters.AddWithValue("$q", idQuarto);
        cmd.Parameters.AddWithValue("$id", ignorarId);
        cmd.Parameters.AddWithValue("$entrada", entrada);
        cmd.Parameters.AddWithValue("$saida", saida);
        cmd.Parameters.AddWithValue("$agora", Agora());
        return Todas(cmd);
    }

    public HashSet<long> QuartosOcupados(string entrada, string saida, long ignorarId)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = $"SELECT DISTINCT r.id_quarto FROM reservas r WHERE r.id_reserva <> $id AND r.entrada < $saida AND r.saida > $entrada AND {Ocupa}";
        cmd.Parameters.AddWithValue("$id", ignorarId);
        cmd.Parameters.AddWithValue("$entrada", entrada);
        cmd.Parameters.AddWithValue("$saida", saida);
        cmd.Parameters.AddWithValue("$agora", Agora());
        using var r = cmd.ExecuteReader();
        var set = new HashSet<long>();
        while (r.Read()) set.Add(r.GetInt64(0));
        return set;
    }

    private static readonly string[] Colunas =
    [
        "codigo", "id_hospede", "id_quarto", "entrada", "saida", "adultos", "criancas", "situacao", "origem", "valor_diaria", "valor_total",
        "sinal_valor", "sinal_pago", "contato_nome", "contato_email", "contato_telefone", "observacao", "expira_em", "cancelado_motivo",
        "checkin_em", "checkout_em"
    ];

    public long Incluir(Dictionary<string, object?> d)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        var cols = Colunas.Where(d.ContainsKey).ToList();
        cmd.CommandText = $"INSERT INTO reservas ({string.Join(",", cols)}, criado_em, alterado_em) " +
                          $"VALUES ({string.Join(",", cols.Select(c => "$" + c))}, $agora, $agora); SELECT last_insert_rowid();";
        foreach (var c in cols) cmd.Parameters.AddWithValue("$" + c, d[c] ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$agora", Agora());
        return Convert.ToInt64(cmd.ExecuteScalar());
    }

    public void Alterar(long id, Dictionary<string, object?> d)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        var cols = Colunas.Where(d.ContainsKey).ToList();
        cmd.CommandText = $"UPDATE reservas SET {string.Join(",", cols.Select(c => $"{c} = ${c}"))}, alterado_em = $agora WHERE id_reserva = $id";
        foreach (var c in cols) cmd.Parameters.AddWithValue("$" + c, d[c] ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$agora", Agora());
        cmd.Parameters.AddWithValue("$id", id);
        cmd.ExecuteNonQuery();
    }

    public bool CodigoExiste(string codigo)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM reservas WHERE codigo = $c";
        cmd.Parameters.AddWithValue("$c", codigo);
        return Convert.ToInt64(cmd.ExecuteScalar()) > 0;
    }
}

public static class ReservasEndpoints
{
    /// <summary>Horas até a pré-reserva vencer. Padrão 24; o Bloco 5 (Gestao.cs) liga às Configurações.</summary>
    public static Func<int> PrazoPreReservaHoras = () => 24;

    public static readonly string[] Situacoes = ["PRE_RESERVA", "CONFIRMADA", "HOSPEDADO", "ENCERRADA", "CANCELADA", "NO_SHOW"];
    public static readonly string[] Origens = ["BALCAO", "TELEFONE", "WHATSAPP", "SITE", "BOOKING", "OUTRO"];
    private const string CodigoMenu = "op_reservas";

    /// <summary>Código público da reserva: "FP-" + 5 letras/números sem os que confundem (0/O, 1/I).</summary>
    private static string NovoCodigo(IReservasRepository repo)
    {
        const string letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        string c;
        do c = "FP-" + new string(Enumerable.Range(0, 5).Select(_ => letras[Random.Shared.Next(letras.Length)]).ToArray());
        while (repo.CodigoExiste(c));
        return c;
    }

    private static bool Data(string? s, out DateOnly d) => DateOnly.TryParseExact(s ?? "", "yyyy-MM-dd", out d);

    /*
     * Validar — todas as regras de uma reserva nova ou alterada. Devolve (erro, avisos, dados prontos para gravar).
     * entrada/saida/quarto/hóspede/capacidade/conflito; calcula o total noite a noite quando não foi informado.
     */
    private static (string? erro, List<string> avisos, Dictionary<string, object?> d) Validar(
        ReservaInput i, long idAtual, IReservasRepository repo, ICadastroRepository cad, IHospedesRepository hosp)
    {
        var avisos = new List<string>();
        var d = new Dictionary<string, object?>();
        if (!Data(i.entrada, out var ent) || !Data(i.saida, out var sai)) return ("Informe entrada e saída (AAAA-MM-DD).", avisos, d);
        if (sai <= ent) return ("A saída deve ser depois da entrada.", avisos, d);
        if (sai.DayNumber - ent.DayNumber > 90) return ("No máximo 90 noites por reserva.", avisos, d);
        if (i.id_hospede is not > 0 || hosp.Obter(i.id_hospede.Value) is not { } h) return ("Escolha o hóspede.", avisos, d);
        if (!h.ativo) return ($"O hóspede {h.nome} está inativo.", avisos, d);
        if (i.id_quarto is not > 0 || cad.Obter(FichasBloco1.Quartos, i.id_quarto.Value) is not { } q) return ("Escolha o quarto.", avisos, d);
        if (q["ativo"] is not true) return ($"O quarto {q["numero"]} está inativo.", avisos, d);
        if (q["situacao"]?.ToString() == "BLOQUEADO") return ($"O quarto {q["numero"]} está bloqueado.", avisos, d);
        if (q["situacao"]?.ToString() == "MANUTENCAO") avisos.Add($"O quarto {q["numero"]} está em manutenção agora.");
        var tipo = cad.Obter(FichasBloco1.TiposQuarto, Convert.ToInt64(q["id_tipo"]))!;
        var adultos = Math.Max(1, i.adultos ?? 1);
        var criancas = Math.Max(0, i.criancas ?? 0);
        var capA = Convert.ToInt32(tipo["capacidade_adultos"] ?? 1L);
        var capC = Convert.ToInt32(tipo["capacidade_criancas"] ?? 0L);
        if (adultos > capA) return ($"O {tipo["nome"]} recebe no máximo {capA} adulto(s).", avisos, d);
        if (adultos + criancas > capA + capC) return ($"O {tipo["nome"]} recebe no máximo {capA + capC} pessoa(s).", avisos, d);
        var entIso = ent.ToString("yyyy-MM-dd");
        var saiIso = sai.ToString("yyyy-MM-dd");
        if (repo.Conflitos(Convert.ToInt64(q["id_quarto"]), entIso, saiIso, idAtual) is { Count: > 0 } c)
            return ($"O quarto {q["numero"]} já está reservado nesse período ({c[0].hospede_nome}, {c[0].entrada} a {c[0].saida}, {c[0].codigo}).", avisos, d);

        // preço noite a noite pelas tarifas do Bloco 1; o mínimo de noites vira aviso (não bloqueia o balcão)
        var calculo = CadastrosEndpoints.CalcularDiarias(cad, Convert.ToInt64(q["id_tipo"]), entIso, saiIso, out var erroCalc);
        if (erroCalc is not null) return (erroCalc, avisos, d);
        var json = JsonSerializer.SerializeToElement(calculo);
        var totalCalc = json.GetProperty("total").GetDouble();
        var minimo = json.GetProperty("minimo_noites").GetInt64();
        var noites = sai.DayNumber - ent.DayNumber;
        if (noites < minimo) avisos.Add($"A tarifa pede no mínimo {minimo} noites (esta reserva tem {noites}).");

        var situacao = string.IsNullOrWhiteSpace(i.situacao) ? "CONFIRMADA" : i.situacao.Trim().ToUpperInvariant();
        if (situacao is not ("PRE_RESERVA" or "CONFIRMADA")) return ("Na reserva use Pré-reserva ou Confirmada (hospedado é pelo check-in).", avisos, d);
        var origem = string.IsNullOrWhiteSpace(i.origem) ? "BALCAO" : i.origem.Trim().ToUpperInvariant();
        if (!Origens.Contains(origem)) return ($"Origem: use {string.Join(", ", Origens)}.", avisos, d);
        var total = i.valor_total is > 0 ? Math.Round(i.valor_total.Value, 2) : totalCalc;
        var sinal = Math.Max(0, Math.Round(i.sinal_valor ?? 0, 2));
        if (sinal > total) return ("O sinal não pode passar do valor total.", avisos, d);

        d["id_hospede"] = i.id_hospede; d["id_quarto"] = i.id_quarto; d["entrada"] = entIso; d["saida"] = saiIso;
        d["adultos"] = adultos; d["criancas"] = criancas; d["situacao"] = situacao; d["origem"] = origem;
        d["valor_total"] = total; d["valor_diaria"] = Math.Round(total / noites, 2);
        d["sinal_valor"] = sinal; d["sinal_pago"] = i.sinal_pago == true ? 1 : 0;
        d["contato_nome"] = (i.contato_nome ?? "").Trim(); d["contato_email"] = (i.contato_email ?? "").Trim();
        d["contato_telefone"] = (i.contato_telefone ?? "").Trim(); d["observacao"] = (i.observacao ?? "").Trim();
        // pré-reserva vence no prazo das Configurações (padrão 24 h — Bloco 5); confirmada não vence
        d["expira_em"] = situacao == "PRE_RESERVA" && i.sinal_pago != true ? DateTimeOffset.Now.AddHours(PrazoPreReservaHoras()).ToString("yyyy-MM-dd HH:mm:ss") : "";
        return (null, avisos, d);
    }

    /// <summary>MapReservas — rotas do Bloco 2. logado/permissao como nos cadastros.</summary>
    public static void MapReservas(this WebApplication app, IReservasRepository repo, ICadastroRepository cad, IHospedesRepository hosp,
        Func<HttpRequest, (long id, bool admin)?> logado, Func<long, string, MenuPermission?> permissao)
    {
        repo.Initialize();

        IResult Nao401() => Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
        IResult? Checar(HttpRequest req, string? acao)
        {
            if (logado(req) is not { } u) return Nao401();
            if (u.admin || acao is null || permissao(u.id, CodigoMenu) is not { } p) return null;
            var negado = (acao == "incluir" && p.incluir == 0) || (acao == "alterar" && p.alterar == 0) || (acao == "excluir" && p.excluir == 0);
            return negado ? Results.Json(new { ok = false, erro = $"Seu usuário não tem permissão para {acao} reservas." }, statusCode: 403) : null;
        }
        IResult NaoAchou() => Results.NotFound(new { ok = false, erro = "Reserva não encontrada." });

        // ---------------- lista e consulta
        app.MapGet("/api/reservas", (HttpRequest req, string? de, string? ate, string? situacao, string? busca, long? id_quarto, long? id_hospede) =>
            Checar(req, null) ?? Results.Ok(new { ok = true, dados = repo.Listar(de, ate, situacao, busca, id_quarto, id_hospede) }));

        app.MapGet("/api/reservas/{id:long}", (HttpRequest req, long id) =>
            Checar(req, null) ?? (repo.Obter(id) is { } r ? Results.Ok(new { ok = true, dados = r }) : NaoAchou()));

        // ---------------- incluir / alterar
        app.MapPost("/api/reservas", (HttpRequest req, ReservaInput input) =>
        {
            if (Checar(req, "incluir") is { } negado) return negado;
            var (erro, avisos, d) = Validar(input, 0, repo, cad, hosp);
            if (erro is not null) return Results.BadRequest(new { ok = false, erro });
            d["codigo"] = NovoCodigo(repo);
            var id = repo.Incluir(d);
            return Results.Ok(new { ok = true, id, codigo = d["codigo"], avisos });
        });

        app.MapPut("/api/reservas/{id:long}", (HttpRequest req, long id, ReservaInput input) =>
        {
            if (Checar(req, "alterar") is { } negado) return negado;
            if (repo.Obter(id) is not { } atual) return NaoAchou();
            if (atual.situacao is "ENCERRADA" or "CANCELADA" or "NO_SHOW") return Results.BadRequest(new { ok = false, erro = "Reserva encerrada ou cancelada não pode ser alterada." });
            if (atual.situacao == "HOSPEDADO") return Results.BadRequest(new { ok = false, erro = "Hóspede já está na casa: mudanças pela tela de estadia/check-out." });
            var (erro, avisos, d) = Validar(input, id, repo, cad, hosp);
            if (erro is not null) return Results.BadRequest(new { ok = false, erro });
            repo.Alterar(id, d);
            return Results.Ok(new { ok = true, id, avisos });
        });

        // ---------------- mover (arrastar no mapa) — mantém tudo, troca quarto/datas e recalcula o total
        app.MapPut("/api/reservas/{id:long}/mover", (HttpRequest req, long id, MoverInput input) =>
        {
            if (Checar(req, "alterar") is { } negado) return negado;
            if (repo.Obter(id) is not { } r) return NaoAchou();
            if (r.situacao is not ("PRE_RESERVA" or "CONFIRMADA")) return Results.BadRequest(new { ok = false, erro = "Só reserva pré ou confirmada pode ser movida." });
            var i = new ReservaInput(r.id_hospede, input.id_quarto ?? r.id_quarto, input.entrada ?? r.entrada, input.saida ?? r.saida,
                r.adultos, r.criancas, r.situacao, r.origem, null, r.sinal_valor, r.sinal_pago, r.contato_nome, r.contato_email,
                r.contato_telefone, r.observacao);
            var (erro, avisos, d) = Validar(i, id, repo, cad, hosp);
            if (erro is not null) return Results.BadRequest(new { ok = false, erro });
            if (r.situacao == "PRE_RESERVA") d["expira_em"] = r.expira_em;    // mover não renova o prazo
            repo.Alterar(id, d);
            return Results.Ok(new { ok = true, id, valor_total = d["valor_total"], avisos });
        });

        // ---------------- cancelar (com motivo) e no-show
        app.MapPost("/api/reservas/{id:long}/cancelar", (HttpRequest req, long id, CancelarInput input) =>
        {
            if (Checar(req, "excluir") is { } negado) return negado;
            if (repo.Obter(id) is not { } r) return NaoAchou();
            if (r.situacao is not ("PRE_RESERVA" or "CONFIRMADA")) return Results.BadRequest(new { ok = false, erro = "Só reserva pré ou confirmada pode ser cancelada." });
            var motivo = (input.motivo ?? "").Trim();
            if (motivo.Length < 3) return Results.BadRequest(new { ok = false, erro = "Informe o motivo do cancelamento." });
            repo.Alterar(id, new() { ["situacao"] = "CANCELADA", ["cancelado_motivo"] = motivo });
            return Results.Ok(new { ok = true, id });
        });

        app.MapPost("/api/reservas/{id:long}/no-show", (HttpRequest req, long id) =>
        {
            if (Checar(req, "alterar") is { } negado) return negado;
            if (repo.Obter(id) is not { } r) return NaoAchou();
            if (r.situacao is not ("PRE_RESERVA" or "CONFIRMADA")) return Results.BadRequest(new { ok = false, erro = "Só reserva pré ou confirmada vira no-show." });
            if (string.CompareOrdinal(r.entrada, DateTime.Today.ToString("yyyy-MM-dd")) > 0) return Results.BadRequest(new { ok = false, erro = "No-show só a partir do dia da entrada." });
            repo.Alterar(id, new() { ["situacao"] = "NO_SHOW" });
            return Results.Ok(new { ok = true, id });
        });

        // ---------------- disponibilidade (tela de reserva): quartos livres com o preço total do período
        app.MapGet("/api/reservas/disponibilidade", (HttpRequest req, string entrada, string saida, int? adultos, int? criancas, long? ignorar) =>
        {
            if (Checar(req, null) is { } negado) return negado;
            var r = Disponibilidade(repo, cad, entrada, saida, adultos ?? 1, criancas ?? 0, ignorar ?? 0, out var erro);
            return erro is null ? Results.Ok(new { ok = true, dados = r }) : Results.BadRequest(new { ok = false, erro });
        });

        // ---------------- mapa de ocupação: quartos, reservas do período e ocupação por dia, numa chamada
        app.MapGet("/api/mapa", (HttpRequest req, string? de, int? dias) =>
        {
            if (Checar(req, null) is { } negado) return negado;
            var ini = Data(de, out var d0) ? d0 : DateOnly.FromDateTime(DateTime.Today);
            var n = Math.Clamp(dias ?? 14, 7, 62);
            var fim = ini.AddDays(n);
            var quartos = cad.Listar(FichasBloco1.Quartos, null, new() { ["ativo"] = "1" });
            var tipos = cad.Listar(FichasBloco1.TiposQuarto, null, new()).ToDictionary(t => Convert.ToInt64(t["id_tipo"]));
            var reservas = repo.Listar(ini.ToString("yyyy-MM-dd"), fim.ToString("yyyy-MM-dd"), null, null, null, null)
                               .Where(r => r.situacao is not ("CANCELADA" or "NO_SHOW")).ToList();
            var ativas = reservas.Where(r => r.situacao is "CONFIRMADA" or "HOSPEDADO" or "PRE_RESERVA").ToList();
            var ocupacao = Enumerable.Range(0, n).Select(k =>
            {
                var dia = ini.AddDays(k).ToString("yyyy-MM-dd");
                var ocup = ativas.Count(r => string.CompareOrdinal(r.entrada, dia) <= 0 && string.CompareOrdinal(r.saida, dia) > 0);
                return new { data = dia, ocupados = ocup, total = quartos.Count, pct = quartos.Count == 0 ? 0 : (int)Math.Round(100.0 * ocup / quartos.Count) };
            }).ToList();
            return Results.Ok(new
            {
                ok = true, de = ini.ToString("yyyy-MM-dd"), dias = n,
                quartos = quartos.Select(q =>
                {
                    var t = tipos.GetValueOrDefault(Convert.ToInt64(q["id_tipo"]));
                    return new { id_quarto = q["id_quarto"], numero = q["numero"], andar = q["andar"], situacao = q["situacao"],
                        id_tipo = q["id_tipo"], tipo = t?["nome"], sigla = t?["sigla"] };
                }),
                reservas, ocupacao
            });
        });

        /* ---------------- PÚBLICA (motor de reservas on-line — próxima etapa): tipos disponíveis e preço total, SEM dados
         * pessoais e sem login. Só leitura. Quando o motor on-line for ao ar, ganha limite de pedidos por minuto. */
        app.MapGet("/api/publico/disponibilidade", (string entrada, string saida, int? adultos, int? criancas) =>
        {
            var r = Disponibilidade(repo, cad, entrada, saida, adultos ?? 2, criancas ?? 0, 0, out var erro);
            if (erro is not null) return Results.BadRequest(new { ok = false, erro });
            var json = JsonSerializer.SerializeToElement(r);
            var porTipo = json.GetProperty("quartos").EnumerateArray()
                .GroupBy(q => q.GetProperty("id_tipo").GetInt64())
                .Select(g => new
                {
                    id_tipo = g.Key, tipo = g.First().GetProperty("tipo").GetString(), disponiveis = g.Count(),
                    total = g.First().GetProperty("total").GetDouble(), descricao = g.First().GetProperty("descricao").GetString(),
                    comodidades = g.First().GetProperty("comodidades").GetString()
                });
            return Results.Ok(new { ok = true, dados = porTipo });
        });
    }

    /*
     * Disponibilidade — quartos LIVRES (ativos, não bloqueados, sem reserva que ocupe) que cabem as pessoas, com o total
     * noite a noite de cada tipo e o aviso de mínimo de noites. Base da tela de reserva e do motor on-line.
     */
    public static object? Disponibilidade(IReservasRepository repo, ICadastroRepository cad, string entrada, string saida, int adultos,
        int criancas, long ignorar, out string? erro)
    {
        erro = null;
        if (!Data(entrada, out var ent) || !Data(saida, out var sai) || sai <= ent) { erro = "Informe entrada e saída (a saída depois da entrada)."; return null; }
        var ocupados = repo.QuartosOcupados(entrada, saida, ignorar);
        var tipos = cad.Listar(FichasBloco1.TiposQuarto, null, new() { ["ativo"] = "1" }).ToDictionary(t => Convert.ToInt64(t["id_tipo"]));
        var precos = new Dictionary<long, JsonElement>();
        var livres = new List<object>();
        foreach (var q in cad.Listar(FichasBloco1.Quartos, null, new() { ["ativo"] = "1" }))
        {
            var idQ = Convert.ToInt64(q["id_quarto"]);
            var idT = Convert.ToInt64(q["id_tipo"]);
            if (ocupados.Contains(idQ) || q["situacao"]?.ToString() == "BLOQUEADO" || !tipos.TryGetValue(idT, out var t)) continue;
            var capA = Convert.ToInt32(t["capacidade_adultos"] ?? 1L);
            var capC = Convert.ToInt32(t["capacidade_criancas"] ?? 0L);
            if (adultos > capA || adultos + criancas > capA + capC) continue;
            if (!precos.TryGetValue(idT, out var p))
            {
                p = JsonSerializer.SerializeToElement(CadastrosEndpoints.CalcularDiarias(cad, idT, entrada, saida, out _));
                precos[idT] = p;
            }
            livres.Add(new
            {
                id_quarto = idQ, numero = q["numero"]?.ToString(), andar = q["andar"]?.ToString(), situacao = q["situacao"]?.ToString(),
                id_tipo = idT, tipo = t["nome"]?.ToString(), descricao = t["descricao"]?.ToString(), comodidades = t["comodidades"]?.ToString(),
                total = p.GetProperty("total").GetDouble(), noites = p.GetProperty("noites").GetInt32(),
                minimo_noites = p.GetProperty("minimo_noites").GetInt64(), atende_minimo = p.GetProperty("atende_minimo").GetBoolean()
            });
        }
        return new { entrada, saida, noites = sai.DayNumber - ent.DayNumber, adultos, criancas, quartos = livres };
    }
}
