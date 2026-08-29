-- M18 — Logo de la résidence (personnalisation) : chemin dans le bucket privé `documents`
-- (`<copropriete>/branding/…`), jamais une URL publique ; l'URL signée est générée à la demande.
ALTER TABLE "copropriete" ADD COLUMN IF NOT EXISTS "logo_storage_path" text;
