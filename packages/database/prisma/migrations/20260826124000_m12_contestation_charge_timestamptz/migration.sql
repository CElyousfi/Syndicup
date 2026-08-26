-- Réparation de drift (migration 20260823232435) : contestation_charge.modifie_le était le seul
-- timestamp du schéma SANS timezone (TIMESTAMP(3)) — réaligné sur timestamptz comme partout.
ALTER TABLE "contestation_charge"
  ALTER COLUMN "modifie_le" TYPE TIMESTAMPTZ USING "modifie_le" AT TIME ZONE 'UTC';
