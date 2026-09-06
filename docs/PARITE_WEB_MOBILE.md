# PARITE_WEB_MOBILE.md — Registre de parité web/mobile

> **Statut : BROUILLON — chaque exception marquée *proposé* doit être confirmée par le
> propriétaire du projet avant de faire autorité.**

Principe (`START_HERE.md` non-négociable n°4) : un produit, deux interfaces. Chaque module
livre son écran web **et** mobile dans la même PR. Toute différence est consignée ici avec sa
justification — jamais implicite. Une ligne absente de ce registre = parité totale exigée.

## Comment tenir ce registre

- Une ligne par écart de parité, ajoutée **dans la PR qui introduit l'écart**.
- `Statut` : `proposé` (en attente de confirmation humaine) → `confirmé` ou `refusé`.
- Un écart `refusé` doit être résorbé avant la clôture du module concerné.

## Registre

| Module | Fonctionnalité | Web | Mobile | Statut | Justification |
|---|---|---|---|---|---|
| M2, M3… | Tous les écrans (login/OTP/invite, lots, etc.) | ✓ | ✓ | proposé (écart résorbé) | Écart historique (décision du 17/08/2026, backend-first). Web livré le 28–29/08/2026, mobile Flutter livré le 04/09/2026 (`apps/mobile`, ~45 écrans, tous les rôles, FR/AR RTL). |
| M10 | Sync offline des visites (queue Drift/SQLite, écriture optimiste) | ✗ | ✓ | proposé | Cas d'usage gardien sur le terrain sans connexion ; Master Spec 13.3 ne prévoit l'offline que côté mobile, et jamais pour les finances. Livré : file locale visible, retry au retour du réseau et périodique tant que l'app est ouverte ; l'exécution en arrière-plan OS (WorkManager/BGTask) reste à brancher. |
| M10 | Cache de lecture des lots pour le formulaire visiteur hors-ligne | ✗ | ✓ | proposé | Conséquence directe de l'écart précédent : le gardien doit pouvoir choisir le lot sans réseau. Lecture seule, aucune donnée financière. |
| M12 | Résolution du rôle côté serveur dans le layout `(dashboard)` | ✓ | ✗ (équivalent : guard Riverpod côté client + API qui refuse) | proposé | Mécanisme structurel propre au rendu serveur Next.js ; la sécurité réelle reste l'API + RLS, identique pour les deux clients. |
| M2 | OTP par SMS comme canal principal de connexion | ✓ (aussi email/mot de passe) | ✓ | proposé | Pas un écart fonctionnel — noté pour mémoire : les deux clients passent par Supabase Auth, aucun accès direct base. |
| M9 | Réception des notifications push (FCM) | ✗ (web : centre de notifications in-app + email) | ✓ | proposé | Push natif = mobile ; le web reçoit les mêmes événements via la matrice événement→canal (Master Spec 7.1), aucun événement perdu. Livré (M19) : `POST/DELETE /users/me/appareils`, transport FCM HTTP v1, deep-links identiques aux liens du web. |
| M9 | Flux temps réel des notifications (SSE) | ✓ | ✓ | proposé | Même endpoint `GET /notifications/stream` consommé par les deux clients (cloche + toast). |
| M12 | Console super admin | ✓ complète | ◐ liste, fiche, création + invitation du 1er syndic | proposé | L'opérateur plateforme travaille sur desktop ; le mobile couvre le geste de terrain (créer une résidence chez le client, transmettre le code). |
| M4 | Rattachement propriétaires/occupants, transfert de propriété | ✓ | ✓ | proposé | Même API, feuilles du bas sur mobile (indivision saisie d'un bloc avec jauge 100 %). |
| M20 | Visionneuse de documents intégrée (documents, PV, quittances) | ✓ modale pdf.js / image | ✓ écran `/visionneuse` (pdfx / image) + partage | proposé | Pas un écart fonctionnel — noté pour mémoire : le web télécharge via `?download=1`, le mobile partage le fichier (feuille système) ; aucun des deux n'ouvre le stockage dans un navigateur externe. |
| M20 | Photos de la résidence personnalisables (Paramètres → Photos) | ✓ | ✓ | proposé | Même API (`photos_json`, URLs signées) et mêmes emplacements sur les deux clients ; image par défaut identique. |
| M15 | Location courte durée (règlement, déclarations de lots, décision syndic, gestionnaire, séjours, fiche lot, incident lié) | ✓ | ✓ | proposé | Même API `/lcd/*` et mêmes dictionnaires (`lcd.*`, enums `regimeLcd`/`statutDeclarationLcd`/`statutSejour`) sur les deux clients ; mobile : `/location-courte-duree` (accueil par rôle syndic / conseil / propriétaire / gestionnaire / gardien), fiches déclaration et séjour, formulaire de séjour, rôle `GESTIONNAIRE_LCD` avec navigation réduite (tableau de bord, LCD, incidents, documents). |
| M15 | Confirmations d'arrivée / de départ du gardien hors-ligne (file Drift `lcd_actions_queue`) | ✗ | ✓ | proposé | Même justification que la file des visites (M10) : le gardien confirme sur le terrain sans réseau. La ligne locale porte l'Idempotency-Key rejouée à l'identique → jamais un second événement probant ; tableau du jour mis en cache pour consultation hors-ligne. Exécution en arrière-plan OS à brancher comme pour les visites. |
| M15 | Pièces jointes de séjour (photo, galerie, PDF) | ✓ (fichier + capture caméra sur mobile web) | ✓ (caméra, galerie, fichier) | proposé | Même API (`/lcd/sejours/upload-url`, `/lcd/sejours/{id}/pieces-jointes`), lecture dans la visionneuse intégrée des deux clients. |
| M16 | Dépenses — liste, détail, approbation / rejet (conseil), paiement avec photo du reçu (syndic), soumission, annulation | ✓ | ✓ | proposé | Même API `/depenses/*`, mêmes dictionnaires (`depenses.*`, `enumsDepenses.*`). Mobile : `/depenses`, `/depenses/:id` (syndic, conseil), feuilles décision et paiement avec Idempotency-Key stable ; le paiement et l'approbation restent des écritures en ligne (jamais dans la file hors-ligne — finances). |
| M16 | Création / modification détaillée d'une dépense, factures, postes budgétaires, fiche fournisseur (RIB), export CSV | ✓ | ✗ (lecture des factures et de la preuve dans la visionneuse ; KPI budget vs réalisé) | proposé | Écrans administratifs syndic (saisie de facture, ventilation HT/TVA, postes du budget, RIB fournisseur, export) : web-first selon la règle du prompt M16 ; le mobile lit tout et exécute les gestes de terrain (approuver, payer avec photo). À résorber si le syndic demande la saisie mobile. |
| M16 | Évaluation du prestataire (1–5) après incident résolu | ✓ | ✓ | proposé | Geste résident : parité totale — même endpoint `POST /incidents/{id}/evaluation`, même règle (créateur du ticket ou syndic, une seule fois). |
| M16 | Dépenses liées sur la fiche incident | ✓ (+ création depuis l'incident) | ✓ (lecture) | proposé | La création pré-remplie depuis l'incident suit la règle web-first des saisies administratives. |
| M17 | Payer (comptes bancaires masqués, déclaration virement / chèque / espèces avec preuve photo ou PDF, mes déclarations, annulation) | ✓ | ✓ | proposé | Geste résident financier : parité totale — même API `/finances/justificatifs/*`, mêmes dictionnaires (`justificatifs.*`, `enumsJustificatifs.*`). |
| M17 | File de validation du syndic (détail preuve + échéances ouvertes, valider avec date de valeur, rejeter avec motif) | ✓ (+ validation en masse non livrée) | ✓ | proposé | Idempotency-Key stable par feuille sur mobile. La « validation en masse » du prompt n'est livrée sur aucun client (un clic par justificatif) — à résorber si le volume l'exige. |
| M17 | Espèces reçues à la loge (gardien) | ✓ (`finances/especes`) | ✓ (`/especes`, en ligne, Idempotency-Key) | proposé | ⚠️ File hors-ligne du gardien (prompt M17) **non livrée** : la remise d'espèces est une écriture financière — le principe M10/M15 exclut les finances de la file locale ; la saisie exige le réseau. À résorber si le terrain l'impose (même mécanisme Drift que les visites, clé rejouée). |
| M17 | Gestion des comptes bancaires de la copropriété (RIB complet, lecture auditée) | ✓ | ✗ (lecture masquée seulement) | proposé | Saisie administrative syndic, web-first ; le mobile affiche banque + RIB masqué. |
| M18 | Transparence « où va mon argent » (agrégats, budget par poste, dépenses payées, factures si option, rapports publiés) | ✓ (`rapports/transparence`) | ✓ (`/rapports/transparence`) | proposé | Fonction résident : parité totale — même API `GET /rapports/transparence`, mêmes dictionnaires (`rapports.*`, `enumsRapports.*`). |
| M18 | Relevé de charges PDF d'un lot (« état daté », FR / AR) | ✓ (fiche lot, onglet finances) | ✓ (fiche lot, ouverture dans la visionneuse + partage) | proposé | Même endpoint `GET /finances/lots/{id}/releve/pdf` ; le mobile télécharge les octets avec la session (`getBytes`) — aucun lien public. |
| M18 | Tableau de bord de gestion (trésorerie 12 mois, ancienneté, budget vs réalisé, top lots) | ✓ | ✓ (lecture seule, `/rapports`) | proposé | Même API `GET /rapports/tableau-de-bord` ; le mobile rend les graphiques en CustomPaint (RTL inversé), sans action. |
| M18 | Rapports de gestion : liste + PDF FR / AR | ✓ | ✓ (liste, ouverture du PDF complet) | proposé | Même API ; le mobile n'affiche pas le détail de l'instantané (tableaux longs) — le PDF le contient. |
| M18 | Génération du rapport, soumission à l'AG, grand livre, impayés filtrés, centre d'exports csv / xlsx, journal des exports, option « factures visibles » | ✓ | ✗ | proposé | Écrans administratifs syndic (règle du prompt M18 : web-first) ; les exports tableur n'ont pas de sens sur mobile. À résorber si le syndic demande la soumission depuis le téléphone. |
| M19 | Contrats : liste par statut / type, assurance immeuble, à renouveler, échéances sous 30 jours, fiche (échéancier, police, documents, dépenses liées, journal) | ✓ | ✓ (lecture, `/contrats`, `/contrats/:id`) | proposé | Même API `/contrats/*`, mêmes dictionnaires (`contrats.*`, `enumsContrats.*`) ; pushs `CONTRAT_*` / `ASSURANCE_IMMEUBLE_ABSENTE` → ces écrans. |
| M19 | Création / modification, activation, suspension, résiliation, échéance manuelle, génération de dépense, calendrier mensuel, export csv / xlsx | ✓ | ✗ | proposé | Gestes administratifs syndic (règle du prompt M19 : mobile = syndic lecture + push, conseil lecture) ; à résorber si le syndic demande la saisie mobile. |
| M12 | Paiement CMI (WebView) | ✗ désactivé | ✗ désactivé | proposé | Backend prêt mais volontairement inactif (brief §9) : emplacement « bientôt disponible » sur les deux clients. |

## Écarts interdits d'office (ne pas proposer)

- Toute fonctionnalité financière (paiement, consultation de charges, quittances) absente d'un des deux clients.
- Tout vote ou consultation AG absent d'un des deux clients.
- FR/AR ou RTL présent sur un client et pas l'autre.
