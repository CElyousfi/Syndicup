# Déploiement — Render (API + web), Supabase, Inngest

> Master Spec Partie 15 (CI/CD) et 1.5 (environnements). Deux services Node par environnement
> (`render.yaml`) : **staging** suit la branche `staging`, **production** suit `main`. Région
> Frankfurt, plan starter, Node 20 (`.node-version`). Le mobile (Flutter) se distribue par les
> stores et pointe l'API par `--dart-define=API_BASE_URL`.

## 1. Services Render

| Service | Branche | Health check | Build | Start |
| --- | --- | --- | --- | --- |
| `syndicup-api-staging` | `staging` | `GET /api/health` | `npm ci && npm run db:generate && npm run build --workspace=@copropriete-maroc/api` | `npm run start --workspace=@copropriete-maroc/api` |
| `syndicup-web-staging` | `staging` | `GET /health` | idem `…--workspace=@copropriete-maroc/web` | idem |
| `syndicup-api` | `main` | `GET /api/health` | idem api | idem |
| `syndicup-web` | `main` | `GET /health` | idem web | idem |

- Les scripts `start` honorent `$PORT` (fourni par Render). `RENDER_GIT_COMMIT` est exposé par
  le health check : `{ status, version, commit, db }` (API) / `{ status, version, commit, api }`
  (web). 503 tant que la base (API) ou l'API (web) ne répond pas — Render ne bascule le trafic
  qu'après un 200, l'ancienne version reste en ligne sinon.
- Au démarrage, chaque application **valide sa configuration** (`apps/api/lib/config/env.ts`,
  `apps/web/lib/config/env.ts`) et refuse de démarrer si une variable obligatoire manque ou est
  mal formée — le message nomme chaque variable.
- `next start` force `NODE_ENV=production` : sans `APP_ENV`, l'application se considère en
  production (secrets exigés). Pour lancer une build en local, poser `APP_ENV=development`
  (ex. `APP_ENV=development PORT=3998 npm run start --workspace=@copropriete-maroc/api`).
- Importer le Blueprint : Render → *New → Blueprint* → dépôt GitHub → `render.yaml`. Les secrets
  (`sync: false`) sont ensuite saisis service par service (ou via un *Environment Group* partagé
  par les deux services d'un même environnement).

## 2. Variables d'environnement

Obligatoire = requis quand `APP_ENV=production` (le démarrage échoue sinon). En staging, tout ce
qui est marqué ★ doit aussi être renseigné pour que le service soit utile.

### API (`syndicup-api*`)

| Variable | Obligatoire en prod | Où l'obtenir |
| --- | --- | --- |
| `APP_ENV` | oui (`staging` / `production`) | render.yaml (valeur fixe par service) |
| `NODE_ENV` | `production` | render.yaml |
| `DATABASE_URL` ★ | oui | Supabase → *Project Settings → Database* → chaîne **pooler (Transaction)** avec le rôle `app_prod` (§3), jamais `postgres` |
| `DIRECT_URL` ★ | oui | même écran, connexion directe (port 5432) avec `postgres` — migrations uniquement |
| `JWT_SECRET` ★ | oui (≥ 32 car.) | Supabase → *Project Settings → API → JWT Secret* (ou clé de vérification si projet en clés asymétriques) |
| `NEXT_PUBLIC_SUPABASE_URL` ★ | oui | Supabase → *API → Project URL* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` ★ | oui | Supabase → *API → anon public* |
| `SUPABASE_SERVICE_ROLE_KEY` ★ | oui | Supabase → *API → service_role* (Storage signé, admin auth) |
| `INNGEST_EVENT_KEY` ★ | oui | app.inngest.com → *Manage → Event Keys* (une clé par environnement) |
| `INNGEST_SIGNING_KEY` ★ | oui | app.inngest.com → *Manage → Signing Key* |
| `NEXT_PUBLIC_APP_URL` ★ | oui | URL publique du web (liens d'invitation, e-mails) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` ★ | oui | console.upstash.com → base Regional Frankfurt → *REST API*. Absents : mémoire par instance hors production, **refus de démarrer en production** |
| `SENTRY_DSN` | non | sentry.io → projet *syndicup-api* → *Client Keys (DSN)* ; `APP_ENV` sert d'`environment` |
| `RESEND_API_KEY` + `RESEND_FROM` | non | resend.com → *API Keys* ; domaine vérifié (SPF/DKIM/DMARC). `RESEND_FROM_EMAIL` encore lu une version (déprécié) |
| `SMTP_URL` + `EMAIL_FROM` | non | alternative SMTP (Resend SMTP, SES…) |
| `SMS_PROVIDER` + `SMS_API_KEY` / `SMS_API_SECRET` / `SMS_SENDER_ID` / `SMS_API_URL` | non | agrégateur SMS contractualisé (`twilio` ou `generic`) |
| `FCM_SERVICE_ACCOUNT_JSON` | non | console.firebase.google.com → *Paramètres → Comptes de service → Générer une clé* (JSON entier) |
| `CMI_MERCHANT_ID` / `CMI_STORE_KEY` / `CMI_API_URL` / `CMI_WEBHOOK_HMAC_SECRET` | non (non utilisé au lancement) | contrat commerçant CMI. Sans `CMI_WEBHOOK_HMAC_SECRET`, les routes CMI répondent **501** |
| `RATE_LIMIT_*_MAX`, `AG_RAPPEL_JOURS_AVANT` | non | plafonds techniques (défauts dans le code) |
| `INNGEST_DEV` | **interdit** en production | local uniquement |

### Web (`syndicup-web*`)

| Variable | Obligatoire en prod | Où l'obtenir |
| --- | --- | --- |
| `APP_ENV`, `NODE_ENV` | oui | render.yaml |
| `API_BASE_URL` | oui (aucun repli localhost hors développement) | URL publique de l'API **avec** le préfixe `/v1` (ex. `https://syndicup-api.onrender.com/v1`) |
| `NEXT_PUBLIC_APP_URL` | non | URL publique du web |

## 3. Base de données de production — rôle applicatif (RLS)

L'API ne doit **jamais** se connecter avec `postgres` (superuser, `BYPASSRLS`) : la seconde
couche d'isolation (RLS, Master Spec Partie 1.6) serait inopérante. Les migrations créent le
rôle `application_role` (NOLOGIN) porteur des GRANTs ; on crée un rôle de connexion qui en hérite.

Sur la base de production (SQL Editor Supabase, connecté en `postgres`) :

```sql
-- 1. Rôle de connexion de l'API, membre de application_role, sans BYPASSRLS ni superuser.
CREATE ROLE app_prod LOGIN PASSWORD '<mot de passe long généré>' IN ROLE application_role;
ALTER ROLE app_prod NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
GRANT USAGE ON SCHEMA public TO app_prod;
```

Puis `DATABASE_URL = postgresql://app_prod:<mdp>@<pooler-host>:6543/postgres?pgbouncer=true`
(pooler Transaction) et `DIRECT_URL` avec `postgres` (migrations seulement).

**Vérification RLS obligatoire avant d'ouvrir le trafic** — sans contexte tenant, une table
métier doit renvoyer **zéro ligne** au rôle applicatif :

```sql
SET ROLE app_prod;
SELECT count(*) FROM lot;            -- doit renvoyer 0 (aucun app.current_copropriete_id posé)
SELECT count(*) FROM appel_de_fonds; -- 0
SELECT rolbypassrls FROM pg_roles WHERE rolname = 'app_prod'; -- false
RESET ROLE;
```

Si un `count` est > 0, le rôle contourne la RLS : ne pas déployer (rôle mal créé ou policy
manquante). Même procédure pour staging avec `app_staging`.

## 4. Inngest

- Synchroniser l'application : app.inngest.com → *Apps → Sync new app* → URL
  `https://<api-host>/api/inngest` (ex. `https://syndicup-api.onrender.com/api/inngest`), une
  app par environnement (clés `INNGEST_*` distinctes). Re-synchroniser après chaque déploiement
  qui ajoute une fonction (Inngest le fait automatiquement sur `PUT /api/inngest` déclenché par
  le déploiement Render quand l'app est déjà enregistrée).
- Ne jamais poser `INNGEST_DEV` sur Render (refusé par la validation d'environnement).

## 5. Migrer puis déployer

L'ordre est toujours **migrations → déploiement** (les migrations sont additives — Master Spec
Partie 2.4 — l'ancienne version du code reste compatible pendant la bascule) :

1. Depuis un poste de confiance (ou un job CI dédié) avec `DIRECT_URL` de l'environnement cible :
   ```bash
   npm ci && npm run db:generate
   npm run migrate:deploy --workspace=@copropriete-maroc/database
   ```
   Jamais `prisma migrate reset` ni `migrate dev` contre staging / production.
2. Pousser sur `staging` (puis `main`) : Render construit, démarre, attend un `200` sur le health
   check, puis bascule le trafic. Un échec de validation d'environnement ou un `503` laisse
   l'ancienne version en ligne.
3. Vérifier : `GET /api/health` (commit attendu, `db: ok`), `GET /health` du web (`api: ok`),
   `GET /v1/personnel` → 401 (API vivante), Inngest → dernière sync verte.
4. Seed : uniquement sur staging (`npm run db:seed` avec `DIRECT_URL` staging) — jamais en
   production (données de démonstration).

## 6. Health checks

| Endpoint | Sans auth | Rate limiting | Contrat OpenAPI |
| --- | --- | --- | --- |
| API `GET /api/health` | oui | non | hors contrat (infrastructure, comme `/api/inngest`) |
| Web `GET /health` | oui | — | — |

Réponses : `200 { "status": "ok", "version": "0.1.0", "commit": "<sha>", "db": "ok" }` ;
`503 { "status": "degraded", …, "db": "error" }` si `SELECT 1` échoue.
