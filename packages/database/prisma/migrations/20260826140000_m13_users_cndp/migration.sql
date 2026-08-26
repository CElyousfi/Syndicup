-- ════════════════════════════════════════════════════════════════════════════
-- M13 — CNDP / Loi 09-08 (Master Spec Partie 5.6 et 10.1)
--
-- Horodatages du cycle de vie nécessaires au job d'anonymisation :
--   - utilisateur.desactive_le : départ (vente, fin de bail, fin de mandat) — point de départ
--     du délai de rétention ;
--   - utilisateur.anonymise_le : exécution de l'anonymisation (PII effacées, lignes
--     financières/PV conservées — intégrité comptable 10 ans, Doc A §12.3).
--   - copropriete.retention_desactivation_mois : durée de rétention avant anonymisation.
--     ⚠️ VALEUR LÉGALEMENT GATÉE (LEGAL_QUESTIONS_BRIEF §5 : « durée nécessaire + 2 ans »,
--     durée de base non quantifiée par catégorie) — nullable SANS défaut : le job
--     d'anonymisation SAUTE les copropriétés non configurées plutôt que d'appliquer un
--     chiffre deviné.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE "utilisateur" ADD COLUMN "desactive_le" TIMESTAMPTZ;
ALTER TABLE "utilisateur" ADD COLUMN "anonymise_le" TIMESTAMPTZ;
ALTER TABLE "copropriete" ADD COLUMN "retention_desactivation_mois" INTEGER;
