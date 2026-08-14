/**
 * Wrapper de client Prisma scopé tenant — SEUL point d'accès DB du code métier
 * (Master Spec Partie 1.6 : "aucune requête Prisma métier n'est exécutable sans ce filtre,
 * wrapper de client, pas laissé à la discrétion du développeur").
 *
 * Le client Prisma brut N'EST PAS exporté : toute requête passe par `withTenant`, qui ouvre une
 * transaction et injecte le contexte RLS via `set_config(..., true)` (portée transaction —
 * équivalent SET LOCAL, Master Spec Partie 2.3). Les policies RLS côté Postgres restent la
 * deuxième couche indépendante : ce wrapper n'est jamais une excuse pour les relâcher.
 *
 * La connexion (DATABASE_URL) doit utiliser un rôle SANS BYPASSRLS (local : app_local, créé par
 * packages/database scripts/setup-local-app-role.ts).
 *
 * Décision UUID v7 (note pré-M1 du schéma) : les id sont générés ici, côté application
 * (package `uuidv7`) — index B-tree plus sain que v4 ; gen_random_uuid() reste le défaut DB
 * en filet de sécurité.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import { assertValidTenantContext, type TenantContext } from "./context";

// Module-privé — volontairement non exporté.
const basePrisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async create({ args, query }) {
        const data = args.data as Record<string, unknown> | undefined;
        if (data && data.id === undefined) {
          data.id = uuidv7();
        }
        return query(args);
      },
      async createMany({ args, query }) {
        const data = args.data;
        if (Array.isArray(data)) {
          for (const row of data as Record<string, unknown>[]) {
            if (row.id === undefined) row.id = uuidv7();
          }
        }
        return query(args);
      },
    },
  },
});

/** Client transactionnel scopé tenant — le seul type que le code métier manipule. */
export type TenantDb = Omit<
  typeof basePrisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Exécute `fn` dans une transaction dont le contexte RLS est celui du tenant vérifié.
 * `set_config(..., true)` = portée transaction : le contexte disparaît au commit/rollback,
 * aucune fuite possible entre deux requêtes du pool.
 */
export async function withTenant<T>(
  ctx: TenantContext,
  fn: (db: TenantDb) => Promise<T>
): Promise<T> {
  assertValidTenantContext(ctx);
  return basePrisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT set_config('app.current_copropriete_id', ${ctx.coproprieteId}, true),
             set_config('app.current_role', ${ctx.role}, true),
             set_config('app.current_user_id', ${ctx.utilisateurId}, true)
    `;
    return fn(tx as unknown as TenantDb);
  });
}

/** Réservé aux tests et aux scripts d'arrêt propre. */
export async function disconnectTenantDb(): Promise<void> {
  await basePrisma.$disconnect();
}

export type { Prisma };
