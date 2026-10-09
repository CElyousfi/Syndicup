# Ticket backend — indicateur de présence (« qui est actif sur la résidence »)

**Statut : hors périmètre de la couche Alive** (décision D3, 2026-10-08). À planifier séparément.

## Besoin

Quand un autre gestionnaire (co-syndic, membre du cabinet, conseil) ou le gardien est actif sur la
même copropriété, afficher un petit indicateur discret, par exemple un point vert sur son avatar
dans l'en-tête et « Karim consulte les finances » au survol. Le but est d'éviter les doublons
(deux personnes saisissent le même paiement) et de rendre le travail d'équipe visible.

## Ce qu'il faudrait

1. **Contrat (OpenAPI d'abord)**
   - `POST /v1/presence/heartbeat`, authentifié, tenant via le JWT. Corps : `{ zone: ZONE_PRESENCE }`
     (enum fermé : `TABLEAU_DE_BORD`, `FINANCES`, `AG`, `INCIDENTS`, `AUTRE`). Il est appelé toutes
     les 30 s tant que l'app est au premier plan.
   - `GET /v1/presence` → `[{ utilisateur_id, prenom, role, zone, vu_le }]` pour la copropriété
     courante, limité aux rôles de gestion et au gardien.
   - Extension du flux SSE existant `GET /notifications/stream` avec un événement `presence`, pour
     ne pas ajouter de second flux.
2. **Données**
   - Option A (recommandée) : **aucune table**. Un TTL Redis (Upstash, déjà présent pour le rate
     limiting), avec la clé `presence:{copropriete_id}:{utilisateur_id}` et une expiration de 60 s.
     Rien de probant, rien à conserver.
   - Option B : une table `presence_session` (non probante, donc pas append-only), avec purge
     automatique au-delà de 24 h, une **policy RLS** par `copropriete_id` et un index sur
     `(copropriete_id, vu_le)`.
3. **Confidentialité (CNDP, loi 09-08)**
   - L'activité d'un utilisateur est une donnée personnelle. Il faut une mention dans la politique
     de confidentialité, et vérifier qui voit qui : les résidents ne voient **jamais** la présence
     des gestionnaires, et inversement.
   - À faire valider dans `docs/LEGAL_QUESTIONS_BRIEF.md` avant tout code : finalité, durée de
     conservation (option A : 60 s, rien n'est conservé) et information des personnes.
   - Un réglage « Masquer ma présence » par utilisateur.
4. **Clients**
   - Web : un battement de cœur dans `components/shell/live.tsx` (visibilité de l'onglet) et des
     pastilles d'avatars dans l'en-tête de la coque.
   - Mobile : un battement de cœur dans `core/realtime/notifications_live.dart` au premier plan
     uniquement (via `AppLifecycleListener`), et les mêmes pastilles.
   - Animation : un point vert qui apparaît avec un ressort, **sans pulsation en boucle**
     (règle de retenue Alive).
5. **Tests**
   - RLS : un utilisateur d'une autre copropriété ne voit rien.
   - Un résident ne voit pas la présence des gestionnaires.
   - Expiration après 60 s sans battement.
   - Le heartbeat est rate-limité (2/min/utilisateur).

## Estimation

Environ 2 jours backend + 1 jour par client. La validation juridique n'est pas encore faite.
