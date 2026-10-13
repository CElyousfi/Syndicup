-- M27 — Durcissement de la surface exposée à PostgREST (Security Advisor Supabase, 14 oct. 2026).
-- L'application n'utilise JAMAIS l'API Data de Supabase (CLAUDE.md §1.4 : tout passe par apps/api
-- avec le rôle applicatif ; Auth et Storage exceptés). Les rôles PostgREST `anon` / `authenticated`
-- ne doivent donc rien pouvoir lire ni exécuter dans `public` — RLS reste la seconde couche.
-- Idempotent et sans effet hors Supabase (les rôles anon/authenticated/postgres sont testés).

-- 1. Fonctions : aucune exécution par PUBLIC / anon / authenticated ; le rôle applicatif (et
--    postgres, qui exécute les migrations et les jobs) gardent l'accès. Le hook Auth reste réservé
--    à supabase_auth_admin (grant posé en m2, conservé). search_path figé partout (lint 0011).
DO $$
DECLARE
  f record;
  roles_postgrest text := '';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN roles_postgrest := roles_postgrest || ', anon'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN roles_postgrest := roles_postgrest || ', authenticated'; END IF;

  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname, p.proconfig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC%s', f.sig, roles_postgrest);
    IF f.proname <> 'custom_access_token_hook' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO application_role', f.sig);
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO postgres', f.sig);
      END IF;
    END IF;
    IF f.proconfig IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(f.proconfig) c WHERE c LIKE 'search_path=%') THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public', f.sig);
    END IF;
  END LOOP;
END $$;

-- 2. Tables, vues, séquences : rien pour anon / authenticated (l'API Data n'est pas utilisée).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
  END IF;
  -- Les objets créés plus tard par les migrations (rôle postgres sur Supabase) n'exposent rien non plus.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  END IF;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
END $$;

-- 3. La table interne de Prisma n'a pas de RLS (lint 0013) : activée sans policy — seul son
--    propriétaire (le rôle des migrations) y accède ; l'application n'y touche jamais.
DO $$ BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY; END IF;
END $$;
