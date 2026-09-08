-- M25 — SYNDIC_COMPTABLE : lecture des lots de la copropriété (relevés, soldes, exports) — policy SELECT additive.
CREATE POLICY comptable_select ON "lot" FOR SELECT
  USING (current_setting('app.current_role', true) = 'SYNDIC_COMPTABLE' AND copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid);
