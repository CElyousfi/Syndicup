# SyndicUp — application mobile (iOS & Android, Flutter)

Application mobile de la plateforme (Master Spec Partie 13) : **une seule API** (`apps/api`),
mêmes rôles, même wording FR/AR que le web (dictionnaires générés depuis `apps/web/lib/i18n`),
RTL natif, module gardien hors-ligne, vote AG en séance, notifications temps réel + push.

## Structure (Master Spec 13.1)

```
lib/
├── core/
│   ├── api/          client Dio (enveloppe {data,meta}/{error,meta}, Bearer, X-Copropriete-Id,
│   │                 X-Request-Id, Idempotency-Key, refresh silencieux), modèles, providers Riverpod
│   ├── auth/         session (trousseau sécurisé) + aiguillage post-connexion (profil réel)
│   ├── config/       AppConfig (--dart-define : API_BASE_URL, FIREBASE_*)
│   ├── format/       montants en centimes BigInt (jamais de float), dates FR/AR chiffres latins
│   ├── i18n/         dict.dart GÉNÉRÉ (fr/ar), fr.arb / ar.arb, chaînes mobiles (offline, push)
│   ├── push/         FCM (activé par build), deep-links
│   ├── realtime/     flux SSE /notifications/stream (cloche live, toasts)
│   ├── router/       go_router — redirections par état de session, routes par rôle
│   ├── theme/        tokens (Partie 14.2, maquette « SyndicUp Mobile »), thème Geist / Noto Arabic
│   ├── util/         navigation par rôle (4 onglets + Plus), badges de statut, liens de notification
│   └── widgets/      kit : cartes, badges, formulaires, feuilles, ConfirmDialog, états vide/erreur
├── features/         un dossier par module : auth, dashboard, lots, finances, ag, incidents,
│                     espaces, visites, personnel, documents, notifications, litiges, profil,
│                     membres, invitations, parametres, admin, shell
└── offline/          Drift/SQLite : file de sync des VISITES uniquement (écriture optimiste,
                      retry au retour du réseau, Idempotency-Key = id local → jamais de doublon)
```

## Lancer en local

Prérequis : Supabase local démarré, API sur le port 3001 (`npm run dev --workspace=@copropriete-maroc/api`),
seed + comptes (`npm run db:seed` puis `npm run seed:auth`).

```bash
cd apps/mobile
flutter pub get
node tool/gen_i18n.mjs            # régénère lib/core/i18n/dict.dart depuis le web (si les textes changent)
dart run build_runner build --delete-conflicting-outputs   # Drift (si lib/offline change)

flutter run                       # émulateur Android : l'API est atteinte via http://10.0.2.2:3001/v1
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:3001/v1   # téléphone physique sur le LAN
```

Comptes de démonstration (Supabase local, OTP de test `123456`) : `+212600000001` syndic,
`+212600000002` propriétaire (AR), `+212600000005` locataire, `+212600000006` gardien ;
e-mail `syndic.alamal@example.ma` / `SyndicUp2026!`.

## Builds

```bash
flutter analyze && flutter test
flutter build apk --release --dart-define=API_BASE_URL=https://api.copropriete-maroc.ma/v1
flutter build appbundle --release --dart-define=API_BASE_URL=https://api.copropriete-maroc.ma/v1
flutter build ipa --release --dart-define=API_BASE_URL=https://api.copropriete-maroc.ma/v1   # macOS + Xcode
```

- **Android** : `applicationId ma.syndicup.app`, minSdk 23, targetSdk 35. Signature de release :
  `android/key.properties` (non commité — storeFile/storePassword/keyAlias/keyPassword) ; sans lui,
  la release est signée avec la clé debug (jamais publiable). Le trafic en clair n'est autorisé
  qu'en debug vers l'hôte local (`src/debug/res/xml/network_security_config.xml`).
- **iOS** : bundle `ma.syndicup.app`, iOS 13+, Podfile fourni ; permissions caméra/photos
  déclarées dans `Info.plist`, `remote-notification` en background mode. Compiler sur macOS :
  `cd ios && pod install`, puis Xcode (signing) — le poste Linux ne peut pas produire l'IPA.
- **Icônes** : `dart run flutter_launcher_icons` (source `assets/images/logo.png`).
- **Visionneuse intégrée** : tout fichier (document GED, PV d'AG, quittance) s'ouvre dans l'écran `/visionneuse` (`features/documents/document_viewer_screen.dart`, PDF via `pdfx`, image zoomable, partage sinon) — jamais dans un navigateur externe. Les URLs signées (15 min) sont demandées au clic, jamais stockées.
- **Photos de la résidence** : `CoproPhoto('<cle>')` / `PhotoBanner` (`core/widgets/photos.dart`) affichent la photo personnalisée par le syndic (`GET /coproprietes/{id}/photos`) ou l'asset par défaut (`assets/images/…`). Mêmes clés que le web (`apps/web/lib/photos.ts`).

## Push (FCM)

Désactivé par défaut : l'app fonctionne intégralement avec le centre de notifications in-app et
le flux temps réel. Pour activer :

```bash
flutter build apk --release \
  --dart-define=FIREBASE_ENABLED=true \
  --dart-define=FIREBASE_API_KEY=… --dart-define=FIREBASE_APP_ID=… \
  --dart-define=FIREBASE_PROJECT_ID=… --dart-define=FIREBASE_SENDER_ID=…
```

Côté API : `FCM_SERVICE_ACCOUNT_JSON` (service account) — transport HTTP v1
(`apps/api/lib/notifications/transports/fcm.ts`), jetons d'appareils enregistrés par l'app via
`POST /users/me/appareils` (retirés à la déconnexion). iOS : ajouter la capability Push +
clé APNs dans Firebase.

## Parité web / mobile

Registre : `docs/PARITE_WEB_MOBILE.md`. Écarts assumés : hors-ligne gardien (mobile seulement),
push natif (mobile), console super admin réduite (création de copropriété + invitation du syndic).
