-- M26 — Activités en direct (Live Activities iOS / notifications persistantes Android) : un
-- téléphone « suit » un objet (séance d'AG, ligne d'appel de fonds, incident) et reçoit ses
-- mises à jour d'état sans ouvrir l'app. iOS : jeton ActivityKit par activité (push-type
-- liveactivity) ; Android : jeton FCM de l'appareil (données seules → notification à progression).
-- Même modèle de possession que appareil_push (m19) : chacun ses lignes ; l'API lit celles des
-- membres de la copropriété courante pour pousser une mise à jour.
CREATE TYPE "TypeActiviteDirect" AS ENUM ('AG_SEANCE', 'APPEL_DE_FONDS', 'INCIDENT');

CREATE TABLE "activite_en_direct" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "utilisateur_id" uuid NOT NULL REFERENCES "utilisateur"("id") ON DELETE CASCADE,
  "copropriete_id" uuid NOT NULL REFERENCES "copropriete"("id") ON DELETE CASCADE,
  "type"           "TypeActiviteDirect" NOT NULL,
  "objet_id"       uuid NOT NULL,
  "token"          text NOT NULL,
  "plateforme"     "PlateformeAppareil" NOT NULL,
  "cree_le"        timestamptz NOT NULL DEFAULT now(),
  "modifie_le"     timestamptz NOT NULL DEFAULT now(),
  "terminee_le"    timestamptz,
  UNIQUE ("utilisateur_id", "type", "objet_id", "plateforme")
);
CREATE INDEX "activite_en_direct_objet_idx" ON "activite_en_direct"("copropriete_id", "type", "objet_id");
CREATE INDEX "activite_en_direct_utilisateur_id_idx" ON "activite_en_direct"("utilisateur_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON "activite_en_direct" TO application_role;

ALTER TABLE "activite_en_direct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activite_en_direct" FORCE ROW LEVEL SECURITY;

CREATE POLICY activite_en_direct_lecture ON "activite_en_direct" FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );

CREATE POLICY activite_en_direct_insertion ON "activite_en_direct" FOR INSERT
  WITH CHECK (
    utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    AND copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );

-- Mise à jour : le propriétaire (rafraîchir le jeton), ou l'API dans le contexte de la copropriété
-- (marquer terminée après la dernière mise à jour poussée).
CREATE POLICY activite_en_direct_maj ON "activite_en_direct" FOR UPDATE
  USING (
    utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );

CREATE POLICY activite_en_direct_suppression ON "activite_en_direct" FOR DELETE
  USING (
    utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );
