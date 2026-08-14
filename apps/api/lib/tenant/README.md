# lib/tenant

Middleware d'isolation multi-tenant (Master Spec Partie 1.6, M1 du roadmap).

Rôle : injecter `copropriete_id` / `role` / `utilisateur_id` dans le contexte RLS Postgres via
`SET LOCAL`, dérivés du JWT Supabase vérifié — jamais fournis par le client. Fournir aussi le
wrapper de client Prisma qui rend une requête métier sans scope tenant impossible à exécuter.

Ne pas commencer un autre module avant que ce middleware existe et soit testé (test critique :
un rôle `proprietaire` ne peut lire aucune ligne hors de sa copropriété, même en modifiant un ID
dans la requête).
