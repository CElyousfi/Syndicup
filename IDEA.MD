# Plateforme de Gestion de Copropriété — Maroc
## Dossier d'Ingénierie Complet — Document Unique de Référence Technique
 
**Version 1.0 — Juillet 2026**
**Statut : Référence figée pour le démarrage du développement**
**Complète : Doc A (`USE_CASES_Copropriete_Maroc_v2.0.html` — 200+ cas d'usage, 12 domaines métier)**
 
---
 
## Table des matières
 
- **Partie 0** — Comment utiliser ce document
- **Partie 1** — Architecture & Stack Technique
- **Partie 2** — Modèle de Données & Schéma Base de Données
- **Partie 3** — Spécification API
- **Partie 4** — Authentification, RBAC & Matrice de Permissions
- **Partie 5** — Onboarding & Cycle de Vie Utilisateur
- **Partie 6** — Moteur Financier (charges, appels de fonds, paiements)
- **Partie 7** — Notifications & Communications
- **Partie 8** — Moteur Assemblées Générales
- **Partie 9** — Génération de Documents & Stockage
- **Partie 10** — Sécurité & Conformité
- **Partie 11** — Exigences Non-Fonctionnelles & Performance
- **Partie 12** — Architecture Frontend Web (Next.js)
- **Partie 13** — Architecture Mobile (Flutter)
- **Partie 14** — Design System & UI Guidelines
- **Partie 15** — DevOps, CI/CD & Déploiement
- **Partie 16** — Stratégie de Tests & QA
- **Partie 17** — Scope MVP & Roadmap de Release
- **Partie 18** — Glossaire & Modèle de Domaine
- **Partie 19** — Guidelines d'Ingénierie pour l'Agent de Codage
---
 
# PARTIE 0 — Comment utiliser ce document
 
## 0.1 Deux documents, deux rôles
 
| Document | Rôle | Autorité sur |
|---|---|---|
| **Doc A** (`USE_CASES_Copropriete_Maroc_v2.0.html`) | Spécification métier exhaustive : 200+ cas d'usage, 12 domaines, références légales (Loi 18-00, 106-12, 09-08), edge cases, règles de confidentialité | **Le QUOI** — toute règle métier, calcul, workflow, cas limite |
| **Ce document** (dossier d'ingénierie) | Comment le système est construit | **Le COMMENT** — stack, schéma, API, sécurité, conventions de code |
 
En cas de conflit apparent : Doc A gagne sur le métier, ce document gagne sur la technique. Un conflit réel doit être signalé à l'humain, jamais résolu silencieusement par l'agent de codage.
 
## 0.2 Règle de complétude
 
Aucune partie de ce document ne laisse de zone grise bloquant l'implémentation. Quand une donnée exacte dépend d'un texte de loi marocain que ce document ne peut pas garantir à 100% (ex. délai exact de convocation AG), c'est marqué explicitely **« À faire valider juridiquement »** — jamais une valeur inventée présentée comme certaine.
 
## 0.3 Contraintes projet (rappel, pilotent tout le reste du document)
 
- Marché unique : **Maroc**. Pas de multi-devise, pas de multi-pays.
- Produit **non négociable à utiliser** : rapide, fiable, sans bug, sécurisé.
- Construit par un **agent de codage** → précision maximale requise, ambiguïté minimale.
- Backend hébergé sur **Vercel**.
- Client final : **Web + iOS + Android** depuis une seule API.
- Bilingue **FR/AR** avec support RTL natif.
- Aucun document supplémentaire ne doit être nécessaire après celui-ci pour démarrer la construction.
---
 
# PARTIE 1 — Architecture & Stack Technique
 
## 1.1 Contraintes qui pilotent la décision
 
| Contrainte | Implication technique |
|---|---|
| Marché unique Maroc | Pas de multi-région/multi-devise ; optimiser pour le trafic local |
| Précision financière légale (charges, tantièmes, quittances) | Aucune opération monétaire en `float`. Entiers (centimes) ou `numeric` strict, de bout en bout |
| Confidentialité fine-grained (Doc A §12.3) | Isolation multi-tenant **et** intra-tenant (row-level), RLS ou équivalent applicatif strict |
| PV d'AG = preuve légale, infalsifiable, horodatée | Journalisation immuable (append-only) pour tout ce qui a valeur probante |
| Public hétérogène : MRE, gardiens peu digitalisés, personnes âgées | Auth multicanal (téléphone/SMS + email), notifications multi-canal avec accusé de réception traçable |
| Bilingue FR/AR, RTL | Frontend et design system supportent RTL nativement dès le départ |
| Construit par agent de codage, doit être sans bug | Stack mainstream, la mieux documentée possible, typage fort de bout en bout |
| Backend sur **Vercel** | Runtime qui colle à ce que Vercel exécute le mieux : Node.js/Next.js plutôt que Python |
| Web + iOS + Android depuis une seule API | API = contrat indépendant du client (REST + OpenAPI) |
 
## 1.2 Décision finale — vue d'ensemble
 
| Couche | Choix | Alternative écartée | Pourquoi |
|---|---|---|---|
| Langage backend | **TypeScript / Node.js** | Python (FastAPI) | Vercel exécute Node nativement (cold-start minimal) ; partage de types avec le web ; écosystème OpenAPI/codegen mature pour Flutter ; moins d'erreurs générées par un agent de codage sur une stack mainstream |
| Framework API | **Next.js 15 (App Router, Route Handlers)**, API-only, séparé du site web | Express/Fastify autonome | Déploiement Vercel natif, middleware auth intégré, cron natif |
| Base de données | **PostgreSQL managé via Supabase** | MySQL/PlanetScale | Types `numeric` stricts, contraintes riches, **Row-Level Security native** — colle exactement aux règles de confidentialité Doc A §12.3 ; Auth + Storage + Realtime inclus |
| ORM | **Prisma** pour schéma/migrations/requêtes courantes ; SQL brut pour policies RLS et calculs financiers critiques | Drizzle ORM | Prisma très largement plus documenté → moins de bugs générés par un agent ; compensé par isolation systématique en middleware + RLS en défense en profondeur |
| Authentification | **Supabase Auth** (OTP téléphone SMS, email/mot de passe, magic link) | Auth.js/NextAuth | OTP téléphone marocain natif, essentiel pour gardiens/résidents peu digitalisés ; JWT compatible RLS Postgres nativement |
| Stockage fichiers | **Supabase Storage** | Vercel Blob | URLs signées, buckets privés par copropriété, même politique RLS |
| Jobs asynchrones/cron | **Inngest** | Trigger.dev, Vercel Cron seul | Fonctions Vercel limitées en durée ; Inngest gère workflows durables, retries, cron |
| Notifications push | **Firebase Cloud Messaging (FCM)** | OneSignal | Gratuit, natif Flutter + web push, un seul SDK |
| SMS | Passerelle SMS marocaine (à contractualiser — Vonage/Twilio route Maroc ou opérateur local) | — | Détail en Partie 7 |
| Paiement en ligne | **CMI (Centre Monétique Interbancaire)** | Stripe | Standard marocain pour paiement carte local, obligatoire pour les banques émettrices marocaines |
| Web frontend | **Next.js 15 (App Router)**, TypeScript, Tailwind CSS, shadcn/ui | Remix, SvelteKit | Cohérence de langage avec le backend, types partagés via monorepo |
| Mobile (iOS + Android) | **Flutter** | React Native | Un seul codebase, quasi-natif, excellent offline (module gardien), écosystème mûr pour CMI/FCM |
| Client API mobile | Client Dart **généré depuis le contrat OpenAPI** | Appels HTTP manuels | Élimine une classe entière de bugs d'intégration |
| Monitoring erreurs | **Sentry** (backend + web + Flutter) | — | Un seul dashboard cross-stack |
| Logs structurés | **Axiom** ou **Better Stack** | — | Recherche/alerting sur le journal d'audit |
| CI/CD | **GitHub Actions** + déploiement auto Vercel ; **Codemagic** pour Flutter | — | Voir Partie 15 |
 
## 1.3 Schéma d'architecture
 
```
                     Résidents / Syndic / Gardien / Prestataires
                     ┌───────────────┬───────────────┬───────────────┐
                     │               │               │               │
             Web (Next.js/Vercel)  Flutter iOS    Flutter Android
                     │               │               │
                     └───────┬───────┴───────┬───────┘
                              │  HTTPS / REST (contrat OpenAPI)
                    ┌─────────▼──────────────────────────┐
                    │  API — Next.js Route Handlers        │
                    │  (Vercel Functions, Node)             │
                    │  Auth · RBAC · Tenant scoping ·       │
                    │  Rate limiting · Validation Zod       │
                    └─────────┬───────────────┬────────────┘
                              │               │
                 ┌────────────▼─────┐   ┌─────▼──────────┐
                 │ Supabase Postgres  │   │ Inngest (jobs)  │
                 │ + RLS + Auth +     │   │ Appels de fonds,│
                 │ Storage + Realtime │   │ relances, cron  │
                 └────────────┬───────┘   └─────┬───────────┘
                              │                  │
           ┌───────────┬──────┴──────┬────────────┼──────────────┐
      ┌────▼────┐ ┌────▼────┐  ┌─────▼─────┐ ┌────▼─────┐ ┌──────▼──────┐
      │  CMI     │ │  FCM     │  │ SMS Maroc │ │ Email    │ │ Sentry/Axiom│
      │  Paiement│ │  Push    │  │ Gateway   │ │ (Resend) │ │ Monitoring  │
      └──────────┘ └──────────┘  └───────────┘ └──────────┘ └─────────────┘
```
 
## 1.4 Structure du monorepo
 
Un **monorepo Turborepo** unique — un seul contexte de travail cohérent pour l'agent de codage.
 
```
copropriete-maroc/
├── apps/
│   ├── api/                    # Next.js API-only — Vercel projet #1
│   │   ├── app/api/v1/...      # Route Handlers, un dossier par module (Partie 3)
│   │   ├── lib/
│   │   │   ├── auth/           # middleware auth + RBAC
│   │   │   ├── tenant/         # scoping copropriete_id obligatoire
│   │   │   ├── db/             # client Prisma
│   │   │   ├── money/          # arithmétique décimale sécurisée
│   │   │   └── audit/          # journal d'audit immuable
│   │   └── inngest/            # fonctions asynchrones
│   ├── web/                    # Next.js site web — Vercel projet #2
│   │   └── app/[locale]/...    # i18n fr/ar, RTL au niveau layout
│   └── mobile/                 # Flutter iOS + Android
│       ├── lib/
│       │   ├── core/           # client API généré, thème, i18n
│       │   ├── features/       # un dossier par module métier
│       │   └── offline/        # cache local (Drift/SQLite) — module gardien
├── packages/
│   ├── database/                # schéma Prisma unique, migrations, seed
│   ├── shared-types/             # types TS générés (Prisma + OpenAPI)
│   ├── api-contract/             # spec OpenAPI (source de vérité, Partie 3)
│   └── config/                   # ESLint, TSConfig, Prettier partagés
├── docs/                          # ce document
├── turbo.json
└── package.json
```
 
**Pourquoi deux projets Vercel séparés** (`api` et `web`) : l'API doit rester un contrat stable consommé identiquement par le web et par Flutter. Coupler l'API aux pages web crée un couplage qui finit toujours par casser le mobile.
 
## 1.5 Environnements & déploiement
 
| Environnement | Branche | Base de données | Usage |
|---|---|---|---|
| Local | toute branche locale | Supabase local (Docker) ou projet "dev" partagé | Dev quotidien |
| Preview | toute PR ouverte | Base "staging" partagée (données test) | Revue de PR |
| Staging | `staging` | Projet Supabase staging dédié | Recette, UAT pilotes |
| Production | `main` | Projet Supabase production | Utilisateurs réels |
 
Règles : aucun déploiement direct en production hors merge sur `main` via CI verte. Migrations Prisma auto en staging, **validation manuelle obligatoire** avant application en production.
 
## 1.6 Multi-tenancy & isolation des données
 
Chaque copropriété = un tenant. Toute table métier porte `copropriete_id` (sauf tables globales : utilisateurs plateforme, référentiels légaux).
 
Isolation en **deux couches indépendantes**, défense en profondeur :
 
1. **Couche applicative** : middleware obligatoire sur chaque route API, injecte `copropriete_id` déduit du token authentifié ; aucune requête Prisma métier n'est exécutable sans ce filtre (wrapper de client Prisma, pas laissé à la discrétion du développeur).
2. **Couche base de données** : policies **RLS Postgres** actives sur chaque table métier, qui repoussent toute requête ne portant pas le `copropriete_id` du JWT Supabase — même en cas de bug applicatif.
Les règles fines du Doc A §12.3 sont des policies RLS supplémentaires par rôle, détaillées en Partie 2.
 
## 1.7 Principes d'ingénierie non négociables
 
1. **Aucune valeur monétaire en `float`/`double`** — `numeric(14,2)` en Postgres, `decimal.js` côté TypeScript.
2. **Toute action à valeur probante est journalisée de façon immuable** (append-only) : votes AG, envois de notification, paiements, changements de propriétaire, décisions de PV.
3. **Idempotence obligatoire** sur toute action déclenchée par un job asynchrone ou un webhook (CMI).
4. **Aucun accès direct à la base depuis Flutter/web** — tout passe par l'API (Auth/Storage Supabase exceptés).
5. **Validation stricte de chaque payload** (Zod) avant écriture — rejet explicite, jamais de défaut silencieux sur un champ sensible.
6. **RTL et FR/AR dès le premier écran**, pas en rustine post-launch.
7. **Contract-first** : chaque endpoint existe dans le contrat OpenAPI avant d'être codé.
## 1.8 Décisions ouvertes (opérationnelles, non bloquantes pour démarrer)
 
| Sujet | Action requise |
|---|---|
| Fournisseur SMS Maroc | Contractualiser un agrégateur (impacte Partie 7) |
| Contrat marchand CMI | Ouverture de compte marchand (délai administratif à anticiper) |
| Comptes développeur Apple/Google | À créer tôt (délai de validation Apple possible) |
| Domaine + email transactionnel (Resend) | À réserver tôt pour la délivrabilité |
 
---
 
# PARTIE 2 — Modèle de Données & Schéma Base de Données
 
## 2.1 Conventions de schéma
 
- Toute table métier : `id` (UUID v7, triable chronologiquement), `copropriete_id` (FK, sauf tables globales), `cree_le`, `modifie_le` (timestamptz).
- Tables à valeur probante (§1.7.2) : **pas de colonne `modifie_le` ni de UPDATE/DELETE autorisé** — append-only strict, corrections via nouvelle ligne + lien vers la précédente.
- Noms de tables et colonnes en **français**, alignés sur le vocabulaire juridique marocain du Doc A (facilite la traçabilité métier↔code) — voir Partie 18 pour le glossaire de mapping. Noms de fonctions/variables applicatives en anglais (convention code standard), voir Partie 19.
- Tous les montants : `numeric(14,2)`, jamais `float`/`double`/`real`.
- Tous les enums métier : type Postgres `ENUM` natif (pas de varchar libre) pour empêcher les valeurs invalides au niveau base.
## 2.2 Entités principales
 
### Tenant & structure immobilière
 
| Table | Champs clés | Notes |
|---|---|---|
| `copropriete` | id, nom, adresse, ville, type_residence (enum: immeuble_collectif, residence_fermee, residence_villas, immeuble_bureaux, immeuble_mixte, residence_etudiante), nb_lots, date_creation, statut (active/archivee), config_json (flags activables : locataire_voit_pv, reservation_espaces_proprietaires_only, etc. — Doc A §10) | Racine du multi-tenant |
| `lot` | id, copropriete_id, type_lot (enum: appartement, parking, cave, local, toit_terrasse, villa, commercial, bureau, loge_gardien), numero, etage, tantiemes, superficie, statut (enum: occupe, vacant, orphelin, en_succession, sinistre), lot_parent_id (nullable, pour parking/cave rattaché à un lot) | Doc A §1 |
| `espace_commun` | id, copropriete_id, nom, type, capacite, reservable (bool), regles_reservation_json | Doc A §7 |
 
### Utilisateurs & droits sur les lots
 
| Table | Champs clés | Notes |
|---|---|---|
| `utilisateur` | id, email (nullable), telephone (nullable, au moins un des deux requis), nom, prenom, langue_preferee (fr/ar), statut_compte (enum: invite, actif, suspendu, desactive, anonymise), raison_sociale (nullable, si personne morale), rc_numero (nullable) | Doc A §2.7 pour personne morale |
| `role_utilisateur` | utilisateur_id, copropriete_id, role (enum: super_admin, syndic, conseil_syndical, proprietaire, locataire, indivisaire, gardien, prestataire, personne_morale_representant), actif (bool) | Un utilisateur peut avoir des rôles différents sur des copropriétés différentes |
| `lot_proprietaire` | lot_id, utilisateur_id, quote_part (pour indivision, somme=100%), type_propriete (enum: plein, indivision, sci), est_representant_indivision (bool), date_debut, date_fin (nullable) | Doc A §2.4 — indivision |
| `lot_occupant` | lot_id, utilisateur_id, type_occupation (enum: proprietaire_occupant, locataire), date_debut, date_fin (nullable), acces_finances_accorde (bool, défaut false), recoit_convocations (bool, défaut false) | Doc A §2.2, §2.3 |
| `succession` | id, lot_id, proprietaire_decede_id, statut (enum: ouverte, heritiers_designes, cloturee), contact_temporaire_id, date_ouverture | Doc A §2.5 |
 
### Finances
 
| Table | Champs clés | Notes |
|---|---|---|
| `budget_ag` | id, copropriete_id, ag_id, exercice, montant_total, statut (enum: propose, vote, actif) | Voté en AG — Doc A §6 |
| `appel_de_fonds` | id, copropriete_id, periode, type (enum: charges_courantes, travaux, fonds_reserve), montant_total, date_echeance, statut (enum: brouillon, emis, cloture) | Doc A §3.2 |
| `appel_de_fonds_lot` | appel_de_fonds_id, lot_id, montant_du (calculé via tantièmes), montant_paye, statut (enum: paye, partiel, impaye) | Un par lot par appel |
| `paiement` | id, lot_id, appel_de_fonds_lot_id, montant, methode (enum: cmi, virement, especes, cheque), reference_cmi (nullable), statut (enum: valide, en_attente, rejete), horodatage | **Append-only, immuable** |
| `fonds_reserve` | id, copropriete_id, solde, historique via table `fonds_reserve_mouvement` (append-only) | Doc A §3.6 |
| `quittance` | id, appel_de_fonds_lot_id, pdf_url, numero, date_emission | Générée automatiquement à paiement complet |
| `contestation_charge` | id, appel_de_fonds_lot_id, utilisateur_id, motif, statut (enum: ouverte, repondue, mediee, tribunal), reponse_syndic | Doc A §12.1 |
 
### Assemblées générales
 
| Table | Champs clés | Notes |
|---|---|---|
| `assemblee_generale` | id, copropriete_id, type (enum: ordinaire, extraordinaire, revocation), date_convocation, date_ag, statut (enum: planifiee, en_cours, cloturee, annulee), quorum_requis, quorum_atteint, motif_annulation (nullable) | Doc A §6 |
| `ag_resolution` | id, ag_id, ordre, texte, type_majorite (enum: simple, double, unanimite), resultat (enum: en_attente, adoptee, rejetee) | |
| `ag_vote` | id, resolution_id, lot_id, utilisateur_id, valeur (enum: pour, contre, abstention), tantiemes_representes, horodatage | **Append-only, immuable** — anonymisé à l'affichage résident, visible en clair pour le syndic (audit) |
| `ag_procuration` | id, lot_id, mandant_id, mandataire_id, ag_id | Doc A §2.4, §12.3 |
| `ag_pv` | id, ag_id, contenu_json, pdf_url, hash_integrite, horodatage_generation | **Append-only** — voir Partie 9 |
| `ag_notification_log` | id, ag_id, utilisateur_id, canal, horodatage_envoi, accusé_reception | Preuve légale d'envoi — Doc A §12.2 |
 
### Incidents, personnel, tiers
 
| Table | Champs clés | Notes |
|---|---|---|
| `incident` | id, copropriete_id, lot_id (nullable si partie commune), categorie, sous_categorie, partie (enum: commune, privative), urgence (enum: normale, urgente, urgence_maximale), statut (enum: ouvert, en_cours, resolu, ferme), cree_par, assigne_a (prestataire_id, nullable), sla_deadline | Doc A §5 |
| `incident_log` | id, incident_id, statut_avant, statut_apres, acteur_id, commentaire, horodatage | Append-only, historique complet |
| `prestataire` | id, copropriete_id, nom, specialite, contact, actif | |
| `personnel` (gardien) | utilisateur_id (FK role gardien), copropriete_id, statut (enum: present, absent, remplace), logement_lot_id (nullable) | Doc A §9 |
| `visite` | id, gardien_id, lot_id, visiteur_nom, statut (enum: en_attente, autorise, refuse), horodatage | Doc A §7 |
| `reservation_espace_commun` | id, espace_id, lot_id, date_debut, date_fin, statut (enum: confirmee, annulee) | |
| `conflit_litige` | id, copropriete_id, type, description, statut, escalade_niveau (int) | Doc A §12.1 |
| `garantie_promoteur` | id, lot_id (nullable) ou copropriete_id, type (enum: decennale, biennale), date_debut, date_fin | Doc A §10 |
 
### Documents, notifications, audit
 
| Table | Champs clés | Notes |
|---|---|---|
| `document` | id, copropriete_id, type (enum: reglement_interieur, pv, quittance, contrat, rapport, autre), url, visibilite (enum: public_copropriete, syndic_only, conseil_syndical), date_creation | Voir Partie 9 |
| `notification` | id, utilisateur_id, canal (enum: push, sms, email, whatsapp), template_code, contenu_rendu, statut_envoi (enum: en_file, envoye, echoue), accuse_reception (bool), horodatage | **Append-only** — preuve légale, Doc A §12.2 |
| `audit_log` | id, acteur_id (nullable si système), action, entite, entite_id, avant_json, apres_json, horodatage, ip | **Append-only, jamais UPDATE/DELETE** |
 
## 2.3 Row-Level Security — principe d'implémentation
 
Chaque table métier a au minimum une policy de tenant isolation, plus des policies additionnelles par rôle reprenant Doc A §12.3 :
 
```sql
-- Isolation tenant de base (répétée sur chaque table métier)
CREATE POLICY tenant_isolation ON lot
  USING (copropriete_id = current_setting('app.current_copropriete_id')::uuid);
 
-- Confidentialité fine : un résident ne voit pas la dette du voisin (Doc A §12.3)
CREATE POLICY impaye_confidentiel ON appel_de_fonds_lot
  FOR SELECT
  USING (
    -- le syndic et le conseil syndical voient tout dans leur copropriété
    current_setting('app.current_role') IN ('syndic', 'conseil_syndical')
    OR
    -- un résident ne voit que la ligne de son propre lot
    lot_id IN (SELECT lot_id FROM lot_proprietaire WHERE utilisateur_id = current_setting('app.current_user_id')::uuid)
    OR
    lot_id IN (SELECT lot_id FROM lot_occupant WHERE utilisateur_id = current_setting('app.current_user_id')::uuid)
  );
 
-- Vote AG : le syndic voit le détail nominatif (audit), le résident voit le résultat agrégé uniquement
CREATE POLICY vote_anonymise_resident ON ag_vote
  FOR SELECT
  USING (
    current_setting('app.current_role') = 'syndic'
    OR utilisateur_id = current_setting('app.current_user_id')::uuid  -- chacun voit son propre vote
  );
```
 
`app.current_copropriete_id`, `app.current_role`, `app.current_user_id` sont injectés par le middleware API à chaque connexion (via `SET LOCAL`), dérivés du JWT Supabase vérifié — jamais fournis par le client directement.
 
## 2.4 Contraintes d'intégrité critiques (niveau base, pas seulement applicatif)
 
| Contrainte | Table | Type |
|---|---|---|
| Somme des `quote_part` d'un lot en indivision = 100% | `lot_proprietaire` | `CHECK` + trigger de validation à l'écriture |
| Somme des tantièmes d'une copropriété = total défini au règlement | `lot` | Trigger de validation, alerte si écart |
| Un seul `role='syndic' actif=true` par copropriété | `role_utilisateur` | Index unique partiel |
| `montant_paye` ≤ `montant_du` sauf trop-perçu explicitement flaggé | `appel_de_fonds_lot` | `CHECK` conditionnel |
| Pas de DELETE sur `ag_vote`, `paiement`, `audit_log`, `notification`, `ag_pv` | — | `REVOKE DELETE`, `REVOKE UPDATE` au niveau rôle Postgres applicatif |
 
## 2.5 Décision ouverte
 
Le détail exact des enums (valeurs additionnelles par cas rares du Doc A §12.2, ex. `SITUATION_COMPLEXE`, `SINISTRE`) doit être extrait exhaustivement du Doc A section par section au moment de l'implémentation Prisma — ce document donne la structure et les cas majeurs, le Doc A reste la liste de vérité pour l'exhaustivité des valeurs d'enum métier.
 
---
 
# PARTIE 3 — Spécification API
 
## 3.1 Conventions générales
 
- Base URL : `https://api.copropriete-maroc.ma/v1`
- Contrat **OpenAPI 3.1** maintenu dans `packages/api-contract/openapi.yaml`, **source de vérité contract-first** : tout endpoint est décrit dans ce fichier avant d'être codé, et le client Flutter + les types web sont générés depuis lui.
- Auth : header `Authorization: Bearer <jwt_supabase>` sur toutes les routes sauf `/auth/*`.
- Toutes les routes sont scopées à une copropriété via le JWT (`copropriete_id` n'est jamais un paramètre libre côté client pour les rôles non-super_admin).
- Format de réponse standard :
```json
{ "data": { }, "meta": { "request_id": "..." } }
```
- Format d'erreur standard :
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": { "montant": "doit être positif" } } }
```
- Codes d'erreur normalisés : `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).
- Pagination : `?page=1&limit=20`, réponse avec `meta.total`, `meta.page`, `meta.has_more`.
- Toute écriture financière ou à valeur probante accepte un header `Idempotency-Key` obligatoire — rejeté avec `409` si rejoué avec un payload différent sous la même clé.
## 3.2 Modules & endpoints principaux
 
| Module | Endpoints clés | Rôles autorisés |
|---|---|---|
| **Auth** | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/invite/accept` | Public / invité |
| **Copropriétés** | `GET/POST /coproprietes`, `GET/PATCH /coproprietes/:id`, `GET /coproprietes/:id/config` | super_admin (create), syndic (manage own) |
| **Lots** | `GET/POST /lots`, `GET/PATCH /lots/:id`, `POST /lots/:id/proprietaires`, `POST /lots/:id/occupants`, `POST /lots/:id/transfert-propriete` | syndic (write), tous (read scopé) |
| **Utilisateurs** | `GET /users/me`, `PATCH /users/me`, `GET /users/:id` (syndic only), `POST /users/:id/anonymize` | selon rôle |
| **Finances** | `GET /finances/appels-de-fonds`, `POST /finances/appels-de-fonds` (génération batch), `GET /finances/lots/:id/solde`, `POST /finances/paiements`, `POST /finances/paiements/cmi/webhook`, `GET /finances/quittances/:id` | syndic (write), résident (read scopé à son lot) |
| **Assemblées Générales** | `POST /ag`, `POST /ag/:id/convoquer`, `POST /ag/:id/resolutions`, `POST /ag/:id/votes`, `POST /ag/:id/cloturer`, `GET /ag/:id/pv` | syndic (write), copropriétaire (vote) |
| **Incidents** | `GET/POST /incidents`, `PATCH /incidents/:id/statut`, `POST /incidents/:id/assign` | tous (create), syndic/prestataire (update scopé) |
| **Personnel / Gardien** | `GET/POST /personnel`, `POST /visites`, `PATCH /visites/:id/statut` | syndic (write personnel), gardien (visites) |
| **Espaces communs** | `GET /espaces-communs`, `POST /reservations`, `PATCH /reservations/:id` | résident (create), syndic (manage config) |
| **Documents** | `GET /documents`, `POST /documents`, `GET /documents/:id/download-url` | selon `visibilite` + RLS |
| **Notifications** | `GET /notifications`, `PATCH /notifications/:id/read` | utilisateur (ses propres notifications) |
| **Litiges / Conflits** | `GET/POST /litiges`, `PATCH /litiges/:id/escalade` | syndic, conseil_syndical |
 
## 3.3 Exemple de contrat détaillé — génération d'un appel de fonds
 
```
POST /v1/finances/appels-de-fonds
Authorization: Bearer <jwt> (role: syndic)
Idempotency-Key: <uuid>
 
Body:
{
  "copropriete_id": "uuid",
  "periode": "2026-08",
  "type": "charges_courantes",
  "date_echeance": "2026-08-10"
}
 
Réponse 201:
{
  "data": {
    "id": "uuid",
    "statut": "emis",
    "montant_total": "45200.00",
    "nb_lots": 24,
    "lignes_generees": 24
  }
}
 
Erreurs possibles:
- 409 CONFLICT si un appel de fonds existe déjà pour cette période+type (idempotence métier)
- 422 si aucun budget AG actif ne couvre la période
```
 
Ce niveau de détail (payload exact, codes d'erreur, règles d'idempotence) doit être répliqué pour **chaque** endpoint dans le fichier OpenAPI réel avant implémentation — cette partie donne le patron à suivre, pas la liste exhaustive des ~120 endpoints attendus (générés au fil de l'implémentation module par module, en suivant strictement ce format).
 
## 3.4 Rate limiting
 
| Catégorie | Limite |
|---|---|
| Auth (OTP request) | 5 / heure / numéro |
| Écriture financière | 30 / minute / utilisateur |
| Lecture générale | 300 / minute / utilisateur |
| Webhook CMI | Pas de limite utilisateur — vérification de signature obligatoire à la place |
 
---
 
# PARTIE 4 — Authentification, RBAC & Matrice de Permissions
 
## 4.1 Rôles du système
 
| Rôle | Description | Portée |
|---|---|---|
| `super_admin` | Équipe plateforme | Toutes copropriétés |
| `syndic` | Gestionnaire mandaté de la copropriété | 1 copropriété (peut en gérer plusieurs comptes distincts) |
| `conseil_syndical` | Élu par l'AG pour contrôler le syndic | Lecture étendue sur sa copropriété |
| `proprietaire` | Copropriétaire (plein, indivision, SCI) | Ses lots |
| `locataire` | Occupant locataire | Son lot, droits limités (Doc A §2.3) |
| `indivisaire` | Copropriétaire en indivision | Sous-cas de `proprietaire`, avec `est_representant_indivision` |
| `gardien` | Personnel de surveillance | Sa copropriété, module visites/incidents |
| `prestataire` | Intervenant externe | Ses tickets uniquement (Doc A §12.3) |
| `personne_morale_representant` | Représentant légal d'une SCI/société propriétaire | Lots de la personne morale |
 
## 4.2 Matrice de permissions (extrait — à compléter module par module selon Doc A)
 
| Module / Action | super_admin | syndic | conseil_syndical | proprietaire | locataire | gardien | prestataire |
|---|---|---|---|---|---|---|---|
| Voir finances copropriété (agrégé) | ✓ | ✓ | ✓ | ✓ (taux global uniquement) | ✗ | ✗ | ✗ |
| Voir impayé d'un autre lot | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Créer appel de fonds | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Voter en AG | ✗ | ✗ (facilite, ne vote pas) | selon tantièmes | ✓ | ✗ (sauf procuration explicite) | ✗ | ✗ |
| Voir détail nominatif des votes | ✓ | ✓ | ✗ (résultat agrégé) | ✗ (résultat agrégé) | ✗ | ✗ | ✗ |
| Créer incident | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ (reçoit assignation) |
| Voir tous les incidents copropriété | ✓ | ✓ | ✓ | ✗ (les siens) | ✗ (les siens) | ✓ | ✗ (les siens assignés) |
| Gérer personnel/gardien | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Autoriser un visiteur | ✗ | ✗ | ✗ | ✓ (son lot) | ✓ (son lot) | ✓ (relai) | ✗ |
| Voir noms complets des copropriétaires | ✓ | ✓ | selon config | ✗ (sauf config activée) | ✗ | ✗ | ✗ |
 
Cette matrice doit être répliquée intégralement (toutes les actions du Doc A) dans un fichier `permissions.ts` unique consommé par le middleware — jamais dupliquée en dur dans chaque route.
 
## 4.3 Flux d'authentification
 
1. **Téléphone (par défaut pour résidents/gardiens)** : `POST /auth/otp/request` → SMS 6 chiffres → `POST /auth/otp/verify` → JWT Supabase.
2. **Email + mot de passe (option MRE/syndic)** : flux standard Supabase Auth.
3. **Invitation** : lien/QR/code reçu par email/SMS/WhatsApp → `POST /auth/invite/accept` avec le code → création de compte liée automatiquement au `lot` et au rôle prévus par l'invitation (voir Partie 5).
## 4.4 Structure du JWT
 
```json
{
  "sub": "utilisateur_id",
  "roles": [{ "copropriete_id": "uuid", "role": "proprietaire" }],
  "phone_verified": true,
  "exp": 1234567890
}
```
 
Le middleware API résout, à partir de ce JWT et de la route appelée, quel `copropriete_id` et quel `role` injecter dans le contexte RLS (§2.3) — jamais fait confiance à un `copropriete_id` envoyé en paramètre par le client pour un rôle non-`super_admin`.
 
---
 
# PARTIE 5 — Onboarding & Cycle de Vie Utilisateur
 
*(Ce document répond explicitement au manque signalé en Doc A §11 : "Lifecycle & Onboarding Master Doc — actuellement en préparation")*
 
## 5.1 Canaux d'invitation
 
| Canal | Cas d'usage principal | Détail |
|---|---|---|
| Email | Propriétaires MRE, syndic, personnes morales | Lien magique + code à 8 caractères, expiration 7 jours |
| SMS | Résidents locaux, gardiens, personnes peu digitalisées | Code OTP + lien court, expiration 48h |
| QR Code | Affichage physique dans le hall d'immeuble | Pointe vers `/invite/:code`, utile pour onboarding en masse à l'ouverture d'une résidence |
| WhatsApp (optionnel, phase 2) | Complément SMS si l'agrégateur WhatsApp Business est disponible | Même contenu que SMS |
 
## 5.2 Machine à états du compte utilisateur
 
```
INVITE ──accept──▶ EN_VALIDATION ──vérif OTP/email──▶ ACTIF
                                                          │
                          ┌───────────────────────────────┼──────────────────┐
                          ▼                                ▼                  ▼
                     SUSPENDU (syndic)               DESACTIVE (départ)   ANONYMISE (CNDP)
                          │                                │
                          └──────réactivation──────────────┘
```
 
| État | Déclencheur | Effet |
|---|---|---|
| `INVITE` | Syndic crée l'invitation liée à un lot/rôle | Pas d'accès, code valide selon canal |
| `EN_VALIDATION` | Code saisi, en attente de vérification OTP/email | Accès partiel (finalisation profil uniquement) |
| `ACTIF` | Vérification réussie | Accès complet selon rôle |
| `SUSPENDU` | Décision syndic (litige, impayé grave selon config) | Connexion bloquée, données conservées |
| `DESACTIVE` | Départ locataire, vente, fin de mandat | Historique conservé sur le lot (pas sur le compte), plus de connexion |
| `ANONYMISE` | Fin de la durée de rétention légale (Doc A §12.3 : durée + 2 ans) | PII supprimées, identifiant technique conservé pour l'intégrité de l'historique financier/PV |
 
## 5.3 Attribution de rôle à l'invitation
 
L'invitation porte toujours : `lot_id` (sauf gardien/prestataire/syndic qui sont rattachés à `copropriete_id` directement), `role` cible, `emetteur_id` (qui a invité), `canal`, `expire_le`. À l'acceptation, le compte est automatiquement lié — pas de sélection de rôle libre par l'invité (évite l'auto-élévation de privilège).
 
## 5.4 Transfert de propriété (vente d'un lot)
 
1. Syndic (ou notification notaire externe, hors scope MVP) initie `POST /lots/:id/transfert-propriete`.
2. Vérification : solde de charges soldé ou explicitement transféré comme dette au nouvel acquéreur selon accord (flag `dette_reprise_acquereur`).
3. Ancien compte propriétaire → `DESACTIVE` (historique conservé, lié au lot pas au compte).
4. Nouveau propriétaire → invitation `INVITE` automatique.
5. Événement `audit_log` : `LOT_TRANSFERT_PROPRIETE`.
## 5.5 Edge cases à couvrir explicitement (repris et complétés depuis Doc A §12.2)
 
| Cas | Comportement |
|---|---|
| Email déjà utilisé à l'inscription | 2e inscription bloquée, message clair, syndic peut forcer la fusion si erreur avérée |
| Code d'invitation déjà utilisé re-soumis | Message "déjà inscrit, connectez-vous" |
| Invitation expirée | Syndic peut régénérer un nouveau code sans recréer le lot |
| Doublon de compte (même personne, 2 lots, invitations séparées) | Un seul `utilisateur_id`, plusieurs entrées `lot_proprietaire`/`lot_occupant` — la résolution de doublon se fait par téléphone/email au moment de la 2e invitation, pas après coup |
| Décès pendant période `EN_VALIDATION` | Rare — traité manuellement par le syndic, pas d'automatisation |
 
## 5.6 Anonymisation CNDP (Loi 09-08)
 
Job planifié (Inngest, cron mensuel) qui scanne les comptes `DESACTIVE` depuis plus de (durée légale + 2 ans, Doc A §12.3) et exécute :
- Suppression `nom`, `prenom`, `email`, `telephone` de `utilisateur`.
- Conservation de `utilisateur_id` et de toutes les lignes financières/PV liées (intégrité comptable/légale sur 10 ans, Doc A §12.3).
- Écriture `audit_log` : `ANONYMISATION_CNDP`.
---
 
# PARTIE 6 — Moteur Financier
 
## 6.1 Calcul des tantièmes
 
Les tantièmes sont saisis au moment de la création du lot (issus du règlement de copropriété, document légal externe — jamais recalculés automatiquement par le système, seulement validés : somme = total du règlement, Doc A §12.1 "conflit sur les tantièmes"). Toute anomalie détectée (somme ≠ total attendu) déclenche une alerte syndic bloquante avant activation de la copropriété.
 
## 6.2 Génération d'un appel de fonds (batch)
 
```
Algorithme POST /finances/appels-de-fonds :
1. Vérifier qu'un budget_ag actif couvre la période et le type demandés → sinon 422
2. Vérifier idempotence : pas d'appel_de_fonds existant même (copropriete_id, periode, type) → sinon 409
3. Pour chaque lot actif de la copropriété (statut != sinistre sauf config contraire, Doc A §12.2) :
     montant_du = (tantiemes_lot / total_tantiemes_copropriete) * montant_total_periode
     arrondi au centime, ajustement du dernier lot pour que la somme exacte = montant_total_periode
     (jamais d'écart de centimes non expliqué — traçabilité comptable)
4. Créer les lignes appel_de_fonds_lot
5. Déclencher (async, Inngest) l'envoi des notifications (Partie 7)
6. audit_log : APPEL_DE_FONDS_EMIS
```
 
## 6.3 Escalade des impayés
 
| Niveau | Délai | Action automatique |
|---|---|---|
| N0 | Échéance dépassée | Rappel automatique (notification) |
| N1 | +15 jours | Relance formelle (email/SMS avec ton officiel) |
| N2 | +30 jours | Alerte syndic + mise en demeure générée (Partie 9) |
| N3 | +60 jours | Escalade conseil syndical, dossier contentieux préparé |
 
*(Les délais exacts doivent être calés sur la politique de recouvrement propre à chaque copropriété — champ configurable `politique_recouvrement_json` sur `copropriete`, ces valeurs sont des défauts, pas une règle légale figée.)*
 
## 6.4 Paiement CMI — flux d'intégration
 
```
1. POST /finances/paiements/cmi/initier { appel_de_fonds_lot_id, montant }
   → API crée une session CMI, retourne URL de paiement hébergée
2. Utilisateur redirigé vers CMI, paie par carte
3. CMI callback → POST /finances/paiements/cmi/webhook (signature HMAC vérifiée obligatoire)
4. Sur callback succès :
   - Créer ligne `paiement` (immuable)
   - Mettre à jour `appel_de_fonds_lot.montant_paye`
   - Si montant_paye == montant_du → générer quittance (Partie 9), statut PAYE
   - audit_log : PAIEMENT_RECU
5. Idempotence stricte sur reference_cmi : un même callback rejoué ne crée jamais 2 lignes paiement
```
 
## 6.5 Fonds de réserve
 
Table `fonds_reserve_mouvement` (append-only) : chaque cotisation, chaque dépense de travaux votée en AG y génère une ligne. Solde = somme des mouvements, jamais un champ modifiable directement — garantit l'auditabilité complète exigée par Doc A §12.1 (cas "syndic disparaît avec la trésorerie").
 
---
 
# PARTIE 7 — Notifications & Communications
 
## 7.1 Matrice événement → canal → rôle destinataire
 
| Événement | Canaux | Destinataires |
|---|---|---|
| Convocation AG | Email (prioritaire MRE) + SMS + push | Tous les copropriétaires du lot concerné |
| Nouvel appel de fonds | Push + email | Propriétaires |
| Rappel impayé | SMS + email | Propriétaire concerné uniquement |
| Incident urgence maximale | Push + SMS (mass-push) | Tous les résidents de la copropriété |
| Visiteur en attente d'autorisation | Push (temps réel, Realtime Supabase) | Résident du lot concerné |
| PV d'AG disponible | Email + push | Copropriétaires (+ locataires si option activée) |
| Changement de statut ticket incident | Push | Créateur du ticket |
 
## 7.2 Preuve d'envoi (valeur légale)
 
Chaque notification génère une ligne `notification` immuable : `canal`, `horodatage`, `statut_envoi`, `accuse_reception` (si applicable, ex. ouverture email trackée, accusé SMS opérateur). C'est la réponse directe au cas Doc A §12.2 *"Résident conteste un vote qui l'a lésé... Preuve de l'envoi"*.
 
## 7.3 Templates & langue
 
Chaque template de notification existe en **FR et AR** (`template_code` + `langue`), le rendu utilise `utilisateur.langue_preferee`. Les templates SMS sont volontairement courts (160 caractères, contrainte opérateur marocain), les templates email/push peuvent être plus riches.
 
## 7.4 WhatsApp Business (statut : optionnel phase 2)
 
Dépend de la disponibilité d'un compte WhatsApp Business API validé pour le Maroc — non bloquant pour le MVP, SMS + email couvrent déjà l'obligation légale de preuve d'envoi.
 
---
 
# PARTIE 8 — Moteur Assemblées Générales
 
## 8.1 Cycle de vie d'une AG
 
```
PLANIFIEE ──convocation envoyée──▶ CONVOQUEE ──jour J──▶ EN_COURS ──clôture──▶ CLOTUREE
     │
     └──annulation (motif obligatoire)──▶ ANNULEE
```
 
## 8.2 Convocation
 
- Délai minimum entre l'envoi de la convocation et la date de l'AG : **à faire valider juridiquement** contre le texte exact de la Loi 18-00/106-12 en vigueur — ce document ne fixe pas de nombre de jours par défaut incorrect ; la valeur doit être injectée comme un paramètre configurable `delai_convocation_jours` sur `copropriete` avec la valeur légale confirmée avant mise en production.
- Chaque convocation envoyée génère une ligne `ag_notification_log` par destinataire (preuve légale, Partie 7.2).
## 8.3 Calcul du quorum
 
`quorum_atteint = somme(tantiemes des lots dont le propriétaire ou son mandataire a émis au moins un vote) / total_tantiemes_copropriete`
 
Le quorum requis (`quorum_requis`) dépend du type d'AG et du texte de loi applicable à la résolution — également un paramètre à confirmer juridiquement et stocké par type de résolution, pas codé en dur.
 
## 8.4 Calcul de majorité
 
| Type de majorité | Règle de calcul |
|---|---|
| Simple | `pour > contre` parmi les tantièmes exprimés (abstention exclue du dénominateur) |
| Double majorité | Majorité des copropriétaires présents/représentés **ET** majorité des tantièmes — les deux conditions doivent être vraies (Doc A §8, révocation syndic) |
| Unanimité | 100% des tantièmes de la copropriété, pas seulement des présents |
| Égalité parfaite (50/50) | Résolution **REJETÉE** par défaut (Doc A §12.2) — la majorité n'est pas atteinte en cas d'ex aequo |
 
## 8.5 Procuration (vote par mandataire)
 
Un `ag_procuration` lie `mandant_id` → `mandataire_id` pour une AG donnée. Le mandataire vote au nom du mandant, le vote est enregistré avec `utilisateur_id = mandataire_id` mais `lot_id` reste celui du mandant — traçabilité complète pour audit syndic. Limite de nombre de procurations par mandataire : **à faire valider juridiquement** (paramètre configurable, valeur par défaut prudente à définir avec conseil juridique avant lancement).
 
## 8.6 Génération automatique du PV
 
Job déclenché à la clôture de l'AG (`statut → CLOTUREE`) :
 
```
1. Compiler : résolutions, résultats, quorum, liste des votants (nominatif), liste des procurations
2. Générer PDF (voir Partie 9) avec horodatage serveur + hash SHA-256 du contenu → ag_pv.hash_integrite
3. Stocker dans Supabase Storage, bucket privé par copropriété
4. Notifier tous les copropriétaires sous 48h (délai cible, Doc A §12.2 "PV signé dans 48h")
5. audit_log : AG_PV_GENERE
```
 
Le hash d'intégrité permet de prouver après coup qu'un PV n'a pas été altéré — réponse directe au cas Doc A §12.2 *"AG sans procès-verbal (ou PV falsifié)"*.
 
## 8.7 Continuité pendant une panne réseau en cours d'AG
 
Les votes déjà soumis avant coupure sont déjà persistés (écriture synchrone par vote, pas de batch en fin de séance) — un vote n'est jamais perdu une fois son accusé de réception 200 reçu côté client. Reprise de session standard (JWT toujours valide). Le mode "vote papier de secours" en cas de panne totale reste une procédure organisationnelle hors plateforme (Doc A §12.2), pas une fonctionnalité à coder.
 
---
 
# PARTIE 9 — Génération de Documents & Stockage
 
## 9.1 Moteur de templating PDF
 
**React-PDF** (`@react-pdf/renderer`), exécuté côté serveur dans les fonctions Vercel/Inngest — cohérent avec la stack TypeScript, évite de dépendre d'un headless browser (Puppeteer) plus lourd et plus fragile en environnement serverless.
 
## 9.2 Types de documents générés automatiquement
 
| Document | Déclencheur | Rétention (Doc A §12.3) |
|---|---|---|
| Quittance | Paiement complet d'un appel de fonds | 10 ans (obligations fiscales) |
| PV d'AG | Clôture d'une AG | Durée de vie de la copropriété |
| Mise en demeure impayé | Escalade N2 (Partie 6.3) | 10 ans |
| Rapport d'incident | Clôture d'un incident majeur/sinistre | 10 ans |
| Convocation AG | Création d'une AG | Durée de vie de la copropriété |
 
## 9.3 Structure de stockage (Supabase Storage)
 
```
/{copropriete_id}/pv/{ag_id}.pdf
/{copropriete_id}/quittances/{lot_id}/{annee}/{numero}.pdf
/{copropriete_id}/documents/{type}/{document_id}.{ext}
/{copropriete_id}/incidents/{incident_id}/photos/{n}.jpg
```
 
Buckets privés, accès uniquement via URL signée à durée de vie courte (15 minutes), générée par l'API après vérification RLS/permission — jamais d'URL Supabase Storage publique pour un document copropriété.
 
## 9.4 Visibilité par document
 
Reprend directement la matrice Doc A §12.3 : `document.visibilite` ∈ {`public_copropriete` (PV, règlement intérieur), `syndic_only` (contrats prestataires, finances détaillées), `conseil_syndical` (rapports d'audit)} — appliquée en RLS sur la table `document`, pas uniquement en filtre applicatif.
 
---
 
# PARTIE 10 — Sécurité & Conformité
 
## 10.1 Conformité Loi 09-08 (CNDP / protection des données personnelles)
 
| Exigence légale | Implémentation |
|---|---|
| Durée de conservation des données personnelles = nécessaire + 2 ans | Job d'anonymisation automatique (Partie 5.6) |
| Droit d'accès et de rectification | Endpoint `GET/PATCH /users/me`, export de données sur demande (`GET /users/me/export`) |
| Finalité déclarée du traitement | Mention dans les CGU/politique de confidentialité (document produit, hors périmètre technique) |
| Sécurisation des données sensibles (finances, identité) | Chiffrement at-rest (Postgres/Supabase géré), TLS obligatoire en transit, RLS |
 
## 10.2 OWASP Top 10 — mapping des mitigations
 
| Risque | Mitigation |
|---|---|
| Broken Access Control | RLS Postgres + middleware RBAC en double couche (Partie 1.6) |
| Injection | Prisma (requêtes paramétrées), Zod sur tout payload entrant |
| Auth faible | Supabase Auth (OTP + JWT courte durée + refresh token rotatif) |
| Exposition de données sensibles | Buckets privés, URLs signées courtes, pas de PII dans les logs |
| Mauvaise configuration sécurité | Variables d'environnement jamais commitées, revue de config à chaque déploiement (Partie 15) |
| Composants vulnérables | `npm audit`/Dependabot en CI, mise à jour régulière |
| Journalisation insuffisante | `audit_log` exhaustif sur toute action sensible (Partie 1.7.2) |
| SSRF / CSRF | Next.js Route Handlers avec vérification d'origine, pas de proxy sortant non contrôlé |
 
## 10.3 Gestion des secrets
 
Vercel Environment Variables (séparées par environnement, Partie 1.5) + Supabase Vault pour les clés tierces sensibles (CMI, SMS, FCM service account). Aucun secret dans le repo, y compris dans l'historique git — vérification pré-commit (`git-secrets` ou équivalent) recommandée dans les guidelines agent (Partie 19).
 
## 10.4 Plan de réponse à incident de sécurité (squelette)
 
1. Détection (Sentry alert / signalement) → 2. Confinement (rotation de clés, révocation de sessions si compromission auth) → 3. Évaluation de la fuite de données (quelles tables, quels tenants) → 4. Notification CNDP + utilisateurs concernés si obligation légale → 5. Post-mortem écrit, action corrective en CI (test de non-régression).
## 10.5 Cadence de revue de sécurité
 
Audit de dépendances automatique hebdomadaire (CI). Revue manuelle des policies RLS à chaque ajout de table. Test de pénétration externe recommandé avant la mise en production publique (hors périmètre de ce document — prestation externe à budgétiser).
 
---
 
# PARTIE 11 — Exigences Non-Fonctionnelles & Performance
 
## 11.1 Budgets de latence (cible, mesurée en p95)
 
| Type de requête | Cible p95 |
|---|---|
| Lecture simple (liste, détail) | < 300 ms |
| Écriture simple (création incident, vote) | < 500 ms |
| Génération PDF (PV, quittance) | < 5 s (asynchrone, notification à la fin, pas d'attente bloquante côté client) |
| Génération batch appel de fonds (jusqu'à 200 lots) | < 10 s, via Inngest si au-delà de la limite de durée d'une fonction Vercel standard |
 
## 11.2 Disponibilité
 
Cible 99.5% mensuel (réaliste pour une stack Vercel/Supabase managée sans sur-ingénierie multi-région, cohérent avec un marché unique Maroc). Monitoring uptime externe (ex. Better Stack) sur l'API et le web.
 
## 11.3 Charge attendue (dimensionnement initial)
 
Hypothèse de dimensionnement MVP : jusqu'à quelques centaines de copropriétés, quelques dizaines de milliers d'utilisateurs actifs, pics de charge prévisibles (période d'appel de fonds mensuel, période d'AG). Supabase (plan Pro) et Vercel (plan Pro) couvrent largement cette charge ; migration vers dimensionnement supérieur = décision commerciale, pas un changement d'architecture.
 
## 11.4 Exigence offline — module gardien
 
Le gardien doit pouvoir enregistrer une visite ou consulter le planning **même en cas de coupure réseau ponctuelle** (Doc A §9, contexte loge parfois mal couverte). Implémentation : cache local Flutter (Drift/SQLite) avec file d'attente de synchronisation, écriture optimiste + résolution de conflit "dernière écriture gagne" sur les entités non-critiques (visite), jamais sur les entités financières (qui ne sont de toute façon pas accessibles au rôle gardien).
 
## 11.5 Stratégie de cache
 
- Cache HTTP côté API pour les données peu volatiles (référentiels, config copropriété) via en-têtes `Cache-Control` + revalidation.
- Cache client (React Query côté web, équivalent côté Flutter) avec invalidation ciblée sur mutation (pas de refetch global systématique).
- Pas de cache sur les données financières individuelles ni les résultats de vote en cours (fraîcheur obligatoire).
## 11.6 Test de charge
 
Avant mise en production : test de charge ciblé sur les deux pics identifiés — envoi massif de notifications (convocation AG à toute une copropriété) et génération batch d'appels de fonds — avec un outil type k6, seuils alignés sur §11.1.
 
---
 
# PARTIE 12 — Architecture Frontend Web (Next.js)
 
## 12.1 Structure
 
```
apps/web/
├── app/
│   ├── [locale]/                 # fr | ar — layout RTL conditionnel
│   │   ├── (auth)/                # login, otp, invite
│   │   ├── (dashboard)/
│   │   │   ├── finances/
│   │   │   ├── ag/
│   │   │   ├── incidents/
│   │   │   ├── documents/
│   │   │   └── admin/             # vues syndic uniquement, protégées par rôle au niveau layout
│   ├── layout.tsx
├── components/
│   ├── ui/                        # shadcn/ui, wrappers RTL-aware
│   └── domain/                    # composants métier (VoteCard, ChargeTable, IncidentBadge...)
├── lib/
│   ├── api-client/                 # client généré depuis OpenAPI (packages/api-contract)
│   ├── auth/                       # session Supabase côté Next.js
│   └── i18n/
```
 
## 12.2 Gestion d'état
 
- **Server state** (données API) : React Query — cache, invalidation, retry automatique.
- **UI state local** : React state natif / Zustand pour état partagé cross-composant (ex. filtre de liste persistant).
- Pas de Redux — inutile vu la nature majoritairement CRUD + server-state du produit.
## 12.3 Internationalisation & RTL
 
`next-intl` pour le routage `[locale]`. Le `<html dir="rtl">` est posé au niveau du layout racine selon la locale active — chaque composant du design system (Partie 14) est testé en RTL dès sa création, pas audité après coup.
 
## 12.4 Routage par rôle
 
Le layout `(dashboard)` résout le rôle actif depuis la session et redirige/masque les sections non autorisées **côté serveur** (Server Component), pas seulement en masquage CSS côté client — un masquage purement visuel ne suffit jamais comme contrôle d'accès.
 
## 12.5 Accessibilité
 
Cible WCAG 2.1 AA (contraste, navigation clavier, labels ARIA) — non négociable vu le public incluant des utilisateurs âgés peu digitalisés (Doc A §2.1).
 
---
 
# PARTIE 13 — Architecture Mobile (Flutter)
 
## 13.1 Structure
 
```
apps/mobile/lib/
├── core/
│   ├── api/                # client Dart généré depuis OpenAPI
│   ├── auth/                # session Supabase
│   ├── theme/                # design tokens (Partie 14), RTL
│   └── i18n/                  # fr.arb, ar.arb
├── features/
│   ├── finances/
│   ├── ag/
│   ├── incidents/
│   ├── visites/               # module gardien, avec offline (voir 13.3)
│   └── documents/
├── offline/
│   ├── local_db/              # Drift (SQLite)
│   └── sync_queue/            # file d'attente de synchronisation
└── main.dart
```
 
## 13.2 Gestion d'état
 
**Riverpod** — choisi pour sa testabilité, son typage strict compatible avec un agent de codage produisant du code prévisible, et son bon support de l'injection de dépendances (client API mocké en test).
 
## 13.3 Stratégie offline (module gardien prioritaire)
 
1. Toute écriture du module `visites` passe par la `sync_queue` locale avant tentative réseau.
2. Si réseau disponible : envoi immédiat, retrait de la queue au succès.
3. Si réseau indisponible : persistance locale (Drift), retry automatique en arrière-plan (`WorkManager`/`BackgroundFetch`).
4. Les autres modules (finances, AG) n'ont **pas** de mode offline — cohérent avec le fait qu'ils ne tolèrent aucune incertitude d'état (voir Partie 1.7.3, idempotence).
## 13.4 Notifications push
 
Firebase Cloud Messaging, un topic par copropriété + un canal direct par utilisateur pour les notifications ciblées (ex. réponse à un ticket).
 
## 13.5 Paiement CMI côté mobile
 
WebView sécurisée pointant vers l'URL de session CMI générée côté API (Partie 6.4) — pas de SDK natif CMI dédié nécessaire, la même intégration serveur sert web et mobile.
 
## 13.6 Checklist soumission stores (à exécuter avant chaque release publique)
 
- Comptes développeur Apple/Google actifs (voir décision ouverte Partie 1.8)
- Politique de confidentialité publiée et liée dans les deux stores
- Écrans de démonstration en français ET arabe pour la revue Apple
- Permissions déclarées justifiées (notifications, caméra pour photos d'incident, réseau en arrière-plan pour sync gardien)
---
 
# PARTIE 14 — Design System & UI Guidelines
 
## 14.1 Principes directeurs
 
- Le produit doit se sentir **sérieux et institutionnel** (il gère de l'argent et du juridique), pas ludique — palette sobre, hiérarchie typographique claire, densité d'information maîtrisée.
- **RTL natif** : tout composant est conçu avec des propriétés logiques (`start`/`end`, pas `left`/`right`) dès sa création, sur web (CSS logical properties) comme sur Flutter (`Directionality`).
- Lisibilité pour un public élargi (y compris peu digitalisé) : tailles de police jamais en dessous de 14px effectif sur mobile, contrastes AA minimum, zones tactiles ≥ 44px.
## 14.2 Tokens (à instancier identiquement web/Flutter)
 
| Token | Valeur indicative | Usage |
|---|---|---|
| `color.primary` | Bleu institutionnel foncé | Actions principales, en-têtes |
| `color.danger` | Rouge | Impayés, urgences, alertes |
| `color.success` | Vert | Paiement confirmé, ticket résolu |
| `color.neutral-*` | Échelle de gris | Texte, bordures, fonds |
| `font.family` | Police système + fallback arabe (ex. Noto Sans Arabic) | Support glyphes arabes complet |
| `radius.base` | 8px | Cohérence des composants |
| `spacing.*` | Échelle 4/8/12/16/24/32 | Grille de mise en page |
 
## 14.3 Composants prioritaires (réutilisés dans tous les modules)
 
`DataTable` (listes lots/charges/incidents), `StatusBadge` (statuts multiples déjà catalogués en Partie 2), `VoteCard`, `ChargeSummaryCard`, `NotificationBanner` (urgence maximale = variante visuelle distincte), `EmptyState`, `ConfirmDialog` (obligatoire sur toute action irréversible — transfert de propriété, clôture AG, suppression prestataire).
 
## 14.4 Accessibilité
 
WCAG 2.1 AA (repris de Partie 12.5) appliqué identiquement côté Flutter (Semantics widgets, tailles de touche, contrastes) — pas seulement côté web.
 
---
 
# PARTIE 15 — DevOps, CI/CD & Déploiement
 
## 15.1 Pipeline CI (GitHub Actions)
 
```
Sur chaque PR :
1. Lint + typecheck (ESLint, tsc --noEmit)
2. Tests unitaires + intégration (Partie 16)
3. Build Turborepo (api + web)
4. Validation du contrat OpenAPI (breaking change detection)
5. Déploiement preview automatique (Vercel)
 
Sur merge `staging` :
6. Migration Prisma auto-appliquée en staging
7. Déploiement staging
8. Suite de tests E2E (Playwright) contre staging
 
Sur merge `main` (après validation manuelle) :
9. Migration Prisma — validation manuelle obligatoire du diff de migration avant apply
10. Déploiement production
11. Smoke tests post-déploiement automatiques
```
 
## 15.2 Déploiement Flutter (stores)
 
Pipeline séparé (Codemagic ou GitHub Actions + Fastlane) : build + signature + upload TestFlight (iOS) / Play Console track interne (Android) sur merge `staging`, promotion manuelle vers production après validation.
 
## 15.3 Jobs asynchrones (Inngest)
 
Déployés avec l'application `api` (fonctions Inngest colocalisées dans `apps/api/inngest/`), enregistrées via webhook Inngest ↔ Vercel. Jobs planifiés principaux : génération mensuelle des appels de fonds (si mode automatique activé), scan d'escalade impayés (quotidien), anonymisation CNDP (mensuel), rappels d'échéance AG.
 
## 15.4 Monitoring & alerting
 
| Signal | Outil | Seuil d'alerte |
|---|---|---|
| Erreurs applicatives | Sentry | Toute erreur 500 en production notifiée immédiatement |
| Latence API | Vercel Analytics + logs Axiom | p95 > budget Partie 11.1 sur 15 min |
| Échec webhook CMI | Alerte dédiée (paiement = critique) | Tout échec de signature ou timeout |
| Échec job Inngest | Dashboard Inngest + Sentry | Tout retry épuisé |
| Disponibilité | Better Stack (ping externe) | Toute indisponibilité > 2 min |
 
## 15.5 Stratégie de rollback
 
Vercel conserve les déploiements précédents — rollback instantané au clic en cas de régression sur `api`/`web`. Les migrations de base de données ne sont **jamais** rollback automatiquement (risque de perte de données financières) — toute migration en production doit être écrite de façon rétro-compatible (colonne additive avant suppression, jamais de `DROP COLUMN` dans le même déploiement qui retire l'usage applicatif).
 
---
 
# PARTIE 16 — Stratégie de Tests & QA
 
## 16.1 Pyramide de tests
 
| Niveau | Outil | Cible de couverture |
|---|---|---|
| Unitaire | Vitest (backend), `flutter test` (mobile) | ≥ 80% sur `lib/money`, `lib/auth`, moteur AG, moteur financier (modules à haut risque légal/financier) |
| Intégration | Vitest + base de test Postgres éphémère | Tous les endpoints critiques (finances, AG, auth) |
| E2E | Playwright (web), `integration_test` (Flutter) | Parcours critiques uniquement (voir 16.2), pas exhaustif |
 
## 16.2 Scénarios critiques à tester en priorité (dérivés directement du Doc A)
 
- Génération d'un appel de fonds + vérification que la somme des lignes = montant total à l'euro/centime près (Doc A §3.1, risque de conflit tantièmes).
- Vote AG avec égalité parfaite → résolution rejetée (Doc A §12.2).
- Indivision : blocage de vote si un indivisaire n'a pas payé (Doc A §2.4).
- Confidentialité : un compte `proprietaire` ne peut jamais lire l'impayé d'un autre lot via l'API, même en modifiant l'ID dans la requête (test de sécurité, pas seulement fonctionnel).
- Idempotence du webhook CMI rejoué deux fois avec la même `reference_cmi`.
- Transfert de propriété : historique conservé sur le lot, pas perdu avec l'ancien compte.
- Anonymisation CNDP : les données financières restent lisibles après anonymisation du compte.
## 16.3 UAT (recette utilisateur)
 
Avant ouverture publique : cohorte pilote de 2-3 copropriétés réelles en staging pendant au moins un cycle mensuel complet (émission d'appel de fonds → paiement → relance si besoin), pour valider le produit sur des tantièmes et des cas d'indivision réels avant généralisation.
 
---
 
# PARTIE 17 — Scope MVP & Roadmap de Release
 
## 17.1 Principe de découpage
 
Le Doc A couvre 200+ cas d'usage sur 12 domaines — les construire tous avant le premier lancement retarderait la mise sur le marché sans nécessité. Le découpage ci-dessous priorise ce qui rend le produit **utilisable et non-négociable dès le jour 1** pour une copropriété standard, en repoussant les cas rares/complexes qui touchent une minorité de situations.
 
## 17.2 Phase 1 — MVP (lancement)
 
| Domaine (réf. Doc A) | Inclus au MVP |
|---|---|
| §1 Lots | Appartements, parkings, caves — types courants |
| §2 Résidents | Propriétaire occupant, bailleur, locataire, indivision simple |
| §3 Finances | Tantièmes, appels de fonds, paiement CMI, quittances, escalade impayés N0-N2 |
| §5 Incidents | Signalement, suivi, assignation prestataire, urgences |
| §6 AG | Convocation, vote, quorum/majorité simple et double, PV auto |
| §7 Parties communes | Réservation espaces communs |
| §9 Personnel | Gardien, module visites |
| §11 Onboarding | Tous les canaux d'invitation, cycle de vie standard |
| §12.3 Confidentialité | RLS complète dès le MVP — **non négociable, pas un module différable** |
 
## 17.3 Phase 2 (post-lancement, 2-3 mois)
 
- Personne morale (SCI), successions, transferts complexes (Doc A §2.5, §2.7)
- Types de résidences avancés (résidence étudiante, immeuble mixte avec commerces) — Doc A §10
- Contestations de charges, module litiges formalisé — Doc A §12.1
- Escalade impayés N3, dossier contentieux
- WhatsApp Business
## 17.4 Phase 3 (extension)
 
- Copropriétés fusionnées / multi-immeubles sous un même syndic (Doc A §12.2)
- Garanties promoteur (décennale/biennale)
- Reporting consolidé avancé pour syndics gérant plusieurs copropriétés
- Automatisations supplémentaires (relances intelligentes, prévisions de trésorerie)
## 17.5 Ce qui n'est **jamais** différable, quel que soit le lot livré
 
RLS/confidentialité (§12.3), immuabilité des votes/PV/paiements (§1.7.2), CNDP (§10.1), précision décimale monétaire (§1.7.1) — ce sont des propriétés structurelles du système, pas des fonctionnalités qu'on ajoute après coup sans tout reconstruire.
 
---
 
# PARTIE 18 — Glossaire & Modèle de Domaine
 
| Terme juridique/métier marocain (Doc A) | Entité système | Notes |
|---|---|---|
| Copropriété | `copropriete` | Le tenant |
| Syndic | rôle `syndic` | Gestionnaire mandaté, 1 actif par copropriété |
| Conseil syndical | rôle `conseil_syndical` | Élu par l'AG, contrôle le syndic |
| Copropriétaire | rôle `proprietaire` | Titulaire d'un lot |
| Tantièmes | `lot.tantiemes` | Quote-part de charges/vote |
| Appel de fonds | `appel_de_fonds` / `appel_de_fonds_lot` | Facturation périodique des charges |
| Quittance | `quittance` | Preuve de paiement, valeur fiscale 10 ans |
| Indivision | `lot_proprietaire` (plusieurs lignes, `type_propriete='indivision'`) | Plusieurs propriétaires d'un même lot |
| Assemblée Générale (AG) | `assemblee_generale` | Instance de décision légale |
| Procès-verbal (PV) | `ag_pv` | Preuve légale des décisions, immuable |
| Procuration | `ag_procuration` | Vote par mandataire |
| Règlement intérieur/de copropriété | `document` (type `reglement_interieur`) | Document légal de référence, tantièmes issus de ce document |
| Gardien / concierge | rôle `gardien`, table `personnel` | Personnel de surveillance |
| Loi 18-00 / 106-12 | — | Cadre légal copropriété marocain, référence dans Doc A et dans les paramètres légaux configurables (délais AG, quorum) |
| Loi 09-08 / CNDP | — | Cadre légal protection des données personnelles, pilote Partie 5.6 et 10.1 |
| MRE | — | Marocain Résidant à l'Étranger — persona clé pour la priorité email/multicanal |
 
---
 
# PARTIE 19 — Guidelines d'Ingénierie pour l'Agent de Codage
 
## 19.1 Conventions de nommage
 
- **Base de données & domaine métier** : français, aligné sur le Doc A et le glossaire (Partie 18) — ex. `appel_de_fonds`, pas `fund_call`.
- **Code applicatif (fonctions, variables, types)** : anglais, convention standard de l'écosystème (camelCase TS, snake_case Dart/Postgres) — la traduction métier↔code se fait au niveau du mapping Prisma/DTO, jamais en mélangeant les deux langues dans un même identifiant.
- **Fichiers/dossiers** : kebab-case.
- **Enums Postgres** : toujours en `SCREAMING_SNAKE_CASE` ou équivalent explicite, jamais de valeur libre.
## 19.2 Git & revue de code
 
- Convention de commits : Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).
- Branche par fonctionnalité : `feature/<module>-<courte-description>`.
- Toute PR touchant `apps/api` doit inclure : mise à jour du contrat OpenAPI si endpoint nouveau/modifié, tests associés (Partie 16), pas de merge sans CI verte.
- Toute PR touchant une table à valeur probante (§1.7.2) nécessite une relecture explicite de la policy RLS associée.
## 19.3 Gestion des erreurs
 
- Jamais de `catch` silencieux — toute exception non gérée explicitement remonte à Sentry avec contexte (`request_id`, `utilisateur_id`, `copropriete_id`).
- Les erreurs métier attendues (ex. solde insuffisant, quorum non atteint) sont des réponses HTTP normales avec un code d'erreur explicite (Partie 3.1) — pas des exceptions traitées comme des bugs.
## 19.4 Logging
 
- Logs structurés JSON (jamais de `console.log` de production sans structure), champs obligatoires : `timestamp`, `request_id`, `copropriete_id`, `utilisateur_id` (si authentifié), `niveau`.
- Aucune donnée personnelle sensible en clair dans les logs applicatifs (numéro de téléphone masqué partiellement, jamais de mot de passe/token).
## 19.5 Définition of Done (à cocher pour toute fonctionnalité livrée)
 
- [ ] Endpoint(s) documenté(s) dans le contrat OpenAPI avant merge
- [ ] Policy RLS écrite et testée si nouvelle table/nouveau cas de confidentialité
- [ ] Tests unitaires + intégration couvrant le cas nominal et au moins un edge case du Doc A
- [ ] Validation Zod sur tout payload entrant
- [ ] Traduction FR/AR des textes utilisateur ajoutés
- [ ] Testé en RTL si UI concernée
- [ ] `audit_log` écrit si l'action a une valeur probante ou financière
- [ ] Pas de valeur monétaire manipulée en dehors de `lib/money`
## 19.6 Ce que l'agent de codage ne doit jamais faire sans validation humaine explicite
 
- Modifier une policy RLS existante en l'assouplissant.
- Supprimer ou altérer une ligne dans une table append-only.
- Changer un délai légal (convocation AG, rétention CNDP) sans confirmation juridique tracée.
- Désactiver ou contourner la validation Zod "pour aller plus vite en dev" dans du code qui atteint `main`.
---
 
**Fin du document. Ce dossier, combiné au Doc A (use cases), constitue l'ensemble de la documentation nécessaire pour démarrer la construction complète de la plateforme — web, mobile, backend — sans document supplémentaire requis.**