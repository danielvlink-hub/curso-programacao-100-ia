# FastPousada no Linux

O sistema do curso **Programação 100% IA** para Linux 64 bits (x64): a FacilApp API SQL do curso + todas as telas.

| Pasta / arquivo | O que é |
|---|---|
| `api/FacilApp.Sqlite.Api` | a API do curso em **um arquivo só, com o .NET dentro** (não precisa instalar .NET) |
| `html/` | as telas (abrem no navegador, como no Windows) |
| `instalar.sh` | instala em `~/FastPousada`, liga a API como serviço do usuário e cria o atalho no menu |
| `iniciar.sh` | sobe a API (se não estiver rodando) e abre o login no navegador |
| `desinstalar.sh` | remove (os dados ficam; `--tudo` apaga também os dados) |

## Instalar

```bash
tar -xzf FastPousada-Linux-x64.tar.gz
cd FastPousada
bash instalar.sh
```

Depois abra **FastPousada** no menu de aplicativos (ou `~/FastPousada/iniciar.sh`). Usuário do curso: `facilapp`, senha `1`.

## Bom saber

- **Não precisa de root.** A API roda como serviço do **seu** usuário (`systemctl --user status fastpousada-api`). Para ela
  subir antes de você entrar na sessão: `sudo loginctl enable-linger $USER`.
- **Dados:** `~/.local/share/FacilApp/CursoApiSqlite` (banco `usuarios.db`, logs e as chaves). No Linux as chaves ficam em
  arquivos `.segredo` com permissão **600** (só o seu usuário lê) — no Windows é a criptografia DPAPI.
- A API escuta **só em 127.0.0.1:7777** (outra porta: `FACILAPP_PORT=7788 bash instalar.sh`).
- Precisa de `curl` e de um navegador (Firefox, Chrome, Chromium...). Testado para distribuições x64 com glibc
  (Ubuntu, Debian, Mint, Fedora...).
- Chave da OpenAI (Luninha): cadastre no console da API, `http://127.0.0.1:7777`, como no Windows.
