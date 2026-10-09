# SOUNDS — sons de la couche Alive

Les six sons actuels sont des **placeholders synthétisés** par `node apps/mobile/tool/gen_sounds.mjs`
(aucune licence nécessaire). Ils posent la famille sonore, la durée et le volume. Ce sont les fichiers
à remplacer par des sons définitifs, sous le **même nom** et dans le **même format**.

| Fichier | Moment | Placeholder actuel | Son idéal (brief pour le sound designer) |
|---|---|---|---|
| `confirm.wav` | Choix enregistré, case validée côté serveur (rare) | Une note de marimba, La5, 160 ms | Une seule lame de bois très courte, attaque douce, sans queue. |
| `success.wav` | Paiement / déclaration / réservation confirmés | Tierce montante Mi5 → Si5, 320 ms | Deux notes boisées montantes, chaleureuses, résolues. La « bonne nouvelle » de la famille. |
| `sent.wav` | Appel de fonds, relance, message envoyés | Deux notes vives Do6 → Sol6, 260 ms | Un « départ » léger : bois + souffle d'air très discret, pas de whoosh cinéma. |
| `notify.wav` | Notification temps réel reçue avec l'app ouverte | Tintement de verre Mi6, 340 ms | Verre fin (cloche de verre / carillon), une seule frappe, résonance courte. |
| `error.wav` | Échec serveur / réseau d'une action importante | Deux notes graves descendantes, 280 ms | Deux lames graves, douces, jamais une alarme ni un buzzer. |
| `signature.wav` | Les 12 annexes générées (coffre qui se ferme) | Coup sourd + accord Do majeur arpégé + verre, 390 ms | Un « clac » de coffre feutré, puis un accord boisé lumineux. Le son le plus « premium » de l'app. |

## Contraintes (vérifiées par le script de génération)

- **Durée ≤ 400 ms**, **taille ≤ 30 Ko** chacun, mono.
- Format : **WAV PCM 16 bits, 22,05 kHz** (lu nativement par iOS, Android et tous les navigateurs).
  Un remplacement en AAC/M4A est possible, mais il faut alors changer l'extension dans
  `apps/mobile/lib/core/feel/sounds.dart` et `apps/web/lib/feel/sounds.ts`.
- **Famille cohérente** : bois chaud (marimba, kalimba) et verre. Pas de synthé, pas de 8-bit, pas de voix.
- Crête vers −3 dBFS, fondu de sortie (pas de clic), **aucun silence en tête**, car la latence compte.
- Sorties : `apps/mobile/assets/sounds/` **et** `apps/web/public/sounds/` (fichiers identiques).

## Règles de lecture (dans le code)

- iOS : catégorie audio **ambient**. Le son respecte le bouton silencieux et ne coupe jamais la
  musique ni un appel. Android : usage *sonification*, sans prise de focus audio.
- Web : contexte audio créé au premier geste (règle d'autoplay). Avant ce geste, rien ne joue.
- Volume bas (0,5–0,55). Tout est coupé par le réglage **Sensations → Sons** ou par `alive_v1 = false`.
- **Jamais sur un tap ordinaire.** La carte complète des sons se trouve dans `docs/ALIVE_GUIDE.md`.

## Revue sur téléphone

Profil → Sensations → **Tester les sensations** (builds debug, ou
`--dart-define=SENSATIONS_TEST=true`). Cet écran joue chaque son et chaque vibration, sans tenir
compte des réglages. Web : `/fr/debug/sensations` en développement (ou avec `SENSATIONS_TEST=true`).
