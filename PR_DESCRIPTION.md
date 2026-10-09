# feat(alive): phase 1 — fondations (jetons, haptique, sons, drapeau alive_v1, Sensations)

Branche : `feature/alive-foundations` → `main`. Première des quatre PR de la couche « Alive »
(audit : `docs/ALIVE_AUDIT.md`). **Aucune logique métier, aucun calcul monétaire, aucune donnée
touchée.** La seule surface d'API ajoutée est `GET /v1/config/client`, approuvée en D1.

## Ce qui change

### API : `GET /v1/config/client` (décision D1)
- Public, lecture seule, sans authentification. Enveloppe standard
  `{ data: { flags: { alive_v1 } }, meta }`, `Cache-Control: public, max-age=60`.
- Lu depuis la variable d'environnement **`ALIVE_V1`** (`true`/`false`, absente ⇒ `true`). Aucune
  base, aucune migration. La variable est validée par Zod au démarrage (`lib/config/env.ts`) et
  déclarée dans `render.yaml` pour les deux services API.
- Le contrat est d'abord écrit dans `openapi.yaml` (nouveau tag `Config`). La conformité contrat ↔
  routes donne 318/318.
- La forme est générique : un futur drapeau = une clé de plus dans `flags`. Un client qui ne
  connaît pas un drapeau l'ignore.
- **Couper la couche** : `ALIVE_V1=false` sur Render puis redémarrer l'API. Tous les clients
  suivent en 60 s au plus (web : au prochain rendu ; mobile : au retour au premier plan).

### Jetons de mouvement partagés (décision D6)
- Source unique : `packages/config/motion/tokens.json`.
- Un générateur (`npm run motion:tokens`) produit :
  - `apps/web/app/motion-tokens.css`
  - `apps/web/lib/motion-tokens.ts`
  - `apps/mobile/lib/core/theme/motion_tokens.g.dart`
- `--check` en CI fait échouer la build si un fichier généré n'est pas à jour.

| Jeton | Avant (web = mobile) | Après | Usage |
|---|---|---|---|
| `press` (nouveau) | 120 ms (via `fast`) | **100 ms** | Enfoncement sous le doigt : retour tactile, reste vif |
| `toggle` (nouveau) | 120 ms (via `fast`) | **120 ms** | Interrupteurs, cases, segments, puces : inchangé |
| `release` (nouveau) | web 360 ms / mobile 380 ms | **360 ms** | Relâchement en ressort, unifié |
| `fast` | 120 ms | **180 ms** | Fondus courts (textes, badges). Plus utilisé pour le toucher |
| `base` | 220 ms | **260 ms** | Transitions standard |
| `page` | 320 ms | 320 ms | Inchangé |
| `slow` | 350 ms | **400 ms** | Entrées, jauges, révélations |
| `sheetIn` / `sheetOut` | 420 / 260 ms (mobile seul) | **400 / 260 ms** | Feuilles du bas (montée / descente) |
| `number` (nouveau) | — | 900 ms | Roulement d'un montant qui change |
| `highlight` (nouveau) | — | 1 200 ms | Surlignage d'une donnée arrivée en direct |
| `signature` / `signatureMax` (nouveaux) | — | 700 / 1 200 ms | Moments signature (plafond 1,2 s) |
| `stagger` | 45 ms | **35 ms** | Décalage d'une cascade |
| `maxStagger` | 12 éléments | **8** | Au-delà, même délai (brief : max 8 animés) |
| `distances` (nouveau) | — | 8 / 16 / 24 px | Glissements |
| `pressScale` (nouveau) | 0,965 / 0,97 / 0,985 / 0,94 / 0,9 dispersés | idem, nommés | bouton / carte / ligne / puce / icône |
| Courbes `easeOut` / `easeIn` / `spring` | inchangées | inchangées | — |
| Ressorts (nouveaux sur mobile) | web : `SPRING_PRESS`, `SPRING_LAYOUT` | `snappy` (520/34/0,7), `smooth` (380/34/0,9), `gentle` (180/22/1) | Physique réelle, mêmes valeurs des deux côtés |
| `hapticThrottle` (nouveau) | — | 80 ms | Anti-rafale haptique |

Le retour tactile (`.su-btn:active`, cartes, `SuPressable`) passe sur `press` (100 ms) et `release`.
Il ne ralentit jamais.

### Services « feel »
- **Mobile** `lib/core/feel/` : `Feel.init` au démarrage, `ClientFlags`, `Sensations`, `LiteMode`,
  `Haptics`, `Sounds`.
- **Web** `lib/feel/` : `flags` (serveur), script d'amorçage, `prefs`, `haptics`, `sounds`.
- **Haptique sémantique** : `tap`, `select`, `success`, `warning`, `error`, `heavy`.
  - Anti-rafale de 80 ms, jamais au défilement ni à la frappe.
  - Muette si le réglage « Vibrations » est coupé ou si `alive_v1` est désactivé.
  - Reste active en « animations réduites » : on réduit le mouvement, pas le toucher.
  - Web : `navigator.vibrate`, donc Android uniquement ; ailleurs, aucun effet.
- **Sons sémantiques** : `confirm`, `success`, `sent`, `notify`, `error`, `signature`.
  - Préchargés, volume bas.
  - Mobile : catégorie iOS **ambient**, qui respecte le bouton silencieux et ne coupe ni la
    musique ni un appel. Android : *sonification* sans prise de focus audio.
  - Web : Web Audio, déverrouillé au premier geste.
  - Les six fichiers sont des placeholders synthétisés (`apps/mobile/tool/gen_sounds.mjs`, ≤ 390 ms,
    ≤ 17 Ko). Le brief des sons définitifs est dans `docs/SOUNDS.md`.
- **Mode lite automatique** : les effets d'ambiance sont coupés ; les retours tactiles et les
  compteurs sont gardés.
  - Mobile : Android `isLowRamDevice` ou ≤ 3 Go de RAM, ou économiseur de batterie (relu au retour
    au premier plan).
  - Web : `deviceMemory ≤ 2`, `hardwareConcurrency ≤ 2` ou `saveData`.
- **Drapeau côté clients (D1)** :
  - Dernière valeur connue sur l'appareil (mobile `shared_preferences`, web `localStorage` via le
    script d'amorçage) et en mémoire côté serveur web.
  - Endpoint injoignable ⇒ dernière valeur ; installation neuve sans valeur ⇒ ON.

### Réglages « Sensations » (décision D2 : sur l'appareil)
- Profil → **Sensations** sur mobile et sur web : Animations (Complètes / Réduites), Vibrations, Sons.
  Tout est activé par défaut et s'applique immédiatement.
- « Réduites » est fusionné avec la préférence système :
  - mobile : `MediaQuery.disableAnimations`, déjà lu par tout le code existant ;
  - web : `data-motion="reduced"` + même règle CSS que `prefers-reduced-motion` +
    `MotionConfig reducedMotion="always"`.
- **Écran caché « Tester les sensations »** : il joue chaque son et chaque vibration en ignorant
  les réglages, pour juger sur un vrai téléphone.
  - Mobile : visible dans Profil en debug, ou avec `--dart-define=SENSATIONS_TEST=true`.
  - Web : `/fr/debug/sensations`, en développement ou avec `SENSATIONS_TEST=true`.
- Textes FR/AR ajoutés dans `lib/i18n/{fr,ar}.ts` (section `alive`), puis `dict.dart` mobile régénéré.

### Garde-fou « écrans vivants » + rapport de couverture
- `npm run check:alive` (`scripts/alive/check-alive.mjs`) interdit, dans les écrans, les
  primitives mortes qui ont un équivalent vivant : `InkWell`, boutons Material bruts,
  `RefreshIndicator`, spinners, montants en texte figé, `<button>`, `<img>`, `HapticFeedback`…
  - Exception motivée possible : `alive:allow <raison>`.
  - `npm run alive:report` écrit `docs/ALIVE_COVERAGE.md` (tableau écran × élément).
- **Phase 1 : la CI l'exécute en avertissement** (`--warn`). Il passe en **bloquant** à la fin de
  la phase 2, une fois la migration faite.
- Point de départ mesuré : mobile 80,5 % vivant (226 usages bruts), web 93,9 % (96).

### Documents
- `docs/ALIVE_AUDIT.md` (phase 0), `docs/SOUNDS.md`, `docs/PRESENCE_TICKET.md` (D3 : présence
  hors périmètre ; ticket backend pour plus tard).

## Dépendances ajoutées (mobile)
`audioplayers ^6.6.0` (sons, contexte audio ambient), `battery_plus ^7.1.2` (économiseur),
`device_info_plus ^12.4.0` (RAM Android). Aucune dépendance web.

## Vérifications
- API : `vitest tests/config-client.test.ts` passe (5 tests : 200 sans jeton, cache 60 s, `false`,
  défaut ON sur valeur absente ou invalide, booléens uniquement, schéma d'environnement), et
  `tsc` est propre. Testé en local avec `curl /v1/config/client`, qui renvoie 200 et
  `cache-control: public, max-age=60`.
- Mobile : `flutter analyze` ne montre aucune erreur ni avertissement (61 infos, toutes antérieures).
  `flutter test` passe (37/37), dont 6 nouveaux : drapeau (défaut, cache, hors-ligne, 500, type
  invalide), persistance Sensations, haptique (intention → moteur, anti-rafale 80 ms, réglage
  coupé, drapeau OFF).
- Web : `tsc --noEmit` et ESLint sont propres. Rendu vérifié : `<html data-alive="1"
  data-alive-src="api">` et script d'amorçage présent.
- Jetons : `node packages/config/motion/gen.mjs --check` passe.

## Hors de cette PR
Phase 2 (primitives vivantes + migration de tous les écrans, AnimatedAmount, rapport à 100 %),
phase 3 (ambiance), phase 4 (moments signature).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
