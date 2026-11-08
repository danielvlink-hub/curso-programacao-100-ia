using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using FacilApp.Sqlite.Api;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseWindowsService();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpClient("public-lookup", client => client.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddSingleton<PublicLookupService>();
var dataDir = Environment.GetEnvironmentVariable("FACILAPP_DATA_DIR")
    ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "FacilApp", "CursoApiSqlite");
Directory.CreateDirectory(dataDir);
if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
{
    var portText = Environment.GetEnvironmentVariable("FACILAPP_PORT");
    var portFile = Path.Combine(dataDir, "porta.txt");
    if (string.IsNullOrWhiteSpace(portText) && File.Exists(portFile)) portText = File.ReadAllText(portFile).Trim();
    if (string.IsNullOrWhiteSpace(portText)) portText = "7777";
    if (!int.TryParse(portText, out var port) || port is < 1 or > 65535)
        throw new InvalidOperationException("Porta inválida em FACILAPP_PORT ou porta.txt.");
    builder.WebHost.UseUrls($"http://127.0.0.1:{port}");
}
var database = Path.Combine(dataDir, "usuarios.db");
var repository = new SqliteUserRepository(database);
repository.Initialize();
var menuCatalog = new MenuCatalog(database);
menuCatalog.Initialize();
// USUÁRIO DOS ALUNOS (Daniel, 03/11/2026: "sempre deve ir o usuário facilapp e senha 1 no banco para os alunos").
// Decisão explícita do dono do projeto para o CURSO: a API escuta só em 127.0.0.1 e o banco é de estudo.
// É criado como administrador se não existir; se o aluno trocar a senha, a troca é respeitada (não reseta).
// NÃO copiar esta regra para API de cliente/produção.
repository.EnsureUser(CursoUsuarioPadrao.Login, CursoUsuarioPadrao.Senha, "FacilApp (alunos)", isAdmin: true);
var adminUser = Environment.GetEnvironmentVariable("FACILAPP_ADMIN_USER");
var adminPassword = Environment.GetEnvironmentVariable("FACILAPP_ADMIN_PASSWORD");
if (!string.IsNullOrWhiteSpace(adminUser) && !string.IsNullOrWhiteSpace(adminPassword))
    repository.CreateFirstAdmin(adminUser, adminPassword);

var tokens = new TokenService(LoadAuthKey(dataDir));

var app = builder.Build();
// As telas do curso são abertas como arquivo local em C:\CURSO\HTML (Origin: null).
// Libera CORS só para as rotas que essas telas usam (login, menu, usuários); a API continua no loopback.
app.Use(async (context, next) =>
{
    if (context.Request.Headers.Origin == "null" &&
        (context.Request.Path.StartsWithSegments("/auth") || context.Request.Path.StartsWithSegments("/api/menu") ||
         context.Request.Path.StartsWithSegments("/users")))
    {
        context.Response.Headers.AccessControlAllowOrigin = "null";
        context.Response.Headers.AccessControlAllowMethods = "GET, POST, PUT, DELETE, OPTIONS";
        context.Response.Headers.AccessControlAllowHeaders = "Content-Type, Authorization";
        if (HttpMethods.IsOptions(context.Request.Method))
        {
            context.Response.StatusCode = StatusCodes.Status204NoContent;
            return;
        }
    }
    await next();
});
app.UseSwagger();
app.UseSwaggerUI();
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapGet("/status", () => Results.Ok(new { ok = true, servico = "FacilApp SQLite", banco = "SQLite" }));
app.MapGet("/api/cnpj/{cnpj}", (string cnpj, PublicLookupService lookup, CancellationToken ct) =>
    LookupReply(async () => (object)new { ok = true, dados = await lookup.CnpjAsync(cnpj, ct) }));
app.MapGet("/api/cnpj/{cnpj}/completo", (string cnpj, PublicLookupService lookup, CancellationToken ct) =>
    LookupReply(async () => (object)new { ok = true, dados = await lookup.CnpjRawAsync(cnpj, ct) }));
app.MapGet("/api/cep/{cep}", (string cep, PublicLookupService lookup, CancellationToken ct) =>
    LookupReply(async () => (object)new { ok = true, dados = await lookup.CepAsync(cep, ct) }));
app.MapGet("/auth/setup-status", () => Results.Ok(new { precisaUsuarioInicial = !repository.HasUsers() }));
app.MapPost("/auth/setup", (HttpRequest request, UserRequest input) =>
{
    if (request.HttpContext.Connection.RemoteIpAddress is not { } remote || !System.Net.IPAddress.IsLoopback(remote))
        return Results.Json(new { ok = false, erro = "Configuração inicial disponível apenas localmente." }, statusCode: 403);
    if (!ValidName(input.nome) || !ValidUsername(input.login) || string.IsNullOrEmpty(input.senha))
        return Results.BadRequest(new { ok = false, erro = "Nome, login ou senha inválidos; a senha é obrigatória." });
    if (!repository.CreateFirstAdmin(input.login, input.senha, input.nome))
        return Results.Conflict(new { ok = false, erro = "Já existe usuário cadastrado." });
    return Results.Ok(new { ok = true, mensagem = "Primeiro usuário criado. Faça login." });
});
app.MapPost("/auth/login", (LoginRequest input) =>
{
    if (string.IsNullOrWhiteSpace(input.usuario) || string.IsNullOrEmpty(input.senha))
        return Results.BadRequest(new { ok = false, erro = "Usuário e senha obrigatórios." });
    var user = repository.Find(input.usuario);
    if (user is null || !user.Active || !PasswordHasher.Verify(input.senha, user.PasswordHash))
        return Results.Json(new { ok = false, erro = "Credenciais inválidas." }, statusCode: 401);
    return Results.Ok(new { ok = true, accessToken = tokens.Issue(user), tokenType = "Bearer", expiresIn = 3600 });
});
app.MapGet("/auth/me", (HttpRequest request) =>
{
    var user = Authenticate(request);
    if (user is null)
        return Results.Json(new { ok = false, erro = "Usuário inativo ou inexistente." }, statusCode: 401);
    return Results.Ok(new { ok = true, nome = user.Name, login = user.Username, usuario = user.Username, id = user.Id, administrador = user.IsAdmin });
});
app.MapGet("/api/menu", (HttpRequest request) =>
{
    var user = Authenticate(request);
    if (user is null)
        return Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
    return Results.Ok(new { ok = true, dados = menuCatalog.GetForUser(user.Id) });
});
app.MapGet("/users", (HttpRequest request) =>
{
    var actor = Authenticate(request);
    if (actor is null) return Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
    if (!actor.IsAdmin) return Results.Json(new { ok = false, erro = "Apenas administrador pode consultar usuários." }, statusCode: 403);
    return Results.Ok(new { ok = true, usuarios = repository.ListUsers() });
});
app.MapPost("/users", (HttpRequest request, UserRequest input) =>
{
    var actor = Authenticate(request);
    if (actor is null) return Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
    if (!actor.IsAdmin) return Results.Json(new { ok = false, erro = "Apenas administrador pode cadastrar usuários." }, statusCode: 403);
    if (!ValidName(input.nome) || !ValidUsername(input.login) || string.IsNullOrEmpty(input.senha))
        return Results.BadRequest(new { ok = false, erro = "Nome, login ou senha inválidos; a senha é obrigatória." });
    if (!repository.CreateUser(input.login, input.senha, input.nome))
        return Results.Conflict(new { ok = false, erro = "Usuário já existe." });
    var criado = repository.Find(input.login);
    if (criado is not null && input.administrador == true) repository.UpdateUser(criado.Id, criado.Name, criado.Username, null, true, true);
    return Results.Ok(new { ok = true, id = criado?.Id, nome = input.nome.Trim(), login = input.login.Trim() });
});

/* ALTERAR USUÁRIO (tela Usuários — update). Só administrador.
 * Entrada: nome, login, senha (vazia = mantém a atual), ativo, administrador.
 * Regras: ninguém se desativa nem tira o próprio administrador (evita trancar o sistema);
 * sempre fica pelo menos um administrador ativo. */
app.MapPut("/users/{id:long}", (HttpRequest request, long id, UserUpdateRequest input) =>
{
    var actor = Authenticate(request);
    if (actor is null) return Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
    if (!actor.IsAdmin) return Results.Json(new { ok = false, erro = "Apenas administrador pode alterar usuários." }, statusCode: 403);
    var alvo = repository.FindById(id);
    if (alvo is null) return Results.NotFound(new { ok = false, erro = "Usuário não encontrado." });
    if (!ValidName(input.nome) || !ValidUsername(input.login))
        return Results.BadRequest(new { ok = false, erro = "Nome ou login inválidos." });
    var ativo = input.ativo ?? alvo.Active;
    var admin = input.administrador ?? alvo.IsAdmin;
    if (alvo.Id == actor.Id && (!ativo || !admin))
        return Results.BadRequest(new { ok = false, erro = "Você não pode desativar nem tirar o administrador do seu próprio usuário." });
    if (alvo.IsAdmin && alvo.Active && (!ativo || !admin) && repository.CountActiveAdmins() <= 1)
        return Results.BadRequest(new { ok = false, erro = "O sistema precisa de pelo menos um administrador ativo." });
    var senha = string.IsNullOrEmpty(input.senha) ? null : input.senha;
    if (!repository.UpdateUser(id, input.nome, input.login, senha, ativo, admin))
        return Results.Conflict(new { ok = false, erro = "Já existe outro usuário com esse login." });
    return Results.Ok(new { ok = true, id });
});

/* EXCLUIR USUÁRIO. Só administrador; não exclui a si mesmo nem o último administrador ativo.
 * Apaga também as exceções de menu dele (menu_usuarios). */
app.MapDelete("/users/{id:long}", (HttpRequest request, long id) =>
{
    var actor = Authenticate(request);
    if (actor is null) return Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
    if (!actor.IsAdmin) return Results.Json(new { ok = false, erro = "Apenas administrador pode excluir usuários." }, statusCode: 403);
    var alvo = repository.FindById(id);
    if (alvo is null) return Results.NotFound(new { ok = false, erro = "Usuário não encontrado." });
    if (alvo.Id == actor.Id) return Results.BadRequest(new { ok = false, erro = "Você não pode excluir o seu próprio usuário." });
    if (alvo.IsAdmin && alvo.Active && repository.CountActiveAdmins() <= 1)
        return Results.BadRequest(new { ok = false, erro = "O sistema precisa de pelo menos um administrador ativo." });
    menuCatalog.DeletePermissionsOfUser(id);
    repository.DeleteUser(id);
    return Results.Ok(new { ok = true, id });
});

/* CATÁLOGO DE MENU (tela Acessos) — mesma estrutura do Gourmet. Só administrador. Ver MenuCatalog.cs. */
app.MapGet("/api/menu/catalogo", (HttpRequest request) =>
    Admin(request) ?? Results.Ok(new { ok = true, dados = menuCatalog.ListAll() }));
app.MapPost("/api/menu/catalogo", (HttpRequest request, CatalogInput input) =>
{
    if (Admin(request) is { } negado) return negado;
    if (menuCatalog.Validate(input, null) is { } erro) return Results.BadRequest(new { ok = false, erro });
    var id = menuCatalog.Insert(input);
    return Results.Ok(new { ok = true, id_item = id });
});
app.MapPut("/api/menu/catalogo/{id:long}", (HttpRequest request, long id, CatalogInput input) =>
{
    if (Admin(request) is { } negado) return negado;
    if (menuCatalog.Get(id) is null) return Results.NotFound(new { ok = false, erro = "Item de menu não encontrado." });
    if (menuCatalog.Validate(input, id) is { } erro) return Results.BadRequest(new { ok = false, erro });
    menuCatalog.Update(id, input);
    return Results.Ok(new { ok = true, id_item = id });
});
app.MapDelete("/api/menu/catalogo/{id:long}", (HttpRequest request, long id) =>
{
    if (Admin(request) is { } negado) return negado;
    if (menuCatalog.Get(id) is null) return Results.NotFound(new { ok = false, erro = "Item de menu não encontrado." });
    menuCatalog.Delete(id);
    return Results.Ok(new { ok = true, id_item = id });
});

/* EXCEÇÕES DE MENU POR USUÁRIO (tela Usuários). Só administrador. Só grava o que foge do padrão. */
app.MapGet("/api/menu/usuarios/{idUsuario:long}", (HttpRequest request, long idUsuario) =>
{
    if (Admin(request) is { } negado) return negado;
    if (repository.FindById(idUsuario) is null) return Results.NotFound(new { ok = false, erro = "Usuário não encontrado." });
    return Results.Ok(new { ok = true, dados = menuCatalog.ListPermissions(idUsuario) });
});
app.MapPut("/api/menu/usuarios/{idUsuario:long}", (HttpRequest request, long idUsuario, List<MenuPermission> permissoes) =>
{
    if (Admin(request) is { } negado) return negado;
    if (repository.FindById(idUsuario) is null) return Results.NotFound(new { ok = false, erro = "Usuário não encontrado." });
    var gravadas = menuCatalog.SavePermissions(idUsuario, permissoes ?? []);
    return Results.Ok(new { ok = true, gravadas });
});

/* PERMISSÕES DO PRÓPRIO USUÁRIO (incluir/alterar/excluir) — as telas usam para esconder botões. Qualquer usuário logado. */
app.MapGet("/api/menu/minhas-permissoes", (HttpRequest request) =>
{
    var user = Authenticate(request);
    if (user is null) return Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
    return Results.Ok(new { ok = true, administrador = user.IsAdmin, dados = menuCatalog.ListPermissions(user.Id) });
});
app.Run();

// Devolve o erro (401/403) quando quem chamou não é administrador; null quando pode seguir.
IResult? Admin(HttpRequest request)
{
    var actor = Authenticate(request);
    if (actor is null) return Results.Json(new { ok = false, erro = "Bearer inválido ou expirado." }, statusCode: 401);
    if (!actor.IsAdmin) return Results.Json(new { ok = false, erro = "Apenas administrador pode alterar o cadastro de menus." }, statusCode: 403);
    return null;
}

static async Task<IResult> LookupReply(Func<Task<object>> action)
{
    try { return Results.Ok(await action()); }
    catch (ArgumentException ex) { return Results.BadRequest(new { ok = false, erro = ex.Message }); }
    catch (KeyNotFoundException ex) { return Results.NotFound(new { ok = false, erro = ex.Message }); }
    catch (HttpRequestException) { return Results.Json(new { ok = false, erro = "Consulta pública indisponível." }, statusCode: 502); }
    catch (TaskCanceledException) { return Results.Json(new { ok = false, erro = "Consulta pública excedeu o tempo limite." }, statusCode: 504); }
    catch (JsonException) { return Results.Json(new { ok = false, erro = "A fonte pública retornou dados inválidos." }, statusCode: 502); }
}

User? Authenticate(HttpRequest request)
{
    var header = request.Headers.Authorization.ToString();
    if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ||
        !tokens.TryValidate(header[7..].Trim(), out var id, out var username)) return null;
    var user = repository.Find(username!);
    return user is not null && user.Active && user.Id == id ? user : null;
}

static bool ValidUsername(string? username) => !string.IsNullOrWhiteSpace(username) && username.Trim().Length is >= 3 and <= 80;
static bool ValidName(string? name) => !string.IsNullOrWhiteSpace(name) && name.Trim().Length is >= 2 and <= 120;

static byte[] LoadAuthKey(string dataDir)
{
    var configured = Environment.GetEnvironmentVariable("FACILAPP_AUTH_KEY");
    if (!string.IsNullOrEmpty(configured))
    {
        if (Encoding.UTF8.GetByteCount(configured) < 32) throw new InvalidOperationException("FACILAPP_AUTH_KEY deve conter pelo menos 32 bytes.");
        return Encoding.UTF8.GetBytes(configured);
    }
    if (!OperatingSystem.IsWindows()) throw new InvalidOperationException("Configure FACILAPP_AUTH_KEY fora do Windows.");
    var path = Path.Combine(dataDir, "auth.key.dpapi");
    if (File.Exists(path))
        return ProtectedData.Unprotect(File.ReadAllBytes(path), null, DataProtectionScope.CurrentUser);
    var generated = RandomNumberGenerator.GetBytes(32);
    var protectedKey = ProtectedData.Protect(generated, null, DataProtectionScope.CurrentUser);
    try
    {
        using var file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        file.Write(protectedKey);
    }
    catch (IOException) when (File.Exists(path))
    {
        return ProtectedData.Unprotect(File.ReadAllBytes(path), null, DataProtectionScope.CurrentUser);
    }
    return generated;
}

record LoginRequest(string usuario, string senha);
record UserRequest(string nome, string login, string senha, bool? administrador = null);
record UserUpdateRequest(string nome, string login, string? senha, bool? ativo, bool? administrador);
record User(long Id, string Name, string Username, string PasswordHash, bool Active, bool IsAdmin);
record UserSummary(long Id, string Nome, string Login, bool Ativo, bool Administrador);

// Usuário fixo do curso (ver EnsureUser no início do arquivo). Decisão do Daniel para os alunos, 03/11/2026.
static class CursoUsuarioPadrao
{
    public const string Login = "facilapp";
    public const string Senha = "1";
}

interface IUserRepository
{
    void Initialize();
    bool HasUsers();
    bool CreateFirstAdmin(string username, string password, string? name = null);
    bool CreateUser(string username, string password, string name);
    void EnsureUser(string username, string password, string name, bool isAdmin);
    User? Find(string username);
    User? FindById(long id);
    bool UpdateUser(long id, string name, string username, string? newPassword, bool active, bool isAdmin);
    bool DeleteUser(long id);
    int CountActiveAdmins();
    IReadOnlyList<UserSummary> ListUsers();
}

sealed class SqliteUserRepository(string path) : IUserRepository
{
    private SqliteConnection Open()
    {
        var connection = new SqliteConnection($"Data Source={path}");
        connection.Open();
        return connection;
    }
    public void Initialize()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '', username TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, is_admin INTEGER NOT NULL DEFAULT 0, created_utc TEXT NOT NULL)";
        command.ExecuteNonQuery();
        command.CommandText = "PRAGMA table_info(users)";
        var hasAdmin = false;
        var hasName = false;
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                if (reader.GetString(1) == "is_admin") hasAdmin = true;
                if (reader.GetString(1) == "name") hasName = true;
            }
        }
        if (!hasAdmin) { command.CommandText = "ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0"; command.ExecuteNonQuery(); }
        if (!hasName) { command.CommandText = "ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''"; command.ExecuteNonQuery(); }
    }
    public bool HasUsers()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT EXISTS(SELECT 1 FROM users)";
        return Convert.ToInt64(command.ExecuteScalar()) != 0;
    }
    public bool CreateFirstAdmin(string username, string password, string? name = null)
    {
        if (string.IsNullOrEmpty(password)) throw new InvalidOperationException("A senha inicial é obrigatória.");
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "INSERT INTO users(name,username,password_hash,active,is_admin,created_utc) SELECT $name,$user,$hash,1,1,$date WHERE NOT EXISTS(SELECT 1 FROM users)";
        command.Parameters.AddWithValue("$name", string.IsNullOrWhiteSpace(name) ? username.Trim() : name.Trim());
        command.Parameters.AddWithValue("$user", username.Trim());
        command.Parameters.AddWithValue("$hash", PasswordHasher.Hash(password));
        command.Parameters.AddWithValue("$date", DateTimeOffset.UtcNow.ToString("O"));
        return command.ExecuteNonQuery() == 1;
    }
    public bool CreateUser(string username, string password, string name)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "INSERT OR IGNORE INTO users(name,username,password_hash,active,is_admin,created_utc) VALUES($name,$user,$hash,1,0,$date)";
        command.Parameters.AddWithValue("$name", name.Trim());
        command.Parameters.AddWithValue("$user", username.Trim());
        command.Parameters.AddWithValue("$hash", PasswordHasher.Hash(password));
        command.Parameters.AddWithValue("$date", DateTimeOffset.UtcNow.ToString("O"));
        return command.ExecuteNonQuery() == 1;
    }
    public User? Find(string username)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT id, name, username, password_hash, active, is_admin FROM users WHERE username=$user LIMIT 1";
        command.Parameters.AddWithValue("$user", username.Trim());
        using var reader = command.ExecuteReader();
        return reader.Read() ? new User(reader.GetInt64(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetInt64(4) != 0, reader.GetInt64(5) != 0) : null;
    }
    // Cria o usuário só se o login ainda não existir (não reseta senha trocada depois).
    public void EnsureUser(string username, string password, string name, bool isAdmin)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "INSERT INTO users(name,username,password_hash,active,is_admin,created_utc) SELECT $name,$user,$hash,1,$admin,$date WHERE NOT EXISTS(SELECT 1 FROM users WHERE username=$user)";
        command.Parameters.AddWithValue("$name", name.Trim());
        command.Parameters.AddWithValue("$user", username.Trim());
        command.Parameters.AddWithValue("$hash", PasswordHasher.Hash(password));
        command.Parameters.AddWithValue("$admin", isAdmin ? 1 : 0);
        command.Parameters.AddWithValue("$date", DateTimeOffset.UtcNow.ToString("O"));
        command.ExecuteNonQuery();
    }
    public User? FindById(long id)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT id, name, username, password_hash, active, is_admin FROM users WHERE id=$id LIMIT 1";
        command.Parameters.AddWithValue("$id", id);
        using var reader = command.ExecuteReader();
        return reader.Read() ? new User(reader.GetInt64(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetInt64(4) != 0, reader.GetInt64(5) != 0) : null;
    }
    // Devolve false quando o novo login já pertence a outro usuário.
    public bool UpdateUser(long id, string name, string username, string? newPassword, bool active, bool isAdmin)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM users WHERE username=$user AND id<>$id";
        command.Parameters.AddWithValue("$user", username.Trim());
        command.Parameters.AddWithValue("$id", id);
        if (Convert.ToInt64(command.ExecuteScalar()) > 0) return false;
        command.CommandText = newPassword is null
            ? "UPDATE users SET name=$name, username=$user, active=$active, is_admin=$admin WHERE id=$id"
            : "UPDATE users SET name=$name, username=$user, active=$active, is_admin=$admin, password_hash=$hash WHERE id=$id";
        command.Parameters.AddWithValue("$name", name.Trim());
        command.Parameters.AddWithValue("$active", active ? 1 : 0);
        command.Parameters.AddWithValue("$admin", isAdmin ? 1 : 0);
        if (newPassword is not null) command.Parameters.AddWithValue("$hash", PasswordHasher.Hash(newPassword));
        return command.ExecuteNonQuery() == 1;
    }
    public bool DeleteUser(long id)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM users WHERE id=$id";
        command.Parameters.AddWithValue("$id", id);
        return command.ExecuteNonQuery() == 1;
    }
    public int CountActiveAdmins()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM users WHERE active=1 AND is_admin=1";
        return Convert.ToInt32(command.ExecuteScalar());
    }
    public IReadOnlyList<UserSummary> ListUsers()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT id,name,username,active,is_admin FROM users ORDER BY name,username";
        using var reader = command.ExecuteReader();
        var users = new List<UserSummary>();
        while (reader.Read()) users.Add(new(reader.GetInt64(0), reader.GetString(1), reader.GetString(2), reader.GetInt64(3) != 0, reader.GetInt64(4) != 0));
        return users;
    }
}

static class PasswordHasher
{
    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 210_000, HashAlgorithmName.SHA256, 32);
        return $"pbkdf2-sha256$210000${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }
    public static bool Verify(string password, string stored)
    {
        var parts = stored.Split('$');
        if (parts.Length != 4 || parts[0] != "pbkdf2-sha256" || !int.TryParse(parts[1], out var rounds) || rounds < 100_000) return false;
        try
        {
            var salt = Convert.FromBase64String(parts[2]);
            var expected = Convert.FromBase64String(parts[3]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, rounds, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException) { return false; }
    }
}

sealed class TokenService(byte[] key)
{
    private static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private static byte[] Decode(string text) => Convert.FromBase64String(text.Replace('-', '+').Replace('_', '/') + new string('=', (4 - text.Length % 4) % 4));
    public string Issue(User user)
    {
        var header = Base64Url(Encoding.UTF8.GetBytes("{\"alg\":\"HS256\",\"typ\":\"JWT\"}"));
        var payload = Base64Url(JsonSerializer.SerializeToUtf8Bytes(new { sub = user.Id.ToString(), name = user.Username, exp = DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds() }));
        var content = $"{header}.{payload}";
        var signature = Base64Url(HMACSHA256.HashData(key, Encoding.ASCII.GetBytes(content)));
        return $"{content}.{signature}";
    }
    public bool TryValidate(string token, out long id, out string? username)
    {
        id = 0; username = null;
        var parts = token.Split('.');
        if (parts.Length != 3) return false;
        try
        {
            var actual = Decode(parts[2]);
            var expected = HMACSHA256.HashData(key, Encoding.ASCII.GetBytes($"{parts[0]}.{parts[1]}"));
            if (!CryptographicOperations.FixedTimeEquals(actual, expected)) return false;
            using var header = JsonDocument.Parse(Decode(parts[0]));
            if (header.RootElement.GetProperty("alg").GetString() != "HS256") return false;
            using var payload = JsonDocument.Parse(Decode(parts[1]));
            var root = payload.RootElement;
            if (root.GetProperty("exp").GetInt64() <= DateTimeOffset.UtcNow.ToUnixTimeSeconds()) return false;
            if (!long.TryParse(root.GetProperty("sub").GetString(), out id)) return false;
            username = root.GetProperty("name").GetString();
            return !string.IsNullOrWhiteSpace(username);
        }
        catch (Exception e) when (e is FormatException or JsonException or KeyNotFoundException or InvalidOperationException) { return false; }
    }
}
