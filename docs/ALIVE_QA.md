# ALIVE_QA — recette finale de la couche « Alive »

Date : 2026-10-09 · Branches `feature/alive-foundations` → `-components` → `-ambient` → `-signature`.
Ce document dit ce qui a été **vérifié**, comment, et ce qui **ne l'a pas été** (et pourquoi).

## 1. Matrice

| Axe | Mobile (Flutter) | Web (Next.js) |
|---|---|---|
| **FR / AR** | Vérifié sur l'émulateur Android. Salutation « Bonsoir / مساء الخير », indicateur d'onglet qui glisse vers la gauche en arabe, jauge qui se remplit depuis la droite, moments rejoués. Vidéos `mobile-rtl-tabs-refresh.mp4` et `mobile-signature-moments.mp4`. | 220 pages authentifiées FR + AR parcourues : 0 erreur serveur. 12 pages clés FR/AR dans Firefox, deux fois, connecté : 0 erreur console. |
| **Clair / sombre** | **Sans objet** : l'application n'a pas de thème sombre (une seule palette claire, `AppTheme.light`). | **Sans objet** : `globals.css` ne définit aucun thème sombre. |
| **Animations réduites ON / OFF** | Tests de contrat : le roulement des chiffres et le premier affichage ; `SuMotion.reduced` → durées nulles ; moments signature posés sur l'image finale ; vibrations conservées. Réglage Sensations « Réduites » fusionné dans `MediaQuery.disableAnimations`. | Même règle CSS pour `prefers-reduced-motion` et `data-motion="reduced"` ; `MotionConfig reducedMotion="always"`. Ambiance (dérive, parallaxe, révélation) coupée. |
| **Sons / vibrations ON / OFF** | Tests : haptique muette si « Vibrations » est coupé ou si `alive_v1` est OFF ; anti-rafale 80 ms. Écran caché « Tester les sensations » pour l'écoute réelle. | `haptic()` / `playSound()` lisent les réglages à chaque appel ; page `/fr/debug/sensations`. |
| **Interrupteur `alive_v1`** | Vérifié de bout en bout. Avec `ALIVE_V1=false` sur l'API puis relance : salutation d'origine « مرحبًا Youssef », plus d'indicateur d'onglet (capture `m-alive-off.png`). Avec `true` : retour de la couche. | `GET /v1/config/client` → `<html data-alive>`. Tests API : 5 cas, dont la valeur absente ou invalide qui donne ON. |
| **Poids des pages publiques (D5)** | — | Mesuré en gzip, builds de production `main` contre la branche : voir la PR de la phase 2 (de −0,08 à +0,10 kB). |

## 2. Fluidité — émulateur Android (profil)

Build `--profile` avec `--dart-define=FRAME_STATS=true` (`lib/core/feel/frame_stats.dart` : synthèse
toutes les 2 s dans logcat, inactive sans ce drapeau). Pixel 5 émulé, API 33, **rendu logiciel**
(`-gpu swiftshader_indirect`), 2 Go de RAM. Lecture : `build` = temps du fil UI (le travail de la
couche : widgets, animations), `raster` = temps de rendu.

| Scénario | Fil UI (build) p50 / p90 / p99 | Raster p50 / p90 / p99 |
|---|---|---|
| Tableau de bord : défilement (parallaxe, révélation, dérive du héros) | 0,3–1,5 / 0,6–3,6 / 1,0–7,7 ms | 17,7–19,4 / 22,6–29,0 / 24,7–58,4 ms |
| Onglet Appels : indicateur, cascade, liste | 0,5–1,6 / 0,7–2,8 / 1,1–12,5 ms | 16,6–20,9 / 21,8–35,8 / 24,1–58,1 ms |
| Incidents : tirer pour actualiser + défilement | 0,6–1,1 / 0,7–2,7 / 0,8–12,4 ms | 17,8–22,6 / 21,5–28,0 / 26,3–111,6 ms |
| Moments signature (annexes, paiement en calque) | 0,5–2,1 / 0,8–4,2 / 1,3–11,4 ms | 19,3–23,9 / 24,2–38,6 / 25,3–41,8 ms |
| **Témoin : même défilement, `alive_v1 = false`** | 0,3–0,7 / 0,7–1,6 / 1,4–9,9 ms | 18,9–21,5 / 22,8–27,6 / 25,0–33,3 ms |

**Conclusion honnête**
- Le fil UI reste très loin du budget de 16,7 ms (p90 ≤ 4,2 ms partout) : la couche ne charge pas
  le fil principal.
- Le raster de cet émulateur logiciel dépasse 16,7 ms pour presque toutes les images, **avec ou
  sans la couche** (témoin identique). Ces chiffres mesurent le rendu CPU de l'émulateur, pas l'app.
- **Les vrais chiffres « Android d'entrée de gamme » restent à relever sur votre téléphone**, avec la
  même commande :
  `flutter build apk --profile --dart-define=FRAME_STATS=true` puis
  `adb logcat -s flutter | grep FRAME_STATS`.
- Le mode lite (≤ 3 Go de RAM, économiseur de batterie) coupe en plus toute l'ambiance.

## 3. Enregistrements (`alive-recordings/`, non versionné — à joindre aux PR)

| Fichier | Phase | Contenu |
|---|---|---|
| `mobile-onboarding-login-field-error.mp4` | 2 | Onboarding passé ; numéro invalide → secousse du champ + message animé |
| `mobile-otp-handoff-welcome-dashboard.mp4` | 3 + 4 | OTP → relais du logo → tableau de bord (« Bonsoir Youssef ! », indicateur d'onglet) → bienvenue (première connexion, sous la demande de permission Android) |
| `mobile-signature-moments.mp4` | 4 | Les sept moments depuis l'écran « Tester les sensations » |
| `mobile-rtl-tabs-refresh.mp4` | 2 + 3 | Arabe : tableau de bord, tirer pour actualiser, défilement, indicateur d'onglet en RTL |
| `web-incidents-live-row.webm` | 2 | Un incident créé par l'API arrive animé dans la liste ouverte, sans recharger |
| `web-ambient-offline-greeting-reveal.webm` | 3 | Format téléphone : salutation, hors ligne → rétablie, révélation au défilement |
| `web-signature-moments.webm` | 4 | Les sept démonstrations web |
| `m-annexes.png`, `m-payment.png`, `web-annexes-moment.png`, `web-payment-moment.png`, `web-offline-banner.png`, `m-ar.png`, `m-alive-off.png` | — | Captures de contrôle |

## 4. Non vérifié ici (à faire de votre côté)

- **iOS** : pas de Mac sur cette machine. Points à juger sur un iPhone :
  - la catégorie audio *ambient*, qui doit respecter le bouton silencieux ;
  - le rendu des vibrations ;
  - la transition Cupertino.
- **Écoute des sons** : placeholders synthétisés, à remplacer (`docs/SOUNDS.md`), à juger via l'écran de test.
- **Android physique d'entrée de gamme** : chiffres de fluidité (§2) et déclenchement réel du mode lite.
- **Safari** : non testé cette fois. Pour mémoire, WebKit via Playwright est faisable sur cette machine, procédure dans la mémoire du projet.
- **Notes de comportement**
  - Le web n'a pas de moment « bienvenue » propre : la visite guidée existante le tient.
  - Sur mobile, le moment de bienvenue peut apparaître sous la demande de permission de notifications d'Android lors de la toute première connexion.
