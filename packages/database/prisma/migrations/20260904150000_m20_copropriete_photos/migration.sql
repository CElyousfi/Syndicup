-- M20 — Photos de la résidence (personnalisation par le syndic) : carte `{ cle: chemin }` vers
-- le bucket privé `documents` (`<copropriete>/branding/…`), jamais une URL publique ; les URLs
-- signées sont générées à la demande. Clés : accueil, entree, cour, salle, piscine, espace:<id>.
ALTER TABLE "copropriete" ADD COLUMN IF NOT EXISTS "photos_json" jsonb;
