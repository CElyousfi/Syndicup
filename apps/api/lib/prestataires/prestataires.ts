/**
 * Fiche fournisseur — M16 (Doc A §8.3 transparence prestataires, §3.6 devis). Les fonctions CRUD
 * historiques restent dans lib/incidents/incidents.ts (M7) ; ce module ajoute la présentation
 * (RIB masqué), la fiche détaillée (historique interventions / dépenses / notes) et la lecture
 * auditée du RIB complet.
 */
import type { Prestataire } from "@prisma/client";
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { money, toApiString } from "../money";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}

/** 4 derniers caractères seulement — le RIB complet ne sort jamais d'une liste ou d'une fiche. */
export function masquerRib(rib: string | null | undefined): string | null {
  if (!rib) return null;
  return `•••• ${rib.slice(-4)}`;
}

export type PrestatairePresente = Omit<Prestataire, "rib"> & { ribMasque: string | null; ribRenseigne: boolean };

export function presenterPrestataire<T extends Prestataire>(p: T): Omit<T, "rib"> & { ribMasque: string | null; ribRenseigne: boolean } {
  const { rib, ...reste } = p;
  return { ...reste, ribMasque: masquerRib(rib), ribRenseigne: Boolean(rib) };
}

/**
 * GET /prestataires/{id} — fiche + historique : interventions (incidents assignés), évaluations
 * (note + commentaire, sans identité du résident), dépenses (totaux payé / engagé) pour les rôles
 * `depenses.lire` uniquement (le gardien lit l'annuaire, pas la comptabilité).
 */
export async function obtenirPrestataire(ctx: TenantContext, prestataireId: string) {
  if (can("prestataires.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à consulter un prestataire.");
  const voitDepenses = can("depenses.lire", ctx.role) === true;
  return withTenant(ctx, async (db) => {
    const p = await db.prestataire.findUnique({ where: { id: prestataireId } });
    if (!p || p.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Prestataire introuvable.");
    const incidents = await db.incident.findMany({
      where: { assigneAId: prestataireId },
      orderBy: { creeLe: "desc" },
      take: 20,
      select: { id: true, categorie: true, sousCategorie: true, statut: true, urgence: true, creeLe: true, notePrestataire: true, commentairePrestataire: true, evalueLe: true },
    });
    const nbInterventions = await db.incident.count({ where: { assigneAId: prestataireId } });
    const evaluations = incidents
      .filter((i) => i.notePrestataire !== null)
      .map((i) => ({ incident_id: i.id, note: i.notePrestataire, commentaire: i.commentairePrestataire, evalue_le: i.evalueLe }));
    let depenses: { total_paye: string; total_engage: string; nb: number; recentes: unknown[] } | null = null;
    if (voitDepenses) {
      const rows = await db.depense.findMany({
        where: { prestataireId, statut: { in: ["APPROUVEE", "PAYEE", "A_APPROUVER"] } },
        orderBy: { dateDepense: "desc" },
        select: { id: true, libelle: true, categorie: true, montantTtc: true, statut: true, dateDepense: true },
      });
      const paye = rows.filter((r) => r.statut === "PAYEE").reduce((acc, r) => acc.plus(money(r.montantTtc)), money(0));
      const engage = rows.filter((r) => r.statut === "APPROUVEE").reduce((acc, r) => acc.plus(money(r.montantTtc)), money(0));
      depenses = { total_paye: toApiString(paye), total_engage: toApiString(engage), nb: rows.length, recentes: rows.slice(0, 10) };
    }
    return {
      ...presenterPrestataire(p),
      nb_interventions: nbInterventions,
      interventions: incidents.map(({ notePrestataire: _n, commentairePrestataire: _c, evalueLe: _e, ...i }) => i),
      evaluations,
      depenses,
    };
  });
}

/** GET /prestataires/{id}/rib — RIB complet, syndic seul, chaque lecture est auditée. */
export async function lireRibPrestataire(ctx: TenantContext, prestataireId: string) {
  if (can("prestataires.rib.lire", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic consulte le RIB complet d'un fournisseur.");
  return withTenant(ctx, async (db) => {
    const p = await db.prestataire.findUnique({ where: { id: prestataireId }, select: { id: true, coproprieteId: true, rib: true, nom: true } });
    if (!p || p.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Prestataire introuvable.");
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "PRESTATAIRE_RIB_CONSULTE",
      entite: "prestataire",
      entiteId: p.id,
      // Jamais le RIB dans l'audit : seulement le fait de la consultation.
      apres: { rib_renseigne: Boolean(p.rib) },
    });
    return { prestataire_id: p.id, nom: p.nom, rib: p.rib };
  });
}
