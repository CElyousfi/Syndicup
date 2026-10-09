# feat(alive): phase 3 — l'application respire (ambiance)

Branche : `feature/alive-ambient`, empilée sur `feature/alive-components` (phase 2).
**Présentation uniquement** : aucune donnée, aucun appel d'API ajouté. Toute l'ambiance s'éteint en mode
lite (appareil modeste, économiseur de batterie, économie de données), en « animations réduites »
(système ou Sensations) et avec `ALIVE_V1=false`.

## Ce qui change

| Brief (phase 3) | Mobile | Web |
|---|---|---|
| **Données en direct** | Déjà assuré par la phase 2 : invalidations SSE → montants qui roulent, lignes clées qui entrent avec un surlignage, toast « Ouvrir » + son `notify`. | Déjà assuré par la phase 2 : `router.refresh()` (SSE, 25 s, retour d'onglet) → `Amount`, `LiveList`, éclosion des badges. Vérifié de bout en bout (vidéo de la phase 2). |
| **Présence** | Hors périmètre (D3) → `docs/PRESENCE_TICKET.md`. | Idem. |
| **Salutation selon l'heure (FR/AR)** | « Bonjour / Bon après-midi / Bonsoir / Bonne nuit {prénom} », révélée mot par mot. | Idem (`<Greeting>`) : heure de Casablanca au rendu serveur, corrigée par l'heure locale au montage. Repli « Bonjour {prénom} » si `alive_v1` est coupé. |
| **Dérive lente du héros** | `SuHeroDrift` : halo lime à 16 % qui dérive sur la photo du tableau de bord, cycle de 20 s. Le ticker s'arrête hors écran (TickerMode). | `.alive-drift` sur les cartes-affiches : pseudo-élément déplacé par `transform`, donc composité, sans repeint par image. |
| **Parallaxe** | `SuParallax` (≤ 10 px) sur la photo du tableau de bord et les `PhotoBanner`. | `.su-parallax` en défilement natif (`animation-timeline: view()`, sans JS) sur `PhotoBanner` et `PosterCard`. Ignoré par les navigateurs qui ne le gèrent pas. |
| **Cartes qui apparaissent au défilement (1re fois seulement)** | `SuEnter` : une ligne clée qui entre à l'écran après la cascade d'arrivée glisse une seule fois par écran (mémoire par route). | `useScrollReveal` : les blocs de `.page-root` sous la ligne de flottaison sont révélés une fois (IntersectionObserver). |
| **Connectivité** | Bandeau calme sous l'encoche : hors ligne → se déplie ; retour → « Connexion rétablie » 2,6 s, puis se replie. | Pastille flottante identique (`online` / `offline`), `warning()` haptique au passage hors ligne. Le web n'a aucune file d'écriture : les finances ne sont jamais mises en attente (Master Spec 13.3). |
| **Actions en file hors ligne : en attente → coche** | `SuQueueSyncFlash` sur les quatre files existantes (visites, LCD, présences, tâches) : quand la file baisse, une coche « Synchronisé » se trace, avec `select()`. Les lignes de la file des visites se replient en sortant. | — (pas de file hors ligne côté web) |
| **Retour au premier plan** | Après ≥ 30 s en arrière-plan, les lectures visibles sont relancées SANS écran blanc (`skipLoadingOnRefresh`) : les montants roulent, les lignes entrent. | Déjà en place (`visibilitychange` → `router.refresh()`), désormais animé. |
| **Lancement** | `LaunchHandoff` : le logo du démarrage reste une fraction de seconde au-dessus du premier écran puis remonte vers l'en-tête en s'effaçant (650 ms). Les routes gardent `NoTransitionPage`, correctif du 2026-10-01 préservé. | Sans objet (pas d'écran de démarrage) : la page arrive en cascade. |
| **Inclinaison gyroscope** | Abandonnée (D4). | Abandonnée (D4). |

## Fichiers clés
- **Mobile**
  - `lib/core/widgets/ambient.dart` : `SuGreeting`/`greetingFor`, `SuHeroDrift`, `SuParallax`, `SuStatusBanner`, `SuSyncState`, `SuQueueSyncFlash`, `LaunchHandoff`, `SuScrollReveal`.
  - Raccordements : coque (bandeau, retour au premier plan, relais du lancement), tableau de bord, files hors ligne, `PhotoBanner`, `SuEnter`.
- **Web**
  - `components/shell/ambient.tsx` (`ConnectivityBanner`, `useScrollReveal`), `components/ui/greeting.tsx`.
  - CSS dans `app/motion.css` (« phase 3 ») ; classes posées sur `PhotoBanner` et `PosterCard`.

## Vérifications
- **Mobile**
  - `flutter analyze` : aucune erreur, aucun avertissement.
  - `flutter test` : 45/45.
- **Web**
  - `tsc` et ESLint propres ; `check:alive` à 100 % ; jetons à jour.
  - Firefox (Playwright) au format téléphone 390 × 844, tableau de bord du syndic :
    - salutation « Bonsoir Youssef » ;
    - passage hors ligne → bandeau `off` « Vous êtes hors ligne — les données affichées peuvent dater. » ;
    - retour → `back` « Connexion rétablie », puis `ok` ;
    - défilement : 8 blocs révélés (7 encore en attente plus bas) ;
    - 0 erreur JS.
  - Vidéo : `web-ambient-offline-greeting-reveal.webm`.
- Le poids des pages publiques est inchangé par cette phase : la salutation et le bandeau ne vivent que dans l'espace connecté.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
