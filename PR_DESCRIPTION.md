# feat(alive): illustrations redessinées et animées (web + mobile)

Branche : `feature/alive-illustrations`, depuis `main` (phases Alive 1–4 déjà fusionnées).

Les 43 illustrations PNG générées par IA (styles inégaux, mains réalistes à côté d'aplats, « T »
parasite sur le bouclier, mégaphone coupé, grain) sont **redessinées en vectoriel** dans un seul
langage visuel tiré du logo (hexagone, tours qui montent) et **animées**. Un seul fichier par
illustration sert le web et le mobile. Aucune logique métier, aucun appel d'API.

## Ce qui change pour l'utilisateur

- **Écrans de succès** : l'objet arrive, le badge lime saute, la coche se trace, confettis calmes.
- **États vides** : l'objet se pose, puis un seul geste vivant (l'étiquette du bagage se balance,
  la cloche oscille, la loupe cherche, la balance hésite, les fenêtres s'allument).
- **Onboarding et accueil** : la scène se construit (la résidence-logo monte tour par tour, les
  votes voyagent jusqu'à l'urne, la fuite goutte dans le viseur).
- **Actions rapides** : assemblage court à l'ouverture, puis immobiles (grille).
- **Affiches** : mégaphone qui émet, bulletin qui tombe dans l'urne, barres qui respirent.
- La respiration s'arrête après 3 cycles (≈ 12 s) : vivant, jamais insistant.

## Contrat

- `<nom>.json` (Lottie) + `<nom>.png` (image de repos = dernière image de l'intro, rendue par le
  même moteur → bascule invisible). Marqueurs `intro` / `idle`.
- Mouvement coupé (alive_v1 OFF, « Réduites », système) → image de repos seule ; mode lite →
  intro sans respiration ; hors écran → pause.
- **Web** : `lottie-web` light (SVG, sans eval) dans un chunk paresseux (163 kB, ≈ 45 kB gz)
  chargé à la première illustration visible ; aucune page ne le charge d'emblée, pages publiques
  inchangées (D5, règle ESLint). PNG ≈ 45 → 11 kB.
- **Mobile** : paquet `lottie` (`^3.3.1`) dans `SuIllustration` et `PosterArt`.

## Correctif trouvé en recette

Le middleware redirigeait `/illustrations/*.json` vers une URL localisée (seules les images
étaient exclues) : `illustrations/` est désormais hors middleware.

## Vérifié

- Les 43 animations rendues image par image dans Chromium (lottie-web) **et** avec un second
  moteur indépendant (rlottie) : rendus identiques.
- Web : `tsc`, `eslint`, `next build`, `check:alive` (100 %) ; en navigateur sur le build de
  production : chargement paresseux, intro à la montée côté client, relais sans saut après
  l'hydratation.
- Mobile : tests de widget ajoutés (`test/illustration_test.dart`).

## À faire avant fusion

- [ ] `flutter pub get` (ajoute `lottie` au `pubspec.lock`), `flutter analyze`, `flutter test` —
      pas de SDK Flutter dans l'environnement de cette branche ; la CI le fait.
- [ ] Regarder sur un vrai téléphone : accueil, onboarding, un écran de succès, un état vide.

## Fichiers

- `scripts/illustrations/` — source (scènes en Python → Lottie), export, outils de relecture.
- `apps/*/…/illustrations/` — 43 × (.json + .png) ; `PROMPTS.md` (prompts IA) supprimé.
- Web : `lib/feel/lottie-art.ts`, `components/ui/illustration.tsx`, `poster-art.tsx`,
  `poster-card.tsx`, bandeau d'onboarding du tableau de bord, `middleware.ts`, ESLint.
- Mobile : `core/widgets/illustration.dart`, `PosterArt` (`cards.dart`), accueil.
- Docs : `docs/ALIVE_ILLUSTRATIONS.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_016RDr9bhMHyxXjASucUyCud
