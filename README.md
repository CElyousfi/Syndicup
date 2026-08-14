# Copropriété Maroc

Plateforme de gestion de copropriété pour le marché marocain — Web + iOS + Android depuis une
seule API. Voir `CLAUDE.md` avant toute session de développement.

## Avant de coder quoi que ce soit

1. Lire `CLAUDE.md` (non-négociables, Definition of Done, conventions).
2. Lire `docs/LEGAL_QUESTIONS_BRIEF.md` — l'envoyer à un avocat marocain spécialisé en droit de
   la copropriété avant de construire le module Assemblées Générales (voir pourquoi dans le
   brief : la réforme Loi 30-24 de 2024 n'est référencée nulle part dans les documents source et
   pourrait changer qui a le droit de convoquer une AG).
3. Lire `docs/ROADMAP_BACKLOG.md` pour savoir dans quel ordre construire et quelles dépendances
   respecter entre modules.
4. Compléter `M0` du roadmap (infra) avant `M1` (schéma).

## Structure

```
copropriete-maroc/
├── CLAUDE.md                     # guide agent — à lire en premier, chaque session
├── apps/
│   ├── api/                      # Next.js API-only (Vercel projet #1)
│   │   └── lib/money/            # arithmétique décimale — seul point de passage autorisé
│   ├── web/                      # Next.js web (Vercel projet #2)
│   └── mobile/                   # Flutter iOS + Android
├── packages/
│   ├── database/prisma/schema.prisma   # schéma unique — traduction du Master Spec Partie 2
│   ├── database/seed/seed.ts           # jeu de données de dev réaliste
│   ├── api-contract/openapi.yaml       # contrat API — source de vérité (contract-first)
│   └── config/                         # tsconfig/eslint partagés
├── docs/
│   ├── source/                   # les deux documents originaux, intacts, ne jamais éditer ici
│   ├── domain-reference/         # Doc A découpé en 12 fichiers par domaine (usage agent)
│   ├── LEGAL_QUESTIONS_BRIEF.md  # paramètres légaux à faire confirmer avant production
│   └── ROADMAP_BACKLOG.md        # scope MVP découpé en unités codables, dans l'ordre
└── .github/workflows/ci.yml
```

## Ce que ce scaffold fournit déjà

- Schéma Prisma complet (34 modèles) traduisant le Master Spec Partie 2 — validé sans erreur de
  relation (voir commentaires en tête de fichier pour les 2-3 décisions encore ouvertes : UUID v7,
  policies RLS à écrire séparément en SQL, enums à compléter module par module).
- Contrat OpenAPI 3.1 valide couvrant tous les modules de la Partie 3.2, avec deux endpoints
  (génération d'appel de fonds, vote AG) détaillés en exemple à répliquer pour le reste.
- `permissions.ts` — squelette typé de la matrice Partie 4.2, à compléter module par module.
- `lib/money` — arithmétique décimale + répartition au prorata des tantièmes, avec gestion de
  l'écart d'arrondi (le point exact que le test critique de la Partie 16.2 vérifie).
- Un jeu de données de seed couvrant indivision, MRE, locataire, et un lot volontairement impayé.
- CI (lint/typecheck/build/test + validation du contrat OpenAPI) prête à tourner dès le premier
  commit.

## Ce que ce scaffold NE fournit PAS (volontairement)

- Les policies RLS SQL elles-mêmes (patron donné en Master Spec Partie 2.3, à écrire table par
  table au fil du roadmap — c'est du code métier, pas de la configuration).
- Les valeurs légales (délai de convocation, quorum, majorités, procuration) — voir le brief
  juridique, ne pas les deviner.
- Le design visuel (palette, logo, wireframes) — les tokens du Master Spec Partie 14.2 sont
  indicatifs, pas finaux.
- Les comptes tiers réels (Supabase, Vercel, CMI, SMS, Apple/Google) — à provisionner (M0 du
  roadmap), ce scaffold ne peut pas le faire à ta place.

## Démarrage local (une fois M0 fait)

```bash
npm install
cp .env.example apps/api/.env.local   # puis remplir depuis Supabase/Vercel
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```
