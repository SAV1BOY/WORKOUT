#!/usr/bin/env python3
"""Reescreve, no PROGRESSO.md, a tabela de contagens e a tabela do plano da seção Fila a partir de docs/ultraloop/fila.json."""
import json,re,sys
raiz=sys.argv[1] if len(sys.argv)>1 else '/home/user/WORKOUT'
f=json.load(open(raiz+'/docs/ultraloop/fila.json'))
c=f['contagens']; ps=c['por_secao']
t=open(raiz+'/PROGRESSO.md',encoding='utf-8').read()
ini=t.index('### Fila (o que não coube)'); fim=t.index('\n### ',ini+10)
sec=t[ini:fim]
cont=['| seção | pendente | publicado | descartado |','| --- | ---: | ---: | ---: |']
for s in ('B','C','D','legado'):
    p=ps.get(s,{}); cont.append(f'| {s} | {p.get("pendente",0)} | {p.get("publicado",0)} | {p.get("descartado",0)} |')
cont.append(f'| **total** | **{c["pendente"]}** | **{c["resolvidos"]}** | **{c["descartados"]}** |')
sec=re.sub(r'\*\*Contagens em [^\n]*\n\n\| seção \|[\s\S]*?\n\n', f'**Contagens em {c["gerado_em"]}:**\n\n'+'\n'.join(cont)+'\n\n', sec, count=1)
plano=['| lote | título | itens | ids |','| --- | --- | ---: | --- |']+[f'| {l["codigo"]} | {l["titulo"]} | {len(l["itens"])} | {", ".join(l["itens"])} |' for l in f['lotes_planejados']]
sec=re.sub(r'\| lote \| título \| itens \| ids \|[\s\S]*$', '\n'.join(plano)+'\n', sec, count=1)
open(raiz+'/PROGRESSO.md','w',encoding='utf-8').write(t[:ini]+sec+t[fim:])
print('ok', c['pendente'], len(f['lotes_planejados']))
