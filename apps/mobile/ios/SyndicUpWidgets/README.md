# SyndicUpWidgets — extension WidgetKit (iOS)

Les sources sont prêtes ; il reste à créer la cible dans Xcode (impossible à faire proprement
sans Xcode, et sans compte Apple Developer l'App Group ne se signe pas). À faire **une fois**,
sur le Mac, quand le compte développeur est actif :

1. `open ios/Runner.xcworkspace` → File → New → Target → **Widget Extension**
   - Product Name : `SyndicUpWidgets` · décocher « Include Configuration App Intent » · Finish.
   - Xcode crée un dossier `SyndicUpWidgets` avec des fichiers d'exemple : **supprime-les**
     (`SyndicUpWidgets.swift`, `SyndicUpWidgetsBundle.swift`, `AppIntent.swift`, Assets si tu veux)
     et ajoute à la cible les fichiers de ce dossier : `Widgets.swift`, `Provider.swift`,
     `Snapshot.swift`, `Theme.swift`, `ToggleMasquerIntent.swift`, `fr.lproj`, `ar.lproj`,
     `Info.plist` (remplace celui généré), `SyndicUpWidgets.entitlements`.
2. Cible **SyndicUpWidgets** → Signing & Capabilities :
   - Bundle Identifier : `ma.syndicup.app.widgets`
   - Deployment target : **iOS 16.0** (écran verrouillé) — 17.0 si tu veux les boutons « œil ».
   - `+ Capability` → **App Groups** → `group.ma.syndicup.app`.
   - Code Signing Entitlements → `SyndicUpWidgets/SyndicUpWidgets.entitlements`.
3. Cible **Runner** → Signing & Capabilities → `+ Capability` → **App Groups** →
   `group.ma.syndicup.app` (le fichier `Runner.entitlements` contient déjà la clé).
   Dans le portail développeur, l'App ID `ma.syndicup.app` doit avoir App Groups coché.
4. Cible Runner → Build Phases → **Embed Foundation Extensions** doit contenir
   `SyndicUpWidgets.appex` (Xcode le fait à la création de la cible).
5. `flutter build ipa` comme d'habitude. L'app écrit `w_snapshot` dans l'App Group à chaque
   ouverture (lib/core/home_widgets/home_widgets.dart) ; l'extension se contente de lire.

Vérification rapide sur simulateur : lancer l'app, se connecter, revenir à l'écran d'accueil,
appui long → « + » → SyndicUp → les cinq widgets apparaissent avec les vraies données.
Écran verrouillé (iOS 16+) : Personnaliser → ajouter « Mes charges » ou « Assemblée ».

Android n'a besoin de rien : tout est dans `android/app/src/main` (receivers, layouts, Kotlin).
