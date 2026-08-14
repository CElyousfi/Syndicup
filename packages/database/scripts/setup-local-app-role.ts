/**
 * LOCAL UNIQUEMENT — crée le rôle LOGIN `app_local` (mot de passe `app_local`), membre de
 * `application_role` (NOLOGIN, soumis à RLS, créé par la migration M1). C'est via ce rôle que
 * l'API et les tests d'isolation se connectent en local — jamais via `postgres` (BYPASSRLS).
 *
 * Staging/production : le rôle LOGIN équivalent est créé par une tâche ops (mot de passe géré
 * en secret), jamais par une migration ni par ce script.
 *
 * Usage : npm run setup:local-role --workspace=@copropriete-maroc/database
 */
import { PrismaClient } from "@prisma/client";

const directUrl = process.env.DIRECT_URL;
if (!directUrl || !directUrl.includes("127.0.0.1")) {
  console.error("DIRECT_URL absent ou non local — ce script est réservé au Supabase local.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

async function main() {
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_local') THEN
        CREATE ROLE app_local LOGIN PASSWORD 'app_local' IN ROLE application_role INHERIT;
      END IF;
    END $$;
  `);
  console.log("Rôle app_local prêt (postgresql://app_local:app_local@127.0.0.1:54322/postgres).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
