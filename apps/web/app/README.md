# apps/web/app

Structure attendue (Master Spec Partie 12.1) : `[locale]/(auth)/`, `[locale]/(dashboard)/{finances,ag,incidents,documents,admin}/`.
Le `<html dir="rtl">` se pose au niveau du layout racine selon la locale (Partie 12.3) — pas en
correctif après coup. Le layout `(dashboard)` résout le rôle **côté serveur** (Partie 12.4).
