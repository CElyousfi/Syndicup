/** Jobs Cabinet (M25) : rafraîchissement de la vue matérialisée des KPI du portefeuille (toutes les 15 min). */
import { PrismaClient } from "@prisma/client";

export async function rafraichirPortefeuilleKpi(client?: PrismaClient): Promise<{ rafraichi: boolean; duree_ms: number }> {
  const raw = client ?? new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  const t0 = Date.now();
  try {
    await raw.$executeRawUnsafe("REFRESH MATERIALIZED VIEW CONCURRENTLY public.portefeuille_kpi");
    return { rafraichi: true, duree_ms: Date.now() - t0 };
  } finally {
    if (!client) await raw.$disconnect();
  }
}
