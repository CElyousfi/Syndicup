-- M23 — un résident (propriétaire actif / occupant en cours) peut déclarer PERDU un badge ACTIF de SES lots
-- (Doc A §4 : « je signale la perte, le syndic désactive »). Policy supplémentaire, ne relâche pas tenant_write
-- (syndic) : UPDATE restreint aux lots du résident, seule transition autorisée ACTIF → PERDU.
CREATE POLICY resident_perdu ON "badge" FOR UPDATE
  USING (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
         AND statut = 'ACTIF'
         AND lot_id IN (SELECT lot_id FROM public.lots_du_resident_courant()))
  WITH CHECK (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
              AND statut = 'PERDU'
              AND lot_id IN (SELECT lot_id FROM public.lots_du_resident_courant()));
