# Illustrations vivantes (alive_v1)

Les 43 illustrations de l'app (accueil, onboarding, écrans de succès, états vides, actions
rapides, affiches) sont **dessinées en vectoriel et animées**, une seule source pour le web et le
mobile. Elles remplacent les PNG générés par IA (styles inégaux, mains réalistes, artefacts).

## Langage visuel

- Formes plates et épaisses, une **profondeur pleine** dans le ton plus sombre (lumière en haut à
  gauche), coins arrondis partout, aucun dégradé, aucun texte.
- Palette de marque uniquement : verts (`#1E7552` et ses tons), lime `#E3EF8D` pour l'accent
  (coches, pièces, lumière), sauge, greige, blanc, encre.
- Le **logo** est le motif récurrent : l'hexagone (badges de succès, marques sur les urnes) et les
  trois tours qui montent (accueil, affiche d'onboarding).
- Une scène = une « scène » teintée (disque sauge pâle) + l'objet + 2–3 étincelles lime.

## Ce que fait chaque famille

| Famille | Intro (à l'apparition) | Respiration (après) |
|---|---|---|
| `ok-*` succès | l'objet arrive, le badge lime saute, la coche se trace, confettis | l'objet flotte, confettis scintillent |
| `empty-*`, `offline` | l'objet se pose (≈ 1 s) | un seul geste propre à l'objet : l'étiquette se balance, la cloche oscille, la loupe cherche, la balance hésite |
| `ob-*`, `welcome-hero` | la scène se construit en séquence (≈ 1,3 s) | fenêtres qui s'allument, arbres, nuages, votes qui voyagent jusqu'à l'urne, goutte qui tombe |
| `quick-*` (grilles, 48 px) | assemblage court (≈ 0,6 s) | **aucune** (plusieurs côte à côte) |
| `poster-*` | l'art entre dans la moitié droite | ondes du mégaphone, bulletin qui tombe dans l'urne, barres qui respirent |

La respiration est **plafonnée à 3 cycles (≈ 12 s)**, puis l'illustration se pose — même règle
que les pastilles (rien ne boucle indéfiniment).

## Contrat d'exécution (les deux apps)

- Fichiers frères dans `apps/web/public/illustrations/` et `apps/mobile/assets/illustrations/` :
  `<nom>.json` (Lottie) et `<nom>.png` (**image de repos**, rendue depuis l'animation : identique
  pixel pour pixel à la fin de l'intro — la bascule est invisible).
- Frise : marqueur `intro` = `[0, repos)`, marqueur `idle` = `[repos, fin)`.
- Mouvement coupé (alive_v1 à OFF, « Animations réduites », préférence système) : image de repos
  seule — sur le web, le lecteur n'est même pas téléchargé.
- Mode lite / appareil modeste : intro oui, respiration non.
- Hors écran : pause (web : IntersectionObserver ; mobile : TickerMode).

### Web (`lib/feel/lottie-art.ts`)

- `lottie-web` **light** (rendu SVG, sans expressions ni `eval`), 163 kB / ≈ 45 kB gz, dans un
  chunk paresseux chargé à la **première illustration visible** — aucune page ne le charge
  d'emblée, les pages publiques ne bougent pas (D5 ; règle ESLint : seul `lib/feel/lottie-art`
  peut l'importer).
- Rendu serveur / hydratation : l'image de repos s'affiche, l'animation prend le relais sur la
  même image puis respire. Montée côté client (navigation, modale, écran de succès) : l'intro
  joue (si le lecteur n'est pas prêt en 700 ms, l'image de repos s'affiche).
- Le middleware laisse passer `illustrations/` (les `.json` étaient sinon redirigés vers une URL
  localisée).
- La page publique de connexion garde l'image de repos statique de `welcome-hero` (D5).

### Mobile (`lib/core/widgets/illustration.dart`)

- Paquet `lottie` ; `SuIllustration` et `PosterArt` jouent l'intro au montage puis la
  respiration ; sinon `Image.asset` du PNG.
- Tests : `test/illustration_test.dart` (repli, image de repos sans `.json`, mouvement réduit).

## Modifier ou ajouter une illustration

Tout est du code dans `scripts/illustrations/` (voir son README) : objets réutilisables
(`objects.py`), scènes par famille (`scenes_*.py`), export vers les deux apps (`tools/export.py`).
Ne jamais modifier un `.json` ou un `.png` à la main : ils sont régénérés.
