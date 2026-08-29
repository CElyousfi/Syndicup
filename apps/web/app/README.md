# apps/web/app

Toutes les routes vivent sous `[locale]/` (fr | ar) — le `<html lang dir>` est posé par le
layout racine `[locale]/layout.tsx`, jamais en correctif après coup.

- `[locale]/(public)/` — connexion (OTP + email), invitation (cible des QR), états de compte
  bloquants (A1→A5 du brief).
- `[locale]/(app)/` — l'application authentifiée. Le layout résout le rôle **côté serveur**
  (`lib/app-context.ts`) et construit une navigation PAR RÔLE (brief §5) — jamais une seule
  navigation avec des entrées grisées.
- `api/` — petits proxys techniques (résultats AG en séance, QR d'invitation, export CNDP) :
  le navigateur ne parle jamais directement à l'API, le JWT vit en cookie httpOnly.
- `dev-login/` — connexion de développement uniquement (404 hors NODE_ENV=development).
