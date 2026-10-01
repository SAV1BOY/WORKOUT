#!/usr/bin/env python3
"""gerar-lote.py <codigo> <pasta-destino> [<fila.json>] — escreve <pasta>/lote.json com a
definição completa do lote (itens inteiros do ledger + plano + checklists) e imprime
um resumo para o orquestrador montar os args do wf-lote.js."""
import json, sys, os
S='/tmp/claude-0/-home-user-WORKOUT/19b8c32e-5647-551a-b360-eec4ee383d9c/scratchpad/ultraloop'
cod, dest = sys.argv[1], sys.argv[2]
fila = json.load(open(sys.argv[3] if len(sys.argv) > 3 else '/home/user/WORKOUT/docs/ultraloop/fila.json'))
plano = fila.get('lotes_planejados') or json.load(open(S+'/r10/ledger/lotes-plano.json'))
lo = next(l for l in plano if l['codigo'] == cod)
idx = {i['id']: i for i in fila['itens']}
itens = []
for iid in lo['itens']:
    it = idx.get(iid)
    if it is None:
        print(f'AVISO: {iid} não está em itens (já resolvido?)'); continue
    itens.append(it)
d = {
  'codigo': cod, 'titulo': lo['titulo'], 'area': lo.get('area'),
  'arquivos_previstos': lo.get('arquivos', []), 'telas_esperadas': lo.get('telas_esperadas', []),
  'observacoes_do_plano': lo.get('observacoes', ''), 'excecao': lo.get('excecao'), 'excecao_de_ordem': lo.get('excecao_de_ordem'),
  'itens': itens,
  'checklist_regra': 'Para cada item: o ACEITE do detalhe conferido no código e nos dados reais (todos os casos), regra pura com teste que falharia sem a mudança, e2e pelo caminho real, SPEC e PROGRESSO iguais ao código.',
  'checklist_tela': 'Para cada item: o ACEITE medido a 360×740 nos dois temas pelo caminho real (alvos ≥ 44 px, scrollWidth == clientWidth, contraste AA do texto e ≥ 3:1 de elementos, headings e aria no DOM), e os diffs das telas declaradas inspecionados.',
}
os.makedirs(dest, exist_ok=True)
json.dump(d, open(os.path.join(dest, 'lote.json'), 'w'), ensure_ascii=False, indent=1)
print(json.dumps({'codigo': cod, 'titulo': lo['titulo'], 'n': len(itens), 'ids': [i['id'] for i in itens],
  'telas': lo.get('telas_esperadas'), 'arquivos': lo.get('arquivos'), 'medios': lo.get('medios')}, ensure_ascii=False))
