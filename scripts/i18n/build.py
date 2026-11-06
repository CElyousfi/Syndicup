#!/usr/bin/env python3
"""
Génère les fichiers de langue de l'app à partir des traductions (texte français → traduction) :

  scripts/i18n/translations/<code>.json        ← mémoire de traduction (versionnée)
  apps/web/lib/i18n/locales/<code>.json        ← dictionnaire web (même arbre que fr.ts, partiel)
  apps/web/lib/i18n/locales/index.ts           ← table des langues chargées
  apps/web/lib/i18n/locales/errors-ui.ts       ← textes d'erreur côté client
  apps/mobile/lib/core/i18n/mobile_dict_l10n.dart ← dictionnaires mobiles (mobile_dict.dart) traduits
  (puis node apps/mobile/tool/gen_i18n.mjs → dict.dart avec toutes les langues)

    python3 scripts/i18n/build.py              # régénère depuis translations/
    python3 scripts/i18n/build.py --ingest     # d'abord : work/out/<langue>.json + work/source.json → translations/

Un texte non traduit retombe sur le français, partout.
"""
import json, os, subprocess, sys
from common import HERE, ROOT, WORK, WEB_LOCALES, MOBILE_I18N, MOBILE_DICT, LANGS, web_dicts
from dartdict import parse

TR = os.path.join(HERE, 'translations')
# Nom de fichier des traducteurs → code de langue de l'app.
FILE_CODE = {'zh-Hans': 'zh'}
os.makedirs(TR, exist_ok=True)


def load(code):
    p = os.path.join(TR, f'{code}.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}


if '--ingest' in sys.argv:
    src = os.environ.get('I18N_SOURCE', os.path.join(WORK, 'source.json'))
    byid = {x['id']: x['fr'] for x in json.load(open(src, encoding='utf-8'))}
    for name in sorted(os.listdir(os.path.join(WORK, 'out'))):
        if not name.endswith('.json') or '.part' in name:
            continue
        lang = name[:-5]
        code = FILE_CODE.get(lang, lang)
        table = load(code)
        data = json.load(open(os.path.join(WORK, 'out', name), encoding='utf-8'))
        n = 0
        for k, v in data.items():
            if k in byid and isinstance(v, str) and v.strip():
                table[byid[k]] = v
                n += 1
        json.dump(table, open(os.path.join(TR, f'{code}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
        print('ingéré', code, n)

tables = {c: load(c) for c in LANGS_CODES} if (LANGS_CODES := [FILE_CODE.get(l, l) for l in LANGS]) else {}

# ── Web : même arbre que fr.ts, seulement les textes traduits ─────────────────────────────
fr_tree = web_dicts()['fr']


def tree(node, t):
    out = {}
    for k, v in node.items():
        if isinstance(v, str):
            if v in t:
                out[k] = t[v]
        else:
            sub = tree(v, t)
            if sub:
                out[k] = sub
    return out


os.makedirs(WEB_LOCALES, exist_ok=True)
loaded = []
for code, t in tables.items():
    if not t:
        continue
    json.dump(tree(fr_tree, t), open(os.path.join(WEB_LOCALES, f'{code}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    loaded.append(code)
ident = lambda c: 'L_' + c.replace('-', '_')
lines = ['/* Généré par scripts/i18n/build.py — ne pas modifier à la main. */']
lines += [f'import {ident(c)} from "./{c}.json";' for c in loaded]
lines += ['', 'export const LOCALE_TABLES: Partial<Record<string, unknown>> = {']
lines += [f'  {json.dumps(c)}: {ident(c)},' for c in loaded]
lines += ['};', '']
open(os.path.join(WEB_LOCALES, 'index.ts'), 'w').write('\n'.join(lines))

# Textes d'erreur côté client (lib/i18n/errors-ui.ts) : sous-arbre errors.{actions,boundary,viewer,stale,reference*}.
e = fr_tree['errors']
ui_src = {
    'actions': e['actions'], 'boundary': e['boundary'], 'viewer': e['viewer'], 'stale': e['stale'],
    'reference': {'reference': e['reference'], 'referenceCopy': e['referenceCopy'], 'referenceCopied': e['referenceCopied']},
}
ui = {c: tree(ui_src, tables[c]) for c in loaded}
open(os.path.join(WEB_LOCALES, 'errors-ui.ts'), 'w').write(
    '/* Généré par scripts/i18n/build.py — ne pas modifier à la main. */\n'
    'export const ERRORS_UI_L10N: Partial<Record<string, unknown>> = '
    + json.dumps(ui, ensure_ascii=False, indent=2) + ';\n')

# ── Mobile : dictionnaires de mobile_dict.dart dans chaque langue ─────────────────────────
def dq(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'").replace('$', '\\$').replace('\n', '\\n') + "'"


def lower(c):
    return c[0].lower() + c[1:]


def pascal(code):
    return ''.join(p.capitalize() for p in code.replace('_', '-').split('-'))


classes = parse(MOBILE_DICT)
dart = ['// GÉNÉRÉ par scripts/i18n/build.py — ne pas modifier à la main.',
        '// Source : mobile_dict.dart (FR) + scripts/i18n/translations/<langue>.json ; texte non traduit = français.',
        '// ignore_for_file: lines_longer_than_80_chars, prefer_single_quotes',
        '', "part of 'mobile_dict.dart';", '']
for cls, langs in classes.items():
    for code in loaded:
        t = tables[code]
        tr = lambda s: t.get(s, s)
        args = []
        for name, v in langs['fr']:
            if isinstance(v, str):
                args.append(f'{name}: {dq(tr(v))}')
            elif 'map' in v:
                args.append(f'{name}: {{' + ', '.join(f'{dq(k)}: {dq(tr(x))}' for k, x in v['map'].items()) + '}')
            elif 'list' in v:
                args.append(f'{name}: [' + ', '.join(dq(tr(x)) for x in v['list']) + ']')
            else:
                args.append(f"{name}: _{lower(v['ref'])}{pascal(code)}")
        dart.append(f'const {cls} _{lower(cls)}{pascal(code)} = {cls}(' + ', '.join(args) + ');')
    dart.append(f'const Map<String, {cls}> _{lower(cls)}L10n = {{' + ', '.join(f"'{c}': _{lower(cls)}{pascal(c)}" for c in loaded) + '};')
    dart.append('')
open(os.path.join(MOBILE_I18N, 'mobile_dict_l10n.dart'), 'w', encoding='utf-8').write('\n'.join(dart))

subprocess.check_call(['node', os.path.join(ROOT, 'apps', 'mobile', 'tool', 'gen_i18n.mjs')], cwd=ROOT)
print('langues :', ' '.join(loaded))
