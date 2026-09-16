# -*- coding: utf-8 -*-
"""Gera assets/mapa-muscular/mapa-anatomico.svg a partir da geometria MIT
(MuscleMap -> body-paths.js do openGym). Nao copia nenhum outro arquivo do
openGym (AGPL).

Fora do build, como scripts/importar-ilustracoes.ts: o SVG gerado esta
versionado. Para refazer, ponha body-paths.js ao lado deste script e rode

    python3 scripts/gerar-mapa-anatomico.py

Ele le e escreve na propria pasta: o mapa-anatomico.svg que sai daqui e o que
vai para assets/mapa-muscular/.

A licenca e a atribuicao obrigatoria estao em
assets/mapa-muscular/LICENCA-mapa-anatomico.md."""
import json, re, os

BASE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(BASE, 'body-paths.js'), encoding='utf-8').read()
data = json.loads(src[src.index('{', src.index('export default')):].strip().rstrip(';'))

MALE = data['male']

# ---- mapeamento MuscleMap -> 16 nomes do sprite do app -------------------
MAP_FRENTE = {
    'trapezius': 'trapezio',
    'deltoids': 'ombro',
    'chest': 'peito',
    'biceps': 'biceps',
    'triceps': 'triceps',
    'forearm': 'antebraco',
    'abs': 'abdomen',
    'obliques': 'obliquo',
    'quadriceps': 'quadriceps',
    'adductors': 'adutor',
    'calves': 'panturrilha',
    'tibialis': 'panturrilha',   # perna de frente: o sprite atual ja pinta "panturrilha" aqui
}
MAP_COSTAS = {
    'trapezius': 'trapezio',
    'deltoids': 'ombrop',
    'upper-back': 'dorsal',
    'triceps': 'triceps',
    'forearm': 'antebraco',
    'lower-back': 'lombar',
    'gluteal': 'gluteo',
    'hamstring': 'posterior',
    'adductors': 'adutor',
    'calves': 'panturrilha',
}
# ficam no corpo base (sem correspondencia nos 16 nomes)
SEM_PAR = {'serratus', 'hip-flexors'}
INERTES = {'head', 'hair', 'neck', 'hands', 'feet', 'knees', 'ankles'}

ORDEM = ['trapezio','ombro','ombrop','peito','biceps','triceps','antebraco','dorsal',
         'abdomen','obliquo','lombar','gluteo','quadriceps','posterior','adutor','panturrilha']

# ---- bbox aproximado (percorre os comandos do path) ----------------------
NUM = re.compile(r'[-+]?(?:\d*\.\d+(?:e[-+]?\d+)?|\d+\.?(?:e[-+]?\d+)?)')
CMD = re.compile(r'[MmLlHhVvCcSsQqTtAaZz]')
SEP = re.compile(r'[\s,]*')

def bbox(d, acc):
    i = 0; n = len(d); cmd = None; x = y = sx = sy = 0.0
    def put(px, py):
        acc[0] = min(acc[0], px); acc[1] = min(acc[1], py)
        acc[2] = max(acc[2], px); acc[3] = max(acc[3], py)
    def num():
        nonlocal i
        i = SEP.match(d, i).end()
        m = NUM.match(d, i)
        i = m.end()
        return float(m.group())
    def flag():
        nonlocal i
        i = SEP.match(d, i).end()
        v = d[i]; i += 1
        return float(v)
    while i < n:
        i = SEP.match(d, i).end()
        if i >= n: break
        if CMD.match(d, i):
            cmd = d[i]; i += 1
            if cmd in 'Zz':
                x, y = sx, sy; put(x, y); continue
        u = cmd.upper(); rel = cmd.islower()
        if u == 'H':
            v = num(); x = x + v if rel else v
        elif u == 'V':
            v = num(); y = y + v if rel else v
        elif u == 'A':
            num(); num(); num(); flag(); flag()
            ax = num(); ay = num()
            x = x + ax if rel else ax; y = y + ay if rel else ay
        else:
            k = {'M': 1, 'L': 1, 'T': 1, 'C': 3, 'S': 2, 'Q': 2}[u]
            px = py = 0.0
            for _ in range(k):
                px = num(); py = num()
                put(x + px if rel else px, y + py if rel else py)
            x = x + px if rel else px; y = y + py if rel else py
        put(x, y)
        if u == 'M':
            sx, sy = x, y
            cmd = 'l' if rel else 'L'
    return acc

acc = [1e9, 1e9, -1e9, -1e9]
for view in ('front', 'back'):
    for part, paths in MALE[view]['p'].items():
        for d in paths:
            bbox(d, acc)
PAD = 14
vx = round(acc[0] - PAD); vy = round(acc[1] - PAD)
vw = round(acc[2] - acc[0] + 2*PAD); vh = round(acc[3] - acc[1] + 2*PAD)

# ---- montagem ------------------------------------------------------------
base = []          # (view, part, d)
musc = {m: [] for m in ORDEM}
stats = {'frente': {}, 'costas': {}}
for view, mapa, rot in (('front', MAP_FRENTE, 'frente'), ('back', MAP_COSTAS, 'costas')):
    for part, paths in MALE[view]['p'].items():
        alvo = mapa.get(part)
        if alvo:
            stats[rot][part] = alvo
            for d in paths:
                musc[alvo].append((rot, d))
        else:
            stats[rot][part] = '(corpo base)'
            for d in paths:
                base.append((rot, part, d))

out = []
out.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%d %d %d %d" '
           'role="img" aria-label="Mapa muscular anatomico, frente e costas">' % (vx, vy, vw, vh))
out.append('  <title>Mapa muscular anatomico (frente e costas)</title>')
mapline = []
for rot, mapa in (('frente', MAP_FRENTE), ('costas', MAP_COSTAS)):
    for k, v in mapa.items():
        mapline.append('       %-7s %-12s -> m-%s' % (rot, k, v))
out.append('  <!-- Mapeamento MuscleMap -> nomes do app:\n' + '\n'.join(mapline) +
           '\n       sem correspondencia (ficam no corpo base): ' + ', '.join(sorted(SEM_PAR)) +
           '\n       partes inertes (corpo base): ' + ', '.join(sorted(INERTES)) + '\n  -->')
out.append('  <desc>Geometria derivada de MuscleMap (Melih Colpan), licenca MIT, via openGym/body-paths.js. '
           'Cada musculo e um &lt;g id="m-NOME"&gt; com fill="var(--m-NOME, var(--mbody))". Veja LICENCA.md.</desc>')
out.append('  <g fill-rule="evenodd" stroke="var(--mline, #3a3a3a)" stroke-width="1.6" '
           'stroke-linejoin="round" vector-effect="non-scaling-stroke">')
out.append('    <g id="corpo-base" fill="var(--mbody, #272727)">')
atual = None
for rot, part, d in base:
    if rot != atual:
        out.append('      <!-- %s -->' % rot); atual = rot
    out.append('      <path data-parte="%s" d="%s"/>' % (part, d))
out.append('    </g>')
out.append('    <g id="musculos">')
for m in ORDEM:
    out.append('      <g id="m-%s" fill="var(--m-%s, var(--mbody, #272727))">' % (m, m))
    atual = None
    for rot, d in musc[m]:
        if rot != atual:
            out.append('        <!-- %s -->' % rot); atual = rot
        out.append('        <path d="%s"/>' % d)
    out.append('      </g>')
out.append('    </g>')
out.append('  </g>')
out.append('</svg>')
open(os.path.join(BASE, 'mapa-anatomico.svg'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')

print('viewBox %d %d %d %d' % (vx, vy, vw, vh))
for m in ORDEM:
    f = sum(1 for r, _ in musc[m] if r == 'frente'); b = len(musc[m]) - f
    print('  m-%-12s frente=%-3d costas=%-3d' % (m, f, b))
print('paths corpo base:', len(base))
print(json.dumps(stats, indent=1, ensure_ascii=False))
