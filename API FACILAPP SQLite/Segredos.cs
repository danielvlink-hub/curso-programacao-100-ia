using System.Security.Cryptography;

namespace FacilApp.Sqlite.Api;

/*
 * SEGREDOS — onde a API guarda a chave dos logins (auth.key) e a configuração da IA (ia.config), no Windows e no Linux.
 * Daniel, 08/11/2026: "gerar pacote linux na pasta curso\linux".
 *
 * WINDOWS: igual a antes — criptografado pelo Windows (DPAPI, usuário do serviço), arquivo "<nome>.dpapi".
 * LINUX (e outros): não existe DPAPI. O arquivo "<nome>.segredo" fica na pasta de dados com permissão 600 (só o usuário
 *   que roda a API lê e grava) — o mesmo cuidado de uma chave SSH. Nunca vai para o GitHub (.gitignore) nem para o log.
 * REGRA: as telas nunca recebem estes arquivos; a chave da OpenAI continua só no servidor.
 */
public static class Segredos
{
    /** Caminho do arquivo do segredo nesta plataforma (nome sem extensão: "auth.key", "ia.config"). */
    public static string Arquivo(string dataDir, string nome) =>
        Path.Combine(dataDir, nome + (OperatingSystem.IsWindows() ? ".dpapi" : ".segredo"));

    public static bool Existe(string dataDir, string nome) => File.Exists(Arquivo(dataDir, nome));

    /** Ler — os bytes do segredo, ou null se não existir (ou não abrir, ex.: DPAPI de outro usuário). */
    public static byte[]? Ler(string dataDir, string nome)
    {
        var arq = Arquivo(dataDir, nome);
        if (!File.Exists(arq)) return null;
        try
        {
            var bytes = File.ReadAllBytes(arq);
            return OperatingSystem.IsWindows() ? ProtectedData.Unprotect(bytes, null, DataProtectionScope.CurrentUser) : bytes;
        }
        catch (CryptographicException) { return null; }
    }

    /** Gravar — grava o segredo (Windows: DPAPI; Linux: permissão 600 desde a criação). sóSeNaoExiste = não sobrescreve. */
    public static bool Gravar(string dataDir, string nome, byte[] dados, bool soSeNaoExiste = false)
    {
        var arq = Arquivo(dataDir, nome);
        var conteudo = OperatingSystem.IsWindows() ? ProtectedData.Protect(dados, null, DataProtectionScope.CurrentUser) : dados;
        var opcoes = new FileStreamOptions
        {
            Mode = soSeNaoExiste ? FileMode.CreateNew : FileMode.Create,
            Access = FileAccess.Write,
            Share = FileShare.None
        };
        if (!OperatingSystem.IsWindows()) opcoes.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
        try
        {
            using var f = new FileStream(arq, opcoes);
            f.Write(conteudo);
        }
        catch (IOException) when (soSeNaoExiste && File.Exists(arq)) { return false; }
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(arq, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        return true;
    }

    public static void Apagar(string dataDir, string nome) { var arq = Arquivo(dataDir, nome); if (File.Exists(arq)) File.Delete(arq); }
}
