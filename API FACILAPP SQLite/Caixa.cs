using Microsoft.Data.Sqlite;

namespace FacilApp.Sqlite.Api;

/*
 * CAIXA E RECEBIMENTOS — Bloco 4 do FastPousada (aula gravada de 08/11/2026).
 * Daniel: "Sim, Bloco 4" (caixa: abrir, suprimento, sangria, fechar, um por usuário; recebimentos com estorno).
 *
 * O QUE FAZ
 *   - CAIXA por usuário: cada recepcionista abre o SEU caixa com o troco inicial; só um aberto por usuário.
 *   - Todo RECEBIMENTO (Bloco 3) entra no caixa aberto de quem recebeu. Sem caixa aberto → "Abra o caixa".
 *   - SUPRIMENTO (entra dinheiro na gaveta) e SANGRIA (sai dinheiro da gaveta), sempre com motivo.
 *   - FECHAR: calcula o ESPERADO em dinheiro (inicial + recebido em dinheiro + suprimentos − sangrias), grava o que
 *     foi contado (informado) e a DIFERENÇA. Caixa fechado não muda mais (nem estorno).
 *   - RESUMO do caixa: total por forma de pagamento, movimentos e os recebimentos.
 *   - LISTA de recebimentos por período/forma (tela Recebimentos), com estorno pelo Bloco 3.
 * TABELAS: caixas, caixa_movimentos (no mesmo SQLite). MULTIBANCO: ICaixaRepository; hoje CaixaSqlite.
 * CUIDADOS: dinheiro em 2 casas; nada é apagado; o caixa é do usuário logado (ninguém mexe no caixa do outro;
 *   o administrador vê todos).
 */

public sealed record Caixa(long id_caixa, string usuario, string situacao, string aberto_em, double saldo_inicial, string fechado_em,
    double esperado_dinheiro, double informado, double diferenca, string observacao);

public sealed record CaixaMovimento(long id_mov, long id_caixa, string tipo, double valor, string motivo, string feito_em, string usuario);

public sealed record AbrirCaixaInput(double? saldo_inicial);
public sealed record MovimentoInput(string? tipo, double? valor, string? motivo);
public sealed record FecharCaixaInput(double? saldo_informado, string? observacao);

public interface ICaixaRepository
{
    void Initialize();
    Caixa? AbertoDe(string usuario);
    Caixa? Obter(long id);
    IReadOnlyList<Caixa> Listar(string? de, string? ate, string? usuario);
    long Abrir(string usuario, double saldoInicial);
    long Movimentar(long idCaixa, string tipo, double valor, string motivo, string usuario);
    IReadOnlyList<CaixaMovimento> Movimentos(long idCaixa);
    /// <summary>Recebimentos (não estornados) do caixa somados por forma: (forma, tipo, quantidade, total).</summary>
    IReadOnlyList<(string forma, string tipo, long qtd, double total)> PorForma(long idCaixa);
    void Fechar(long idCaixa, double esperado, double informado, string observacao);
}

public sealed class CaixaSqlite(string databasePath) : ICaixaRepository
{
    private SqliteConnection Open()
    {
        var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = databasePath }.ToString());
        db.Open();
        return db;
    }
    private static string Agora() => DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss");

    public void Initialize()
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS caixas (
                id_caixa INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario TEXT NOT NULL,
                situacao TEXT NOT NULL DEFAULT 'ABERTO',
                aberto_em TEXT NOT NULL,
                saldo_inicial REAL NOT NULL DEFAULT 0,
                fechado_em TEXT NOT NULL DEFAULT '',
                esperado_dinheiro REAL NOT NULL DEFAULT 0,
                informado REAL NOT NULL DEFAULT 0,
                diferenca REAL NOT NULL DEFAULT 0,
                observacao TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS ix_caixas_usuario ON caixas(usuario, situacao);
            CREATE TABLE IF NOT EXISTS caixa_movimentos (
                id_mov INTEGER PRIMARY KEY AUTOINCREMENT,
                id_caixa INTEGER NOT NULL,
                tipo TEXT NOT NULL,
                valor REAL NOT NULL,
                motivo TEXT NOT NULL DEFAULT '',
                feito_em TEXT NOT NULL,
                usuario TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS ix_caixa_mov ON caixa_movimentos(id_caixa);
            """;
        cmd.ExecuteNonQuery();
    }

    private const string SelectCaixa = """
        SELECT id_caixa, usuario, situacao, aberto_em, saldo_inicial, fechado_em, esperado_dinheiro, informado, diferenca, observacao FROM caixas
        """;
    private static Caixa Ler(SqliteDataReader r) => new(r.GetInt64(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetDouble(4),
        r.GetString(5), r.GetDouble(6), r.GetDouble(7), r.GetDouble(8), r.GetString(9));

    public Caixa? AbertoDe(string usuario)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = SelectCaixa + " WHERE usuario = $u AND situacao = 'ABERTO' ORDER BY id_caixa DESC LIMIT 1";
        cmd.Parameters.AddWithValue("$u", usuario);
        using var r = cmd.ExecuteReader();
        return r.Read() ? Ler(r) : null;
    }

    public Caixa? Obter(long id)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = SelectCaixa + " WHERE id_caixa = $id";
        cmd.Parameters.AddWithValue("$id", id);
        using var r = cmd.ExecuteReader();
        return r.Read() ? Ler(r) : null;
    }

    public IReadOnlyList<Caixa> Listar(string? de, string? ate, string? usuario)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        var w = new List<string>();
        if (!string.IsNullOrWhiteSpace(de)) { w.Add("aberto_em >= $de"); cmd.Parameters.AddWithValue("$de", de); }
        if (!string.IsNullOrWhiteSpace(ate)) { w.Add("aberto_em < $ate"); cmd.Parameters.AddWithValue("$ate", ate); }
        if (!string.IsNullOrWhiteSpace(usuario)) { w.Add("usuario = $u"); cmd.Parameters.AddWithValue("$u", usuario); }
        cmd.CommandText = SelectCaixa + (w.Count > 0 ? " WHERE " + string.Join(" AND ", w) : "") + " ORDER BY id_caixa DESC LIMIT 200";
        using var r = cmd.ExecuteReader();
        var l = new List<Caixa>();
        while (r.Read()) l.Add(Ler(r));
        return l;
    }

    public long Abrir(string usuario, double saldoInicial)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "INSERT INTO caixas (usuario, aberto_em, saldo_inicial) VALUES ($u, $agora, $s); SELECT last_insert_rowid();";
        cmd.Parameters.AddWithValue("$u", usuario);
        cmd.Parameters.AddWithValue("$agora", Agora());
        cmd.Parameters.AddWithValue("$s", Math.Round(saldoInicial, 2));
        return Convert.ToInt64(cmd.ExecuteScalar());
    }

    public long Movimentar(long idCaixa, string tipo, double valor, string motivo, string usuario)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            INSERT INTO caixa_movimentos (id_caixa, tipo, valor, motivo, feito_em, usuario) VALUES ($c, $t, $v, $m, $agora, $u);
            SELECT last_insert_rowid();
            """;
        cmd.Parameters.AddWithValue("$c", idCaixa); cmd.Parameters.AddWithValue("$t", tipo); cmd.Parameters.AddWithValue("$v", Math.Round(valor, 2));
        cmd.Parameters.AddWithValue("$m", motivo); cmd.Parameters.AddWithValue("$agora", Agora()); cmd.Parameters.AddWithValue("$u", usuario);
        return Convert.ToInt64(cmd.ExecuteScalar());
    }

    public IReadOnlyList<CaixaMovimento> Movimentos(long idCaixa)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT id_mov, id_caixa, tipo, valor, motivo, feito_em, usuario FROM caixa_movimentos WHERE id_caixa = $c ORDER BY id_mov";
        cmd.Parameters.AddWithValue("$c", idCaixa);
        using var r = cmd.ExecuteReader();
        var l = new List<CaixaMovimento>();
        while (r.Read()) l.Add(new(r.GetInt64(0), r.GetInt64(1), r.GetString(2), r.GetDouble(3), r.GetString(4), r.GetString(5), r.GetString(6)));
        return l;
    }

    public IReadOnlyList<(string forma, string tipo, long qtd, double total)> PorForma(long idCaixa)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            SELECT COALESCE(f.nome, '?'), COALESCE(f.tipo, ''), COUNT(*), ROUND(SUM(p.valor), 2)
            FROM recebimentos p LEFT JOIN formas_pagamento f ON f.id_forma = p.id_forma
            WHERE p.id_caixa = $c AND p.estornado = 0
            GROUP BY p.id_forma ORDER BY 4 DESC
            """;
        cmd.Parameters.AddWithValue("$c", idCaixa);
        using var r = cmd.ExecuteReader();
        var l = new List<(string, string, long, double)>();
        while (r.Read()) l.Add((r.GetString(0), r.GetString(1), r.GetInt64(2), r.GetDouble(3)));
        return l;
    }

    public void Fechar(long idCaixa, double esperado, double informado, string observacao)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            UPDATE caixas SET situacao = 'FECHADO', fechado_em = $agora, esperado_dinheiro = $e, informado = $i, diferenca = $d, observacao = $o
            WHERE id_caixa = $c AND situacao = 'ABERTO'
            """;
        cmd.Parameters.AddWithValue("$c", idCaixa); cmd.Parameters.AddWithValue("$agora", Agora());
        cmd.Parameters.AddWithValue("$e", Math.Round(esperado, 2)); cmd.Parameters.AddWithValue("$i", Math.Round(informado, 2));
        cmd.Parameters.AddWithValue("$d", Math.Round(informado - esperado, 2)); cmd.Parameters.AddWithValue("$o", observacao);
        cmd.ExecuteNonQuery();
    }
}

public static class CaixaEndpoints
{
    private static double R2(double v) => Math.Round(v, 2);
    private static readonly System.Globalization.CultureInfo Br = new("pt-BR");

    /*
     * Resumo — tudo do caixa numa resposta: o caixa, total por forma, movimentos, recebimentos e o ESPERADO em dinheiro
     * (inicial + recebido em dinheiro + suprimentos − sangrias).
     */
    public static object Resumo(Caixa c, ICaixaRepository cx, IOperacaoRepository op)
    {
        var formas = cx.PorForma(c.id_caixa).Select(f => new { f.forma, f.tipo, f.qtd, f.total }).ToList();
        var movs = cx.Movimentos(c.id_caixa);
        var (dinheiro, suprimentos, sangrias, esperado) = Gaveta(c, cx);
        return new
        {
            caixa = c, por_forma = formas, total_recebido = R2(formas.Sum(f => f.total)), recebido_dinheiro = dinheiro,
            suprimentos, sangrias, esperado_dinheiro = esperado, movimentos = movs, recebimentos = op.RecebimentosDoCaixa(c.id_caixa)
        };
    }

    /// <summary>Gaveta — o dinheiro do caixa: recebido em dinheiro, suprimentos, sangrias e o ESPERADO na gaveta.</summary>
    private static (double dinheiro, double suprimentos, double sangrias, double esperado) Gaveta(Caixa c, ICaixaRepository cx)
    {
        var dinheiro = R2(cx.PorForma(c.id_caixa).Where(f => f.tipo == "DINHEIRO").Sum(f => f.total));
        var movs = cx.Movimentos(c.id_caixa);
        var sup = R2(movs.Where(m => m.tipo == "SUPRIMENTO").Sum(m => m.valor));
        var san = R2(movs.Where(m => m.tipo == "SANGRIA").Sum(m => m.valor));
        return (dinheiro, sup, san, R2(c.saldo_inicial + dinheiro + sup - san));
    }

    /// <summary>MapCaixa — rotas do Bloco 4. O caixa é sempre do usuário logado; o administrador consulta todos.</summary>
    public static void MapCaixa(this WebApplication app, ICaixaRepository cx, IOperacaoRepository op,
        Func<HttpRequest, (long id, bool admin, string login)?> logado, Func<long, string, MenuPermission?> permissao)
    {
        cx.Initialize();
        IResult Nao401() => Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
        IResult Erro(string m) => Results.BadRequest(new { ok = false, erro = m });
        // permissão pelo item de menu (alterar = operar); devolve o usuário logado
        IResult? Checar(HttpRequest req, string codigo, out (long id, bool admin, string login) usuario)
        {
            usuario = default;
            if (logado(req) is not { } u) return Nao401();
            usuario = u;
            if (u.admin || permissao(u.id, codigo) is not { } p) return null;
            return p.alterar == 0 || p.ativo == 0 || p.oculto == 1 || p.desabilitado == 1
                ? Results.Json(new { ok = false, erro = "Seu usuário não tem permissão para esta operação." }, statusCode: 403) : null;
        }

        // ---------------- o caixa do usuário (aberto ou não)
        app.MapGet("/api/caixa/atual", (HttpRequest req) =>
        {
            if (logado(req) is not { } u) return Nao401();
            return cx.AbertoDe(u.login) is { } c
                ? Results.Ok(new { ok = true, aberto = true, usuario = u.login, dados = Resumo(c, cx, op) })
                : Results.Ok(new { ok = true, aberto = false, usuario = u.login, dados = (object?)null });
        });

        // ---------------- abrir
        app.MapPost("/api/caixa/abrir", (HttpRequest req, AbrirCaixaInput input) =>
        {
            if (Checar(req, "fin_caixa", out var u) is { } negado) return negado;
            if (cx.AbertoDe(u.login) is { } c) return Erro($"Você já tem um caixa aberto (nº {c.id_caixa}, desde {c.aberto_em[8..10]}/{c.aberto_em[5..7]} {c.aberto_em[11..16]}).");
            var inicial = R2(input.saldo_inicial ?? 0);
            if (inicial < 0) return Erro("O troco inicial não pode ser negativo.");
            var id = cx.Abrir(u.login, inicial);
            return Results.Ok(new { ok = true, id, mensagem = $"Caixa nº {id} aberto com {inicial.ToString("C", Br)}." });
        });

        // ---------------- suprimento / sangria
        app.MapPost("/api/caixa/movimentos", (HttpRequest req, MovimentoInput input) =>
        {
            if (Checar(req, "fin_caixa", out var u) is { } negado) return negado;
            if (cx.AbertoDe(u.login) is not { } c) return Erro("Abra o caixa primeiro.");
            var tipo = (input.tipo ?? "").Trim().ToUpperInvariant();
            if (tipo is not ("SUPRIMENTO" or "SANGRIA")) return Erro("Tipo deve ser SUPRIMENTO ou SANGRIA.");
            var valor = R2(input.valor ?? 0);
            if (valor <= 0) return Erro("Informe o valor.");
            var motivo = (input.motivo ?? "").Trim();
            if (motivo.Length < 3) return Erro("Informe o motivo.");
            if (tipo == "SANGRIA")
            {
                // não dá para tirar da gaveta mais dinheiro do que tem nela
                var esperado = Gaveta(c, cx).esperado;
                if (valor > esperado + 0.004) return Erro($"A sangria passa do dinheiro do caixa ({esperado.ToString("C", Br)}).");
            }
            var id = cx.Movimentar(c.id_caixa, tipo, valor, motivo, u.login);
            return Results.Ok(new { ok = true, id, mensagem = (tipo == "SANGRIA" ? $"Sangria de {valor.ToString("C", Br)} registrada." : $"Suprimento de {valor.ToString("C", Br)} registrado.") });
        });

        // ---------------- fechar (conferência do dinheiro)
        app.MapPost("/api/caixa/fechar", (HttpRequest req, FecharCaixaInput input) =>
        {
            if (Checar(req, "fin_caixa", out var u) is { } negado) return negado;
            if (cx.AbertoDe(u.login) is not { } c) return Erro("Você não tem caixa aberto.");
            if (input.saldo_informado is not >= 0) return Erro("Informe o dinheiro contado na gaveta.");
            var esperado = Gaveta(c, cx).esperado;
            var informado = R2(input.saldo_informado.Value);
            var dif = R2(informado - esperado);
            if (Math.Abs(dif) > 0.004 && (input.observacao ?? "").Trim().Length < 3) return Erro($"Há diferença de {dif.ToString("C", Br)}: explique na observação.");
            cx.Fechar(c.id_caixa, esperado, informado, (input.observacao ?? "").Trim());
            return Results.Ok(new { ok = true, id = c.id_caixa, esperado, informado, diferenca = dif,
                mensagem = $"Caixa nº {c.id_caixa} fechado." + (Math.Abs(dif) < 0.005 ? " Bateu certinho." : (dif > 0 ? " Sobra de " : " Falta de ") + Math.Abs(dif).ToString("C", Br) + ".") });
        });

        // ---------------- histórico de caixas (o administrador vê todos; o usuário, os seus)
        app.MapGet("/api/caixas", (HttpRequest req, string? de, string? ate, string? usuario) =>
        {
            if (logado(req) is not { } u) return Nao401();
            var lista = cx.Listar(de, string.IsNullOrWhiteSpace(ate) ? null : ate + " 99", u.admin ? usuario : u.login);
            return Results.Ok(new { ok = true, dados = lista });
        });
        app.MapGet("/api/caixas/{id:long}", (HttpRequest req, long id) =>
        {
            if (logado(req) is not { } u) return Nao401();
            if (cx.Obter(id) is not { } c || (!u.admin && c.usuario != u.login)) return Results.NotFound(new { ok = false, erro = "Caixa não encontrado." });
            return Results.Ok(new { ok = true, dados = Resumo(c, cx, op) });
        });

        // ---------------- lista de recebimentos (tela Recebimentos)
        app.MapGet("/api/recebimentos", (HttpRequest req, string? de, string? ate, long? id_forma, string? busca, string? situacao) =>
        {
            if (logado(req) is null) return Nao401();
            var l = op.Recebimentos(null, de, string.IsNullOrWhiteSpace(ate) ? null : ate + " 99").AsEnumerable();
            if (id_forma is > 0) l = l.Where(p => p.id_forma == id_forma);
            if (!string.IsNullOrWhiteSpace(busca)) { var b = busca.Trim().ToLowerInvariant(); l = l.Where(p => (p.hospede + " " + p.quarto + " " + p.observacao).ToLowerInvariant().Contains(b)); }
            if (situacao == "ATIVO") l = l.Where(p => !p.estornado); else if (situacao == "ESTORNADO") l = l.Where(p => p.estornado);
            return Results.Ok(new { ok = true, dados = l.OrderByDescending(p => p.recebido_em).ToList() });
        });
    }
}
