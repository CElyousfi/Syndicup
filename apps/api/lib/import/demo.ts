/**
 * Résidence de démonstration (M24) — SUPER_ADMIN : une copropriété jetable inspirée du seed
 * Al Amal (lots, budget, appel, paiements, incidents, annonce, emplacements) pour qu'un prospect
 * clique partout ; `est_demo` = exclue des rapports / exports transverses ; purgée par le job
 * `demo-purge-quotidien` après `demo_expire_le` (30 jours par défaut). Aucun compte n'est créé :
 * une invitation SYNDIC (code retourné) ouvre la résidence au prospect.
 */
import { PrismaClient } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { genererCode, expiration } from "../auth/invitations";
import { money } from "../money";
import type { DemoCreateInput } from "./schemas";

export class PermissionRefuseeError extends Error {}

export async function creerDemo(ctx: TenantContext, input: DemoCreateInput) {
  if (can("demo.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul l'opérateur plateforme crée une résidence de démonstration.");
  const id = uuidv7();
  const jours = input.jours ?? 30;
  const ctxDemo: TenantContext = { utilisateurId: ctx.utilisateurId, coproprieteId: id, role: "SUPER_ADMIN" };
  const jour = (delta: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + delta); return d; };
  const exercice = String(new Date().getUTCFullYear());
  const periode = new Date().toISOString().slice(0, 7);
  return withTenant(ctxDemo, async (db) => {
    const copro = await db.copropriete.create({ data: { id, nom: input.nom ?? `Démo — Résidence Al Amal ${new Date().toISOString().slice(0, 10)}`, adresse: "12, rue des Orangers", ville: "Casablanca", typeResidence: "IMMEUBLE_COLLECTIF", nbLots: 5, totalTantiemes: "1000.00", estDemo: true, demoExpireLe: new Date(Date.now() + jours * 86_400_000), comptesBancairesJson: [{ libelle: "Compte syndicat", banque: "Banque Démo", rib: "007780000123456789012345" }], delaiExecutionResolutionJours: 60 } });
    const lots = await Promise.all([
      ["APPARTEMENT", "A1", 1, "300.00", "A"], ["APPARTEMENT", "A2", 2, "250.00", "A"], ["APPARTEMENT", "A3", 3, "250.00", "B"], ["PARKING", "P1", null, "100.00", "A"], ["LOGE_GARDIEN", "LG", 0, "100.00", "A"],
    ].map(([t, n, e, ta, b]) => db.lot.create({ data: { coproprieteId: id, typeLot: t as "APPARTEMENT" | "PARKING" | "LOGE_GARDIEN", numero: n as string, etage: e as number | null, tantiemes: ta as string, batiment: b as string, statut: "OCCUPE" } })));
    const budget = await db.budgetAg.create({ data: { coproprieteId: id, exercice, montantTotal: "120000.00", statut: "ACTIF" } });
    const appel = await db.appelDeFonds.create({ data: { coproprieteId: id, periode, type: "CHARGES_COURANTES", montantTotal: "10000.00", dateEcheance: jour(15), statut: "EMIS", lignes: { create: lots.map((l) => ({ lotId: l.id, montantDu: money("10000").times(money(l.tantiemes.toString())).dividedBy(1000).toFixed(2) })) } }, include: { lignes: true } });
    const ligneA1 = appel.lignes.find((l) => l.lotId === lots[0]!.id)!;
    await db.paiement.create({ data: { lotId: lots[0]!.id, appelDeFondsLotId: ligneA1.id, montant: ligneA1.montantDu.toString(), methode: "VIREMENT", statut: "VALIDE" } });
    await db.appelDeFondsLot.update({ where: { id: ligneA1.id }, data: { montantPaye: ligneA1.montantDu.toString(), statut: "PAYE" } });
    await db.incident.createMany({ data: [
      { coproprieteId: id, lotId: null, categorie: "PLOMBERIE", sousCategorie: "Fuite colonne montante", description: "Fuite au sous-sol près du compteur général.", partie: "COMMUNE", urgence: "URGENTE", statut: "EN_COURS", creePar: ctx.utilisateurId, slaDeadline: new Date(Date.now() + 4 * 3600_000) },
      { coproprieteId: id, lotId: lots[1]!.id, categorie: "ELECTRICITE", sousCategorie: "Minuterie du palier", description: "La lumière du 2e ne s'allume plus.", partie: "COMMUNE", urgence: "NORMALE", statut: "OUVERT", creePar: ctx.utilisateurId, slaDeadline: new Date(Date.now() + 48 * 3600_000) },
    ] });
    await db.annonce.create({ data: { coproprieteId: id, auteurId: ctx.utilisateurId, titre: "Bienvenue dans la résidence de démonstration", contenu: "Cliquez partout : lots, finances, incidents, parkings… Les données sont fictives et seront effacées automatiquement.", categorie: "INFORMATION", audience: "TOUS", epingle: true, statut: "PUBLIEE", publieLe: new Date(), commentairesActives: false } });
    await db.emplacement.createMany({ data: [
      { coproprieteId: id, type: "PARKING_VISITEUR", code: "P-V1", niveau: "-1", attribuable: false },
      { coproprieteId: id, type: "PARKING_COMMUN", code: "P-12", niveau: "-1", attribuable: true },
      { coproprieteId: id, type: "PARKING_PMR", code: "P-PMR", niveau: "0", attribuable: false },
    ] });
    await db.contrat.create({ data: { coproprieteId: id, type: "ASSURANCE_IMMEUBLE", libelle: "Assurance multirisque immeuble", dateDebut: jour(-100), dateFin: jour(265), tacite: true, periodicite: "ANNUELLE", montantPeriode: "18000.00", statut: "ACTIF", creeParId: ctx.utilisateurId } });
    const invitation = await db.invitation.create({ data: { coproprieteId: id, roleCible: "SYNDIC", emetteurId: ctx.utilisateurId, canal: "QR_CODE", code: genererCode(), expireLe: expiration("QR_CODE") } });
    await ecrireAuditLog(db, { coproprieteId: id, acteurId: ctx.utilisateurId, action: "COPROPRIETE_DEMO_CREEE", entite: "copropriete", entiteId: id, apres: { nom: copro.nom, expire_le: copro.demoExpireLe?.toISOString() ?? null, jours } });
    return { id, nom: copro.nom, est_demo: true, demo_expire_le: copro.demoExpireLe, invitation_syndic: { id: invitation.id, code: invitation.code, expire_le: invitation.expireLe }, lots: lots.length, budget_id: budget.id, appel_de_fonds_id: appel.id };
  });
}

/** Purge des démonstrations expirées — job quotidien (client direct, hors RLS : ordre des dépendances). */
export async function purgerDemosExpirees(now = new Date(), client?: PrismaClient): Promise<{ purgees: number; erreurs: string[] }> {
  const raw = client ?? new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  const res = { purgees: 0, erreurs: [] as string[] };
  try {
    const demos = await raw.copropriete.findMany({ where: { estDemo: true, demoExpireLe: { lt: now } }, select: { id: true, nom: true } });
    for (const d of demos) {
      try {
        await raw.$transaction(async (tx) => {
          const c = d.id;
          const lotIds = (await tx.lot.findMany({ where: { coproprieteId: c }, select: { id: true } })).map((l) => l.id);
          await tx.notification.deleteMany({ where: { coproprieteId: c } });
          await tx.annonceCommentaire.deleteMany({ where: { annonce: { coproprieteId: c } } });
          await tx.annonceLecture.deleteMany({ where: { annonce: { coproprieteId: c } } });
          await tx.document.deleteMany({ where: { coproprieteId: c } });
          await tx.annonce.deleteMany({ where: { coproprieteId: c } });
          await tx.incidentLog.deleteMany({ where: { incident: { coproprieteId: c } } });
          await tx.incident.deleteMany({ where: { coproprieteId: c } });
          await tx.attributionEmplacement.deleteMany({ where: { coproprieteId: c } });
          await tx.badge.deleteMany({ where: { coproprieteId: c } });
          await tx.vehicule.deleteMany({ where: { coproprieteId: c } });
          await tx.visite.deleteMany({ where: { coproprieteId: c } });
          await tx.emplacement.deleteMany({ where: { coproprieteId: c } });
          await tx.contratLog.deleteMany({ where: { coproprieteId: c } });
          await tx.contrat.deleteMany({ where: { coproprieteId: c } });
          await tx.quittance.deleteMany({ where: { appelDeFondsLot: { lotId: { in: lotIds } } } });
          await tx.paiement.deleteMany({ where: { lotId: { in: lotIds } } });
          await tx.soldeOuverture.deleteMany({ where: { coproprieteId: c } });
          await tx.appelDeFondsLot.deleteMany({ where: { lotId: { in: lotIds } } });
          await tx.appelDeFonds.deleteMany({ where: { coproprieteId: c } });
          await tx.budgetAg.deleteMany({ where: { coproprieteId: c } });
          await tx.invitation.deleteMany({ where: { coproprieteId: c } });
          await tx.lotOccupant.deleteMany({ where: { lotId: { in: lotIds } } });
          await tx.lotProprietaire.deleteMany({ where: { lotId: { in: lotIds } } });
          await tx.lot.deleteMany({ where: { coproprieteId: c } });
          await tx.roleUtilisateur.deleteMany({ where: { coproprieteId: c } });
          await tx.auditLog.deleteMany({ where: { coproprieteId: c } });
          await tx.copropriete.delete({ where: { id: c } });
        });
        res.purgees++;
      } catch (e) {
        res.erreurs.push(`${d.nom} (${d.id}) : ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
      }
    }
  } finally {
    if (!client) await raw.$disconnect();
  }
  return res;
}
