# apps/web/lib

- `api/types.ts` — types des réponses **réelles** de l'API (camelCase Prisma + îlots snake_case),
  relevés depuis le code des routes, PAS depuis l'openapi.yaml (qui décrit du snake_case).
- `api/client.ts` — fetch serveur uniquement (Server Components / Actions) : Bearer +
  `X-Copropriete-Id` depuis les cookies httpOnly, `Idempotency-Key` générée sur les écritures
  financières/probantes (le bouton « Réessayer » est toujours sûr).
- `session.ts` — cookies de session (`su_access`, `su_refresh`, `su_copro`).
- `app-context.ts` — contexte par requête (profil, rôle, copropriété active), mémoïsé
  `React.cache`, résolu côté serveur.
- `i18n/` — dictionnaires FR/AR typés (`Dict` dérivé de fr.ts), zéro dépendance.
- `format.ts` — affichage uniquement (montants `1 250,00 MAD`, dates, téléphone) — aucun calcul
  monétaire côté client.
- `centimes.ts` — agrégats d'affichage des tableaux de bord en BigInt centimes (arithmétique
  exacte, jamais de float sur un montant).
- `forms.ts` — contrat FormState des Server Actions (422 « gaté légal » → bannière, jamais une
  erreur rouge).
- `membres.ts` — annuaire léger reconstruit depuis les rattachements des lots (pas d'endpoint
  de liste d'utilisateurs côté API).
