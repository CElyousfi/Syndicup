-- M15 (suite) — pièces jointes d'un séjour (confirmation de réservation, photos d'arrivée /
-- d'état des lieux) : chemins storage `<copropriete>/lcd/sejours/…` du bucket privé `documents`,
-- servis par URL signée 15 min (même règle que les photos d'incident). Jamais de pièce
-- d'identité (minimisation CNDP). Effacées avec les données voyageur par le job CNDP.
ALTER TABLE "sejour_courte_duree" ADD COLUMN "pieces_jointes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
