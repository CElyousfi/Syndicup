/**
 * Fan-out de notification d'un appel de fonds émis — l'« étape 5 » du Master Spec Partie 6.2
 * (matrice 7.1 : "Nouvel appel de fonds → Push + email → Propriétaires"). Exécuté en async par
 * Inngest (événement "finances/appel_de_fonds.emis") avec un contexte système.
 *
 * Idempotent : si des notifications APPEL_DE_FONDS_EMIS existent déjà pour cet appel (rejeu
 * Idempotency-Key côté API ou retry Inngest), le fan-out est sauté — jamais de double envoi.
 */
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { envoyerNotification } from "../notifications/notifications";
import { toApiString } from "../money";
import { logger } from "../logging/logger";

const ACTEUR_SYSTEME = "00000000-0000-0000-0000-000000000000";

export async function notifierAppelDeFonds(
  coproprieteId: string,
  appelDeFondsId: string
): Promise<{ notifies: number; saute: boolean }> {
  const ctxSysteme: TenantContext = {
    utilisateurId: ACTEUR_SYSTEME,
    coproprieteId,
    role: "SUPER_ADMIN",
  };
  return withTenant(ctxSysteme, async (db) => {
    const dejaNotifie = await db.notification.count({
      where: {
        coproprieteId,
        templateCode: "APPEL_DE_FONDS_EMIS",
        contenuJson: { path: ["appel_de_fonds_id"], equals: appelDeFondsId },
      },
    });
    if (dejaNotifie > 0) {
      logger.info("Fan-out appel de fonds sauté (déjà notifié — rejeu/retry)", {
        appel_de_fonds_id: appelDeFondsId,
      });
      return { notifies: 0, saute: true };
    }

    const appel = await db.appelDeFonds.findUnique({
      where: { id: appelDeFondsId },
      include: { lignes: true },
    });
    if (!appel) {
      logger.warn("Fan-out appel de fonds : appel introuvable", {
        appel_de_fonds_id: appelDeFondsId,
      });
      return { notifies: 0, saute: true };
    }

    let notifies = 0;
    for (const ligne of appel.lignes) {
      const proprietaires = await db.lotProprietaire.findMany({
        where: { lotId: ligne.lotId, dateFin: null },
        select: { utilisateurId: true },
      });
      for (const p of proprietaires) {
        for (const canal of ["EMAIL", "PUSH"] as const) {
          await envoyerNotification(db, {
            coproprieteId,
            utilisateurId: p.utilisateurId,
            templateCode: "APPEL_DE_FONDS_EMIS",
            canal,
            contenuJson: {
              appel_de_fonds_id: appelDeFondsId,
              lot_id: ligne.lotId,
              montant: toApiString(ligne.montantDu.toString()),
              date_echeance: appel.dateEcheance.toISOString().slice(0, 10),
            },
          });
        }
        notifies += 1;
      }
    }
    return { notifies, saute: false };
  });
}
