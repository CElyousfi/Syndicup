-- M22 — récurrence : quand l'assigné(e) (gardien, conseil) termine SA tâche récurrente, l'occurrence
-- suivante est créée dans la même transaction, pour lui/elle-même. La policy d'insertion (créée dans
-- la migration m22_taches, même module, non encore livrée) l'autorise uniquement dans ce cas :
-- même assigné(e) ET `recurrence_parente_id` renseigné. Le syndic garde l'insertion libre.
DROP POLICY IF EXISTS tenant_insert ON "tache";
CREATE POLICY tenant_insert ON "tache" FOR INSERT
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) = 'SYNDIC'
        OR (recurrence_parente_id IS NOT NULL
            AND assignee_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
            AND public.tache_visible(recurrence_parente_id))
      )
    )
  );
