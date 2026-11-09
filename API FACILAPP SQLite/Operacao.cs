using Microsoft.Data.Sqlite;

namespace FacilApp.Sqlite.Api;

/*
 * OPERAÇÃO DO DIA — Bloco 3 do FastPousada (aula gravada de 08/11/2026).
 * Daniel: "gere o bloco 3" (check-in, estadia e consumos, check-out — plano aprovado no Bloco 1).
 *
 * O QUE FAZ
 *   - Painel de HOJE: chegadas, saídas, hospedados, chegadas atrasadas e quartos sujos.
 *   - CHECK-IN: a reserva (confirmada ou pré) vira HOSPEDADO. Regras: a entrada já chegou (hoje ou antes); o quarto não
 *     pode estar ocupado por outro hospedado; quarto SUJO ou em MANUTENÇÃO pede confirmação (forcar=true).
 *   - CONTA do hóspede: diárias (valor da reserva) + consumos − recebimentos − sinal pago antes = SALDO.
 *   - CONSUMOS: só com hóspede na casa; preço vem do cadastro de serviços e produtos (pode ajustar); estorno com motivo.
 *   - RECEBIMENTOS: com a forma de pagamento; não passa do saldo; estorno com motivo. Entram no caixa aberto de quem
 *     recebe (Bloco 4, Caixa.cs): sem caixa aberto → "Abra o caixa"; caixa fechado não aceita estorno.
 *   - CHECK-OUT: só com saldo zerado; a reserva vira ENCERRADA e o quarto vira SUJO (governança).
 * TABELAS: consumos, recebimentos (no mesmo SQLite). MULTIBANCO: IOperacaoRepository; hoje OperacaoSqlite.
 * CUIDADOS: dinheiro sempre arredondado em 2 casas; nada é apagado — estorno marca e guarda o motivo.
 */

public sealed record Consumo(long id_consumo, long id_reserva, long id_item, string descricao, double quantidade, double valor_unitario,
    double valor_total, string lancado_em, bool estornado, string estorno_motivo);

public sealed record Recebimento(long id_recebimento, long id_reserva, long id_forma, string forma, double valor, string recebido_em,
    string observacao, bool estornado, string estorno_motivo, string hospede, string quarto, long id_caixa);

public sealed record CheckinInput(bool? forcar, string? observacao);
public sealed record ConsumoInput(long? id_item, double? quantidade, double? valor_unitario, string? descricao);
public sealed record RecebimentoInput(long? id_forma, double? valor, string? observacao);
public sealed record EstornoInput(string? motivo);

public interface IOperacaoRepository
{
    void Initialize();
    IReadOnlyList<Consumo> Consumos(long idReserva);
    IReadOnlyList<Recebimento> Recebimentos(long? idReserva, string? de, string? ate);
    long IncluirConsumo(long idReserva, long idItem, string descricao, double qtd, double unitario, string usuario);
    long IncluirRecebimento(long idReserva, long idForma, double valor, string observacao, string usuario, long idCaixa);
    /// <summary>Recebimentos de um caixa (Bloco 4).</summary>
    IReadOnlyList<Recebimento> RecebimentosDoCaixa(long idCaixa);
    Consumo? ObterConsumo(long id);
    Recebimento? ObterRecebimento(long id);
    void EstornarConsumo(long id, string motivo);
    void EstornarRecebimento(long id, string motivo);
    /// <summary>Hospedado no quarto (outra reserva) — null se o quarto está livre de hóspedes na casa.</summary>
    long? HospedadoNoQuarto(long idQuarto, long ignorarReserva);
    void MarcarQuarto(long idQuarto, string situacao);
}

public sealed class OperacaoSqlite(string databasePath) : IOperacaoRepository
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
            CREATE TABLE IF NOT EXISTS consumos (
                id_consumo INTEGER PRIMARY KEY AUTOINCREMENT,
                id_reserva INTEGER NOT NULL,
                id_item INTEGER NOT NULL,
                descricao TEXT NOT NULL,
                quantidade REAL NOT NULL,
                valor_unitario REAL NOT NULL,
                valor_total REAL NOT NULL,
                lancado_em TEXT NOT NULL,
                usuario TEXT NOT NULL DEFAULT '',
                estornado INTEGER NOT NULL DEFAULT 0,
                estorno_motivo TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS ix_consumos_reserva ON consumos(id_reserva);
            CREATE TABLE IF NOT EXISTS recebimentos (
                id_recebimento INTEGER PRIMARY KEY AUTOINCREMENT,
                id_reserva INTEGER NOT NULL,
                id_forma INTEGER NOT NULL,
                valor REAL NOT NULL,
                recebido_em TEXT NOT NULL,
                observacao TEXT NOT NULL DEFAULT '',
                usuario TEXT NOT NULL DEFAULT '',
                id_caixa INTEGER NOT NULL DEFAULT 0,
                estornado INTEGER NOT NULL DEFAULT 0,
                estorno_motivo TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS ix_recebimentos_reserva ON recebimentos(id_reserva);
            CREATE INDEX IF NOT EXISTS ix_recebimentos_data ON recebimentos(recebido_em);
            """;
        cmd.ExecuteNonQuery();
    }

    public IReadOnlyList<Consumo> Consumos(long idReserva)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            SELECT id_consumo, id_reserva, id_item, descricao, quantidade, valor_unitario, valor_total, lancado_em, estornado, estorno_motivo
            FROM consumos WHERE id_reserva = $r ORDER BY lancado_em, id_consumo
            """;
        cmd.Parameters.AddWithValue("$r", idReserva);
        using var r = cmd.ExecuteReader();
        var l = new List<Consumo>();
        while (r.Read()) l.Add(new(r.GetInt64(0), r.GetInt64(1), r.GetInt64(2), r.GetString(3), r.GetDouble(4), r.GetDouble(5), r.GetDouble(6),
            r.GetString(7), r.GetInt64(8) != 0, r.GetString(9)));
        return l;
    }

    private const string SelectRecebimento = """
        SELECT p.id_recebimento, p.id_reserva, p.id_forma, COALESCE(f.nome,''), p.valor, p.recebido_em, p.observacao, p.estornado,
               p.estorno_motivo, COALESCE(h.nome,''), COALESCE(q.numero,''), p.id_caixa
        FROM recebimentos p
        LEFT JOIN formas_pagamento f ON f.id_forma = p.id_forma
        LEFT JOIN reservas r ON r.id_reserva = p.id_reserva
        LEFT JOIN hospedes h ON h.id_hospede = r.id_hospede
        LEFT JOIN quartos q ON q.id_quarto = r.id_quarto
        """;
    private static Recebimento LerRecebimento(SqliteDataReader r) => new(r.GetInt64(0), r.GetInt64(1), r.GetInt64(2), r.GetString(3),
        r.GetDouble(4), r.GetString(5), r.GetString(6), r.GetInt64(7) != 0, r.GetString(8), r.GetString(9), r.GetString(10), r.GetInt64(11));

    public IReadOnlyList<Recebimento> Recebimentos(long? idReserva, string? de, string? ate)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        var w = new List<string>();
        if (idReserva is > 0) { w.Add("p.id_reserva = $r"); cmd.Parameters.AddWithValue("$r", idReserva); }
        if (!string.IsNullOrWhiteSpace(de)) { w.Add("p.recebido_em >= $de"); cmd.Parameters.AddWithValue("$de", de); }
        if (!string.IsNullOrWhiteSpace(ate)) { w.Add("p.recebido_em < $ate"); cmd.Parameters.AddWithValue("$ate", ate); }
        cmd.CommandText = SelectRecebimento + (w.Count > 0 ? " WHERE " + string.Join(" AND ", w) : "") + " ORDER BY p.recebido_em, p.id_recebimento";
        using var r = cmd.ExecuteReader();
        var l = new List<Recebimento>();
        while (r.Read()) l.Add(LerRecebimento(r));
        return l;
    }

    public long IncluirConsumo(long idReserva, long idItem, string descricao, double qtd, double unitario, string usuario)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            INSERT INTO consumos (id_reserva, id_item, descricao, quantidade, valor_unitario, valor_total, lancado_em, usuario)
            VALUES ($r, $i, $d, $q, $u, $t, $agora, $us); SELECT last_insert_rowid();
            """;
        cmd.Parameters.AddWithValue("$r", idReserva); cmd.Parameters.AddWithValue("$i", idItem); cmd.Parameters.AddWithValue("$d", descricao);
        cmd.Parameters.AddWithValue("$q", qtd); cmd.Parameters.AddWithValue("$u", unitario); cmd.Parameters.AddWithValue("$t", Math.Round(qtd * unitario, 2));
        cmd.Parameters.AddWithValue("$agora", Agora()); cmd.Parameters.AddWithValue("$us", usuario);
        return Convert.ToInt64(cmd.ExecuteScalar());
    }

    public long IncluirRecebimento(long idReserva, long idForma, double valor, string observacao, string usuario, long idCaixa)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            INSERT INTO recebimentos (id_reserva, id_forma, valor, recebido_em, observacao, usuario, id_caixa)
            VALUES ($r, $f, $v, $agora, $o, $us, $cx); SELECT last_insert_rowid();
            """;
        cmd.Parameters.AddWithValue("$r", idReserva); cmd.Parameters.AddWithValue("$f", idForma); cmd.Parameters.AddWithValue("$v", Math.Round(valor, 2));
        cmd.Parameters.AddWithValue("$o", observacao); cmd.Parameters.AddWithValue("$us", usuario); cmd.Parameters.AddWithValue("$agora", Agora());
        cmd.Parameters.AddWithValue("$cx", idCaixa);
        return Convert.ToInt64(cmd.ExecuteScalar());
    }

    public IReadOnlyList<Recebimento> RecebimentosDoCaixa(long idCaixa)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = SelectRecebimento + " WHERE p.id_caixa = $c ORDER BY p.recebido_em, p.id_recebimento";
        cmd.Parameters.AddWithValue("$c", idCaixa);
        using var r = cmd.ExecuteReader();
        var l = new List<Recebimento>();
        while (r.Read()) l.Add(LerRecebimento(r));
        return l;
    }

    public Consumo? ObterConsumo(long id)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT id_reserva FROM consumos WHERE id_consumo = $id";
        cmd.Parameters.AddWithValue("$id", id);
        var r = cmd.ExecuteScalar();
        return r is null ? null : Consumos(Convert.ToInt64(r)).FirstOrDefault(c => c.id_consumo == id);
    }

    public Recebimento? ObterRecebimento(long id)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = SelectRecebimento + " WHERE p.id_recebimento = $id";
        cmd.Parameters.AddWithValue("$id", id);
        using var r = cmd.ExecuteReader();
        return r.Read() ? LerRecebimento(r) : null;
    }

    public void EstornarConsumo(long id, string motivo) => Estornar("consumos", "id_consumo", id, motivo);
    public void EstornarRecebimento(long id, string motivo) => Estornar("recebimentos", "id_recebimento", id, motivo);
    private void Estornar(string tabela, string chave, long id, string motivo)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = $"UPDATE {tabela} SET estornado = 1, estorno_motivo = $m WHERE {chave} = $id";   // nomes fixos no código
        cmd.Parameters.AddWithValue("$m", motivo);
        cmd.Parameters.AddWithValue("$id", id);
        cmd.ExecuteNonQuery();
    }

    public long? HospedadoNoQuarto(long idQuarto, long ignorarReserva)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT id_reserva FROM reservas WHERE id_quarto = $q AND situacao = 'HOSPEDADO' AND id_reserva <> $r LIMIT 1";
        cmd.Parameters.AddWithValue("$q", idQuarto);
        cmd.Parameters.AddWithValue("$r", ignorarReserva);
        var v = cmd.ExecuteScalar();
        return v is null ? null : Convert.ToInt64(v);
    }

    public void MarcarQuarto(long idQuarto, string situacao)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "UPDATE quartos SET situacao = $s, alterado_em = $agora WHERE id_quarto = $q";
        cmd.Parameters.AddWithValue("$s", situacao);
        cmd.Parameters.AddWithValue("$q", idQuarto);
        cmd.Parameters.AddWithValue("$agora", Agora());
        cmd.ExecuteNonQuery();
    }
}

public static class OperacaoEndpoints
{
    private static string Hoje() => DateTime.Today.ToString("yyyy-MM-dd");
    private static double R2(double v) => Math.Round(v, 2);

    /*
     * Conta — a conta do hóspede: diárias (valor da reserva) + consumos (não estornados) − recebimentos (não estornados)
     * − sinal pago antes (quando marcado na reserva e não lançado como recebimento) = saldo a receber.
     */
    public static object Conta(Reserva r, IOperacaoRepository op)
    {
        var consumos = op.Consumos(r.id_reserva);
        var recebimentos = op.Recebimentos(r.id_reserva, null, null);
        var totalConsumos = R2(consumos.Where(c => !c.estornado).Sum(c => c.valor_total));
        var totalRecebido = R2(recebimentos.Where(p => !p.estornado).Sum(p => p.valor));
        var sinal = r.sinal_pago ? R2(r.sinal_valor) : 0;
        var total = R2(r.valor_total + totalConsumos);
        var saldo = R2(total - totalRecebido - sinal);
        return new
        {
            reserva = r, diarias = r.valor_total, consumos, total_consumos = totalConsumos, recebimentos,
            total_recebido = totalRecebido, sinal_pago_antes = sinal, total, saldo
        };
    }
    private static double Saldo(Reserva r, IOperacaoRepository op)
    {
        var c = op.Consumos(r.id_reserva).Where(x => !x.estornado).Sum(x => x.valor_total);
        var p = op.Recebimentos(r.id_reserva, null, null).Where(x => !x.estornado).Sum(x => x.valor);
        return R2(r.valor_total + c - p - (r.sinal_pago ? r.sinal_valor : 0));
    }

    /// <summary>MapOperacao — rotas do Bloco 3. Usa o repositório de reservas (Bloco 2) e os cadastros (Bloco 1).</summary>
    public static void MapOperacao(this WebApplication app, IOperacaoRepository op, IReservasRepository reservas, ICadastroRepository cad, ICaixaRepository cx,
        Func<HttpRequest, (long id, bool admin, string login)?> logado, Func<long, string, MenuPermission?> permissao)
    {
        op.Initialize();
        IResult Nao401() => Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
        IResult Erro(string m) => Results.BadRequest(new { ok = false, erro = m });
        IResult NaoAchou() => Results.NotFound(new { ok = false, erro = "Reserva não encontrada." });
        // permissão pelo item de menu da tela (alterar = operar)
        IResult? Checar(HttpRequest req, string codigo, out string usuario)
        {
            usuario = "";
            if (logado(req) is not { } u) return Nao401();
            usuario = u.login;
            if (u.admin || permissao(u.id, codigo) is not { } p) return null;
            return p.alterar == 0 || p.ativo == 0 || p.oculto == 1 || p.desabilitado == 1
                ? Results.Json(new { ok = false, erro = "Seu usuário não tem permissão para esta operação." }, statusCode: 403) : null;
        }

        // ---------------- HOJE: chegadas, saídas, hospedados, atrasados, quartos sujos
        app.MapGet("/api/operacao/hoje", (HttpRequest req) =>
        {
            if (logado(req) is null) return Nao401();
            var hoje = Hoje();
            var todas = reservas.Listar(null, null, null, null, null, null);
            var quartos = cad.Listar(FichasBloco1.Quartos, null, new() { ["ativo"] = "1" });
            bool AEntrar(Reserva r) => r.situacao is "CONFIRMADA" or "PRE_RESERVA";
            return Results.Ok(new
            {
                ok = true, hoje,
                // chegadas de hoje; atrasadas = entrada já passou, saída ainda não, e não fizeram check-in
                chegadas = todas.Where(r => AEntrar(r) && r.entrada == hoje).ToList(),
                atrasadas = todas.Where(r => AEntrar(r) && string.CompareOrdinal(r.entrada, hoje) < 0 && string.CompareOrdinal(r.saida, hoje) > 0).ToList(),
                saidas = todas.Where(r => r.situacao == "HOSPEDADO" && string.CompareOrdinal(r.saida, hoje) <= 0).ToList(),
                hospedados = todas.Where(r => r.situacao == "HOSPEDADO").ToList(),
                quartos_sujos = quartos.Where(q => q["situacao"]?.ToString() == "SUJO").Select(q => q["numero"]).ToList(),
                total_quartos = quartos.Count
            });
        });

        // ---------------- CHECK-IN
        app.MapPost("/api/reservas/{id:long}/checkin", (HttpRequest req, long id, CheckinInput input) =>
        {
            if (Checar(req, "op_checkin", out _) is { } negado) return negado;
            if (reservas.Obter(id) is not { } r) return NaoAchou();
            if (r.situacao is not ("CONFIRMADA" or "PRE_RESERVA")) return Erro($"Check-in só de reserva confirmada ou pré-reserva (esta está {r.situacao.ToLower().Replace('_', '-')}).");
            if (string.CompareOrdinal(r.entrada, Hoje()) > 0) return Erro($"A entrada é só em {r.entrada[8..]}/{r.entrada[5..7]}: antecipe a reserva antes do check-in.");
            if (string.CompareOrdinal(r.saida, Hoje()) <= 0) return Erro("A data de saída já passou: ajuste a reserva antes do check-in.");
            if (op.HospedadoNoQuarto(r.id_quarto, id) is { } outra) return Erro($"O quarto {r.quarto_numero} ainda tem hóspede na casa (reserva nº {outra}): faça o check-out antes.");
            var q = cad.Obter(FichasBloco1.Quartos, r.id_quarto);
            var sit = q?["situacao"]?.ToString() ?? "LIVRE";
            if (sit is "SUJO" or "MANUTENCAO" && input.forcar != true)
                return Results.Json(new { ok = false, erro = $"O quarto {r.quarto_numero} está {(sit == "SUJO" ? "sujo" : "em manutenção")}. Confirme para fazer o check-in mesmo assim.", confirmar = true }, statusCode: 409);
            var obs = (input.observacao ?? "").Trim();
            reservas.Alterar(id, new()
            {
                ["situacao"] = "HOSPEDADO", ["checkin_em"] = DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss"), ["expira_em"] = "",
                ["observacao"] = obs.Length > 0 ? (r.observacao.Length > 0 ? r.observacao + " | " : "") + "Check-in: " + obs : r.observacao
            });
            if (sit != "LIVRE") op.MarcarQuarto(r.id_quarto, "LIVRE");     // hóspede entrou: o quarto está em uso
            return Results.Ok(new { ok = true, id, mensagem = $"Check-in feito: {r.hospede_nome} no quarto {r.quarto_numero}." });
        });

        // ---------------- CONTA
        app.MapGet("/api/reservas/{id:long}/conta", (HttpRequest req, long id) =>
        {
            if (logado(req) is null) return Nao401();
            return reservas.Obter(id) is { } r ? Results.Ok(new { ok = true, dados = Conta(r, op) }) : NaoAchou();
        });

        // ---------------- CONSUMOS
        app.MapPost("/api/reservas/{id:long}/consumos", (HttpRequest req, long id, ConsumoInput input) =>
        {
            if (Checar(req, "op_estadia", out var usuario) is { } negado) return negado;
            if (reservas.Obter(id) is not { } r) return NaoAchou();
            if (r.situacao != "HOSPEDADO") return Erro("Consumo só na conta de hóspede na casa (depois do check-in).");
            if (input.id_item is not > 0 || cad.Obter(FichasBloco1.ServicosProdutos, input.id_item.Value) is not { } item) return Erro("Escolha o serviço ou produto.");
            if (item["ativo"] is not true) return Erro($"O item {item["nome"]} está inativo.");
            var qtd = input.quantidade ?? 1;
            if (qtd <= 0 || qtd > 999) return Erro("Quantidade inválida.");
            var unit = input.valor_unitario is >= 0 ? R2(input.valor_unitario.Value) : Convert.ToDouble(item["preco"] ?? 0d);
            var desc = string.IsNullOrWhiteSpace(input.descricao) ? item["nome"]!.ToString()! : input.descricao.Trim();
            var novo = op.IncluirConsumo(id, input.id_item.Value, desc, qtd, unit, usuario);
            return Results.Ok(new { ok = true, id = novo, total = R2(qtd * unit), saldo = Saldo(reservas.Obter(id)!, op) });
        });

        app.MapPost("/api/consumos/{id:long}/estornar", (HttpRequest req, long id, EstornoInput input) =>
        {
            if (Checar(req, "op_estadia", out _) is { } negado) return negado;
            if (op.ObterConsumo(id) is not { } c) return Results.NotFound(new { ok = false, erro = "Consumo não encontrado." });
            if (c.estornado) return Erro("Este consumo já foi estornado.");
            if (reservas.Obter(c.id_reserva)?.situacao != "HOSPEDADO") return Erro("Só dá para estornar consumo de hóspede na casa.");
            if ((input.motivo ?? "").Trim().Length < 3) return Erro("Informe o motivo do estorno.");
            op.EstornarConsumo(id, input.motivo!.Trim());
            return Results.Ok(new { ok = true, id });
        });

        // ---------------- RECEBIMENTOS (sinal ou pagamento da conta)
        app.MapPost("/api/reservas/{id:long}/recebimentos", (HttpRequest req, long id, RecebimentoInput input) =>
        {
            if (Checar(req, "op_checkout", out var usuario) is { } negado) return negado;
            if (reservas.Obter(id) is not { } r) return NaoAchou();
            if (r.situacao is not ("HOSPEDADO" or "CONFIRMADA" or "PRE_RESERVA")) return Erro("Recebimento só de reserva ativa.");
            if (input.id_forma is not > 0 || cad.Obter(FichasBloco1.FormasPagamento, input.id_forma.Value) is not { } forma) return Erro("Escolha a forma de pagamento.");
            if (forma["ativo"] is not true) return Erro($"A forma {forma["nome"]} está inativa.");
            var valor = R2(input.valor ?? 0);
            if (valor <= 0) return Erro("Informe o valor recebido.");
            var saldo = Saldo(r, op);
            if (valor > saldo + 0.004) return Erro($"O valor passa do saldo da conta ({saldo.ToString("C", new System.Globalization.CultureInfo("pt-BR"))}).");
            // Bloco 4: todo recebimento entra no caixa aberto de quem recebe
            if (cx.AbertoDe(usuario) is not { } caixa) return Erro("Abra o caixa antes de receber (Financeiro → Caixa).");
            var novo = op.IncluirRecebimento(id, input.id_forma.Value, valor, (input.observacao ?? "").Trim(), usuario, caixa.id_caixa);
            // pré-reserva com sinal recebido vira confirmada
            if (r.situacao == "PRE_RESERVA") reservas.Alterar(id, new() { ["situacao"] = "CONFIRMADA", ["expira_em"] = "" });
            return Results.Ok(new { ok = true, id = novo, saldo = Saldo(reservas.Obter(id)!, op) });
        });

        app.MapPost("/api/recebimentos/{id:long}/estornar", (HttpRequest req, long id, EstornoInput input) =>
        {
            if (Checar(req, "op_checkout", out _) is { } negado) return negado;
            if (op.ObterRecebimento(id) is not { } p) return Results.NotFound(new { ok = false, erro = "Recebimento não encontrado." });
            if (p.estornado) return Erro("Este recebimento já foi estornado.");
            if (reservas.Obter(p.id_reserva)?.situacao is "ENCERRADA") return Erro("Conta encerrada: o recebimento não pode mais ser estornado.");
            // Bloco 4: caixa fechado não muda mais
            if (p.id_caixa > 0 && cx.Obter(p.id_caixa) is { situacao: "FECHADO" }) return Erro($"O caixa nº {p.id_caixa} já foi fechado: o estorno não é mais possível.");
            if ((input.motivo ?? "").Trim().Length < 3) return Erro("Informe o motivo do estorno.");
            op.EstornarRecebimento(id, input.motivo!.Trim());
            return Results.Ok(new { ok = true, id });
        });

        // ---------------- CHECK-OUT
        app.MapPost("/api/reservas/{id:long}/checkout", (HttpRequest req, long id) =>
        {
            if (Checar(req, "op_checkout", out _) is { } negado) return negado;
            if (reservas.Obter(id) is not { } r) return NaoAchou();
            if (r.situacao != "HOSPEDADO") return Erro("Check-out só de hóspede na casa.");
            var saldo = Saldo(r, op);
            if (saldo > 0.004) return Erro($"Ainda falta receber {saldo.ToString("C", new System.Globalization.CultureInfo("pt-BR"))}: receba antes do check-out.");
            var avisos = new List<string>();
            if (string.CompareOrdinal(Hoje(), r.saida) < 0) avisos.Add("Saída antes da data prevista: as diárias reservadas foram mantidas.");
            reservas.Alterar(id, new() { ["situacao"] = "ENCERRADA", ["checkout_em"] = DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss") });
            op.MarcarQuarto(r.id_quarto, "SUJO");      // governança: o quarto precisa de limpeza
            return Results.Ok(new { ok = true, id, mensagem = $"Check-out feito. O quarto {r.quarto_numero} ficou como sujo para a limpeza.", avisos });
        });
    }
}
