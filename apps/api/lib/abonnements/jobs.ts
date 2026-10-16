/**
 * Job quotidien des abonnements (M29) : envoie les rappels dus (rappels.ts) et journalise chaque
 * envoi avec sa clé unique — idempotent (un rappel déjà journalisé n'est jamais renvoyé).
 * Lecture et écriture sous le contexte opérateur système (RLS : SUPER_ADMIN).
 */
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { transportPour } from "../notifications/transports";
import { logger } from "../logging/logger";
import { etatAcces } from "./etat";
import { rappelsDus } from "./rappels";

const SYSTEME = "00000000-0000-0000-0000-000000000000";
const ctxSysteme: TenantContext = { utilisateurId: SYSTEME, coproprieteId: SYSTEME, role: "SUPER_ADMIN" };

function emailsOperateur(): string[] {
  return (process.env.ABONNEMENTS_OPERATEUR_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export async function executerRappelsAbonnements(maintenant = new Date()) {
  const bilan = { abonnements: 0, rappels: 0, envois: 0, erreurs: [] as string[] };
  const abos = await withTenant(ctxSysteme, (db) =>
    db.abonnement.findMany({
      where: { statut: { in: ["ESSAI", "ACTIF"] } },
      include: { client: true, coproprietes: { where: { actif: true }, include: { copropriete: { select: { nom: true } } } } },
    })
  );
  const email = transportPour("EMAIL");
  for (const a of abos) {
    bilan.abonnements += 1;
    const etat = etatAcces(a, maintenant);
    const dus = rappelsDus({ abonnementId: a.id, statut: a.statut, etat, residences: a.coproprietes.map((c) => c.copropriete.nom), contact: a.client.contactNom });
    for (const r of dus) {
      try {
        // Réserver la clé AVANT l'envoi : si l'insert échoue (déjà envoyé), on n'envoie rien.
        const reserve = await withTenant(ctxSysteme, async (db) => {
          const deja = await db.abonnementEvenement.findUnique({ where: { cle: r.cle }, select: { id: true } });
          if (deja) return false;
          const destinataires = [a.client.contactEmail, ...(r.operateur ? emailsOperateur() : [])].filter((x): x is string => Boolean(x));
          await db.abonnementEvenement.create({
            data: { abonnementId: a.id, type: "RAPPEL_ENVOYE", cle: r.cle, detailsJson: { palier: r.palier, titre: r.titre, destinataires: destinataires.length, etat: etat.etat } },
          });
          return destinataires;
        });
        if (!reserve) continue;
        bilan.rappels += 1;
        for (const destinataire of reserve) {
          const res = await email.envoyer({ destinataire: { utilisateurId: SYSTEME, email: destinataire, telephone: null }, titre: r.titre, corps: r.corps, langue: "FR" });
          if (res.statut === "ENVOYE") bilan.envois += 1;
        }
      } catch (e) {
        bilan.erreurs.push(`${a.id}/${r.palier}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  if (bilan.erreurs.length > 0) logger.error("abonnements.rappels_erreurs", { erreurs: bilan.erreurs.slice(0, 20) });
  return bilan;
}
