# lib/audit

Écriture de `audit_log` (Master Spec Partie 2.2, append-only). Toute action à valeur probante ou
financière doit y écrire une ligne (CLAUDE.md §4 — item de la Definition of Done). Centraliser ici
plutôt que d'écrire du `prisma.auditLog.create(...)` dispersé dans chaque route.
