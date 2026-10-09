# scripts/illustrations — scènes vectorielles → Lottie

Source unique des 43 illustrations animées (docs/ALIVE_ILLUSTRATIONS.md).

```
src/kit.py              géométrie → Lottie (formes, peinture, calques, vocabulaire d'animation)
src/objects.py          objets dessinés réutilisables (carte, enveloppe, urne, porte, hexagone…)
src/scenes_ok.py        écrans de succès          src/scenes_empty.py      états vides + offline
src/scenes_onboarding.py onboarding + accueil     src/scenes_quick.py      actions rapides
src/scenes_poster.py    affiches 1600×1000
tools/render.mjs        rend des images (lottie-web dans Chromium sans tête)
tools/export.py         écrit <nom>.json + <nom>.png (image de repos) dans les deux apps
tools/sheet.py          planche-contact pour relire un lot
```

## Banc de rendu (une fois)

```bash
mkdir -p /tmp/su-bench && npm i --prefix /tmp/su-bench playwright-core@1.48.2 lottie-web@5.12.2
npx --prefix /tmp/su-bench playwright-core install chromium-headless-shell   # si absent
export BENCH=/tmp/su-bench PW_CHROMIUM=<chemin du headless_shell>
pip install pillow
```

## Exporter

```bash
python3 scripts/illustrations/tools/export.py              # tout
python3 scripts/illustrations/tools/export.py ok-vote      # une seule
```

## Relire avant d'exporter

```bash
python3 scripts/illustrations/src/build.py /tmp/out/json ok-vote
node scripts/illustrations/tools/render.mjs /tmp/out/strip 240 strip:10 /tmp/out/json/ok-vote.json
python3 scripts/illustrations/tools/sheet.py /tmp/out/strip.png 10 240 /tmp/out/strip/*.png
```

## Règles

- Uniquement ce que lottie-web ET le paquet Flutter `lottie` rendent à l'identique : calques de
  formes, parentage, rect/ellipse/chemins, aplats, traits arrondis, trim au niveau du calque,
  transformations, marqueurs. Pas de masques, mattes, expressions, dégradés ni texte.
- Le parentage Lottie ne transmet PAS l'opacité : `kit.py` la recopie aux enfants (assemblage
  qui apparaît d'un bloc).
- Une boucle d'ambiance doit être sans couture (`_periodic`) et rester discrète : quelques
  pixels, quelques degrés.
- Vérification croisée possible avec un second moteur : `pip install rlottie-python`.
