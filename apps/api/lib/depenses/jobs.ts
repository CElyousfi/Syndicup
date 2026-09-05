/**
 * Job quotidien `depenses-factures-echeances` — M16 : rappel FACTURE_ECHEANCE_PROCHE au syndic
 * 7 jours avant `facture.date_echeance` pour toute facture non REGLEE / non CONTESTEE d'une
 * dépense non annulée. Idempotent : `rappel_echeance_envoye_le` est posé dans la même
 * transaction que l'envoi, un rejeu ne renotifie jamais. Une transaction tenant (contexte
 * système) par copropriété : l'échec de l'une n'empêche pas les autres.
 */
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { envoyerNotification } from "../notifications/notifications";
import { toApiString } from "../money";

const SYSTEME = "00000000-0000-0000-0000-000000000000";
export const JOURS_AVANT_ECHEANCE = 7;

export interface ResultatJobFactures {
  coproprietes: number;
  rappels: number;
}

function jourUtc(now: Date, delta = 0): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

export async function executerRappelsFactures(db: TenantDb, coproprieteId: string, now = new Date()): Promise<{ rappels: number }> {
  const aujourdhui = jourUtc(now);
  const horizon = jourUtc(now, JOURS_AVANT_ECHEANCE);
  const factures = await db.facture.findMany({
    where: {
      rappelEcheanceEnvoyeLe: null,
      statut: { in: ["RECUE", "VERIFIEE"] },
      dateEcheance: { gte: aujourdhui, lte: horizon },
      depense: { coproprieteId, statut: { notIn: ["ANNULEE", "PAYEE"] } },
    },
    include: { depense: { select: { id: true, libelle: true } }, prestataire: { select: { nom: true } } },
  });
  if (factures.length === 0) return { rappels: 0 };
  const syndics = await db.roleUtilisateur.findMany({ where: { coproprieteId, actif: true, role: "SYNDIC" }, select: { utilisateurId: true }, distinct: ["utilisateurId"] });
  let rappels = 0;
  for (const f of factures) {
    await Promise.all(
      syndics.map((s) =>
        envoyerNotification(db, {
          coproprieteId,
          utilisateurId: s.utilisateurId,
          templateCode: "FACTURE_ECHEANCE_PROCHE",
          canal: "PUSH",
          contenuJson: {
            depense_id: f.depense.id,
            facture_id: f.id,
            numero: f.numero ?? "—",
            montant: toApiString(f.montantTtc),
            prestataire: f.prestataire?.nom ?? f.depense.libelle,
            date_echeance: f.dateEcheance!.toISOString().slice(0, 10),
          },
        })
      )
    );
    await db.facture.update({ where: { id: f.id }, data: { rappelEcheanceEnvoyeLe: now } });
    rappels += 1;
  }
  return { rappels };
}

export async function executerRappelsFacturesCopropriete(coproprieteId: string, now = new Date()) {
  const ctxSysteme: TenantContext = { utilisateurId: SYSTEME, coproprieteId, role: "SUPER_ADMIN" };
  return withTenant(ctxSysteme, (db) => executerRappelsFactures(db, coproprieteId, now));
}

export async function executerRappelsFacturesToutesCoproprietes(now = new Date()): Promise<ResultatJobFactures & { erreurs: string[] }> {
  const { PrismaClient } = await import("@prisma/client");
  const raw = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  const total: ResultatJobFactures & { erreurs: string[] } = { coproprietes: 0, rappels: 0, erreurs: [] };
  try {
    const coproprietes = await raw.copropriete.findMany({ where: { statut: "ACTIVE", depenses: { some: { factures: { some: { rappelEcheanceEnvoyeLe: null } } } } }, select: { id: true } });
    for (const { id } of coproprietes) {
      total.coproprietes += 1;
      try {
        const r = await executerRappelsFacturesCopropriete(id, now);
        total.rappels += r.rappels;
      } catch (e) {
        total.erreurs.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return total;
  } finally {
    await raw.$disconnect();
  }
}
