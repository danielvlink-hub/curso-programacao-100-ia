# Cria a pasta de um treinamento novo (apresentação guiada com voz) a partir do modelo — CURSO (copiado do Gourmet, 08/11/2026).
# Uso (dentro da pasta HTML):  python TREINAMENTOS/novo_treinamento.py <Pasta> <tela.html> "<Título>"
#   ex.: python TREINAMENTOS/novo_treinamento.py Hospedes modelo_browse.html "Cadastro de Hóspedes"
# Gera TREINAMENTOS/<Pasta>/ com Apresentacao_<Pasta>.html, gerar_audios.py e um roteiro.js vazio (se ainda não existir),
# e roda o mapear_tela.py para listar TODOS os controles da tela em MAPA.md (base para escrever o roteiro).
# Depois de escrever o roteiro: python mapear_tela.py <Pasta> (nenhum ❌) → python <Pasta>/gerar_audios.py → registrar em ajudas.js.
import io, os, shutil, subprocess, sys, time
AQUI = os.path.dirname(os.path.abspath(__file__))
pasta, tela, titulo = sys.argv[1], sys.argv[2].replace(chr(92), '/'), sys.argv[3]
destino = os.path.join(AQUI, pasta)
os.makedirs(os.path.join(destino, 'audio'), exist_ok=True)
shutil.copy(os.path.join(AQUI, '_modelo', 'gerar_audios.py'), os.path.join(destino, 'gerar_audios.py'))
modelo = io.open(os.path.join(AQUI, '_modelo', 'Apresentacao_MODELO.html'), encoding='utf-8').read()
modelo = modelo.replace('TITULO', titulo).replace('VERSAO', time.strftime('%Y%m%d%H%M'))
io.open(os.path.join(destino, 'Apresentacao_' + pasta + '.html'), 'w', encoding='utf-8', newline='\n').write(modelo)
roteiro = os.path.join(destino, 'roteiro.js')
if not os.path.exists(roteiro):
    io.open(roteiro, 'w', encoding='utf-8', newline='\n').write(
        "window.TREINAMENTO = {\n  titulo: '%s',\n  tela: '../../%s',\n  quadros: [],\n  ignorar: [],\n  passos: [\n  ]\n};\n" % (titulo, tela))
env = dict(os.environ, PYTHONIOENCODING='utf-8')
subprocess.run([sys.executable, os.path.join(AQUI, 'mapear_tela.py'), pasta], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print(io.open(os.path.join(destino, 'MAPA.md'), encoding='utf-8').read())
