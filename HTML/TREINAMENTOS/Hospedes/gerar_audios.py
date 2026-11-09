# Gera a voz da apresentação guiada a partir do roteiro.js desta pasta.
# Padrão do Daniel (Antigravity): edge-tts, voz pt-BR-FranciscaNeural, ritmo +3%.
# Uso: python gerar_audios.py      (precisa de internet só para gerar; o mp3 toca offline)
import asyncio
import json
import os
import re

import edge_tts

VOICE = "pt-BR-FranciscaNeural"
PASTA = os.path.dirname(os.path.abspath(__file__))


def ler_roteiro():
    texto = open(os.path.join(PASTA, "roteiro.js"), encoding="utf-8").read()
    passos = re.findall(r"audio:\s*'([^']+)'\s*,\s*texto:\s*'((?:[^'\\]|\\.)*)'", texto)
    return [{"arquivo": a, "texto": t.replace("\\'", "'")} for a, t in passos]


async def gerar_todos_audios():
    passos = ler_roteiro()
    if not passos:
        raise SystemExit("Nenhum passo encontrado no roteiro.js")
    for item in passos:
        caminho = os.path.join(PASTA, item["arquivo"])
        os.makedirs(os.path.dirname(caminho), exist_ok=True)
        print(f"Gravando voz para: {item['arquivo']}...")
        comunicador = edge_tts.Communicate(text=item["texto"], voice=VOICE, rate="+3%", pitch="+0Hz")
        await comunicador.save(caminho)
    print(json.dumps({"ok": True, "passos": len(passos)}))


if __name__ == "__main__":
    asyncio.run(gerar_todos_audios())
