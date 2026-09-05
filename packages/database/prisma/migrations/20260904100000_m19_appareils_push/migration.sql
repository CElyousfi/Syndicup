-- M19 — Appareils push (Master Spec Partie 13.4 / 7) : jetons FCM des téléphones.
-- Un jeton = UN compte à la fois (un téléphone qui change d'utilisateur ne doit jamais recevoir
-- les notifications de l'ancien compte) : présenter le jeton vaut preuve de possession —
-- `app.push_token` (set_config, portée transaction) autorise la suppression d'un rattachement
-- antérieur du même jeton, quel qu'en soit le propriétaire.
CREATE TYPE "PlateformeAppareil" AS ENUM ('ANDROID', 'IOS');

CREATE TABLE "appareil_push" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "utilisateur_id" uuid NOT NULL REFERENCES "utilisateur"("id") ON DELETE CASCADE,
  "token"          text NOT NULL UNIQUE,
  "plateforme"     "PlateformeAppareil" NOT NULL,
  "langue"         "LanguePreferee" NOT NULL DEFAULT 'FR',
  "version_app"    text,
  "cree_le"        timestamptz NOT NULL DEFAULT now(),
  "dernier_vu_le"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "appareil_push_utilisateur_id_idx" ON "appareil_push"("utilisateur_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON "appareil_push" TO application_role;

ALTER TABLE "appareil_push" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appareil_push" FORCE ROW LEVEL SECURITY;

-- Lecture : ses propres appareils ; ceux des membres de la copropriété courante (nécessaire
-- au transport PUSH qui envoie, dans le contexte de l'expéditeur, vers le destinataire) ;
-- super admin. Aucun endpoint n'expose les jetons d'autrui — seule l'API les lit.
CREATE POLICY appareil_push_lecture ON "appareil_push" FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR EXISTS (
      SELECT 1 FROM "role_utilisateur" ru
      WHERE ru.utilisateur_id = "appareil_push".utilisateur_id
        AND ru.actif = true
        AND ru.copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
    )
  );

CREATE POLICY appareil_push_insertion ON "appareil_push" FOR INSERT
  WITH CHECK (utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY appareil_push_maj ON "appareil_push" FOR UPDATE
  USING (utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- Suppression : ses propres appareils, ou tout rattachement du jeton présenté (changement de
-- compte sur le même téléphone, jeton invalidé par FCM).
CREATE POLICY appareil_push_suppression ON "appareil_push" FOR DELETE
  USING (
    utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR token = NULLIF(current_setting('app.push_token', true), '')
  );
