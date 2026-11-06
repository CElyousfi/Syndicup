#!/usr/bin/env python3
"""Valide une traduction : python3 scripts/i18n/check.py <langue>  (lit work/out/<langue>.json)."""
import json, os, re, sys
from common import WORK
lang = sys.argv[1]
src = json.load(open(os.path.join(WORK, 'source.json'), encoding='utf-8'))
if len(sys.argv) == 4:  # vérifier seulement une plage d'ids : check.py <langue> <de> <à>
    lo, hi = int(sys.argv[2]), int(sys.argv[3])
    src = [x for x in src if lo <= int(x['id']) <= hi]
try:
    out = json.load(open(os.path.join(WORK, 'out', f'{lang}.json'), encoding='utf-8'))
except Exception as e:
    print('JSON INVALIDE :', e); sys.exit(1)
ph = lambda s: sorted(re.findall(r'\{[A-Za-z_][A-Za-z0-9_]*\}', s))
mk = lambda s: (s.count('**'), s.count('\n'))
errs, ids = [], {x['id'] for x in src}
for x in src:
    v = out.get(x['id'])
    if not isinstance(v, str) or not v.strip():
        errs.append(f"manquant {x['id']} : {x['fr'][:60]}")
        continue
    if ph(v) != ph(x['fr']):
        errs.append(f"variables {x['id']} : {ph(x['fr'])} ≠ {ph(v)} :: {v[:60]}")
    if mk(v) != mk(x['fr']):
        errs.append(f"marques (** ou retour ligne) {x['id']} :: {v[:60]}")
for k in out:
    if k not in ids and len(sys.argv) != 4:
        errs.append(f'id inconnu {k}')
for e in errs[:60]:
    print(e)
done = len(src) - len([e for e in errs if e.startswith('manquant')])
print(f'{lang} : {done}/{len(src)} traduits, {len(errs)} problèmes')
sys.exit(1 if errs else 0)
