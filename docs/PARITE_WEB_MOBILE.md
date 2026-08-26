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
| M2, M3… | Tous les écrans (login/OTP/invite, lots, etc.) | ✗ | ✗ | confirmé | Décision explicite du propriétaire du projet (17/08/2026) : construire le backend complet (schéma, RLS, API, tests) module par module avant d'attaquer l'UI, plutôt que livrer écran par écran au fil de l'eau. Rattrapage prévu en bloc une fois le backend jugé complet — voir `docs/ROADMAP_BACKLOG.md`. Ne dispense pas de tenir ce registre à jour ensuite. |
| M10 | Sync offline des visites (queue Drift/SQLite, écriture optimiste) | ✗ | ✓ | proposé | Cas d'usage gardien sur le terrain sans connexion ; Master Spec 13.3 ne prévoit l'offline que côté mobile, et jamais pour les finances. |
| M12 | Résolution du rôle côté serveur dans le layout `(dashboard)` | ✓ | ✗ (équivalent : guard Riverpod côté client + API qui refuse) | proposé | Mécanisme structurel propre au rendu serveur Next.js ; la sécurité réelle reste l'API + RLS, identique pour les deux clients. |
| M2 | OTP par SMS comme canal principal de connexion | ✓ (aussi email/mot de passe) | ✓ | proposé | Pas un écart fonctionnel — noté pour mémoire : les deux clients passent par Supabase Auth, aucun accès direct base. |
| M9 | Réception des notifications push (FCM) | ✗ (web : centre de notifications in-app + email) | ✓ | proposé | Push natif = mobile ; le web reçoit les mêmes événements via la matrice événement→canal (Master Spec 7.1), aucun événement perdu. |

## Écarts interdits d'office (ne pas proposer)

- Toute fonctionnalité financière (paiement, consultation de charges, quittances) absente d'un des deux clients.
- Tout vote ou consultation AG absent d'un des deux clients.
- FR/AR ou RTL présent sur un client et pas l'autre.
