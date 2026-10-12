# Liens, Siri / Assistant, Spotlight, partage — ce qui reste à faire une fois les comptes actifs

## Android App Links (`https://app.syndicup.pro/fr/…` s'ouvre dans l'app sans demander)
`apps/web/public/.well-known/assetlinks.json` contient un espace réservé. Remplace-le par l'empreinte
SHA-256 de la **clé de signature Play** : Play Console → Configuration → Intégrité de l'application →
« Certificat de clé de signature d'application » → SHA-256. (Ajoute aussi celle de ta clé d'upload
si tu installes des builds locaux.) Redéploie le web, puis sur un téléphone :
`adb shell pm verify-app-links --re-verify ma.syndicup.app`.

## Universal Links iOS
`apps/web/public/.well-known/apple-app-site-association` : remplace `TEAMID` par l'identifiant
d'équipe Apple (developer.apple.com → Membership). Dans Xcode, cible Runner → Signing & Capabilities →
**Associated Domains** → `applinks:app.syndicup.pro`.

## Siri / Raccourcis (iOS 16+)
Déjà dans `ios/Runner/AppShortcuts.swift` : « Payer mes charges avec SyndicUp », « Signaler un
incident avec SyndicUp », assemblées, affichage, visiteur. Rien à configurer ; les phrases en arabe
s'ajoutent dans un `AppShortcuts.strings` (ar.lproj) quand on voudra les tester avec Siri en arabe.

## Assistant Google (App Actions)
`android/app/src/main/res/xml/shortcuts.xml` : « Ok Google, payer mes charges avec SyndicUp ».
Pour que l'Assistant les reconnaisse, l'app doit être publiée (même en test interne) et, dans Play
Console, la déclaration « Actions dans les applications » acceptée. Test : app Google Assistant
Plugin dans Android Studio.

## Spotlight (iOS)
Lots, incidents ouverts, annonces et documents sont indexés à l'ouverture de l'app
(`SpotlightBridge.swift`, canal `ma.syndicup.app/spotlight`). Rien à configurer.

## Cible de partage
Android : déjà actif — partager une photo vers SyndicUp ouvre « Signaler un incident » avec la photo ;
un PDF ouvre « Payer » (preuve de virement). iOS : nécessite une Share Extension (cible Xcode) —
à créer avec le compte Apple ; le routeur accepte déjà `syndicup:///incidents/nouveau?photo=…`.
