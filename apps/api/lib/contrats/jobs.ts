/**
 * Jobs Contrats — M19.
 *  - `contrats-echeances-quotidien` : rappels J-30 / J-7 (`CONTRAT_ECHEANCE_PROCHE`, une fois chacun :
 *    `notifie_j30_le` / `notifie_j7_le`), échéances de PAIEMENT dépassées sans dépense → MANQUEE
 *    (`CONTRAT_ECHEANCE_MANQUEE`), contrats ACTIF à `date_fin` atteinte : tacite → période
 *    prolongée d'une durée égale + échéancier régénéré (`CONTRAT_RECONDUIT`), sinon → EXPIRE
 *    (`CONTRAT_EXPIRE`). Tâches M22 de renouvellement : posées quand la table `tache` existe.
 *  - `contrats-assurance-mensuel` : aucune ASSURANCE_IMMEUBLE ACTIVE et non échue →
 *    `ASSURANCE_IMMEUBLE_ABSENTE` au syndic et au conseil, au plus une fois par 28 jours
 *    (`copropriete.assurance_alerte_envoyee_le`).
 * Idempotents : les marqueurs sont posés dans la même transaction que l'envoi. Une transaction tenant
 * (contexte système) par copropriété.
 */
import type { Prisma } from "@prisma/client";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { envoyerNotification } from "../notifications/notifications";
import { toApiString } from "../money";
import { ajouterJours, ajouterMois, dureeEnMois, isoDate, jourUtc } from "./echeancier";
import { etatAssuranceDb, journal, notifierRoles, regenererEcheances } from "./contrats";

const SYSTEME = "00000000-0000-0000-0000-000000000000";
export const RAPPELS_JOURS = [30, 7] as const;
export const ASSURANCE_ALERTE_INTERVALLE_JOURS = 28;

export interface ResultatJobContrats {
  rappels: number;
  manquees: number;
  expires: number;
  reconduits: number;
}

async function syndics(db: TenantDb, coproprieteId: string) {
  return (await db.roleUtilisateur.findMany({ where: { coproprieteId, actif: true, role: "SYNDIC" }, select: { utilisateurId: true }, distinct: ["utilisateurId"] })).map((s) => s.utilisateurId);
}

export async function executerJobContrats(db: TenantDb, coproprieteId: string, now = new Date()): Promise<ResultatJobContrats> {
  const aujourdhui = jourUtc(now);
  const ctx = { coproprieteId, utilisateurId: null };
  const res: ResultatJobContrats = { rappels: 0, manquees: 0, expires: 0, reconduits: 0 };
  const destinataires = await syndics(db, coproprieteId);
  const notifier = async (templateCode: string, contenu: Record<string, unknown>) => {
    await Promise.all(destinataires.map((u) => envoyerNotification(db, { coproprieteId, utilisateurId: u, templateCode, canal: "PUSH", contenuJson: contenu as Prisma.InputJsonValue })));
  };

  // 1. Fin de contrat atteinte : reconduction tacite (échéancier prolongé) ou expiration — AVANT les
  //    rappels, pour que les échéances créées par la reconduction soient traitées dans le même passage.
  const finis = await db.contrat.findMany({ where: { coproprieteId, statut: "ACTIF", dateFin: { not: null, lt: aujourdhui } } });
  for (const c of finis) {
    if (c.tacite && c.dateFin) {
      const duree = dureeEnMois(c.dateDebut, c.dateFin);
      let nouvelleFin = c.dateFin;
      // Plusieurs périodes peuvent s'être écoulées si le job n'a pas tourné.
      while (jourUtc(nouvelleFin) < aujourdhui) nouvelleFin = ajouterMois(nouvelleFin, duree);
      await db.contrat.update({ where: { id: c.id }, data: { dateFin: nouvelleFin } });
      await regenererEcheances(db, ctx, { ...c, dateFin: nouvelleFin }, 12, now);
      await journal(db, ctx, c.id, "RECONDUIT", { ancienne_fin: isoDate(c.dateFin), nouvelle_fin: isoDate(nouvelleFin), duree_mois: duree });
      await notifier("CONTRAT_RECONDUIT", { contrat_id: c.id, libelle: c.libelle, date: isoDate(nouvelleFin) });
      res.reconduits += 1;
    } else {
      await db.contrat.update({ where: { id: c.id }, data: { statut: "EXPIRE" } });
      await db.contratEcheance.updateMany({ where: { contratId: c.id, statut: "A_VENIR", dateEcheance: { gte: aujourdhui } }, data: { statut: "ANNULEE" } });
      await journal(db, ctx, c.id, "EXPIRE", { date_fin: c.dateFin ? isoDate(c.dateFin) : null });
      await notifier("CONTRAT_EXPIRE", { contrat_id: c.id, libelle: c.libelle, date: c.dateFin ? isoDate(c.dateFin) : "" });
      res.expires += 1;
    }
  }
  // 2. Échéances de paiement dépassées sans dépense → MANQUEE.
  const depassees = await db.contratEcheance.findMany({ where: { contrat: { coproprieteId, statut: "ACTIF" }, statut: "A_VENIR", type: "PAIEMENT", dateEcheance: { lt: aujourdhui } }, include: { contrat: { select: { id: true, libelle: true } } } });
  for (const e of depassees) {
    await db.contratEcheance.update({ where: { id: e.id }, data: { statut: "MANQUEE" } });
    await journal(db, ctx, e.contrat.id, "ECHEANCE_MODIFIEE", { echeance_id: e.id, avant: { statut: "A_VENIR" }, apres: { statut: "MANQUEE" }, systeme: true });
    await notifier("CONTRAT_ECHEANCE_MANQUEE", { contrat_id: e.contrat.id, echeance_id: e.id, libelle: e.contrat.libelle, date: isoDate(e.dateEcheance) });
    res.manquees += 1;
  }

  // 3. Rappels J-30 puis J-7 (une échéance à 7 jours qui n'a jamais reçu de J-30 reçoit directement le J-7).
  for (const jours of RAPPELS_JOURS) {
    const champ = jours === 30 ? "notifieJ30Le" : "notifieJ7Le";
    const fenetreFin = ajouterJours(aujourdhui, jours);
    const echeances = await db.contratEcheance.findMany({
      where: { contrat: { coproprieteId, statut: "ACTIF" }, statut: "A_VENIR", [champ]: null, dateEcheance: { gte: aujourdhui, lte: fenetreFin } },
      include: { contrat: { select: { id: true, libelle: true } } },
    });
    for (const e of echeances) {
      const restant = Math.round((jourUtc(e.dateEcheance).getTime() - aujourdhui.getTime()) / 86_400_000);
      // Le J-30 ne s'envoie que si on est encore à plus de 7 jours (sinon le J-7 seul suffit).
      if (jours === 30 && restant <= 7) {
        await db.contratEcheance.update({ where: { id: e.id }, data: { notifieJ30Le: now } });
        continue;
      }
      await notifier("CONTRAT_ECHEANCE_PROCHE", { contrat_id: e.contrat.id, echeance_id: e.id, libelle: e.contrat.libelle, type_echeance: e.type, date: isoDate(e.dateEcheance), jours: String(restant), montant: e.montant ? ` (${toApiString(e.montant)} MAD)` : "" });
      await db.contratEcheance.update({ where: { id: e.id }, data: { [champ]: now, ...(jours === 7 ? { notifieJ30Le: e.notifieJ30Le ?? now } : {}) } });
      res.rappels += 1;
    }
  }

  return res;
}

/** Alerte mensuelle « aucune assurance immeuble active » (Doc A §8). */
export async function executerAlerteAssurance(db: TenantDb, coproprieteId: string, now = new Date()): Promise<{ alerte: boolean }> {
  const copro = await db.copropriete.findUnique({ where: { id: coproprieteId }, select: { assuranceAlerteEnvoyeeLe: true } });
  const etat = await etatAssuranceDb(db, coproprieteId, now);
  if (etat.immeuble_active) {
    if (copro?.assuranceAlerteEnvoyeeLe) await db.copropriete.update({ where: { id: coproprieteId }, data: { assuranceAlerteEnvoyeeLe: null } });
    return { alerte: false };
  }
  if (copro?.assuranceAlerteEnvoyeeLe && now.getTime() - copro.assuranceAlerteEnvoyeeLe.getTime() < ASSURANCE_ALERTE_INTERVALLE_JOURS * 86_400_000) return { alerte: false };
  await notifierRoles(db, coproprieteId, ["SYNDIC", "CONSEIL_SYNDICAL"], "ASSURANCE_IMMEUBLE_ABSENTE", { copropriete_id: coproprieteId });
  await db.copropriete.update({ where: { id: coproprieteId }, data: { assuranceAlerteEnvoyeeLe: now } });
  return { alerte: true };
}

function ctxSysteme(coproprieteId: string): TenantContext {
  return { utilisateurId: SYSTEME, coproprieteId, role: "SUPER_ADMIN" };
}

export async function executerJobContratsCopropriete(coproprieteId: string, now = new Date()) {
  return withTenant(ctxSysteme(coproprieteId), (db) => executerJobContrats(db, coproprieteId, now));
}
export async function executerAlerteAssuranceCopropriete(coproprieteId: string, now = new Date()) {
  return withTenant(ctxSysteme(coproprieteId), (db) => executerAlerteAssurance(db, coproprieteId, now));
}

interface TotalJob {
  coproprietes: number;
  compteurs: Record<string, number>;
  erreurs: string[];
}

async function pourToutesLesCoproprietes<T>(fn: (id: string) => Promise<T>, cumul: (acc: Record<string, number>, r: T) => void): Promise<TotalJob> {
  const { PrismaClient } = await import("@prisma/client");
  const raw = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  const total: TotalJob = { coproprietes: 0, compteurs: {}, erreurs: [] };
  try {
    const coproprietes = await raw.copropriete.findMany({ where: { statut: "ACTIVE" }, select: { id: true } });
    for (const { id } of coproprietes) {
      total.coproprietes += 1;
      try {
        cumul(total.compteurs, await fn(id));
      } catch (e) {
        total.erreurs.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return total;
  } finally {
    await raw.$disconnect();
  }
}

export function executerJobContratsToutesCoproprietes(now = new Date()) {
  return pourToutesLesCoproprietes((id) => executerJobContratsCopropriete(id, now), (acc, r) => {
    for (const k of ["rappels", "manquees", "expires", "reconduits"] as const) acc[k] = (acc[k] ?? 0) + r[k];
  });
}
export function executerAlerteAssuranceToutesCoproprietes(now = new Date()) {
  return pourToutesLesCoproprietes((id) => executerAlerteAssuranceCopropriete(id, now), (acc, r) => {
    acc.alertes = (acc.alertes ?? 0) + (r.alerte ? 1 : 0);
  });
}
