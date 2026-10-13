-- M28 — Performance Advisor Supabase (14 oct. 2026).
-- 1. `auth_rls_initplan` : dans toutes les policies, `current_setting(...)` est enveloppé dans
--    `(select current_setting(...))` → évalué UNE fois par requête (InitPlan) au lieu d'une fois
--    par ligne. Sémantique strictement identique. Idempotent (les occurrences déjà enveloppées sont
--    ignorées) et catalogue-driven : couvre aussi les policies futures si on relance la migration.
-- 2. `unindexed_foreign_keys` : un index par clé étrangère sans index couvrant (préfixe), nommé
--    `<table>_<colonnes>_fk_idx`. ⚠️ Ces index vivent dans les migrations, pas dans schema.prisma :
--    si `prisma migrate dev` propose un jour de les supprimer, refuser.
DO $$
DECLARE
  p record;
  q text;
  wc text;
  motif constant text := '(?<!\(select )current_setting\((''[^'']+''(?:::text)?, true)\)';
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname, qual, with_check FROM pg_policies WHERE schemaname = 'public' LOOP
    q := CASE WHEN p.qual IS NULL THEN NULL ELSE regexp_replace(p.qual, motif, '(select current_setting(\1))', 'g') END;
    wc := CASE WHEN p.with_check IS NULL THEN NULL ELSE regexp_replace(p.with_check, motif, '(select current_setting(\1))', 'g') END;
    IF q IS DISTINCT FROM p.qual OR wc IS DISTINCT FROM p.with_check THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I%s%s', p.policyname, p.schemaname, p.tablename,
        CASE WHEN q IS NOT NULL THEN ' USING (' || q || ')' ELSE '' END,
        CASE WHEN wc IS NOT NULL THEN ' WITH CHECK (' || wc || ')' ELSE '' END);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  fk record;
  cle text;
  nom text;
BEGIN
  FOR fk IN
    SELECT c.oid, c.conrelid, c.conrelid::regclass AS tbl, c.conkey,
           (SELECT string_agg(a.attname, '_' ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS cols_nom,
           (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS cols_sql
    FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.contype = 'f' AND n.nspname = 'public'
  LOOP
    cle := array_to_string(fk.conkey, ' ');
    IF NOT EXISTS (
      SELECT 1 FROM pg_index i WHERE i.indrelid = fk.conrelid AND (i.indkey::text = cle OR i.indkey::text LIKE cle || ' %')
    ) THEN
      nom := left(replace(fk.tbl::text, '"', '') || '_' || fk.cols_nom || '_fk_idx', 63);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%s)', nom, fk.tbl, fk.cols_sql);
    END IF;
  END LOOP;
END $$;
