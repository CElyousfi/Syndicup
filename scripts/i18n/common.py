"""Chemins et lecture des sources FR/AR, partagés par extract.py et build.py."""
import json, os, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
WEB_LOCALES = os.path.join(ROOT, 'apps', 'web', 'lib', 'i18n', 'locales')
MOBILE_I18N = os.path.join(ROOT, 'apps', 'mobile', 'lib', 'core', 'i18n')
MOBILE_DICT = os.path.join(MOBILE_I18N, 'mobile_dict.dart')
WORK = os.environ.get('I18N_WORK', os.path.join(HERE, 'work'))

# Langues proposées en plus du français (référence) et de l'arabe (écrits à la main).
# Ajouter une langue : l'ajouter ici + dans LANGUES (web lib/i18n/core.ts, mobile i18n.dart),
# faire traduire work/source.json (BRIEF.md), puis build.py.
LANGS = ['en', 'es', 'it', 'de', 'nl', 'pt', 'ru', 'tr', 'zh-Hans']


def web_dicts():
    out = subprocess.check_output(['npx', 'tsx', os.path.join(HERE, 'dump_web.ts')], cwd=ROOT)
    return json.loads(out)


def flat(o, p='', acc=None):
    acc = {} if acc is None else acc
    for k, v in o.items():
        if isinstance(v, str):
            acc[p + k] = v
        else:
            flat(v, p + k + '.', acc)
    return acc
