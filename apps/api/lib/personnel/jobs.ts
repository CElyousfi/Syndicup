/**
 * Jobs Personnel RH — M20.
 *  - `personnel-mensuel` (le 25) : fiches de paie BROUILLON pour chaque employé actif avec un salaire
 *    (idempotent : unique personnel / période) + `PAIE_A_VALIDER` au syndic ; CDD dont la fin tombe
 *    dans 30 jours → `CONTRAT_TRAVAIL_FIN_PROCHE` (une fois : `fin_contrat_notifie_le`).
 *  - `personnel-conges-rappel` (quotidien) : demande de congé DEMANDE depuis > 3 jours → rappel au
 *    syndic (une fois : `rappel_envoye_le`).
 * Une transaction tenant (contexte système) par copropriété.
 */
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { calculerFicheDb, isoDate, journal, notifier, periodeCourante } from "./rh";

const SYSTEME = "00000000-0000-0000-0000-000000000000";
export const JOUR_PAIE = 25;
export const JOURS_RAPPEL_CONGE = 3;
export const JOURS_AVANT_FIN_CDD = 30;

async function syndics(db: TenantDb, coproprieteId: string) {
  return (await db.roleUtilisateur.findMany({ where: { coproprieteId, actif: true, role: "SYNDIC" }, select: { utilisateurId: true }, distinct: ["utilisateurId"] })).map((s) => s.utilisateurId);
}

export async function executerPaieMensuelle(db: TenantDb, coproprieteId: string, now = new Date(), force = false): Promise<{ fiches: number; fins_contrat: number }> {
  const res = { fiches: 0, fins_contrat: 0 };
  const ctx = { coproprieteId, utilisateurId: null };
  const dest = await syndics(db, coproprieteId);
  const periode = periodeCourante(now);
  if (force || now.getUTCDate() >= JOUR_PAIE) {
    const employes = await db.personnel.findMany({ where: { coproprieteId, statut: { in: ["PRESENT", "ABSENT", "REMPLACE"] }, salaireBrutMensuel: { not: null } }, select: { id: true, salaireBrutMensuel: true } });
    for (const p of employes) {
      const existante = await db.fichePaie.findUnique({ where: { personnelId_periode: { personnelId: p.id, periode } } });
      if (existante) continue;
      const calc = await calculerFicheDb(db, coproprieteId, p, { periode });
      const f = await db.fichePaie.create({ data: { coproprieteId, personnelId: p.id, periode, ...calc.data } });
      await journal(db, ctx, p.id, "PAIE_BROUILLON", { fiche_id: f.id, periode, systeme: true, parametres_configures: calc.params !== null });
      res.fiches += 1;
    }
    if (res.fiches > 0) await notifier(db, coproprieteId, dest, "PAIE_A_VALIDER", { periode, nb: String(res.fiches) });
  }
  // Fins de CDD (ou tout contrat à date de fin) dans les 30 jours.
  const horizon = new Date(now.getTime() + JOURS_AVANT_FIN_CDD * 86_400_000);
  const finissant = await db.personnel.findMany({ where: { coproprieteId, statut: { in: ["PRESENT", "ABSENT", "REMPLACE"] }, finContratNotifieLe: null, dateFinContrat: { not: null, lte: horizon, gte: now } }, include: { utilisateur: { select: { nom: true, prenom: true } } } });
  for (const p of finissant) {
    const nom = [p.utilisateur.prenom, p.utilisateur.nom].filter(Boolean).join(" ") || p.poste;
    const jours = Math.round((p.dateFinContrat!.getTime() - now.getTime()) / 86_400_000);
    await notifier(db, coproprieteId, dest, "CONTRAT_TRAVAIL_FIN_PROCHE", { personnel_id: p.id, nom, type: p.typeContrat ?? "—", date: isoDate(p.dateFinContrat!), jours: String(jours) });
    await db.personnel.update({ where: { id: p.id }, data: { finContratNotifieLe: now } });
    res.fins_contrat += 1;
  }
  return res;
}

export async function executerRappelConges(db: TenantDb, coproprieteId: string, now = new Date()): Promise<{ rappels: number }> {
  const limite = new Date(now.getTime() - JOURS_RAPPEL_CONGE * 86_400_000);
  const enAttente = await db.conge.findMany({ where: { coproprieteId, statut: "DEMANDE", rappelEnvoyeLe: null, creeLe: { lte: limite } }, include: { personnel: { select: { poste: true, utilisateur: { select: { nom: true, prenom: true } } } } } });
  if (enAttente.length === 0) return { rappels: 0 };
  const dest = await syndics(db, coproprieteId);
  for (const c of enAttente) {
    const nom = [c.personnel.utilisateur.prenom, c.personnel.utilisateur.nom].filter(Boolean).join(" ") || c.personnel.poste;
    await notifier(db, coproprieteId, dest, "CONGE_EN_ATTENTE_RAPPEL", { conge_id: c.id, personnel_id: c.personnelId, nom, debut: isoDate(c.dateDebut), fin: isoDate(c.dateFin) });
    await db.conge.update({ where: { id: c.id }, data: { rappelEnvoyeLe: now } });
  }
  return { rappels: enAttente.length };
}

const ctxSysteme = (coproprieteId: string): TenantContext => ({ utilisateurId: SYSTEME, coproprieteId, role: "SUPER_ADMIN" });

export const executerPaieMensuelleCopropriete = (coproprieteId: string, now = new Date(), force = false) => withTenant(ctxSysteme(coproprieteId), (db) => executerPaieMensuelle(db, coproprieteId, now, force));
export const executerRappelCongesCopropriete = (coproprieteId: string, now = new Date()) => withTenant(ctxSysteme(coproprieteId), (db) => executerRappelConges(db, coproprieteId, now));

async function pourToutes<T extends Record<string, number>>(fn: (id: string) => Promise<T>) {
  const { PrismaClient } = await import("@prisma/client");
  const raw = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  const total = { coproprietes: 0, compteurs: {} as Record<string, number>, erreurs: [] as string[] };
  try {
    for (const { id } of await raw.copropriete.findMany({ where: { statut: "ACTIVE" }, select: { id: true } })) {
      total.coproprietes += 1;
      try {
        const r = await fn(id);
        for (const [k, v] of Object.entries(r)) total.compteurs[k] = (total.compteurs[k] ?? 0) + v;
      } catch (e) {
        total.erreurs.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return total;
  } finally {
    await raw.$disconnect();
  }
}
export const executerPaieMensuelleToutesCoproprietes = (now = new Date()) => pourToutes((id) => executerPaieMensuelleCopropriete(id, now));
export const executerRappelCongesToutesCoproprietes = (now = new Date()) => pourToutes((id) => executerRappelCongesCopropriete(id, now));
