/**
 * Job quotidien LCD — `lcd-sejours-quotidien` (M15). Une transaction tenant par copropriété
 * (contexte système, comme escalade-impayes) : l'échec de l'une n'empêche pas les autres.
 * Logique testée dans lcd.ts (executerSejoursQuotidien) ; ici uniquement l'itération.
 */
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { executerSejoursQuotidien, type ResultatJobSejours } from "./lcd";

const SYSTEME = "00000000-0000-0000-0000-000000000000";

export async function executerSejoursQuotidienCopropriete(coproprieteId: string, now = new Date()) {
  const ctxSysteme: TenantContext = { utilisateurId: SYSTEME, coproprieteId, role: "SUPER_ADMIN" };
  return withTenant(ctxSysteme, (db) => executerSejoursQuotidien(db, coproprieteId, now));
}

export async function executerSejoursQuotidienToutesCoproprietes(now = new Date()): Promise<ResultatJobSejours & { erreurs: string[] }> {
  const { PrismaClient } = await import("@prisma/client");
  const raw = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  const total: ResultatJobSejours & { erreurs: string[] } = { coproprietes: 0, rappelsArrivee: 0, departsAutomatiques: 0, erreurs: [] };
  try {
    const coproprietes = await raw.copropriete.findMany({ where: { regimeLcd: { in: ["AUTORISEE", "ENCADREE"] } }, select: { id: true } });
    for (const { id } of coproprietes) {
      total.coproprietes += 1;
      try {
        const r = await executerSejoursQuotidienCopropriete(id, now);
        total.rappelsArrivee += r.rappelsArrivee;
        total.departsAutomatiques += r.departsAutomatiques;
      } catch (e) {
        total.erreurs.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return total;
  } finally {
    await raw.$disconnect();
  }
}
