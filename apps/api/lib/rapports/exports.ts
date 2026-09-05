/**
 * Exports de gestion (csv / xlsx) et liste des impayés — M18. Chaque export est journalisé dans
 * `export_log` (append-only). Données nominatives (annuaire des propriétaires) : syndic seul.
 * Les montants sont des chaînes décimales (lib/money) ; aucun RIB ni identifiant bancaire ici.
 */
import type { Prisma } from "@prisma/client";
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { toApiString } from "../money";
import { journaliserExport, type CelluleCsv, type FormatExport } from "../http/export";
import type { Pagination, Tri } from "../http/pagination";
import { isoDate, lignesImpayees, agencerAnciennete, type LigneImpayee } from "./chiffres";
import type { ImpayesFiltres, TRIS_IMPAYES } from "./schemas";
import { PermissionRefuseeError } from "./erreurs";

export interface ResultatExport {
  entetes: string[];
  lignes: CelluleCsv[][];
  nbLignes: number;
}

function exigerExport(ctx: TenantContext, action = "exports.lire") {
  if (can(action, ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à exporter ces données.");
}

// ── Impayés ────────────────────────────────────────────────────────────────────────────────────

function filtrerImpayes(lignes: LigneImpayee[], f: ImpayesFiltres) {
  return lignes.filter((l) => (!f.tranche || l.tranche === f.tranche) && (!f.lot_id || l.lot_id === f.lot_id));
}

function trierImpayes(lignes: LigneImpayee[], tri: Tri<(typeof TRIS_IMPAYES)[number]>) {
  const sens = tri.sens === "asc" ? 1 : -1;
  return lignes.slice().sort((a, b) => {
    switch (tri.champ) {
      case "reste_du": return sens * (Number(a.reste_du) - Number(b.reste_du));
      case "date_echeance": return sens * a.date_echeance.localeCompare(b.date_echeance);
      case "lot": return sens * a.lot_numero.localeCompare(b.lot_numero, "fr", { numeric: true });
      default: return sens * (a.retard_jours - b.retard_jours);
    }
  });
}

/** GET /rapports/impayes — lignes échues IMPAYE / PARTIEL, ancienneté, filtres, tri, pagination. */
export async function listerImpayes(ctx: TenantContext, filtres: ImpayesFiltres, pagination: Pagination, tri: Tri<(typeof TRIS_IMPAYES)[number]>) {
  if (can("rapports.syndic.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à consulter les impayés.");
  return withTenant(ctx, async (db) => {
    const toutes = filtrerImpayes(await lignesImpayees(db, ctx.coproprieteId), filtres);
    const triees = trierImpayes(toutes, tri);
    return { total: triees.length, rows: triees.slice(pagination.skip, pagination.skip + pagination.take), synthese: agencerAnciennete(toutes) };
  });
}

export const ENTETES_IMPAYES = ["lot", "periode", "type", "date_echeance", "montant_du", "montant_paye", "reste_du", "retard_jours", "tranche", "statut", "conteste", "niveau_escalade"];

export async function exporterImpayes(ctx: TenantContext, filtres: ImpayesFiltres, format: FormatExport): Promise<ResultatExport> {
  exigerExport(ctx);
  return withTenant(ctx, async (db) => {
    const lignes = trierImpayes(filtrerImpayes(await lignesImpayees(db, ctx.coproprieteId), filtres), { champ: "retard_jours", sens: "desc" })
      .map((l) => [l.lot_numero, l.periode, l.type, l.date_echeance, l.montant_du, l.montant_paye, l.reste_du, l.retard_jours, l.tranche, l.statut, l.conteste, l.niveau_escalade] as CelluleCsv[]);
    await journaliserExport(db, ctx, { type: "IMPAYES", filtres: filtres as Record<string, unknown>, nbLignes: lignes.length, format });
    return { entetes: ENTETES_IMPAYES, lignes, nbLignes: lignes.length };
  });
}

// ── Lots ───────────────────────────────────────────────────────────────────────────────────────

export const ENTETES_LOTS = ["numero", "type_lot", "type_usage", "etage", "tantiemes", "superficie", "statut", "nb_proprietaires", "nb_occupants", "solde_du"];

export async function exporterLots(ctx: TenantContext, format: FormatExport): Promise<ResultatExport> {
  exigerExport(ctx);
  return withTenant(ctx, async (db) => {
    const lots = await db.lot.findMany({
      where: { coproprieteId: ctx.coproprieteId },
      orderBy: { numero: "asc" },
      select: { id: true, numero: true, typeLot: true, typeUsage: true, etage: true, tantiemes: true, superficie: true, statut: true, _count: { select: { proprietaires: { where: { dateFin: null } }, occupants: { where: { dateFin: null } } } }, appelsDeFondsLot: { where: { statut: { in: ["IMPAYE", "PARTIEL"] } }, select: { montantDu: true, montantPaye: true } } },
    });
    const { money } = await import("../money");
    const lignes: CelluleCsv[][] = lots.map((l) => [
      l.numero, l.typeLot, l.typeUsage ?? "", l.etage, toApiString(l.tantiemes), l.superficie ? toApiString(l.superficie) : "", l.statut, l._count.proprietaires, l._count.occupants,
      toApiString(l.appelsDeFondsLot.reduce((a, x) => a.plus(money(x.montantDu).minus(money(x.montantPaye))), money(0))),
    ]);
    await journaliserExport(db, ctx, { type: "LOTS", filtres: {}, nbLignes: lignes.length, format });
    return { entetes: ENTETES_LOTS, lignes, nbLignes: lignes.length };
  });
}

// ── Propriétaires (nominatif — syndic seul) ────────────────────────────────────────────────────

export const ENTETES_PROPRIETAIRES = ["lot", "nom", "prenom", "raison_sociale", "email", "telephone", "type_propriete", "quote_part", "representant_indivision", "date_debut", "statut_compte", "langue"];

export async function exporterProprietaires(ctx: TenantContext, format: FormatExport): Promise<ResultatExport> {
  exigerExport(ctx, "exports.proprietaires");
  return withTenant(ctx, async (db) => {
    const rows = await db.lotProprietaire.findMany({
      where: { lot: { coproprieteId: ctx.coproprieteId }, dateFin: null },
      orderBy: [{ lot: { numero: "asc" } }, { dateDebut: "asc" }],
      select: { quotePart: true, typePropriete: true, estRepresentantIndivision: true, dateDebut: true, lot: { select: { numero: true } }, utilisateur: { select: { nom: true, prenom: true, raisonSociale: true, email: true, telephone: true, statutCompte: true, languePreferee: true } } },
    });
    const lignes: CelluleCsv[][] = rows.map((p) => [p.lot.numero, p.utilisateur.nom, p.utilisateur.prenom, p.utilisateur.raisonSociale, p.utilisateur.email, p.utilisateur.telephone, p.typePropriete, toApiString(p.quotePart), p.estRepresentantIndivision, isoDate(p.dateDebut), p.utilisateur.statutCompte, p.utilisateur.languePreferee]);
    await journaliserExport(db, ctx, { type: "PROPRIETAIRES", filtres: {}, nbLignes: lignes.length, format });
    return { entetes: ENTETES_PROPRIETAIRES, lignes, nbLignes: lignes.length };
  });
}

// ── Paiements ──────────────────────────────────────────────────────────────────────────────────

export const ENTETES_PAIEMENTS = ["date", "lot", "periode", "type_appel", "methode", "montant", "statut", "reference_cmi", "date_valeur", "justificatif_id"];

export async function exporterPaiements(ctx: TenantContext, exercice: string | undefined, format: FormatExport): Promise<ResultatExport> {
  exigerExport(ctx);
  const annee = exercice && /^\d{4}$/.test(exercice) ? Number(exercice) : null;
  return withTenant(ctx, async (db) => {
    const rows = await db.paiement.findMany({
      where: { lot: { coproprieteId: ctx.coproprieteId }, ...(annee ? { horodatage: { gte: new Date(`${annee}-01-01T00:00:00Z`), lt: new Date(`${annee + 1}-01-01T00:00:00Z`) } } : {}) },
      orderBy: { horodatage: "asc" },
      select: { horodatage: true, methode: true, montant: true, statut: true, referenceCmi: true, dateValeur: true, justificatifId: true, lot: { select: { numero: true } }, appelDeFondsLot: { select: { appelDeFonds: { select: { periode: true, type: true } } } } },
    });
    const lignes: CelluleCsv[][] = rows.map((p) => [p.horodatage.toISOString(), p.lot.numero, p.appelDeFondsLot.appelDeFonds.periode, p.appelDeFondsLot.appelDeFonds.type, p.methode, toApiString(p.montant), p.statut, p.referenceCmi, p.dateValeur ? isoDate(p.dateValeur) : "", p.justificatifId]);
    await journaliserExport(db, ctx, { type: "PAIEMENTS", filtres: { exercice: exercice ?? null }, nbLignes: lignes.length, format });
    return { entetes: ENTETES_PAIEMENTS, lignes, nbLignes: lignes.length };
  });
}

// ── Incidents ──────────────────────────────────────────────────────────────────────────────────

export const ENTETES_INCIDENTS = ["date", "categorie", "sous_categorie", "partie", "urgence", "statut", "lot", "prestataire", "sla_deadline", "note_prestataire", "nb_depenses"];

export async function exporterIncidents(ctx: TenantContext, filtres: { statut?: string; sejour_id?: string }, format: FormatExport): Promise<ResultatExport> {
  exigerExport(ctx);
  return withTenant(ctx, async (db) => {
    const where: Prisma.IncidentWhereInput = { coproprieteId: ctx.coproprieteId, ...(filtres.sejour_id ? { sejourId: filtres.sejour_id } : {}) };
    const rows = await db.incident.findMany({
      where,
      orderBy: { creeLe: "asc" },
      select: { creeLe: true, categorie: true, sousCategorie: true, partie: true, urgence: true, statut: true, slaDeadline: true, notePrestataire: true, lot: { select: { numero: true } }, assigneA: { select: { nom: true } }, _count: { select: { depenses: true } } },
    });
    const lignes: CelluleCsv[][] = rows.map((i) => [i.creeLe.toISOString(), i.categorie, i.sousCategorie, i.partie, i.urgence, i.statut, i.lot?.numero ?? "", i.assigneA?.nom ?? "", i.slaDeadline?.toISOString() ?? "", i.notePrestataire, i._count.depenses]);
    await journaliserExport(db, ctx, { type: "INCIDENTS", filtres: filtres as Record<string, unknown>, nbLignes: lignes.length, format });
    return { entetes: ENTETES_INCIDENTS, lignes, nbLignes: lignes.length };
  });
}

/** GET /rapports/exports — journal des exports (syndic / conseil) : qui a extrait quoi, quand. */
export async function listerExportsJournal(ctx: TenantContext, pagination: Pagination) {
  if (can("rapports.syndic.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à consulter le journal des exports.");
  return withTenant(ctx, async (db) => {
    const where = { coproprieteId: ctx.coproprieteId };
    const [total, rows] = await Promise.all([
      db.exportLog.count({ where }),
      db.exportLog.findMany({ where, orderBy: { horodatage: "desc" }, skip: pagination.skip, take: pagination.take, select: { id: true, type: true, filtresJson: true, nbLignes: true, horodatage: true, utilisateur: { select: { id: true, nom: true, prenom: true } } } }),
    ]);
    return { total, rows: rows.map((r) => ({ id: r.id, type: r.type, filtres: r.filtresJson, nb_lignes: r.nbLignes, horodatage: r.horodatage.toISOString(), utilisateur: r.utilisateur })) };
  });
}
