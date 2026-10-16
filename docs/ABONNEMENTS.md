# Abonnements SyndicUp & console opérateur (M29)

Les clients ne paient pas dans l'application : c'est l'opérateur (compte `SUPER_ADMIN`) qui ouvre
l'abonnement, émet les factures, enregistre les paiements reçus et pilote l'accès. Tout se fait
dans la console : `https://app.syndicup.pro/fr/admin`.

## Le cycle de vie

| Étape | Ce que fait l'opérateur | Ce que voit la résidence |
|---|---|---|
| Ouverture | **Abonnements → Ouvrir un abonnement** : client (nouveau ou existant), résidences, formule, lots. Essai gratuit de **30 jours** par défaut ; prix de la grille proposé (modifiable) ; tarif fondateur garanti 24 mois. | Rien. |
| Fin d'essai J-7 → J | — (rappels e-mail automatiques à J-7 et J-1) | **Syndic** : fenêtre douce « Votre essai se termine dans N jours », refermable, une fois par jour. Résidents : rien. |
| Facture | Fiche abonnement → **Émettre la facture** (période suivante, numéro `SU-AAAA-NNNN` sans trou ; lots facturés = max(contractés, créés)). **Imprimer ou enregistrer en PDF** depuis la facture. | — |
| Paiement reçu | Ligne de facture → **Enregistrer un paiement** (virement, chèque…). Facture soldée ⇒ abonnement **ACTIF**, payé jusqu'à la fin de la période facturée, accès rouvert. Paiements partiels acceptés ; un montant supérieur au reste dû est refusé. | La fenêtre disparaît. |
| Échéance dépassée | Délai de grâce (15 jours par défaut, réglable par abonnement). | **Syndic** : fenêtre « Règlement en attente » à chaque session, avec la date de coupure. |
| Coupure | Automatique le lendemain du dernier jour de grâce. | **Tout le monde** : écran « Accès suspendu ». Les données sont intactes. Le syndic voit les boutons WhatsApp / e-mail SyndicUp. |
| Renouvellement J-30 | Apparaît dans « À traiter » (vue d'ensemble). Rappels e-mail à J-30, J-14, J-3. | Syndic : fenêtre à partir de J-14. |

L'état est **calculé depuis les dates** à chaque requête (`apps/api/lib/abonnements/etat.ts`) : un job
en panne ne bloque ni ne débloque personne. Le job quotidien (09:00 Casablanca) n'envoie que les e-mails.

### Les exceptions (fiche abonnement → Actions)

- **Prolonger l'essai** — nouvelle date de fin d'essai.
- **Accorder un délai** — l'accès reste ouvert jusqu'à une date, même sans paiement. Cas typique :
  le syndicat attend le vote en AG. Motif obligatoire, visible dans le journal.
- **Activer sans facture** — geste commercial ou règlement reçu hors facture : payé jusqu'au …
- **Suspendre l'accès** — fermeture immédiate (motif obligatoire). **Réactiver** la rouvre.
- **Résilier** — fin définitive : les résidences restent fermées jusqu'à l'ouverture d'un nouvel abonnement.
- **Réactiver** est refusé si la période est déjà échue (la résidence resterait fermée) : enregistrez d'abord le paiement, activez sans facture ou accordez un délai.

Résidence **sans abonnement** : elle fonctionne normalement (clients historiques, démos) et apparaît
dans la vue d'ensemble « Résidences sans abonnement » jusqu'à ce qu'on lui en ouvre un.

## Règles techniques

- Tables : `client_facturation`, `abonnement`, `abonnement_copropriete` (une seule couverture
  active par résidence), `facture_abonnement`, `compteur_facture_abonnement`, `paiement_abonnement`
  (append-only), `abonnement_evenement` (append-only, journal). Migration `m29_abonnements`.
- RLS : tout réservé au `SUPER_ADMIN`, sauf la lecture de l'abonnement de la résidence courante
  (nécessaire au contrôle d'accès). Factures, clients et journal ne sont jamais lisibles par un syndic.
- Résidence bloquée : toute requête répond **402 `ABONNEMENT_SUSPENDU`**, sauf `/v1/abonnement`,
  `/v1/users/me`, `/v1/app/version`, `/v1/auth` (de quoi afficher l'écran). L'opérateur n'est jamais bloqué.
- Montants : `lib/money` uniquement. Syndicats en TTC (TVA décomposée), cabinets en HT (TVA ajoutée).
- Paiement : `Idempotency-Key` obligatoire (le formulaire en génère une par ouverture).

## Limites connues

- Le contrôle d'accès porte sur les routes de la résidence. L'**espace cabinet** (`/v1/cabinets/**`,
  portefeuille, alertes, agenda) et les **jobs automatiques** (appels de fonds, relances, rappels d'AG)
  continuent pour une résidence fermée. À trancher : filtrer les résidences fermées du portefeuille
  et suspendre leurs jobs.
- Le cache d'état (60 s) vit en mémoire de chaque instance API : avec plusieurs instances, un
  paiement ou une suspension peut mettre jusqu'à une minute à s'appliquer partout.
- Un e-mail de rappel en échec n'est pas renvoyé (la clé est réservée avant l'envoi).

## Variables d'environnement

| Service | Variable | Rôle |
|---|---|---|
| API | `ABONNEMENTS_CONTACT_EMAIL` | E-mail montré au syndic (rappel, suspension). |
| API | `ABONNEMENTS_CONTACT_WHATSAPP` | Numéro WhatsApp montré au syndic (format international). |
| API | `ABONNEMENTS_OPERATEUR_EMAIL` | Destinataires opérateur des rappels (virgules). |
| Web | `SYNDICUP_FACTURE_RAISON_SOCIALE`, `_ADRESSE`, `_ICE`, `_RC`, `_IF`, `_RIB`, `_EMAIL` | En-tête et pied des factures. |

Les e-mails de rappel partent par Resend (`RESEND_API_KEY` / `RESEND_FROM` déjà posés) vers le
contact de facturation du client.

## Déploiement

1. `prisma migrate deploy` sur syndicup-prod (Render ne le lance pas — voir la note M26).
2. Poser les variables ci-dessus.
3. Ouvrir l'abonnement de CK SYNDIC (Menara Garden 2) avec les conditions réellement convenues.
