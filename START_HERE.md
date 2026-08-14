# START_HERE.md — Point d'entrée du repo

> **Statut : BROUILLON — à valider par le propriétaire du projet avant de faire autorité.**

Ce fichier dit dans quel ordre lire la documentation et rappelle les 5 règles qui ne se
négocient jamais, quelle que soit la tâche. Il ne remplace aucun document — il oriente.

## Ordre de lecture

1. **`CLAUDE.md`** — guide de session : principes, conventions, Definition of Done. À relire au début de chaque session.
2. **`docs/ROADMAP_BACKLOG.md`** — où en est la construction, quel module est en cours, quelles dépendances.
3. **`docs/domain-reference/00-INDEX.md`** — puis *uniquement* le fichier de domaine pertinent pour la tâche en cours (jamais le HTML complet de Doc A, sauf tâche multi-domaines).
4. **`docs/source/MASTER_ENGINEERING_SPEC.md`** — la partie technique concernée par la tâche (schéma, API, sécurité).
5. **`docs/LEGAL_QUESTIONS_BRIEF.md`** — obligatoire si la tâche touche AG, charges, procurations, litiges ou rétention de données.
6. **`docs/PARITE_WEB_MOBILE.md`** — registre de parité web/mobile, à mettre à jour à chaque écran livré.

En cas de conflit apparent : **Doc A** (`docs/source/USE_CASES_DOC_A.html`) gagne sur le métier,
le **Master Spec** gagne sur la technique. Un conflit réel est **signalé à l'humain**, jamais
résolu silencieusement.

## Les 5 non-négociables

1. **Argent = Decimal, jamais float.** `numeric(14,2)` en Postgres, `decimal.js` en TypeScript. Toute arithmétique monétaire passe par `apps/api/lib/money/` — aucun calcul inline, nulle part.
2. **Isolation multi-tenant en deux couches indépendantes.** Middleware applicatif (`copropriete_id` injecté depuis le JWT vérifié, jamais un paramètre libre client) **et** policy RLS Postgres écrite **en même temps** que la création de chaque table — jamais après coup. Une couche n'excuse jamais l'autre.
3. **Contract-first.** Rien n'est codé avant d'exister dans `packages/api-contract/openapi.yaml`. Le client Flutter et les types web sont générés depuis ce fichier — c'est la source de vérité de l'API.
4. **Un produit, deux interfaces.** Chaque module livre son écran web **et** mobile (FR/AR + RTL dès le premier écran). Toute exception de parité est justifiée et consignée dans `docs/PARITE_WEB_MOBILE.md` — jamais implicite.
5. **Aucune valeur légale codée en dur sans confirmation.** Délais de convocation AG, quorums, majorités, limites de procuration, rétention CNDP : uniquement si la réponse est confirmée dans `docs/LEGAL_QUESTIONS_BRIEF.md`. En cas de doute : **stop et demander**. Doc A gagne sur les règles métier, mais les conflits sont rapportés.

## Rappels de discipline (détail dans `CLAUDE.md`)

- Tables probantes = append-only : pas d'UPDATE, pas de DELETE, correction = nouvelle ligne liée.
- `Idempotency-Key` obligatoire sur toute écriture financière/probante.
- Validation Zod stricte sur tout payload entrant — jamais désactivée « pour aller vite ».
- Un module à la fois, dans l'ordre de `docs/ROADMAP_BACKLOG.md` — pas d'anticipation.
