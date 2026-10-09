# feat(alive): phase 2 — chaque élément vivant (primitives + migration de tous les écrans)

Branche : `feature/alive-components`, empilée sur `feature/alive-foundations` (phase 1). À merger
après elle, ou viser `feature/alive-foundations` pour une revue du seul diff de la phase 2.
**Présentation uniquement** : aucun appel d'API, aucune logique métier, aucun calcul monétaire n'est
modifié. Tous les nouveaux comportements s'éteignent avec `ALIVE_V1=false`.

## Résultat

| | Avant (phase 0) | Après |
|---|---|---|
| Mobile — primitives vivantes | 80,5 % (226 usages bruts) | **100 %** (1 095 usages, 0 brut, 2 exceptions motivées) |
| Web — primitives vivantes | 93,9 % (96 usages bruts) | **100 %** (1 652 usages, 0 brut, 7 exceptions motivées) |
| Montants animés au changement | 4 mobile / 15 web (odomètres de tuiles) | **tous les montants affichés** (≈ 100 mobile, ≈ 160 web) |
| Spinners plein écran | 5 mobile / 2 web | **0** |
| CI | — | `check:alive` **bloquant** (et plus en avertissement) |

Rapport détaillé écran × élément : `docs/ALIVE_COVERAGE.md`, généré par `npm run alive:report`.
Exceptions restantes, toutes motivées sur la ligne même :
- le champ OTP invisible sous les six cases ;
- une aide de tuile qui n'accepte que du texte ;
- les cases OTP du web ;
- le lien « renvoyer le code » ;
- deux `<option>` natives ;
- un texte réservé aux lecteurs d'écran ;
- une option de sondage `required` ;
- un radio réparti sur une liste dynamique.

## Primitives (contrat complet : `docs/ALIVE_GUIDE.md` §3)

**Mobile** (`lib/core/widgets/alive.dart` + mises à niveau de `forms`, `cards`, `page`, `states`, `badge`, `success`, `toast`) :
- **Toucher**
  - `SuTap` : enfoncement en ressort ; un appui long soulève l'élément.
  - `SuButton` : le chargement s'affiche DANS le bouton, coche tracée à la fin d'un envoi réussi, secousse + `warning()` à chaque nouvel échec.
  - `SubmitButton(fail:)` délègue à `SuButton`.
  - `SuIconButton` : l'icône se transforme quand elle change.
- **Montants** : `AnimatedAmount` / `AnimatedFigureText` / `KeyValueRow.amount` / `MoneyText`.
  - Texte simple au premier affichage. À chaque changement, seuls les chiffres qui changent roulent, avec une teinte verte ou rouge (`upIsGood: false` pour les impayés).
  - Comparaison exacte en `BigInt` sur la chaîne formatée : **jamais de float**.
- **Formulaires**
  - `SuField` : l'erreur, serveur ou validateur, secoue le champ en miroir RTL ; coche de validité.
  - `SuSearchField` : bouton d'effacement qui éclot.
  - `SuCheckbox` (coche qui se trace, style de libellé animé), `SuRadioGroup`, `SuSwitchRow` ; `select()` sur `Segmented` et `FilterChips`.
- **Listes**
  - `SuLiveColumn` (utilisée par `CardList`) : une ligne clée insérée se déplie avec un surlignage lime, une ligne retirée se replie. Toutes les listes de données ont reçu des clés `ValueKey(id)`.
  - `SuSwipeAction` : glisser pour marquer une notification comme lue, avec l'action existante.
- **Surfaces**
  - `SuRefresh` : indicateur SyndicUp, `select()` au seuil, coche à la fin.
  - `SuImage` : apparition en fondu et dézoom.
  - `SuRing` / `Gauge`, `showSuSheet`, `showSuDialog` (entrée en ressort).
  - `SuFadeSwitch` : plus aucun contenu qui change d'un coup.
- **Coque**
  - Indicateur d'onglet qui glisse en ressort (miroir en arabe), `select()` au changement d'onglet.
  - Notifications en direct en toast avec action « Ouvrir » + son `notify` ; les menus en `showSuSheet`.
- **Badges** : plus de pulsation en boucle (19 points). Une seule pulsation, et une éclosion quand le statut change.
- **Succès** : `showSuccess` émet `success()` + le son `success`.

**Web** (`components/ui/`) :
- **Toucher**
  - `Button` / `ButtonLink` : 100 ms à l'enfoncement.
  - `IconButton`, et `Pressable` pour les tuiles à mise en page libre (`ui/pressable`).
  - `SubmitButton` + `FormAlert` : coche après succès, secousse après refus, haptique.
- **Montants** : `Amount` / `Figure`, même contrat que le mobile. Les montants roulent après l'actualisation live (25 s), une action ou le retour sur l'onglet.
- **Formulaires**
  - `Field` : secousse en miroir RTL, coche de validité en CSS.
  - `Switch` / `Checkbox` / `RadioGroup` (`ui/toggle`) : coche tracée, `select()`.
- **Listes** : `LiveList` (dont 30 tables et listes migrées). Une ligne arrivée en direct se déplie avec un surlignage, une ligne retirée se replie.
- **Badges** : restent des composants serveur sans JS ; la coque connectée les fait éclore quand leur statut change (`useBadgePop`).
- **Surfaces**
  - `Modal` : la feuille du bas se ferme en glissant (mobile).
  - `ProgressBar` / `RingGauge` : remplissage par `transform`, jamais de reflow.
  - Trésorerie : la ligne se trace et se transforme quand l'exercice change, les barres et les points glissent.
  - Toast d'erreur → `error()` ; notification en direct → son `notify`.
- **D5** : `motion` est autorisé dans `components/ui/**` et reste interdit dans `(public)` et `components/auth` (ESLint).

## Poids JS des pages publiques (D5 — mesuré, gzip, premier chargement)

Builds de production comparés, `main` contre cette branche (`app-build-manifest`, somme gzip des
fragments chargés au premier affichage) :

| Page | `main` | Phase 2 | Δ |
|---|---:|---:|---:|
| `/connexion` | 118,63 kB | 118,57 kB | **−0,06 kB** |
| `/connexion/code` | 116,94 kB | 117,04 kB | +0,10 kB |
| `/invitation` | 115,10 kB | 115,17 kB | +0,07 kB |
| `/invitation/[code]` | 116,73 kB | 116,65 kB | **−0,08 kB** |
| `/compte/sans-acces`, `/` | 112,90 / 113,13 kB | 112,92 / 113,15 kB | +0,02 kB |

Ce qui a été fait pour tenir la contrainte :
- Tout ce qui se déclenche après un geste vit dans un seul module différé, `lib/feel/lazy.ts` : haptique, résultat de formulaire, glisser de feuille.
- Coches en CSS (masque SVG).
- `Badge` reste un composant serveur.
- `Switch`, `Checkbox`, `IconButton`, `Pressable` et `IrreversibleNotice` sont sortis des modules importés par les pages publiques.

Ce qui reste :
- **+20 octets sur toutes les pages** : l'entrée de ce module différé dans la table du runtime webpack.
- **+70 à +100 octets sur deux pages** : le code d'annonce du résultat dans `FormAlert` et le crochet de glisser de `Modal`.

Pour revenir strictement à zéro, il faudrait retirer la coche et la secousse du bouton d'envoi sur les pages publiques. **À décider** : je ne l'ai pas fait sans votre accord.

## Vérifications
- **Mobile**
  - `flutter analyze` : aucune erreur, aucun avertissement (infos antérieures uniquement).
  - `flutter test` : 45/45, dont 8 nouveaux tests de contrat — `compareFigures` sans float, aucune animation au premier affichage, roulement + valeur finale exacte pour les lecteurs d'écran, `alive_v1` coupé ⇒ pas de roulement, bouton chargement → coche → libellé, secousse sur échec, case cochée, liste vivante insertion / retrait.
  - Un vrai bogue trouvé et corrigé : `BigInt.compareTo` ne renvoie pas −1/0/1.
- **Web**
  - `tsc --noEmit`, ESLint et `next build` de production sont propres.
  - **Parcours de 220 pages authentifiées (FR + AR) sur le serveur de dev : 0 erreur.**
  - Firefox (Playwright), 12 pages clés FR/AR : 0 erreur console, `data-alive="1"` lu depuis l'API.
- **Test de bout en bout du direct (web)**
  - Incidents ouverts dans le navigateur, puis création d'un incident par l'API. La ligne arrive animée (`data-live="in"`) sans recharger la page, 22,6 s après sa création, par l'actualisation de 25 s.
  - Enregistrement : `web-incidents-live-row.webm`, joint à la PR.
  - Note : cet essai a créé l'incident « Fuite (test Alive) » dans la base de développement.
- `npm run check:alive` passe à 100 % sur les deux plateformes, et le job CI `alive-layer` est maintenant bloquant.

## Changements visibles à connaître
- Quelques boutons convertis prennent l'icône à 20 px (au lieu de 18) et les marges des primitives.
- Le lien rouge « détacher » d'un rattachement est devenu un bouton `dangerGhost` (`sm`).
- Deux surfaces pressables mobiles s'enfoncent au lieu de faire une onde : l'option de sondage et le champ de date de congé.
- Le zoom de la photo depuis sa vignette n'est **pas** fait sur mobile. Les photos d'incident s'ouvrent dans un dialogue (qui, lui, entre en zoom ressort) et le visualiseur télécharge le fichier avant de l'afficher.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
