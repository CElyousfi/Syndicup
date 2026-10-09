# ALIVE_GUIDE — comment chaque écran naît vivant

La couche **Alive** rend chaque élément de SyndicUp réactif au toucher et aux données, sur le web
(Next.js) comme sur le mobile (Flutter), **sans toucher à la logique métier**. Elle vit dans les
**primitives partagées** : un écran qui les utilise hérite de tout. Le reste de ce guide est la
règle du jeu pour tout nouvel écran.

> **Une seule règle à retenir** : n'utilisez jamais une primitive brute (`InkWell`,
> `FilledButton`, `Text(formatMAD(…))`, `<button>`, `<img>`, `{formatMAD(…)}`…) dans un écran.
> `npm run check:alive` le refuse en CI. Si c'est vraiment nécessaire, motivez-le sur la ligne :
> `// alive:allow <raison>`. Ces exceptions sont listées dans `docs/ALIVE_COVERAGE.md`.

---

## 1. Interrupteurs

| Niveau | Où | Effet |
|---|---|---|
| Drapeau serveur `alive_v1` | `ALIVE_V1=true/false` sur Render (API), lu par `GET /v1/config/client` | Coupe toute la couche chez tous les clients en ≤ 60 s. Dernière valeur gardée sur l'appareil ; installation neuve hors ligne = ON. |
| Réglage utilisateur | Profil → **Sensations** : Animations (Complètes / Réduites), Vibrations, Sons | Sur l'appareil (décision D2). « Réduites » = même règle que la préférence système. |
| Préférence système | « Réduire les animations » (iOS, Android, OS du navigateur) | Toujours respectée : le mouvement devient un fondu ou disparaît. **Les vibrations restent.** |
| Mode lite automatique | Android ≤ 3 Go RAM / `isLowRamDevice`, économiseur de batterie ; web `deviceMemory ≤ 2`, `saveData` | On garde le toucher et les compteurs ; on coupe l'ambiance (dérive du héros, parallaxe, révélation au défilement, motifs en boucle). |

Code : mobile `Feel.alive`, `Feel.motion(context)`, `Feel.ambient(context)` (`lib/core/feel/feel.dart`) ;
web `aliveOn()`, `motionOn()`, `ambientOn()` (`lib/feel/prefs.ts`), attributs `<html data-alive data-motion data-lite>`.

## 2. Jetons (source unique)

`packages/config/motion/tokens.json` → `npm run motion:tokens` génère
`apps/web/app/motion-tokens.css`, `apps/web/lib/motion-tokens.ts`,
`apps/mobile/lib/core/theme/motion_tokens.g.dart` (`--check` en CI).

| Jeton | Valeur | Usage |
|---|---|---|
| `press` | 100 ms | Enfoncement sous le doigt. **Le toucher ne ralentit jamais.** |
| `toggle` | 120 ms | Interrupteurs, cases, segments, puces |
| `release` | 360 ms (ressort) | Relâchement |
| `fast` / `base` / `page` / `slow` | 180 / 260 / 320 / 400 ms | Fondus, transitions, entrées, jauges |
| `sheetIn` / `sheetOut` | 400 / 260 ms | Feuilles du bas |
| `number` | 900 ms | Roulement d'un montant qui change |
| `highlight` | 1 200 ms | Surlignage d'une donnée arrivée en direct |
| `signature` / `signatureMax` | 700 / 1 200 ms | Moments signature (plafond 1,2 s) |
| `stagger` / `maxStagger` | 35 ms / 8 éléments | Cascade d'entrée |
| distances | 8 / 16 / 24 px | Glissements |
| ressorts | `snappy` 520/34/0,7 · `smooth` 380/34/0,9 · `gentle` 180/22/1 | Pression · indicateurs · arrivées |

Seuls **transform** et **opacity** s'animent (exceptions bornées : couleur d'une teinte de montant,
hauteur d'une barre de graphique dans une boîte de taille fixe). Tout décalage horizontal suit le
sens de lecture (`SuMotion.sign(context)` / `--dir`).

## 3. Contrat des primitives

### Mobile (`lib/core/widgets/` — `import '../../core/widgets/widgets.dart'`)

| Au lieu de… | Utiliser | Ce qui est vivant |
|---|---|---|
| `InkWell`, `GestureDetector(onTap)`, `InkResponse` | `SuTap(onTap:, onLongPress:, borderRadius:, customBorder:, ink:, haptic:, scale:)` | Enfoncement ressort ; appui long = l'élément se soulève (ombre + 1,03) + `select()` |
| `ListTile` | `ListRow(leading:, title:, subtitle:, trailing:, onTap:)` | Enfoncement, chevron miroir RTL |
| `FilledButton`, `OutlinedButton`, `TextButton` (+ `.icon`) | `SuButton(label:, icon:, onPressed:, variant: primary/secondary/ghost/danger, size: sm/md/lg, expand:, loading:, fail:, style:)` · lien souligné : `LinkButton(label, onTap:)` | Enfoncement, `tap()` sur primary/danger, chargement DANS le bouton, coche à la fin d'un chargement réussi, secousse + `warning()` sur un nouvel échec |
| `SubmitButton(label, onPressed, loading)` | idem **+ `fail: _fail`** | Même chose (délègue à `SuButton`) |
| `IconButton` | `SuIconButton(icon:, onPressed:, tooltip:, selected:, selectedIcon:)` ou `CircleIconButton` | Enfoncement 0,9 ; l'icône se **transforme** quand elle change |
| `Text(formatMAD(v, locale))` | `AnimatedAmount(v, style:, textAlign:)` (`currency: false` → `formatMontant`) | Texte simple au 1er affichage ; à chaque changement, les chiffres qui changent roulent + teinte verte/rouge. `upIsGood: false` pour un impayé |
| `KeyValueRow(label, formatMAD(v, l))` | `KeyValueRow.amount(label, v)` | Idem |
| `Text(formatPourcent(r))`, compteurs formatés | `AnimatedFigureText(texte, style:)` | Idem, pour toute chaîne numérique formatée |
| `MoneyText(texte)` | déjà vivant | — |
| texte d'état qui change (filtre, libellé) | `SuFadeSwitch(value: clé, child: …)` | Fondu enchaîné, jamais de saut |
| `TextField`, `TextFormField` | `SuField(label:, controller:, error:, validator:, valid:, …)` | Erreur (serveur ou validateur) = secousse miroir + `warning()` ; `valid` = coche tracée ; anneau de focus animé |
| `Switch`, `SwitchListTile` | `SuSwitchRow(label:, help:, value:, onChanged:)` | Curseur ressort + `select()` |
| `Checkbox`, `CheckboxListTile` | `SuCheckbox(value:, onChanged:, label:, help:)` | Case en ressort, coche qui se trace, `select()` |
| `Radio` | `SuRadioGroup<T>(value:, options:, labelOf:, onChanged:)` | Pastille en ressort, `select()` |
| `SegmentedButton` | `Segmented<T>` / `FilterChips<T>` | Pastille qui glisse, `select()` |
| `Image.network/file/memory` | `SuImage.network(url, heroTag:)` / `.file` / `.memory` | Fondu + léger dézoom, jamais d'apparition brutale ; `heroTag` = ouverture en zoom |
| `CircularProgressIndicator`, `LinearProgressIndicator` | squelette (`AsyncView` / `LoadingList`), `Gauge(ratio)`, `SuRing(ratio)`, `LoadingOrb` (petit, en ligne) | Aucun spinner plein écran |
| `showModalBottomSheet` | `showSuSheet(context, builder:)` / `showFormSheet(...)` | Montée douce, fond assombri, poignée, glisser pour fermer |
| `showDialog` / `AlertDialog` | `confirmDialog(...)` / `showSuDialog(context, builder:)` | Entrée en ressort |
| `SnackBar` | `showToast(context, msg, error:)` / `SuToaster.show(..., actionLabel:, onAction:)` | Ressort, empilement, glisser, filet de temps ; `error()` haptique |
| `RefreshIndicator` | `SuPage(onRefresh:)` ou `SuRefresh(onRefresh:, child:)` | Indicateur SyndicUp, `select()` au seuil, coche à la fin |
| `HapticFeedback.*` | `Haptics.tap/select/success/warning/error/heavy()` | Sémantique, anti-rafale, réglage |
| liste qui change | `CardList([...])` avec **`key: ValueKey(objet.id)`** sur chaque ligne, ou `SuLiveColumn` | Entrée (dépli + surlignage lime) / sortie (repli) |
| action de glisser existante | `SuSwipeAction(onAction:, icon:, label:, child:)` | `select()` au seuil, sens de lecture respecté |
| badge de statut | `StatusBadge(label, variant:, pulse:)` | Éclot quand le statut change ; `pulse` = UNE pulsation |

### Web (`components/ui/`)

| Au lieu de… | Utiliser | Ce qui est vivant |
|---|---|---|
| `<button>` | `<Button variant size>` / `<IconButton label tone size>` / `<ButtonLink>` | Enfoncement ressort (100 ms), relâchement |
| `type="submit"` brut | `<SubmitButton>` (+ `<FormAlert state>` dans le même `<form>`) | Spinner dans le bouton ; coche après succès, secousse après erreur (événement `su:form-result`) ; haptique (Android) |
| `{formatMAD(v, locale)}` | `<Amount value={v} locale={locale} />` (`currency={false}`, `upIsGood={false}`, `prefix`) | Texte simple au 1er rendu ; à chaque changement (actualisation live 25 s, action) roulement des chiffres changés + teinte. Aucun float |
| `{formatPourcent(r)}`, compteurs | `<Figure value={texte} />` | Idem |
| grande valeur de tuile | `<StatCard value>` (odomètre) | Défile au montage et à chaque changement |
| `<input>` / `<select>` / `<textarea>` | `<Input>`, `<Select>`, `<Textarea>` dans `<Field label error valid>` | Anneau de focus animé ; erreur = secousse (miroir RTL) + fondu ; `valid` = coche tracée |
| `type="checkbox"` / `type="radio"` | `<Checkbox>`, `<Switch>`, `<RadioGroup>` | Ressort, coche tracée, `select()` haptique |
| `<img>` | `<FadeImg>` | Fondu + dézoom au chargement |
| `<Spinner>` / `animate-spin` dans un écran | `loading.tsx` + `*Skeleton`, état du `SubmitButton` | Aucun spinner plein écran |
| `<tbody>` / liste de lignes clées | `<LiveList as="tbody">{rows.map(r => <TR key={r.id}>)}</LiveList>` | Ligne arrivée en direct : dépli + surlignage lime ; ligne retirée : repli |
| `alert()`, `confirm()`, `<dialog>` | `<Modal>`, `<ConfirmDelete>`, `toast()`, `celebrate()` | Ressort, fond flouté, feuille glissable sur mobile |
| `navigator.vibrate` / `new Audio` | `haptic(intent)` / `playSound(name)` (`lib/feel`) | Sémantique, réglages, anti-rafale |
| jauge | `<ProgressBar ratio>` / `<RingGauge>` | Remplissage par `transform`, glisse vers la nouvelle valeur |
| badge | `<Badge variant pulse>` | Éclot au changement ; `pulse` = 2 pulsations puis immobile |

`motion` (bibliothèque JS) : autorisé dans `components/shell/**` et `components/ui/**` uniquement,
jamais dans les pages publiques (`(public)`, `components/auth`) — ESLint le refuse (D5). Le poids JS
des pages de connexion est mesuré à chaque phase et ne doit pas grossir.

## 4. Carte haptique & sonore

| Intention | Haptique | Son | Quand |
|---|---|---|---|
| Action principale validée | `tap()` | — | Bouton primary / danger, bouton central d'actions |
| Sélection | `select()` | — | Onglet, segment, puce, interrupteur, case, radio, seuil de glisser / tirer-pour-actualiser, appui long |
| Écriture confirmée | `success()` | `success` | `showSuccess` (mobile), `FormAlert` succès (web), paiement enregistré |
| Saisie refusée | `warning()` | — | Erreur de validation (champ, bouton d'envoi), confirmation d'une action dangereuse |
| Échec | `error()` | (`error` réservé aux moments signature ratés) | Toast d'erreur, erreur serveur |
| Moment signature | `heavy()` | `signature` | 12 annexes générées |
| Envoi | `success()` | `sent` | Appel de fonds / relance / message envoyés |
| Notification en direct | — | `notify` | Notification reçue app ouverte et visible |

Jamais au défilement, jamais à la frappe, jamais de son sur un tap ordinaire. Sons : `docs/SOUNDS.md`.

## 5. Règles de retenue

- **Une seule chose bouge pour attirer l'attention à la fois.** Aucune boucle qui réclame l'attention
  (badges : une pulsation, cloche : sonne une fois quand le compteur monte).
- **Rien n'anime au premier affichage d'une liste** (sauf la cascade d'entrée, ≤ 8 éléments) ; les
  nombres ne roulent que lorsqu'ils CHANGENT.
- Moments signature : ≤ 1,2 s, passables d'un tap, jamais bloquants, toujours APRÈS la confirmation
  serveur.
- Rien n'anime hors écran ; pas de Lottie/Rive > 100 Ko ; pas d'animation en boucle dans une ligne de liste.

## 6. Accessibilité & RTL

- Aucune information portée seulement par le mouvement ou le son (le texte final est toujours là ;
  les lecteurs d'écran lisent la valeur finale, jamais les étapes d'une animation).
- Chaque animation directionnelle est miroir en arabe : glissements, secousses, indicateurs d'onglet,
  jauges (origine `inline-start`), anneaux (sens antihoraire), gestes de glisser.
- Testez chaque écran en **FR et AR**, animations complètes et réduites.

## 7. Nouvel écran — check-list

1. N'importe que des primitives (`check:alive` passe).
2. Listes : une `key` stable par ligne (`ValueKey(id)` / `key={id}`) dans `CardList` / `LiveList`.
3. Montants : `AnimatedAmount` / `<Amount>` ; pourcentages et compteurs : `AnimatedFigureText` / `<Figure>`.
4. Formulaires : `SubmitButton(fail: _fail)` (mobile) ; `<FormAlert state>` dans le `<form>` (web).
5. Chargement : squelette à la forme exacte de la page (`loading.tsx` / `AsyncView`), jamais de spinner plein écran.
6. Changement d'état visible (filtre, onglet, mode) : `SuFadeSwitch` / transition CSS — rien ne saute.
7. Textes FR + AR ; vérifier en RTL.
8. `npm run alive:report` puis relire la ligne de votre écran dans `docs/ALIVE_COVERAGE.md`.
