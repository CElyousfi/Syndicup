#!/usr/bin/env python3
"""Fusionne les parties : python3 scripts/i18n/merge.py <langue>  (work/out/<langue>.part*.json → work/out/<langue>.json), puis check.py.
   python3 merge.py <langue> <de> <à> ne vérifie que la plage d'ids donnée."""
import glob, json, os, re, subprocess, sys
from common import WORK, HERE
lang = sys.argv[1]
merged = {}
parts = sorted(glob.glob(os.path.join(WORK, 'out', f'{lang}.part*.json')), key=lambda p: int(re.search(r'part(\d+)', p).group(1)))
for p in parts:
    try:
        merged.update(json.load(open(p, encoding='utf-8')))
    except Exception as e:
        print('JSON INVALIDE dans', os.path.basename(p), e); sys.exit(1)
json.dump(merged, open(os.path.join(WORK, 'out', f'{lang}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
sys.exit(subprocess.call([sys.executable, os.path.join(HERE, 'check.py'), lang, *sys.argv[2:4]]))
