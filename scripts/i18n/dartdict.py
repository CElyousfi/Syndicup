#!/usr/bin/env python3
"""
Lecteur des dictionnaires mobiles écrits à la main (apps/mobile/lib/core/i18n/mobile_dict.dart) :
chaque classe porte `static const fr = Classe(champ: 'texte', …)` et `static const ar = …`.
Renvoie, par classe, la liste ordonnée des champs de la version FR et AR :
  str · {'map': {clé: str}} · {'list': [str]} · {'ref': 'AutreClasse'}
Utilisé par extract.py (textes à traduire) et build.py (génération des autres langues).
"""
import re

ESC = {'n': '\n', 't': '\t', "'": "'", '"': '"', '\\': '\\', '$': '$', 'r': '\r'}


class P:
    def __init__(self, s, i):
        self.s, self.i = s, i

    def ws(self):
        s = self.s
        while self.i < len(s):
            if s[self.i].isspace():
                self.i += 1
            elif s.startswith('//', self.i):
                self.i = s.index('\n', self.i)
            else:
                break

    def peek(self, t):
        self.ws()
        return self.s.startswith(t, self.i)

    def eat(self, t):
        self.ws()
        if not self.s.startswith(t, self.i):
            raise ValueError(f'attendu {t!r} à {self.s[self.i:self.i+60]!r}')
        self.i += len(t)

    def ident(self):
        self.ws()
        m = re.compile(r'[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?').match(self.s, self.i)
        if not m:
            raise ValueError(f'identifiant attendu à {self.s[self.i:self.i+60]!r}')
        self.i = m.end()
        return m.group(0)

    def one_string(self):
        self.ws()
        q = self.s[self.i]
        if q not in "'\"":
            raise ValueError(f'chaîne attendue à {self.s[self.i:self.i+60]!r}')
        self.i += 1
        out = []
        while True:
            c = self.s[self.i]
            if c == '\\':
                n = self.s[self.i + 1]
                if n == 'u':
                    if self.s[self.i + 2] == '{':
                        j = self.s.index('}', self.i)
                        out.append(chr(int(self.s[self.i + 3:j], 16)))
                        self.i = j + 1
                    else:
                        out.append(chr(int(self.s[self.i + 2:self.i + 6], 16)))
                        self.i += 6
                    continue
                out.append(ESC.get(n, n))
                self.i += 2
                continue
            if c == '$':
                raise ValueError('interpolation Dart non prise en charge dans un dictionnaire')
            if c == q:
                self.i += 1
                return ''.join(out)
            out.append(c)
            self.i += 1

    def string(self):
        parts = [self.one_string()]
        while True:
            self.ws()
            if self.i < len(self.s) and self.s[self.i] in "'\"":
                parts.append(self.one_string())
            else:
                return ''.join(parts)

    def value(self):
        self.ws()
        c = self.s[self.i]
        if c in "'\"":
            return self.string()
        if c == '{':
            self.eat('{')
            m = {}
            while not self.peek('}'):
                k = self.string()
                self.eat(':')
                m[k] = self.string()
                if self.peek(','):
                    self.eat(',')
            self.eat('}')
            return {'map': m}
        if c == '[':
            self.eat('[')
            items = []
            while not self.peek(']'):
                items.append(self.string())
                if self.peek(','):
                    self.eat(',')
            self.eat(']')
            return {'list': items}
        name = self.ident()
        cls, _, which = name.partition('.')
        if which not in ('fr', 'ar'):
            raise ValueError(f'référence inattendue {name}')
        return {'ref': cls}


def parse(path):
    src = open(path, encoding='utf-8').read()
    out = {}
    for m in re.finditer(r'static const (fr|ar) = ([A-Za-z]+)\(', src):
        lang, cls = m.group(1), m.group(2)
        p = P(src, m.end())
        fields = []
        while not p.peek(')'):
            name = p.ident()
            p.eat(':')
            fields.append((name, p.value()))
            if p.peek(','):
                p.eat(',')
        out.setdefault(cls, {})[lang] = fields
    return out


def strings(v):
    """Toutes les chaînes d'une valeur (str, map, list)."""
    if isinstance(v, str):
        return [v]
    if 'map' in v:
        return list(v['map'].values())
    if 'list' in v:
        return list(v['list'])
    return []


if __name__ == '__main__':
    import sys
    d = parse(sys.argv[1])
    for c, v in d.items():
        n = sum(len(strings(x)) for _, x in v['fr'])
        print(c, len(v['fr']), len(v.get('ar', [])), n)
