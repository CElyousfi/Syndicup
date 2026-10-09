# feat(alive): phase 4 — moments signature (mouvement + haptique + son)

Branche : `feature/alive-signature`, empilée sur `feature/alive-ambient` (phase 3).
Chaque moment dure ≤ 1,2 s, se passe d'un tap ou d'un clic et ne bloque jamais l'interface. Il est
joué **après** la réponse 2xx du serveur, donc il n'annonce jamais un succès à la place de l'API.
Aucune logique métier, aucun appel d'API ajouté ; tout s'éteint avec `ALIVE_V1=false`.

## Les sept moments

| # | Moment | Où (vrais parcours) | Ressenti |
|---|---|---|---|
| 1 | **Paiement enregistré** : le montant (pastille lime) tombe dans le reçu ; sceau ✓ tamponné. En calque, le solde roule de l'ancien vers le nouveau. | Mobile : paiement saisi par le syndic, justificatif validé. Web : `PaiementModal`, validation de justificatif. | `success()` + son `success` au tampon |
| 2 | **Les 12 annexes générées** : 12 documents apparaissent en cascade serrée (≈ 40 ms), chacun coché ; la grille se resserre (le coffre se ferme) ; sceau « CONFORME ». | **Module comptable encore inexistant** : démonstration dans l'écran de test, et l'appel unique est documenté (ci-dessous). | `heavy()` + son `signature` |
| 3 | **Envoi** : la lettre s'envole vers la fin de ligne (miroir en arabe), la coche éclot, « Envoyé ». | Appel de fonds émis (mobile) ; annonce publiée — pas programmée (mobile + web). | `success()` + son `sent` |
| 4 | **Vote d'AG** : le bulletin descend dans l'urne, qui se tasse ; « Vote enregistré ». | Mobile : séance (remplace le toast, annonce lecteur d'écran conservée) et sondage. Web : vote en séance, sondage. | `success()` |
| 5 | **Dépense justifiée** : la photo du reçu se clipse sur la dépense, badge « Justifiée ». | Dépense payée avec reçu (mobile + web). | `success()` + son `confirm` |
| 6 | **Résidence 100 % à jour** : anneau plein qui se trace, halo unique. | Tableau de bord du syndic, quand il n'y a aucun impayé et que le taux est de 100 %. Le halo ne brille qu'une fois par mois et par résidence (puis l'anneau reste plein, immobile). | `success()` (une fois) |
| 7 | **Bienvenue** : le logo éclot, « Bienvenue sur SyndicUp ». | Mobile : première connexion de chaque utilisateur sur l'appareil, juste après le relais du lancement. Web : la visite guidée existante (« Bienvenue sur SyndicUp ») tient déjà ce rôle, pas de doublon. | `success()` |

Sur les écrans de succès plein écran, le moment **remplace l'illustration** au lieu de s'empiler
dessus (`showSuccess(moment:)` / `celebrate({ moment })`). Le web évite la double vibration : la
vibration part avec la réponse (`FormAlert`), le son au sommet. Le moment autonome
`SuSignature` / `signature()` sert là où il n'y a pas d'écran de succès (vote en séance, annexes).

### L'appel unique du futur module « annexes » (Décret 2.23.700)
Juste après la réponse 2xx de l'endpoint de génération, sans autre logique :
```dart
SuSignature.annexes(context, titles: annexes.map((a) => a.intitule).toList()); // mobile
```
```ts
signature({ kind: "annexes", titles: annexes.map((a) => a.intitule) }); // web — lib/signature.ts
```

### Revue sur téléphone
**Profil → Sensations → Tester les sensations** (APK debug, ou `--dart-define=SENSATIONS_TEST=true`)
rejoue les sept moments, chaque son et chaque vibration, sans rien écrire. Web : `/fr/debug/sensations`
en développement.

## Accessibilité, RTL, retenue
- « Animations réduites » : l'image finale s'affiche directement puis s'efface ; vibration et son restent (selon les réglages).
- Lecteurs d'écran : le calque est exclu de la sémantique. Le succès est annoncé par l'écran lui-même, ou par `SemanticsService.announce` pour le vote en séance.
- RTL : la lettre part vers la fin de ligne ; l'anneau se trace dans le sens de lecture ; le badge éclot depuis le début de ligne.
- Un seul moment à la fois (un nouveau remplace le précédent). Aucune boucle.

## Correctif inclus (phase 3)
`fix(alive)` : la révélation au défilement web passe par la Web Animations API. La version de la
phase 3 posait `data-reveal` sur le DOM avant la fin de l'hydratation d'une page servie en flux, ce
qui produisait un avertissement React en développement. Les règles CSS correspondantes sont retirées.

## Vérifications
- **Mobile**
  - `flutter analyze` : aucune erreur, aucun avertissement.
  - `flutter test` : 49/49, dont 4 nouveaux — le calque des annexes affiche « CONFORME » puis se retire seul ; un tap le passe ; `alive_v1` coupé = aucun moment ; l'écran de succès joue le moment avec le montant formaté (« 1 250,00 MAD »).
- **Web**
  - `tsc` et ESLint propres ; `check:alive` à 100 % ; jetons à jour.
  - Firefox (Playwright, session réelle) : les 7 démonstrations jouées depuis `/fr/debug/sensations` sans erreur.
  - Vidéo : `web-signature-moments.webm` ; captures `web-payment-moment.png`, `web-annexes-moment.png`.
  - 12 pages clés FR/AR rejouées deux fois, connecté : **0 erreur console** après le correctif d'hydratation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
