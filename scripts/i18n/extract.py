#!/usr/bin/env python3
"""
Liste tous les textes français à traduire → work/source.json : [{id, fr, ar, k}], un élément par
texte FR distinct (web : apps/web/lib/i18n/fr.ts ; mobile : mobile_dict.dart). `ar` = traduction
arabe existante (aide au sens), `k` = une clé où le texte apparaît (contexte).

    python3 scripts/i18n/extract.py            # tous les textes
    python3 scripts/i18n/extract.py --missing  # seulement ceux qu'une langue n'a pas encore (translations/)
"""
import json, os, sys
from common import HERE, WORK, MOBILE_DICT, LANGS, web_dicts, flat
from dartdict import parse, strings

d = web_dicts()
fr, ar = flat(d['fr']), flat(d['ar'])
items, seen = [], {}


def add(text, ar_text, key):
    if text in seen or not text.strip():
        return
    seen[text] = len(items)
    items.append({'id': str(len(items)), 'fr': text, 'ar': ar_text, 'k': key})


for k, v in fr.items():
    add(v, ar.get(k, ''), 'web:' + k)
for cls, langs in parse(MOBILE_DICT).items():
    ar_fields = dict(langs.get('ar', []))
    for name, v in langs['fr']:
        a = ar_fields.get(name)
        if isinstance(v, dict) and 'map' in v:
            am = a['map'] if isinstance(a, dict) and 'map' in a else {}
            for mk, s in v['map'].items():
                add(s, am.get(mk, ''), f'mobile:{cls}.{name}.{mk}')
            continue
        fs, as_ = strings(v), (strings(a) if a is not None else [])
        for i, s in enumerate(fs):
            add(s, as_[i] if i < len(as_) else '', f'mobile:{cls}.{name}')
if '--missing' in sys.argv:
    codes = [{'zh-Hans': 'zh'}.get(l, l) for l in LANGS]
    tr = {}
    for c in codes:
        p = os.path.join(HERE, 'translations', f'{c}.json')
        tr[c] = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
    items = [x for x in items if any(x['fr'] not in tr[c] for c in codes)]
    for i, x in enumerate(items):
        x['id'] = str(i)
os.makedirs(WORK, exist_ok=True)
json.dump(items, open(os.path.join(WORK, 'source.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(items), 'textes', sum(len(x['fr']) for x in items), 'caractères')
