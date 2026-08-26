/**
 * Rappels d'échéance AG (Master Spec Partie 15.3 "rappels d'échéance AG") — job quotidien :
 * les AG CONVOQUEE dont la date tombe dans les JOURS_AVANT_RAPPEL prochains jours déclenchent
 * un rappel AG_RAPPEL aux copropriétaires. JOURS_AVANT_RAPPEL est un paramètre TECHNIQUE
 * (confort produit), pas un délai légal — surchargable par env AG_RAPPEL_JOURS_AVANT.
 * Idempotent : une AG déjà rappelée (notification AG_RAPPEL existante) est sautée.
 */
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { envoyerNotification } from "../notifications/notifications";
import { logger } from "../logging/logger";

const ACTEUR_SYSTEME = "00000000-0000-0000-0000-000000000000";
const JOUR_MS = 24 * 60 * 60 * 1000;

function joursAvantRappel(): number {
  const v = Number(process.env.AG_RAPPEL_JOURS_AVANT);
  return Number.isFinite(v) && v > 0 ? v : 3;
}

export async function executerRappelsAg(): Promise<
  { coproprieteId: string; agId: string; notifies: number }[]
> {
  const { PrismaClient } = await import("@prisma/client");
  // Lecture d'inventaire transverse (même pattern que executerEscaladeImpayesToutesCoproprietes) —
  // les écritures passent par withTenant + RLS.
  const raw = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  try {
    const horizon = new Date(Date.now() + joursAvantRappel() * JOUR_MS);
    const ags = await raw.assembleeGenerale.findMany({
      where: { statut: "CONVOQUEE", dateAg: { gte: new Date(), lte: horizon } },
      select: { id: true, coproprieteId: true, dateAg: true },
    });

    const resultats: { coproprieteId: string; agId: string; notifies: number }[] = [];
    for (const ag of ags) {
      const ctxSysteme: TenantContext = {
        utilisateurId: ACTEUR_SYSTEME,
        coproprieteId: ag.coproprieteId,
        role: "SUPER_ADMIN",
      };
      try {
        const notifies = await withTenant(ctxSysteme, async (db) => {
          const dejaRappele = await db.notification.count({
            where: {
              coproprieteId: ag.coproprieteId,
              templateCode: "AG_RAPPEL",
              contenuJson: { path: ["ag_id"], equals: ag.id },
            },
          });
          if (dejaRappele > 0) return 0;

          const destinataires = await db.roleUtilisateur.findMany({
            where: {
              coproprieteId: ag.coproprieteId,
              actif: true,
              role: { in: ["PROPRIETAIRE", "INDIVISAIRE", "PERSONNE_MORALE_REPRESENTANT"] },
            },
            select: { utilisateurId: true },
            distinct: ["utilisateurId"],
          });
          await Promise.all(
            destinataires.map((d) =>
              envoyerNotification(db, {
                coproprieteId: ag.coproprieteId,
                utilisateurId: d.utilisateurId,
                templateCode: "AG_RAPPEL",
                canal: "PUSH",
                contenuJson: { ag_id: ag.id, date_ag: ag.dateAg.toISOString() },
              })
            )
          );
          return destinataires.length;
        });
        resultats.push({ coproprieteId: ag.coproprieteId, agId: ag.id, notifies });
      } catch (e) {
        logger.error("Rappel AG échoué pour une copropriété", {
          ag_id: ag.id,
          erreur: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return resultats;
  } finally {
    await raw.$disconnect();
  }
}
