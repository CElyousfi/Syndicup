-- ════════════════════════════════════════════════════════════════════════════
-- M14 — correctif d'accès au custom_access_token_hook (Master Spec Partie 4.4).
-- Le GRANT EXECUTE de M2 ne suffit pas : supabase_auth_admin n'a pas USAGE sur le schéma
-- public, donc GoTrue échoue à résoudre public.custom_access_token_hook au moment d'émettre
-- un token ("permission denied for schema public", SQLSTATE 42501) → tout login échoue en 500
-- côté GoTrue / 401 côté API. Constaté sur l'environnement Supabase local ; le même grant est
-- requis en staging/production.
-- Aucune donnée touchée, aucune policy RLS modifiée — grant d'accès schéma uniquement,
-- gardé par l'existence du rôle (absent du Postgres nu de la CI, comme en M2).
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
  END IF;
END $$;
