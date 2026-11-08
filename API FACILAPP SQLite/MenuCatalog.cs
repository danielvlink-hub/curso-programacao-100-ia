using Microsoft.Data.Sqlite;

namespace FacilApp.Sqlite.Api;

/*
 * CATÁLOGO DE MENU — mesma estrutura do Gourmet (Daniel, 03/11/2026: "criar o cadastro de menus igual está no SQL").
 *
 * O QUE FAZ
 *   Guarda no SQLite da API todos os itens de menu do FastPousada e, por usuário, só as EXCEÇÕES (o que foi
 *   bloqueado). Monta o menu pronto para a tela (formato do index.html do Gourmet) e oferece o CRUD do catálogo
 *   e das exceções para as telas Acessos e Usuários.
 *
 * TABELAS (iguais ao Gourmet, PS1/criar_menu_direto_sqlite.ps1 + coluna desabilitado_padrao):
 *   menu_catalogo_itens(id_item, tipo_menu, id_pai, codigo, rotulo, icone, icone_tipo, coluna, ordem,
 *                       arquivo_destino, button_id, ativo_padrao, desabilitado_padrao)
 *     - tipo_menu 'lateral': linha SEM id_pai = módulo (caixa do mega menu); COM id_pai = item do módulo.
 *     - tipo_menu 'superior': atalho da barra de cima (lista plana).
 *     - tipo_menu 'dashboard': painel aberto no palco ao entrar (extra do curso; o Gourmet não usa).
 *     - ativo_padrao 0 = OCULTO para todos (some do menu). desabilitado_padrao 1 = aparece cinza, sem clique
 *       (no curso: tela prevista para uma próxima aula).
 *   menu_usuarios(id_permissao, id_usuario, id_item, incluir, alterar, excluir, ativo, oculto, desabilitado)
 *     - id_usuario = users.id desta API (no Gourmet é o GUID do Console; aqui o usuário é local).
 *     - SÓ GRAVA O QUE FOGE DO PADRÃO: item liberado e sem restrição não vira linha. Sem linha = liberado.
 *       Motivo (regra do Gourmet): com catálogo + exceção, o pior caso é ver itens demais, nunca ficar sem menu.
 *
 * MIGRAÇÃO
 *   A 1ª versão (0.1.x) tinha outra estrutura (id TEXT, modulo, titulo...). Se ela for encontrada, as tabelas
 *   antigas são RENOMEADAS para *_v1 (nada é apagado) e o catálogo novo é criado com a carga do organograma.
 *
 * CARGA INICIAL
 *   Só quando o catálogo está VAZIO (1ª vez). Depois disso o catálogo é do administrador: o que ele excluir ou
 *   mudar na tela Acessos não volta sozinho no próximo início do serviço.
 *
 * CUIDADOS
 *   Toda consulta é parametrizada; não existe rota de SQL livre (AGENTS.md). Código SQLite-específico fica
 *   aqui; outro banco exige outra implementação e testes próprios.
 */
public sealed class MenuCatalog(string databasePath)
{
    public static readonly string[] TiposMenu = ["lateral", "superior", "dashboard"];

    private SqliteConnection Open()
    {
        var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = databasePath }.ToString());
        db.Open();
        using var fk = db.CreateCommand();
        fk.CommandText = "PRAGMA foreign_keys = ON";
        fk.ExecuteNonQuery();
        return db;
    }

    // ------------------------------------------------------------------ estrutura + migração + carga
    public void Initialize()
    {
        using var db = Open();
        using var tx = db.BeginTransaction();
        using var cmd = db.CreateCommand();
        cmd.Transaction = tx;

        // 1) Estrutura antiga (0.1.x)? Guarda como *_v1 antes de criar a nova.
        if (ColumnExists(cmd, "menu_catalogo_itens", "titulo"))
        {
            cmd.CommandText = """
                DROP INDEX IF EXISTS ix_menu_tipo_ordem;
                ALTER TABLE menu_usuarios RENAME TO menu_usuarios_v1;
                ALTER TABLE menu_catalogo_itens RENAME TO menu_catalogo_itens_v1;
                """;
            cmd.ExecuteNonQuery();
        }

        // 2) Estrutura do Gourmet.
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS menu_catalogo_itens (
                id_item INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo_menu TEXT NOT NULL,
                id_pai INTEGER NULL,
                codigo TEXT NOT NULL,
                rotulo TEXT NOT NULL,
                icone TEXT NULL,
                icone_tipo TEXT NULL,
                coluna INTEGER NULL,
                ordem INTEGER NULL,
                arquivo_destino TEXT NULL,
                button_id TEXT NULL,
                ativo_padrao INTEGER NULL,
                desabilitado_padrao INTEGER NULL
            );
            CREATE TABLE IF NOT EXISTS menu_usuarios (
                id_permissao INTEGER PRIMARY KEY AUTOINCREMENT,
                id_usuario INTEGER NOT NULL,
                id_item INTEGER NOT NULL,
                incluir INTEGER NULL,
                alterar INTEGER NULL,
                excluir INTEGER NULL,
                ativo INTEGER NULL,
                oculto INTEGER NULL,
                desabilitado INTEGER NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ux_menu_catalogo_codigo ON menu_catalogo_itens(codigo);
            CREATE INDEX IF NOT EXISTS ix_menu_catalogo_pai ON menu_catalogo_itens(tipo_menu, id_pai, ordem);
            CREATE UNIQUE INDEX IF NOT EXISTS ux_menu_usuarios_item ON menu_usuarios(id_usuario, id_item);
            """;
        cmd.ExecuteNonQuery();

        // 3) Carga inicial (organograma do FastPousada), só com o catálogo vazio.
        cmd.CommandText = "SELECT COUNT(*) FROM menu_catalogo_itens";
        if (Convert.ToInt64(cmd.ExecuteScalar()) == 0) Seed(cmd);

        tx.Commit();
    }

    private static bool ColumnExists(SqliteCommand cmd, string table, string column)
    {
        cmd.CommandText = $"PRAGMA table_info({table})";   // nome fixo no código, nunca vindo do usuário
        using var r = cmd.ExecuteReader();
        while (r.Read()) if (string.Equals(r.GetString(1), column, StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    // Módulo -> itens. desabilitado = tela ainda não feita nas aulas (aparece cinza no menu).
    private static readonly (string codigo, string rotulo, int coluna, (string codigo, string rotulo, string arquivo, string icone, bool desabilitado)[] itens)[] SeedModulos =
    [
        ("mod_cadastros", "Cadastros", 1, [
            ("cad_hospedes", "Hóspedes", "", "person", true),
            ("cad_tipos_quarto", "Tipos de quarto", "", "bed", true),
            ("cad_quartos", "Quartos", "", "meeting_room", true),
            ("cad_tarifas", "Tarifas", "", "sell", true),
            ("cad_servicos", "Serviços e produtos", "", "room_service", true),
            ("cad_pagamentos", "Formas de pagamento", "", "credit_card", true)]),
        ("mod_operacao", "Operação", 2, [
            ("op_reservas", "Reservas", "", "event", true),
            ("op_ocupacao", "Mapa de ocupação", "", "grid_view", true),
            ("op_checkin", "Check-in", "", "login", true),
            ("op_estadia", "Estadia e consumos", "", "receipt_long", true),
            ("op_checkout", "Check-out", "", "logout", true)]),
        ("mod_financeiro", "Financeiro", 3, [
            ("fin_caixa", "Caixa", "", "point_of_sale", true),
            ("fin_recebimentos", "Recebimentos", "", "paid", true)]),
        ("mod_relatorios", "Relatórios", 3, [
            ("rel_ocupacao", "Ocupação", "", "analytics", true),
            ("rel_faturamento", "Faturamento", "", "bar_chart", true)]),
        ("mod_administracao", "Administração", 4, [
            ("adm_usuarios", "Usuários", "usuarios.html", "group", false),
            ("adm_acessos", "Acessos", "acessos.html", "admin_panel_settings", false),
            ("adm_config", "Configurações", "", "settings", true)])
    ];

    private static void Seed(SqliteCommand cmd)
    {
        var ordemModulo = 10;
        foreach (var (codigo, rotulo, coluna, itens) in SeedModulos)
        {
            var idModulo = InsertSeed(cmd, "lateral", null, codigo, rotulo, "", coluna, ordemModulo, "", false);
            ordemModulo += 10;
            var ordemItem = 10;
            foreach (var item in itens)
            {
                InsertSeed(cmd, "lateral", idModulo, item.codigo, item.rotulo, item.icone, 0, ordemItem, item.arquivo, item.desabilitado);
                ordemItem += 10;
            }
        }
        InsertSeed(cmd, "superior", null, "sup_inicio", "Início", "home", 0, 10, "DASHBOARDS/resumo.html", false);
        InsertSeed(cmd, "superior", null, "sup_reservas", "Reservas", "event", 0, 20, "", true);
        InsertSeed(cmd, "superior", null, "sup_ocupacao", "Mapa", "grid_view", 0, 30, "", true);
        InsertSeed(cmd, "superior", null, "sup_checkin", "Check-in", "login", 0, 40, "", true);
        InsertSeed(cmd, "superior", null, "sup_checkout", "Check-out", "logout", 0, 50, "", true);
        // DASHBOARDS do curso (Daniel, 03/11/2026: "dados do antigo curso que temos de remasterizar" / "e pôr como
        // dashboard no menu" / "as dashboards estarão Módulo I, Módulo II e etc."). Vieram de C:\FacilApp\Curso\COWORK-SQLITE\DASHBOARDS. O 1º abre no palco ao entrar.
        var ordemDash = 10;
        foreach (var (codigo, rotulo, arquivo, icone) in SeedDashboards)
        {
            InsertSeed(cmd, "dashboard", null, codigo, rotulo, icone, 0, ordemDash, arquivo, false);
            ordemDash += 10;
        }
    }

    private static readonly (string codigo, string rotulo, string arquivo, string icone)[] SeedDashboards =
    [
        ("dash_resumo", "Módulo I", "DASHBOARDS/resumo.html", "dashboard"),
        ("dash_conversar_ia", "Módulo II", "DASHBOARDS/como_conversar_ia.html", "forum"),
        ("dash_telas", "Módulo III", "DASHBOARDS/telas_interfaces_frontend.html", "web"),
        ("dash_projetos", "Módulo IV", "DASHBOARDS/projetos_que_funcionam.html", "task_alt"),
        ("dash_plataformas", "Módulo V", "DASHBOARDS/desktop_web_mobile.html", "devices"),
        ("dash_integracoes", "Módulo VI", "DASHBOARDS/integracoes_dados_publicacao.html", "hub")
        // Descanso saiu da faixa (Daniel, 04/11/2026: igual ao DashboardData.js do curso antigo, só Módulo I…VI).
    ];

    private static long InsertSeed(SqliteCommand cmd, string tipo, long? pai, string codigo, string rotulo, string icone,
        int coluna, int ordem, string arquivo, bool desabilitado)
    {
        cmd.Parameters.Clear();
        cmd.CommandText = """
            INSERT INTO menu_catalogo_itens
              (tipo_menu,id_pai,codigo,rotulo,icone,icone_tipo,coluna,ordem,arquivo_destino,button_id,ativo_padrao,desabilitado_padrao)
            VALUES ($tipo,$pai,$codigo,$rotulo,$icone,'material',$coluna,$ordem,$arquivo,NULL,1,$desab);
            SELECT last_insert_rowid();
            """;
        cmd.Parameters.AddWithValue("$tipo", tipo);
        cmd.Parameters.AddWithValue("$pai", (object?)pai ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$codigo", codigo);
        cmd.Parameters.AddWithValue("$rotulo", rotulo);
        cmd.Parameters.AddWithValue("$icone", icone);
        cmd.Parameters.AddWithValue("$coluna", coluna);
        cmd.Parameters.AddWithValue("$ordem", ordem);
        cmd.Parameters.AddWithValue("$arquivo", arquivo);
        cmd.Parameters.AddWithValue("$desab", desabilitado ? 1 : 0);
        var id = Convert.ToInt64(cmd.ExecuteScalar());
        cmd.Parameters.Clear();
        return id;
    }

    // ------------------------------------------------------------------ leitura do catálogo
    private static CatalogItem ReadItem(SqliteDataReader r) => new(
        r.GetInt64(0), r.GetString(1), r.IsDBNull(2) ? null : r.GetInt64(2), r.GetString(3), r.GetString(4),
        r.IsDBNull(5) ? "" : r.GetString(5), r.IsDBNull(6) ? "" : r.GetString(6), r.IsDBNull(7) ? 0 : r.GetInt32(7),
        r.IsDBNull(8) ? 0 : r.GetInt32(8), r.IsDBNull(9) ? "" : r.GetString(9), r.IsDBNull(10) ? "" : r.GetString(10),
        r.IsDBNull(11) ? 1 : r.GetInt32(11), r.IsDBNull(12) ? 0 : r.GetInt32(12));

    private const string SelectItem = """
        SELECT id_item,tipo_menu,id_pai,codigo,rotulo,icone,icone_tipo,coluna,ordem,arquivo_destino,button_id,
               ativo_padrao,desabilitado_padrao
        FROM menu_catalogo_itens
        """;

    /// <summary>Catálogo inteiro, em ordem (módulos antes dos filhos). Usado pela tela Acessos.</summary>
    public IReadOnlyList<CatalogItem> ListAll()
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = SelectItem + " ORDER BY tipo_menu, COALESCE(id_pai,0), ordem, id_item";
        using var r = cmd.ExecuteReader();
        var list = new List<CatalogItem>();
        while (r.Read()) list.Add(ReadItem(r));
        return list;
    }

    public CatalogItem? Get(long id)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = SelectItem + " WHERE id_item=$id";
        cmd.Parameters.AddWithValue("$id", id);
        using var r = cmd.ExecuteReader();
        return r.Read() ? ReadItem(r) : null;
    }

    // ------------------------------------------------------------------ CRUD do catálogo (tela Acessos)
    /// <summary>Valida o item; devolve a mensagem de erro ou null quando está tudo certo.</summary>
    public string? Validate(CatalogInput i, long? idAtual)
    {
        if (!TiposMenu.Contains(i.tipo_menu)) return "tipo_menu deve ser lateral, superior ou dashboard.";
        if (string.IsNullOrWhiteSpace(i.codigo) || i.codigo.Trim().Length > 80) return "Código obrigatório (até 80 caracteres).";
        if (string.IsNullOrWhiteSpace(i.rotulo) || i.rotulo.Trim().Length > 120) return "Rótulo obrigatório (até 120 caracteres).";
        var arquivo = (i.arquivo_destino ?? "").Trim();
        if (arquivo.Length > 0 && arquivo != "api-console" &&
            (arquivo.Contains("..") || !System.Text.RegularExpressions.Regex.IsMatch(arquivo, @"^[A-Za-z0-9_./-]+\.html([?#].*)?$")))
            return "Arquivo de destino deve ser uma tela .html dentro da pasta do sistema.";
        if (i.id_pai is { } pai)
        {
            if (i.tipo_menu != "lateral") return "Só itens do menu lateral têm módulo (id_pai).";
            if (idAtual == pai) return "Um item não pode ser pai dele mesmo.";
            var modulo = Get(pai);
            if (modulo is null || modulo.tipo_menu != "lateral" || modulo.id_pai is not null) return "Módulo (id_pai) não encontrado.";
        }
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM menu_catalogo_itens WHERE codigo=$c AND id_item<>$id";
        cmd.Parameters.AddWithValue("$c", i.codigo.Trim());
        cmd.Parameters.AddWithValue("$id", idAtual ?? 0);
        if (Convert.ToInt64(cmd.ExecuteScalar()) > 0) return "Já existe item com esse código.";
        return null;
    }

    public long Insert(CatalogInput i)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            INSERT INTO menu_catalogo_itens
              (tipo_menu,id_pai,codigo,rotulo,icone,icone_tipo,coluna,ordem,arquivo_destino,button_id,ativo_padrao,desabilitado_padrao)
            VALUES ($tipo,$pai,$codigo,$rotulo,$icone,$iconeTipo,$coluna,$ordem,$arquivo,$button,$ativo,$desab);
            SELECT last_insert_rowid();
            """;
        Bind(cmd, i);
        return Convert.ToInt64(cmd.ExecuteScalar());
    }

    public bool Update(long id, CatalogInput i)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            UPDATE menu_catalogo_itens SET tipo_menu=$tipo,id_pai=$pai,codigo=$codigo,rotulo=$rotulo,icone=$icone,
              icone_tipo=$iconeTipo,coluna=$coluna,ordem=$ordem,arquivo_destino=$arquivo,button_id=$button,
              ativo_padrao=$ativo,desabilitado_padrao=$desab
            WHERE id_item=$id
            """;
        Bind(cmd, i);
        cmd.Parameters.AddWithValue("$id", id);
        return cmd.ExecuteNonQuery() == 1;
    }

    private static void Bind(SqliteCommand cmd, CatalogInput i)
    {
        cmd.Parameters.AddWithValue("$tipo", i.tipo_menu);
        cmd.Parameters.AddWithValue("$pai", (object?)i.id_pai ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$codigo", i.codigo.Trim());
        cmd.Parameters.AddWithValue("$rotulo", i.rotulo.Trim());
        cmd.Parameters.AddWithValue("$icone", (i.icone ?? "").Trim());
        cmd.Parameters.AddWithValue("$iconeTipo", string.IsNullOrWhiteSpace(i.icone_tipo) ? "material" : i.icone_tipo.Trim());
        cmd.Parameters.AddWithValue("$coluna", i.coluna ?? 0);
        cmd.Parameters.AddWithValue("$ordem", i.ordem ?? 0);
        cmd.Parameters.AddWithValue("$arquivo", (i.arquivo_destino ?? "").Trim());
        cmd.Parameters.AddWithValue("$button", string.IsNullOrWhiteSpace(i.button_id) ? DBNull.Value : i.button_id.Trim());
        cmd.Parameters.AddWithValue("$ativo", i.ativo_padrao ?? 1);
        cmd.Parameters.AddWithValue("$desab", i.desabilitado_padrao ?? 0);
    }

    /// <summary>Exclui o item, os filhos (quando é módulo) e as exceções ligadas a eles.</summary>
    public int Delete(long id)
    {
        using var db = Open();
        using var tx = db.BeginTransaction();
        using var cmd = db.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = """
            DELETE FROM menu_usuarios WHERE id_item=$id OR id_item IN (SELECT id_item FROM menu_catalogo_itens WHERE id_pai=$id);
            DELETE FROM menu_catalogo_itens WHERE id_pai=$id;
            DELETE FROM menu_catalogo_itens WHERE id_item=$id;
            SELECT changes();
            """;
        cmd.Parameters.AddWithValue("$id", id);
        var apagou = Convert.ToInt32(cmd.ExecuteScalar());
        tx.Commit();
        return apagou;
    }

    // ------------------------------------------------------------------ exceções por usuário (tela Usuários)
    public IReadOnlyList<MenuPermission> ListPermissions(long userId)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            SELECT id_item,COALESCE(incluir,1),COALESCE(alterar,1),COALESCE(excluir,1),COALESCE(ativo,1),
                   COALESCE(oculto,0),COALESCE(desabilitado,0)
            FROM menu_usuarios WHERE id_usuario=$u ORDER BY id_item
            """;
        cmd.Parameters.AddWithValue("$u", userId);
        using var r = cmd.ExecuteReader();
        var list = new List<MenuPermission>();
        while (r.Read()) list.Add(new(r.GetInt64(0), r.GetInt32(1), r.GetInt32(2), r.GetInt32(3), r.GetInt32(4), r.GetInt32(5), r.GetInt32(6)));
        return list;
    }

    /// <summary>Regrava as exceções do usuário. Só grava o que foge do padrão. Devolve quantas ficaram.</summary>
    public int SavePermissions(long userId, IEnumerable<MenuPermission> permissoes)
    {
        using var db = Open();
        using var tx = db.BeginTransaction();
        using var cmd = db.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = "DELETE FROM menu_usuarios WHERE id_usuario=$u";
        cmd.Parameters.AddWithValue("$u", userId);
        cmd.ExecuteNonQuery();
        var gravadas = 0;
        foreach (var p in permissoes.GroupBy(x => x.id_item).Select(g => g.Last()))
        {
            var ehPadrao = p.ativo == 1 && p.oculto == 0 && p.desabilitado == 0 && p.incluir == 1 && p.alterar == 1 && p.excluir == 1;
            if (ehPadrao) continue;
            cmd.Parameters.Clear();
            cmd.CommandText = """
                INSERT INTO menu_usuarios(id_usuario,id_item,incluir,alterar,excluir,ativo,oculto,desabilitado)
                SELECT $u,$i,$inc,$alt,$exc,$atv,$ocu,$des WHERE EXISTS(SELECT 1 FROM menu_catalogo_itens WHERE id_item=$i)
                """;
            cmd.Parameters.AddWithValue("$u", userId);
            cmd.Parameters.AddWithValue("$i", p.id_item);
            cmd.Parameters.AddWithValue("$inc", p.incluir != 0 ? 1 : 0);
            cmd.Parameters.AddWithValue("$alt", p.alterar != 0 ? 1 : 0);
            cmd.Parameters.AddWithValue("$exc", p.excluir != 0 ? 1 : 0);
            cmd.Parameters.AddWithValue("$atv", p.ativo != 0 ? 1 : 0);
            cmd.Parameters.AddWithValue("$ocu", p.oculto != 0 ? 1 : 0);
            cmd.Parameters.AddWithValue("$des", p.desabilitado != 0 ? 1 : 0);
            gravadas += cmd.ExecuteNonQuery();
        }
        tx.Commit();
        return gravadas;
    }

    public void DeletePermissionsOfUser(long userId)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "DELETE FROM menu_usuarios WHERE id_usuario=$u";
        cmd.Parameters.AddWithValue("$u", userId);
        cmd.ExecuteNonQuery();
    }

    // ------------------------------------------------------------------ menu pronto para a tela
    /*
     * GetForUser — formato do index.html do Gourmet (carregarMenuCatalogoDoBanco):
     *   lateral:   [{ id, id_item, module, column, icon, hide, disable, ativo, submenu:[{ id, id_item, title, path, url,
     *               icon, hide, disable, ativo, incluir, alterar, excluir }] }]
     *   superior:  [{ id, id_item, title, path, icon, iconType, buttonId, hide, disable, ativo }]
     *   dashboards:[{ id, id_item, title, path, icon, hide, disable, ativo }]
     * (Só "ativo" minúsculo: o JSON da API usa camelCase e "Ativo" colidiria; o index do Gourmet lê item.Ativo ?? item.ativo.)
 * REGRAS: hide = ativo_padrao 0 OU exceção oculto 1 OU exceção ativo 0. disable = desabilitado_padrao 1 OU
     * exceção desabilitado 1 (no curso o item desabilitado APARECE cinza: "tela de uma próxima aula").
     * Módulo escondido esconde os filhos; módulo desabilitado desabilita os filhos.
     */
    public object GetForUser(long userId)
    {
        var itens = ListAll();
        var excecoes = ListPermissions(userId).ToDictionary(p => p.id_item);
        (bool hide, bool disable, MenuPermission? exc) Flags(CatalogItem i)
        {
            excecoes.TryGetValue(i.id_item, out var e);
            var hide = i.ativo_padrao == 0 || (e is not null && (e.oculto == 1 || e.ativo == 0));
            var disable = i.desabilitado_padrao == 1 || (e is not null && e.desabilitado == 1);
            return (hide, disable, e);
        }

        var lateral = itens.Where(i => i.tipo_menu == "lateral" && i.id_pai is null).OrderBy(i => i.ordem).Select(m =>
        {
            var fm = Flags(m);
            var submenu = itens.Where(i => i.tipo_menu == "lateral" && i.id_pai == m.id_item).OrderBy(i => i.ordem).Select(i =>
            {
                var f = Flags(i);
                var hide = fm.hide || f.hide;
                var disable = fm.disable || f.disable;
                return new
                {
                    id = i.codigo, i.id_item, title = i.rotulo, path = i.arquivo_destino, url = i.arquivo_destino, icon = i.icone,
                    hide, disable, ativo = !hide,
                    incluir = f.exc?.incluir ?? 1, alterar = f.exc?.alterar ?? 1, excluir = f.exc?.excluir ?? 1
                };
            }).ToList();
            return new { id = m.codigo, m.id_item, module = m.rotulo, column = m.coluna, icon = m.icone,
                hide = fm.hide, disable = fm.disable, ativo = !fm.hide, submenu };
        }).ToList();

        object Plano(CatalogItem i)
        {
            var f = Flags(i);
            return new { id = i.codigo, i.id_item, title = i.rotulo, path = i.arquivo_destino, icon = i.icone,
                iconType = i.icone_tipo, buttonId = i.button_id, hide = f.hide, disable = f.disable, ativo = !f.hide };
        }
        var superior = itens.Where(i => i.tipo_menu == "superior").OrderBy(i => i.ordem).Select(Plano).ToList();
        var dashboards = itens.Where(i => i.tipo_menu == "dashboard").OrderBy(i => i.ordem).Select(Plano).ToList();
        return new { lateral, superior, dashboards };
    }
}

public sealed record CatalogItem(long id_item, string tipo_menu, long? id_pai, string codigo, string rotulo, string icone,
    string icone_tipo, int coluna, int ordem, string arquivo_destino, string button_id, int ativo_padrao, int desabilitado_padrao);

public sealed record CatalogInput(string tipo_menu, long? id_pai, string codigo, string rotulo, string? icone, string? icone_tipo,
    int? coluna, int? ordem, string? arquivo_destino, string? button_id, int? ativo_padrao, int? desabilitado_padrao);

public sealed record MenuPermission(long id_item, int incluir, int alterar, int excluir, int ativo, int oculto, int desabilitado);
