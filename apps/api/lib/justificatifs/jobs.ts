/** Job quotidien `justificatifs-relance-syndic` (M17) — une transaction tenant (système) par copropriété. */
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { executerRelanceJustificatifs } from "./justificatifs";

const SYSTEME = "00000000-0000-0000-0000-000000000000";

export async function executerRelanceJustificatifsCopropriete(coproprieteId: string, now = new Date()) {
  const ctx: TenantContext = { utilisateurId: SYSTEME, coproprieteId, role: "SUPER_ADMIN" };
  return withTenant(ctx, (db) => executerRelanceJustificatifs(db, coproprieteId, now));
}

export async function executerRelanceJustificatifsToutesCoproprietes(now = new Date()) {
  const { PrismaClient } = await import("@prisma/client");
  const raw = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  const total = { coproprietes: 0, rappels: 0, erreurs: [] as string[] };
  try {
    const coproprietes = await raw.copropriete.findMany({ where: { statut: "ACTIVE", delaiValidationJustificatifJours: { not: null } }, select: { id: true } });
    for (const { id } of coproprietes) {
      total.coproprietes += 1;
      try {
        total.rappels += (await executerRelanceJustificatifsCopropriete(id, now)).rappels;
      } catch (e) {
        total.erreurs.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return total;
  } finally {
    await raw.$disconnect();
  }
}
