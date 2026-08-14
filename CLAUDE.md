# CLAUDE.md — Guide de l'agent de codage

Ce fichier est le point d'entrée pour toute session de développement sur ce repo. Il ne remplace pas
les documents de référence — il les résume pour qu'ils tiennent dans le contexte de chaque session,
et pointe vers le détail quand il faut aller plus loin.

## 0. Les deux documents de référence

| Document | Rôle | Autorité sur |
|---|---|---|
| `docs/source/USE_CASES_DOC_A.html` (+ version découpée par domaine dans `docs/domain-reference/`) | 200+ cas d'usage, 12 domaines métier, règles, edge cases | **Le QUOI** — toute règle métier |
| `docs/source/MASTER_ENGINEERING_SPEC.md` | Stack, schéma, API, sécurité, conventions | **Le COMMENT** — tout choix technique |

**En cas de conflit apparent : Doc A gagne sur le métier, le Master Spec gagne sur la technique.**
Un conflit réel doit être signalé à l'humain — jamais résolu silencieusement.

**Ne charge que le fichier de domaine pertinent** dans `docs/domain-reference/` pour la tâche en cours
(voir `docs/domain-reference/00-INDEX.md`), pas le HTML complet — sauf si la tâche touche
explicitement plusieurs domaines à la fois.

**Avant de commencer un module** : lis aussi `docs/ROADMAP_BACKLOG.md` pour savoir où ce module se
situe dans l'ordre de construction, et `docs/LEGAL_QUESTIONS_BRIEF.md` s'il touche AG, charges,
procurations, ou rétention de données — certaines valeurs y sont encore non confirmées
juridiquement et ne doivent jamais être codées en dur sans la confirmation qui y est décrite.

## 1. Principes non négociables (Master Spec Partie 1.7)

1. **Aucune valeur monétaire en `float`/`double`** — `numeric(14,2)` en Postgres, `decimal.js` côté TypeScript. Toute arithmétique monétaire passe par `apps/api/lib/money/`, jamais un calcul inline.
2. **Toute action à valeur probante est journalisée de façon immuable** (append-only) : votes AG, envois de notification, paiements, changements de propriétaire, décisions de PV. Ces tables n'ont **pas** de colonne `modifie_le`, pas d'UPDATE, pas de DELETE — correction = nouvelle ligne + lien vers la précédente.
3. **Idempotence obligatoire** sur toute action déclenchée par un job asynchrone ou un webhook (CMI). Header `Idempotency-Key` obligatoire sur toute écriture financière/probante — rejoué avec un payload différent sous la même clé = `409`.
4. **Aucun accès direct à la base depuis Flutter/web** — tout passe par l'API (Auth/Storage Supabase exceptés).
5. **Validation stricte de chaque payload (Zod)** avant écriture — rejet explicite, jamais de défaut silencieux sur un champ sensible.
6. **RTL et FR/AR dès le premier écran** — propriétés logiques (`start`/`end`), jamais `left`/`right`. Pas une passe de correction après coup.
7. **Contract-first** : chaque endpoint existe dans `packages/api-contract/openapi.yaml` avant d'être codé. Le client Flutter et les types web sont générés depuis ce fichier.
8. **Isolation multi-tenant en deux couches indépendantes** : middleware applicatif (`copropriete_id` injecté depuis le JWT, jamais un paramètre libre côté client) **et** policy RLS Postgres sur chaque table métier. Les deux couches doivent être vraies en même temps — l'une n'est jamais une excuse pour relâcher l'autre.

## 2. Ce que l'agent ne doit JAMAIS faire sans validation humaine explicite (Partie 19.6)

- Modifier une policy RLS existante en l'assouplissant.
- Supprimer ou altérer une ligne dans une table append-only.
- Changer un délai légal (convocation AG, rétention CNDP, quorum, majorité, procuration) sans confirmation juridique tracée dans `docs/LEGAL_QUESTIONS_BRIEF.md`.
- Désactiver ou contourner la validation Zod « pour aller plus vite en dev » dans du code qui atteint `main`.
- Inventer une valeur d'enum ou un champ absent du Master Spec / Doc A sans le signaler explicitement dans la PR.

## 3. Conventions

- **Base de données & domaine métier** : français, aligné sur Doc A (ex. `appel_de_fonds`, pas `fund_call`).
- **Code applicatif** (fonctions, variables, types) : anglais, camelCase TS / snake_case Dart & Postgres. La traduction métier↔code se fait au niveau du mapping Prisma/DTO — jamais mélangée dans un même identifiant.
- **Fichiers/dossiers** : kebab-case. **Enums Postgres** : `SCREAMING_SNAKE_CASE`, jamais de valeur libre.
- **Commits** : Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). **Branches** : `feature/<module>-<courte-description>`.

## 4. Definition of Done — à cocher pour toute fonctionnalité livrée

- [ ] Endpoint(s) documenté(s) dans `packages/api-contract/openapi.yaml` avant merge
- [ ] Policy RLS écrite et testée si nouvelle table / nouveau cas de confidentialité
- [ ] Tests unitaires + intégration couvrant le cas nominal et au moins un edge case du Doc A
- [ ] Validation Zod sur tout payload entrant
- [ ] Traduction FR/AR des textes utilisateur ajoutés
- [ ] Testé en RTL si UI concernée
- [ ] `audit_log` écrit si l'action a une valeur probante ou financière
- [ ] Pas de valeur monétaire manipulée en dehors de `lib/money`
- [ ] Erreurs métier attendues = réponses HTTP normales avec code d'erreur explicite (jamais des exceptions traitées comme des bugs) ; toute exception non gérée remonte à Sentry avec `request_id`, `utilisateur_id`, `copropriete_id`

## 5. Gestion des erreurs & logging

- Jamais de `catch` silencieux.
- Logs structurés JSON uniquement, champs obligatoires : `timestamp`, `request_id`, `copropriete_id`, `utilisateur_id` (si authentifié), `niveau`.
- Aucune PII en clair dans les logs (téléphone masqué partiellement, jamais de mot de passe/token).

## 6. Stack (résumé — détail Master Spec Partie 1.2)

Next.js 15 (API + web, TypeScript) · Prisma + PostgreSQL/Supabase (RLS) · Supabase Auth (OTP + email) ·
Supabase Storage · Inngest (jobs) · Flutter (mobile, Riverpod, client Dart généré depuis OpenAPI) ·
CMI (paiement) · FCM (push) · Sentry + Axiom/Better Stack (monitoring) · Turborepo monorepo.

## 7. Structure du repo

Voir l'arborescence complète en pied de fichier. Points clés : `packages/api-contract/openapi.yaml`
est la source de vérité de l'API, `packages/database/prisma/schema.prisma` celle du schéma, les deux
doivent rester synchronisés avec le Master Spec Partie 2 et 3 à chaque changement.

## 8. Comment traiter le Master Spec Partie 2.5 (enums)

Le Master Spec le dit explicitement : la liste exhaustive des valeurs d'enum par cas rare doit être
extraite de Doc A section par section **au moment de l'implémentation** de chaque module — ce
repo ne prétend pas l'avoir fait à l'avance de façon exhaustive. Quand un module touche un enum,
relis le fichier de domaine correspondant dans `docs/domain-reference/` avant de figer la liste
finale dans le schéma Prisma, puis documente les valeurs ajoutées dans la PR.
