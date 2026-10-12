# SyndicUpNotifications — extension de service (images dans les notifications iOS)

Le serveur envoie `mutable-content: 1` et `image_url` ; cette extension télécharge l'image et
l'attache à la bannière. À créer une fois dans Xcode (compte Apple Developer requis) :

1. File → New → Target → **Notification Service Extension** · Product Name `SyndicUpNotifications`.
2. Remplace le `NotificationService.swift` généré par celui de ce dossier ; remplace `Info.plist`.
3. Bundle Identifier `ma.syndicup.app.notifications` · Deployment target iOS 13.0.
4. Cible Runner → Build Phases → Embed Foundation Extensions contient `SyndicUpNotifications.appex`.

Les boutons (Payer, Voter, Appeler, Autoriser / Refuser, Marquer lu) ne dépendent pas de cette
extension : ce sont des catégories enregistrées par l'app (lib/core/push/push_service.dart).
