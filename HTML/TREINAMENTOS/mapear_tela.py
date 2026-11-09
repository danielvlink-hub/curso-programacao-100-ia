# Mapeia TODOS os botões e campos de uma tela e confere com o roteiro do treinamento. (Copiado do Gourmet para o curso, 08/11/2026.)
# Pedido do Daniel (15/09/2026): "tem que mapear todos os botões antes, fazer um projeto para não ficar nada de fora".
#
# Uso (dentro da pasta HTML):  python TREINAMENTOS/mapear_tela.py Hospedes
#   lê  TREINAMENTOS/<Pasta>/roteiro.js  (tela: '../../<arquivo>.html' e, se tiver, quadros: ['../../<update>.html'])
#   gera TREINAMENTOS/<Pasta>/MAPA.md    (cada controle: ✅ no roteiro / ⏭️ ignorado / ❌ fora)
#   sai com código 1 se sobrar controle fora do roteiro (use antes de gerar_audios.py).
#
# Controles: <button>, <input> (menos hidden), <select>, <textarea> com id — do HTML e também os criados pelo
# JavaScript da tela (id="..." dentro de strings). "quadros" = telas que abrem dentro de um iframe da tela
# (ex.: o update do browse); os controles delas também entram no mapa.
# Para deixar um controle fora de propósito, liste o id em  ignorar: ['id', ...]  no roteiro.js.
import html
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def rotulo(trecho):
    t = re.sub(r"<span class=\"material-(symbols-rounded|icons)\">[^<]*</span>", "", trecho)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def controles(texto, arquivo, achados):
    for m in re.finditer(r"<(button)\b([^>]*)>(.*?)</button>|<(input|select|textarea)\b([^>]*)>", texto, re.S | re.I):
        if m.group(1):
            tag, attrs, dentro = "button", m.group(2), m.group(3)
        else:
            tag, attrs, dentro = m.group(4).lower(), m.group(5), ""
        idm = re.search(r"\bid=[\"']([\w-]+)[\"']", attrs)
        if not idm:
            continue
        if tag == "input" and re.search(r"type=[\"']hidden", attrs, re.I):
            continue
        titulo = re.search(r"\btitle=[\"']([^\"']*)", attrs)
        ph = re.search(r"\bplaceholder=[\"']([^\"']*)", attrs)
        nome = rotulo(dentro) if tag == "button" else ""
        achados.setdefault(idm.group(1), {
            "tipo": tag, "arquivo": arquivo,
            "nome": nome or (ph.group(1) if ph else "") or (titulo.group(1) if titulo else ""),
            "desabilitado": bool(re.search(r"\bdisabled\b", attrs)),
        })


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Uso: python mapear_tela.py <PastaDoTreinamento>")
    pasta = os.path.join(RAIZ, "TREINAMENTOS", sys.argv[1])
    roteiro = open(os.path.join(pasta, "roteiro.js"), encoding="utf-8").read()
    telas = [re.search(r"tela:\s*'([^']+)'", roteiro).group(1)]
    q = re.search(r"quadros:\s*\[([^\]]*)\]", roteiro)
    if q:
        telas += re.findall(r"'([^']+)'", q.group(1))

    mapa = {}
    for rel in telas:
        caminho = os.path.normpath(os.path.join(pasta, rel.split('?')[0]))
        controles(open(caminho, encoding="utf-8").read(), os.path.basename(caminho), mapa)

    alvos = set(re.findall(r"#([\w-]+)", " ".join(re.findall(r"alvo:\s*'([^']+)'", roteiro))))
    ignorar = set(re.findall(r"'([\w-]+)'", (re.search(r"ignorar:\s*\[([^\]]*)\]", roteiro) or [None, ""])[1] or ""))

    linhas = ["# Mapa de controles — " + ", ".join(os.path.basename(t) for t in telas), "",
              "Gerado por `TREINAMENTOS/mapear_tela.py`. ✅ explicado no roteiro · ⏭️ ignorado de propósito · ❌ fora do roteiro.", "",
              "| | id | tipo | nome / dica | arquivo | obs |", "|---|---|---|---|---|---|"]
    fora = []
    for cid, c in mapa.items():
        if cid in alvos:
            marca = "✅"
        elif cid in ignorar:
            marca = "⏭️"
        else:
            marca = "❌"
            fora.append(cid)
        linhas.append("| %s | `%s` | %s | %s | %s | %s |" % (marca, cid, c["tipo"], c["nome"].replace("|", "/"), c["arquivo"],
                                                         "começa desabilitado" if c["desabilitado"] else ""))
    linhas += ["", "**%d controles · %d no roteiro · %d ignorados · %d fora**" % (
        len(mapa), len(alvos & set(mapa)), len(ignorar & set(mapa)), len(fora))]
    open(os.path.join(pasta, "MAPA.md"), "w", encoding="utf-8").write("\n".join(linhas) + "\n")
    print("\n".join(linhas))
    sys.exit(1 if fora else 0)


if __name__ == "__main__":
    main()
