using System.Text.RegularExpressions;
using Microsoft.Data.Sqlite;

namespace FacilApp.Sqlite.Api;

/*
 * HÓSPEDES — cadastro de hóspedes do FastPousada (pessoas e empresas).
 * Daniel, 08/11/2026 (aula gravada): "Crie o BrowseHospedes e UpdateHospedes, gere CRUD, exportação XLS, CSV e Rpt dos
 * hóspedes" + "Incluir Adicionar Empresa por CNPJ, onde somente pede o CNPJ e o sistema cadastra sozinho".
 *
 * O QUE FAZ
 *   Tabela `hospedes` no mesmo SQLite da API (usuarios.db) e as rotas /api/hospedes (CRUD) e
 *   /api/hospedes/empresa-por-cnpj (cadastro automático da empresa pelos dados públicos do CNPJ).
 * TABELA
 *   hospedes(id_hospede, tipo PF|PJ, nome, nome_fantasia, documento, documento_chave, inscricao_estadual, telefone, email,
 *            data_nascimento, cep, logradouro, numero, complemento, bairro, cidade, uf, observacao, ativo,
 *            criado_em, alterado_em)
 *   documento_chave = documento só com letras e números, em maiúsculas: é ele que não pode repetir
 *   ("123.456.789-09" e "12345678909" são o mesmo documento).
 * REGRAS (a verdade fica aqui; a tela só ajuda)
 *   - nome com 3+ letras; tipo PF (pessoa) ou PJ (empresa);
 *   - PF: telefone obrigatório com DDD (10+ dígitos). PJ: telefone opcional (vem da Receita quando existe);
 *   - PJ com documento: precisa ser CNPJ válido; documento não repete entre hóspedes;
 *   - e-mail válido quando informado; UF com 2 letras; nascimento AAAA-MM-DD;
 *   - não exclui hóspede com reserva (quando a tabela reservas existir): responde "inative em vez de excluir".
 * PERMISSÕES
 *   Precisa estar logado (Bearer). Administrador pode tudo. Usuário comum segue as exceções do item de menu
 *   "cad_hospedes" (Usuários → Permissões: incluir/alterar/excluir).
 * CUIDADOS
 *   Consultas sempre parametrizadas. Nenhuma rota recebe SQL. A busca do CNPJ usa o PublicLookupService (BrasilAPI e
 *   CNPJ.ws) — precisa de internet só nessa hora.
 * MULTIBANCO (Daniel, 08/11/2026: "a 7777 deverá ser uma API multibanco, no futuro aceitará SQL Server e Postgres")
 *   As rotas e as regras só conhecem a interface IHospedesRepository. Hoje existe a implementação HospedesSqlite.
 *   Para outro banco: criar HospedesSqlServer / HospedesPostgres com o MESMO contrato (só o SQL muda: autonumeração,
 *   id recém-criado, tipos de texto/data e busca sem maiúsculas) e escolher a implementação no Program.cs.
 */

/// <summary>Contrato do cadastro de hóspedes: o que qualquer banco (SQLite, SQL Server, PostgreSQL) precisa oferecer.</summary>
public interface IHospedesRepository
{
    /// <summary>Cria a tabela e os índices se não existirem (nunca apaga dados).</summary>
    void Initialize();
    /// <summary>Lista com filtros opcionais. busca = nome, fantasia, documento, telefone ou cidade.</summary>
    IReadOnlyList<Hospede> Listar(string? busca, bool? ativo, string? tipo, string? cidade, string? uf);
    Hospede? Obter(long id);
    /// <summary>Hóspede que já usa este documento (ignorando o próprio id na alteração); null = livre.</summary>
    Hospede? PorDocumento(string documento, long ignorarId = 0);
    /// <summary>Grava um hóspede novo e devolve o id criado.</summary>
    long Incluir(HospedeInput h);
    bool Alterar(long id, HospedeInput h);
    /// <summary>Quantas reservas o hóspede tem (0 enquanto a tabela de reservas não existir).</summary>
    long ContarReservas(long id);
    bool Excluir(long id);
}

/// <summary>Hóspedes no SQLite (banco das aulas). Todo SQL específico do SQLite fica aqui.</summary>
public sealed class HospedesSqlite(string databasePath) : IHospedesRepository
{
    private const string Colunas = """
        id_hospede,tipo,nome,nome_fantasia,documento,inscricao_estadual,telefone,email,data_nascimento,cep,logradouro,
        numero,complemento,bairro,cidade,uf,observacao,ativo,criado_em,alterado_em
        """;

    private SqliteConnection Open()
    {
        var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = databasePath }.ToString());
        db.Open();
        return db;
    }

    /// <summary>Cria a tabela e os índices se não existirem (nunca apaga dados).</summary>
    public void Initialize()
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS hospedes (
                id_hospede INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo TEXT NOT NULL DEFAULT 'PF',
                nome TEXT NOT NULL,
                nome_fantasia TEXT NOT NULL DEFAULT '',
                documento TEXT NOT NULL DEFAULT '',
                documento_chave TEXT NOT NULL DEFAULT '',
                inscricao_estadual TEXT NOT NULL DEFAULT '',
                telefone TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL DEFAULT '',
                data_nascimento TEXT NOT NULL DEFAULT '',
                cep TEXT NOT NULL DEFAULT '',
                logradouro TEXT NOT NULL DEFAULT '',
                numero TEXT NOT NULL DEFAULT '',
                complemento TEXT NOT NULL DEFAULT '',
                bairro TEXT NOT NULL DEFAULT '',
                cidade TEXT NOT NULL DEFAULT '',
                uf TEXT NOT NULL DEFAULT '',
                observacao TEXT NOT NULL DEFAULT '',
                ativo INTEGER NOT NULL DEFAULT 1,
                criado_em TEXT NOT NULL,
                alterado_em TEXT NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ux_hospedes_documento ON hospedes(documento_chave) WHERE documento_chave <> '';
            CREATE INDEX IF NOT EXISTS ix_hospedes_nome ON hospedes(nome COLLATE NOCASE);
            """;
        cmd.ExecuteNonQuery();
    }

    private static Hospede Ler(SqliteDataReader r) => new(
        r.GetInt64(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4), r.GetString(5), r.GetString(6),
        r.GetString(7), r.GetString(8), r.GetString(9), r.GetString(10), r.GetString(11), r.GetString(12), r.GetString(13),
        r.GetString(14), r.GetString(15), r.GetString(16), r.GetInt64(17) != 0, r.GetString(18), r.GetString(19));

    /// <summary>Lista com filtros opcionais. busca = nome, fantasia, documento, telefone ou cidade.</summary>
    public IReadOnlyList<Hospede> Listar(string? busca, bool? ativo, string? tipo, string? cidade, string? uf)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        var where = new List<string>();
        if (!string.IsNullOrWhiteSpace(busca))
        {
            where.Add("(nome LIKE $b OR nome_fantasia LIKE $b OR documento LIKE $b OR documento_chave LIKE $bd OR telefone LIKE $b OR cidade LIKE $b)");
            cmd.Parameters.AddWithValue("$b", "%" + busca.Trim() + "%");
            cmd.Parameters.AddWithValue("$bd", "%" + HospedeRegras.Chave(busca) + "%");
        }
        if (ativo is not null) { where.Add("ativo=$a"); cmd.Parameters.AddWithValue("$a", ativo.Value ? 1 : 0); }
        if (!string.IsNullOrWhiteSpace(tipo)) { where.Add("tipo=$t"); cmd.Parameters.AddWithValue("$t", tipo.Trim().ToUpperInvariant()); }
        if (!string.IsNullOrWhiteSpace(cidade)) { where.Add("cidade LIKE $c"); cmd.Parameters.AddWithValue("$c", "%" + cidade.Trim() + "%"); }
        if (!string.IsNullOrWhiteSpace(uf)) { where.Add("uf=$u"); cmd.Parameters.AddWithValue("$u", uf.Trim().ToUpperInvariant()); }
        cmd.CommandText = $"SELECT {Colunas} FROM hospedes" + (where.Count > 0 ? " WHERE " + string.Join(" AND ", where) : "") +
                          " ORDER BY nome COLLATE NOCASE";
        using var r = cmd.ExecuteReader();
        var lista = new List<Hospede>();
        while (r.Read()) lista.Add(Ler(r));
        return lista;
    }

    public Hospede? Obter(long id)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = $"SELECT {Colunas} FROM hospedes WHERE id_hospede=$id";
        cmd.Parameters.AddWithValue("$id", id);
        using var r = cmd.ExecuteReader();
        return r.Read() ? Ler(r) : null;
    }

    /// <summary>Hóspede que já usa este documento (ignorando o próprio id na alteração); null = livre.</summary>
    public Hospede? PorDocumento(string documento, long ignorarId = 0)
    {
        var chave = HospedeRegras.Chave(documento);
        if (chave.Length == 0) return null;
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = $"SELECT {Colunas} FROM hospedes WHERE documento_chave=$c AND id_hospede<>$id LIMIT 1";
        cmd.Parameters.AddWithValue("$c", chave);
        cmd.Parameters.AddWithValue("$id", ignorarId);
        using var r = cmd.ExecuteReader();
        return r.Read() ? Ler(r) : null;
    }

    public long Incluir(HospedeInput h)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            INSERT INTO hospedes (tipo,nome,nome_fantasia,documento,documento_chave,inscricao_estadual,telefone,email,
              data_nascimento,cep,logradouro,numero,complemento,bairro,cidade,uf,observacao,ativo,criado_em,alterado_em)
            VALUES ($tipo,$nome,$fantasia,$doc,$chave,$ie,$fone,$email,$nasc,$cep,$logr,$num,$compl,$bairro,$cidade,$uf,$obs,$ativo,$agora,$agora);
            SELECT last_insert_rowid();
            """;
        Bind(cmd, h);
        return Convert.ToInt64(cmd.ExecuteScalar());
    }

    public bool Alterar(long id, HospedeInput h)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            UPDATE hospedes SET tipo=$tipo,nome=$nome,nome_fantasia=$fantasia,documento=$doc,documento_chave=$chave,
              inscricao_estadual=$ie,telefone=$fone,email=$email,data_nascimento=$nasc,cep=$cep,logradouro=$logr,numero=$num,
              complemento=$compl,bairro=$bairro,cidade=$cidade,uf=$uf,observacao=$obs,ativo=$ativo,alterado_em=$agora
            WHERE id_hospede=$id
            """;
        Bind(cmd, h);
        cmd.Parameters.AddWithValue("$id", id);
        return cmd.ExecuteNonQuery() == 1;
    }

    private static void Bind(SqliteCommand cmd, HospedeInput h)
    {
        string T(string? v) => (v ?? "").Trim();
        cmd.Parameters.AddWithValue("$tipo", HospedeRegras.Tipo(h.tipo));
        cmd.Parameters.AddWithValue("$nome", T(h.nome));
        cmd.Parameters.AddWithValue("$fantasia", T(h.nome_fantasia));
        cmd.Parameters.AddWithValue("$doc", T(h.documento));
        cmd.Parameters.AddWithValue("$chave", HospedeRegras.Chave(h.documento));
        cmd.Parameters.AddWithValue("$ie", T(h.inscricao_estadual));
        cmd.Parameters.AddWithValue("$fone", T(h.telefone));
        cmd.Parameters.AddWithValue("$email", T(h.email));
        cmd.Parameters.AddWithValue("$nasc", T(h.data_nascimento));
        cmd.Parameters.AddWithValue("$cep", T(h.cep));
        cmd.Parameters.AddWithValue("$logr", T(h.logradouro));
        cmd.Parameters.AddWithValue("$num", T(h.numero));
        cmd.Parameters.AddWithValue("$compl", T(h.complemento));
        cmd.Parameters.AddWithValue("$bairro", T(h.bairro));
        cmd.Parameters.AddWithValue("$cidade", T(h.cidade));
        cmd.Parameters.AddWithValue("$uf", T(h.uf).ToUpperInvariant());
        cmd.Parameters.AddWithValue("$obs", T(h.observacao));
        cmd.Parameters.AddWithValue("$ativo", h.ativo == false ? 0 : 1);
        cmd.Parameters.AddWithValue("$agora", DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss"));
    }

    /// <summary>Quantas reservas o hóspede tem (0 enquanto a tabela reservas não existir).</summary>
    public long ContarReservas(long id)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM pragma_table_info('reservas') WHERE name='id_hospede'";
        if (Convert.ToInt64(cmd.ExecuteScalar()) == 0) return 0;
        cmd.CommandText = "SELECT COUNT(*) FROM reservas WHERE id_hospede=$id";
        cmd.Parameters.AddWithValue("$id", id);
        return Convert.ToInt64(cmd.ExecuteScalar());
    }

    public bool Excluir(long id)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "DELETE FROM hospedes WHERE id_hospede=$id";
        cmd.Parameters.AddWithValue("$id", id);
        return cmd.ExecuteNonQuery() == 1;
    }
}

/// <summary>Regras de validação do hóspede (usadas na inclusão, alteração e no cadastro por CNPJ).</summary>
public static class HospedeRegras
{
    public static string Digitos(string? v) => new((v ?? "").Where(char.IsAsciiDigit).ToArray());
    public static string Chave(string? v) => new((v ?? "").Where(char.IsAsciiLetterOrDigit).Select(char.ToUpperInvariant).ToArray());
    public static string Tipo(string? v) => string.Equals((v ?? "").Trim(), "PJ", StringComparison.OrdinalIgnoreCase) ? "PJ" : "PF";

    public static bool CnpjValido(string? valor)
    {
        var v = Digitos(valor);
        if (v.Length != 14 || v.All(c => c == v[0])) return false;
        int Digito(int tamanho)
        {
            int peso = tamanho - 7, soma = 0;
            for (var i = 0; i < tamanho; i++) { soma += (v[i] - '0') * peso; peso = peso < 3 ? 9 : peso - 1; }
            var resto = soma % 11;
            return resto < 2 ? 0 : 11 - resto;
        }
        return Digito(12) == v[12] - '0' && Digito(13) == v[13] - '0';
    }

    /// <summary>Devolve a primeira mensagem de erro, ou null quando está tudo certo.</summary>
    public static string? Validar(HospedeInput h)
    {
        var tipo = Tipo(h.tipo);
        var nome = (h.nome ?? "").Trim();
        if (nome.Length < 3) return tipo == "PJ" ? "Informe a razão social da empresa (mínimo 3 letras)." : "Informe o nome do hóspede (mínimo 3 letras).";
        if (nome.Length > 150) return "Nome muito longo (máximo 150 caracteres).";
        var fone = Digitos(h.telefone);
        if (tipo == "PF" && fone.Length < 10) return "Informe o telefone com DDD (10 ou 11 números).";
        if (fone.Length > 0 && fone.Length < 10) return "Telefone incompleto: informe com DDD.";
        if (tipo == "PJ" && Digitos(h.documento).Length > 0 && !CnpjValido(h.documento)) return "CNPJ inválido.";
        var email = (h.email ?? "").Trim();
        if (email.Length > 0 && !Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$")) return "E-mail inválido.";
        var uf = (h.uf ?? "").Trim();
        if (uf.Length > 0 && !Regex.IsMatch(uf, "^[A-Za-z]{2}$")) return "UF deve ter 2 letras (ex.: SP).";
        var nasc = (h.data_nascimento ?? "").Trim();
        if (nasc.Length > 0 && !DateOnly.TryParseExact(nasc, "yyyy-MM-dd", out _)) return "Data de nascimento inválida.";
        return null;
    }
}

public sealed record Hospede(long id_hospede, string tipo, string nome, string nome_fantasia, string documento,
    string inscricao_estadual, string telefone, string email, string data_nascimento, string cep, string logradouro,
    string numero, string complemento, string bairro, string cidade, string uf, string observacao, bool ativo,
    string criado_em, string alterado_em);

public sealed record HospedeInput(string? tipo, string? nome, string? nome_fantasia, string? documento,
    string? inscricao_estadual, string? telefone, string? email, string? data_nascimento, string? cep, string? logradouro,
    string? numero, string? complemento, string? bairro, string? cidade, string? uf, string? observacao, bool? ativo);

public sealed record EmpresaCnpjInput(string? cnpj);

/// <summary>Rotas /api/hospedes. Recebe de Program.cs quem está logado e a permissão do item de menu.</summary>
public static class HospedesEndpoints
{
    /// <param name="logado">devolve (id, administrador) do Bearer, ou null quando não está logado.</param>
    /// <param name="permissao">(idUsuario) → exceções do item cad_hospedes (null = sem restrição).</param>
    public static void MapHospedes(this WebApplication app, IHospedesRepository repo,
        Func<HttpRequest, (long id, bool admin)?> logado, Func<long, MenuPermission?> permissao)
    {
        IResult Nao401() => Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
        IResult Nao403(string acao) => Results.Json(new { ok = false, erro = $"Seu usuário não tem permissão para {acao} hóspedes." }, statusCode: 403);
        // null = pode seguir; senão o erro (401/403). acao: incluir | alterar | excluir | null (só consultar).
        IResult? Checar(HttpRequest req, string? acao)
        {
            if (logado(req) is not { } u) return Nao401();
            if (u.admin || acao is null) return null;
            var p = permissao(u.id);
            if (p is null) return null;
            if (p.ativo == 0 || p.oculto == 1 || p.desabilitado == 1) return Nao403("acessar");
            return acao switch
            {
                "incluir" when p.incluir == 0 => Nao403("incluir"),
                "alterar" when p.alterar == 0 => Nao403("alterar"),
                "excluir" when p.excluir == 0 => Nao403("excluir"),
                _ => null
            };
        }

        app.MapGet("/api/hospedes", (HttpRequest req, string? busca, int? ativo, string? tipo, string? cidade, string? uf) =>
            Checar(req, null) ?? Results.Ok(new { ok = true, dados = repo.Listar(busca, ativo is null ? null : ativo != 0, tipo, cidade, uf) }));

        app.MapGet("/api/hospedes/{id:long}", (HttpRequest req, long id) =>
        {
            if (Checar(req, null) is { } negado) return negado;
            return repo.Obter(id) is { } h ? Results.Ok(new { ok = true, dados = h }) : Results.NotFound(new { ok = false, erro = "Hóspede não encontrado." });
        });

        app.MapPost("/api/hospedes", (HttpRequest req, HospedeInput input) =>
        {
            if (Checar(req, "incluir") is { } negado) return negado;
            if (HospedeRegras.Validar(input) is { } erro) return Results.BadRequest(new { ok = false, erro });
            if (repo.PorDocumento(input.documento ?? "") is { } outro)
                return Results.Conflict(new { ok = false, erro = $"Já existe hóspede com esse documento: {outro.nome}." });
            var id = repo.Incluir(input);
            return Results.Ok(new { ok = true, id_hospede = id });
        });

        app.MapPut("/api/hospedes/{id:long}", (HttpRequest req, long id, HospedeInput input) =>
        {
            if (Checar(req, "alterar") is { } negado) return negado;
            if (repo.Obter(id) is null) return Results.NotFound(new { ok = false, erro = "Hóspede não encontrado." });
            if (HospedeRegras.Validar(input) is { } erro) return Results.BadRequest(new { ok = false, erro });
            if (repo.PorDocumento(input.documento ?? "", id) is { } outro)
                return Results.Conflict(new { ok = false, erro = $"Já existe outro hóspede com esse documento: {outro.nome}." });
            repo.Alterar(id, input);
            return Results.Ok(new { ok = true, id_hospede = id });
        });

        app.MapDelete("/api/hospedes/{id:long}", (HttpRequest req, long id) =>
        {
            if (Checar(req, "excluir") is { } negado) return negado;
            if (repo.Obter(id) is null) return Results.NotFound(new { ok = false, erro = "Hóspede não encontrado." });
            if (repo.ContarReservas(id) > 0)
                return Results.Conflict(new { ok = false, erro = "Este hóspede já tem reserva: inative em vez de excluir." });
            repo.Excluir(id);
            return Results.Ok(new { ok = true, id_hospede = id });
        });

        /* CEP DO FORMULÁRIO — mesma consulta da rota /api/cep/{cep} (PublicLookupService), dentro de /api/hospedes para a
         * tela aberta como arquivo poder chamar. Daniel, 08/11/2026: "também tem a rota de consulta de CEP". Só consulta. */
        app.MapGet("/api/hospedes/cep/{cep}", async (HttpRequest req, string cep, PublicLookupService lookup, CancellationToken ct) =>
        {
            if (Checar(req, null) is { } negado) return negado;
            try { return Results.Ok(new { ok = true, dados = await lookup.CepAsync(cep, ct) }); }
            catch (ArgumentException ex) { return Results.BadRequest(new { ok = false, erro = ex.Message }); }
            catch (KeyNotFoundException) { return Results.NotFound(new { ok = false, erro = "CEP não encontrado." }); }
            catch (HttpRequestException) { return Results.Json(new { ok = false, erro = "Consulta de CEP indisponível agora." }, statusCode: 502); }
            catch (TaskCanceledException) { return Results.Json(new { ok = false, erro = "A consulta do CEP demorou demais." }, statusCode: 504); }
        });

        /* EMPRESA POR CNPJ — o usuário informa só o CNPJ; a API busca os dados públicos e cadastra a empresa (PJ).
         * Daniel, 08/11/2026: "somente pede o CNPJ e o sistema cadastra sozinho". */
        app.MapPost("/api/hospedes/empresa-por-cnpj", async (HttpRequest req, EmpresaCnpjInput input, PublicLookupService lookup, CancellationToken ct) =>
        {
            if (Checar(req, "incluir") is { } negado) return negado;
            var cnpj = HospedeRegras.Digitos(input.cnpj);
            if (!HospedeRegras.CnpjValido(cnpj)) return Results.BadRequest(new { ok = false, erro = "CNPJ inválido. Confira os 14 números." });
            if (repo.PorDocumento(cnpj) is { } ja)
                return Results.Conflict(new { ok = false, erro = $"Esta empresa já está cadastrada: {ja.nome}.", id_hospede = ja.id_hospede });
            PublicCompanyView e;
            try { e = await lookup.CnpjAsync(cnpj, ct); }
            catch (KeyNotFoundException) { return Results.NotFound(new { ok = false, erro = "CNPJ não encontrado na Receita." }); }
            catch (HttpRequestException) { return Results.Json(new { ok = false, erro = "Consulta do CNPJ indisponível agora (sem internet?). Tente de novo ou cadastre manualmente." }, statusCode: 502); }
            catch (TaskCanceledException) { return Results.Json(new { ok = false, erro = "A consulta do CNPJ demorou demais. Tente de novo." }, statusCode: 504); }
            var fone = HospedeRegras.Digitos(e.Telefone);
            var dados = new HospedeInput("PJ", string.IsNullOrWhiteSpace(e.RazaoSocial) ? e.NomeFantasia : e.RazaoSocial, e.NomeFantasia,
                FormatarCnpj(cnpj), e.InscricaoEstadual, fone.Length >= 10 ? FormatarFone(fone) : "", e.Email.ToLowerInvariant(), "",
                e.Cep, e.Endereco, e.Numero, e.Complemento, e.Bairro, e.Cidade, e.Uf, "Cadastrada pelo CNPJ em " + DateTime.Now.ToString("dd/MM/yyyy HH:mm") + ".", true);
            if (!System.Text.RegularExpressions.Regex.IsMatch(dados.email ?? "", @"^[^@\s]+@[^@\s]+\.[^@\s]+$")) dados = dados with { email = "" };
            if (HospedeRegras.Validar(dados) is { } erro) return Results.BadRequest(new { ok = false, erro = "Dados da Receita incompletos: " + erro });
            var id = repo.Incluir(dados);
            return Results.Ok(new { ok = true, id_hospede = id, dados = repo.Obter(id) });
        });
    }

    private static string FormatarCnpj(string d) => $"{d[..2]}.{d[2..5]}.{d[5..8]}/{d[8..12]}-{d[12..]}";
    private static string FormatarFone(string d) => d.Length == 11 ? $"({d[..2]}) {d[2..7]}-{d[7..]}" : $"({d[..2]}) {d[2..6]}-{d[6..]}";
}
