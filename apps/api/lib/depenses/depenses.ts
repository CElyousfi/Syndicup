/**
 * Service Dépenses — M16 (Doc A §3 charges, §3.6 fonds de réserve, §8 obligations du syndic,
 * §8.3 « dépense > seuil configurable → conseil syndical », §6 approbation des comptes).
 *
 * « L'argent qui sort » : une Depense est à la copropriété ce qu'un AppelDeFondsLot est à un lot —
 * cycle de vie (BROUILLON → A_APPROUVER → APPROUVEE → PAYEE ; REJETEE ; ANNULEE), paiement tracé
 * (méthode, référence, preuve), factures, journal append-only `depense_log`. Payer depuis le fonds
 * de réserve écrit un mouvement DEPENSE dans `fonds_reserve_mouvement` (le SEUL grand livre de la
 * réserve) dans la même transaction ; le solde ne peut jamais devenir négatif (422 + trigger).
 *
 * Aucune valeur légale codée en dur : le seuil d'approbation du conseil est
 * `copropriete.seuil_approbation_conseil` (nullable — non configuré = toute dépense soumise passe
 * par une approbation explicite du syndic et les rapports le signalent). Toute arithmétique
 * passe par lib/money ; toute écriture par withTenant (RLS) ; les écritures probantes sont
 * idempotentes (Idempotency-Key) et auditées.
 */
import { Prisma } from "@prisma/client";
import type Decimal from "decimal.js";
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import { withTenantIdempotent } from "../http/idempotency";
import type { ErrorCode } from "../http/respond";
import { money, toApiString, isGreaterThan } from "../money";
import { attacherDocument, preparerUploadModule, urlsSigneesDocuments, CheminHorsPerimetreError } from "../documents/attach";
import type { Pagination, Tri } from "../http/pagination";
import { journaliserExport, type CelluleCsv } from "../http/export";
import type {
  DepenseCreateInput,
  DepenseUpdateInput,
  DepenseRejeterInput,
  DepenseAnnulerInput,
  DepensePayerInput,
  DepenseUploadUrlInput,
  DepensesFiltres,
  FactureCreateInput,
  FactureUpdateInput,
  IncidentDepenseCreateInput,
  TRIS_DEPENSE,
} from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
/** Règle métier violée — `code` = code d'erreur HTTP explicite (422 / 409), jamais une exception « bug ». */
export class DepenseError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}

export type NiveauApprobation = "SYNDIC" | "CONSEIL";

function dateUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Paramètres de copropriété ─────────────────────────────────────────────────

export async function chargerParametresDepenses(db: TenantDb, coproprieteId: string) {
  const copro = await db.copropriete.findUnique({
    where: { id: coproprieteId },
    select: { seuilApprobationConseil: true, reserveSansResolutionAutorisee: true, tvaParDefaut: true },
  });
  if (!copro) throw new IntrouvableError("Copropriété introuvable.");
  return copro;
}

/**
 * Qui doit approuver ? Seuil non configuré → le syndic approuve explicitement (jamais de montant
 * deviné — brief §8, les rapports signalent « seuil non configuré ») ; montant > seuil → conseil.
 */
export function niveauApprobationRequis(seuil: Decimal | null | undefined, montantTtc: Prisma.Decimal | string): NiveauApprobation {
  if (seuil === null || seuil === undefined) return "SYNDIC";
  return isGreaterThan(montantTtc.toString(), seuil.toString()) ? "CONSEIL" : "SYNDIC";
}

// ── Journal append-only ───────────────────────────────────────────────────────

type TypeLog = "CREEE" | "SOUMISE" | "APPROUVEE" | "REJETEE" | "PAYEE" | "ANNULEE" | "FACTURE_AJOUTEE" | "FACTURE_CONTESTEE" | "MODIFIEE";

async function journal(db: TenantDb, ctx: { coproprieteId: string; utilisateurId: string | null }, depenseId: string, type: TypeLog, details?: Record<string, unknown>) {
  // INSERT sans RETURNING (policy SELECT plus stricte que le WITH CHECK — même précaution que
  // sejour_evenement / envoyerNotification).
  await db.depenseLog.createMany({
    data: [{ coproprieteId: ctx.coproprieteId, depenseId, type, acteurId: ctx.utilisateurId, detailsJson: (details ?? Prisma.DbNull) as Prisma.InputJsonValue }],
  });
}

async function audit(db: TenantDb, ctx: TenantContext, action: string, depenseId: string, avant?: unknown, apres?: unknown) {
  await ecrireAuditLog(db, {
    coproprieteId: ctx.coproprieteId,
    acteurId: ctx.utilisateurId,
    action,
    entite: "depense",
    entiteId: depenseId,
    avant: avant as Prisma.InputJsonValue,
    apres: apres as Prisma.InputJsonValue,
  });
}

async function notifierRoles(db: TenantDb, ctx: TenantContext, roles: ("SYNDIC" | "CONSEIL_SYNDICAL")[], templateCode: string, contenu: Record<string, unknown>) {
  const destinataires = await db.roleUtilisateur.findMany({
    where: { coproprieteId: ctx.coproprieteId, actif: true, role: { in: roles } },
    select: { utilisateurId: true },
    distinct: ["utilisateurId"],
  });
  await Promise.all(
    destinataires
      .filter((d) => d.utilisateurId !== ctx.utilisateurId)
      .map((d) => envoyerNotification(db, { coproprieteId: ctx.coproprieteId, utilisateurId: d.utilisateurId, templateCode, canal: "PUSH", contenuJson: contenu as Prisma.InputJsonValue }))
  );
}

async function notifierUtilisateur(db: TenantDb, ctx: TenantContext, utilisateurId: string, templateCode: string, contenu: Record<string, unknown>) {
  if (utilisateurId === ctx.utilisateurId) return;
  await envoyerNotification(db, { coproprieteId: ctx.coproprieteId, utilisateurId, templateCode, canal: "PUSH", contenuJson: contenu as Prisma.InputJsonValue });
}

// ── Chargement / présentation ─────────────────────────────────────────────────

const depenseInclude = {
  prestataire: { select: { id: true, nom: true, specialite: true } },
  budgetPoste: { select: { id: true, libelle: true, categorie: true } },
  incident: { select: { id: true, categorie: true, sousCategorie: true, statut: true } },
  resolutionAg: { select: { id: true, texte: true, resultat: true, agId: true } },
  creePar: { select: { id: true, nom: true, prenom: true } },
  approuvePar: { select: { id: true, nom: true, prenom: true } },
  _count: { select: { factures: true } },
} satisfies Prisma.DepenseInclude;

const depenseDetailInclude = {
  ...depenseInclude,
  factures: { orderBy: { dateFacture: "asc" }, include: { document: { select: { id: true, nom: true, type: true } }, prestataire: { select: { id: true, nom: true } } } },
  justificatifPaiementDocument: { select: { id: true, nom: true, type: true } },
  logs: { orderBy: { horodatage: "asc" }, include: { acteur: { select: { id: true, nom: true, prenom: true } } } },
  mouvementsFondsReserve: { select: { id: true, montant: true, horodatage: true, resolutionAgId: true } },
} satisfies Prisma.DepenseInclude;

async function chargerDepense(db: TenantDb, ctx: TenantContext, id: string) {
  const d = await db.depense.findUnique({ where: { id }, include: depenseInclude });
  if (!d || d.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Dépense introuvable.");
  return d;
}

/** Résout budget / poste et vérifie la cohérence poste ↔ catégorie (rapports fiables). */
async function resoudreBudget(db: TenantDb, ctx: TenantContext, input: { budget_poste_id?: string | null; categorie?: string; date_depense?: string }, courant?: { budgetPosteId: string | null; budgetAgId: string | null }) {
  if (input.budget_poste_id) {
    const poste = await db.budgetPoste.findUnique({ where: { id: input.budget_poste_id }, include: { budgetAg: { select: { coproprieteId: true, statut: true } } } });
    if (!poste || poste.budgetAg.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Poste budgétaire introuvable.");
    if (input.categorie && input.categorie !== poste.categorie) {
      throw new DepenseError("UNPROCESSABLE_ENTITY", `La catégorie de la dépense (${input.categorie}) doit correspondre à celle du poste (${poste.categorie}).`);
    }
    return { budgetPosteId: poste.id, budgetAgId: poste.budgetAgId, categorie: poste.categorie };
  }
  if (input.budget_poste_id === null) {
    // Détachement explicite du poste : on garde le budget de l'exercice s'il existe.
    return { budgetPosteId: null, budgetAgId: courant?.budgetAgId ?? null, categorie: input.categorie };
  }
  if (courant) return { budgetPosteId: courant.budgetPosteId, budgetAgId: courant.budgetAgId, categorie: input.categorie };
  // Sans poste : rattachement au budget ACTIF de l'exercice de la dépense (s'il existe) pour le
  // « hors poste » du rapport budget vs réalisé.
  const exercice = input.date_depense?.slice(0, 4);
  const budget = exercice ? await db.budgetAg.findFirst({ where: { coproprieteId: ctx.coproprieteId, exercice, statut: "ACTIF" }, select: { id: true } }) : null;
  return { budgetPosteId: null, budgetAgId: budget?.id ?? null, categorie: input.categorie };
}

async function verifierReferences(db: TenantDb, ctx: TenantContext, input: { prestataire_id?: string | null; incident_id?: string | null; resolution_ag_id?: string | null }) {
  if (input.prestataire_id) {
    const p = await db.prestataire.findUnique({ where: { id: input.prestataire_id }, select: { coproprieteId: true } });
    if (!p || p.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Prestataire introuvable.");
  }
  if (input.incident_id) {
    const i = await db.incident.findUnique({ where: { id: input.incident_id }, select: { coproprieteId: true } });
    if (!i || i.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Incident introuvable.");
  }
  if (input.resolution_ag_id) {
    const r = await db.agResolution.findUnique({ where: { id: input.resolution_ag_id }, select: { resultat: true, ag: { select: { coproprieteId: true } } } });
    if (!r || r.ag.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Résolution d'AG introuvable.");
    if (r.resultat !== "ADOPTEE") throw new DepenseError("UNPROCESSABLE_ENTITY", "La résolution d'AG liée doit être ADOPTEE.");
  }
}

/**
 * Doc A §3.6 : décaissement de la réserve lié à une décision AG — sauf si le règlement autorise
 * explicitement l'urgence (`reserve_sans_resolution_autorisee`).
 */
function assertReserveJustifiee(d: { source: string; resolutionAgId: string | null }, params: { reserveSansResolutionAutorisee: boolean }) {
  if (d.source === "FONDS_RESERVE" && !d.resolutionAgId && !params.reserveSansResolutionAutorisee) {
    throw new DepenseError(
      "DEPENSE_RESERVE_RESOLUTION_REQUISE",
      "Un décaissement du fonds de réserve doit être lié à une résolution d'AG ADOPTEE (Doc A §3.6) — ou le règlement doit autoriser explicitement l'urgence (paramètre de copropriété)."
    );
  }
}

// ── Liste / détail ────────────────────────────────────────────────────────────

function whereFiltres(ctx: TenantContext, f: DepensesFiltres): Prisma.DepenseWhereInput {
  const dateDepense: Prisma.DateTimeFilter = {};
  if (f.date_from) dateDepense.gte = dateUtc(f.date_from);
  if (f.date_to) dateDepense.lte = dateUtc(f.date_to);
  if (f.exercice) {
    dateDepense.gte = dateUtc(`${f.exercice}-01-01`);
    dateDepense.lte = dateUtc(`${f.exercice}-12-31`);
  }
  return {
    coproprieteId: ctx.coproprieteId,
    ...(f.statut ? { statut: f.statut } : {}),
    ...(f.categorie ? { categorie: f.categorie } : {}),
    ...(f.budget_poste_id ? { budgetPosteId: f.budget_poste_id } : {}),
    ...(f.prestataire_id ? { prestataireId: f.prestataire_id } : {}),
    ...(f.source ? { source: f.source } : {}),
    ...(f.incident_id ? { incidentId: f.incident_id } : {}),
    ...(f.contrat_id ? { contratId: f.contrat_id } : {}),
    ...(f.personnel_id ? { personnelId: f.personnel_id } : {}),
    ...(Object.keys(dateDepense).length ? { dateDepense } : {}),
    ...(f.q ? { OR: [{ libelle: { contains: f.q, mode: "insensitive" } }, { description: { contains: f.q, mode: "insensitive" } }, { referencePaiement: { contains: f.q, mode: "insensitive" } }] } : {}),
  };
}

const ORDER_BY: Record<(typeof TRIS_DEPENSE)[number], (sens: "asc" | "desc") => Prisma.DepenseOrderByWithRelationInput[]> = {
  date_depense: (s) => [{ dateDepense: s }, { creeLe: s }],
  montant_ttc: (s) => [{ montantTtc: s }],
  statut: (s) => [{ statut: s }, { dateDepense: "desc" }],
  cree_le: (s) => [{ creeLe: s }],
};

export async function listerDepenses(ctx: TenantContext, filtres: DepensesFiltres, pagination: Pagination, tri: Tri<(typeof TRIS_DEPENSE)[number]>) {
  if (can("depenses.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à consulter les dépenses.");
  return withTenant(ctx, async (db) => {
    const where = whereFiltres(ctx, filtres);
    const [total, rows, parStatut, sommeFiltre] = await Promise.all([
      db.depense.count({ where }),
      db.depense.findMany({ where, include: depenseInclude, orderBy: ORDER_BY[tri.champ](tri.sens), skip: pagination.skip, take: pagination.take }),
      // Compteurs par statut sur le même périmètre hors filtre statut (onglets de la liste).
      db.depense.groupBy({ by: ["statut"], where: { ...where, statut: undefined }, _count: { _all: true }, _sum: { montantTtc: true } }),
      db.depense.aggregate({ where, _sum: { montantTtc: true } }),
    ]);
    return {
      total,
      rows,
      totaux: {
        montant_ttc: toApiString(sommeFiltre._sum.montantTtc ?? 0),
        par_statut: Object.fromEntries(parStatut.map((s) => [s.statut, { nb: s._count._all, montant_ttc: toApiString(s._sum.montantTtc ?? 0) }])),
      },
    };
  });
}

/** Itérateur CSV — même filtre que la liste, pagination interne (jamais tout en mémoire). */
export async function exporterDepensesCsv(ctx: TenantContext, filtres: DepensesFiltres, format: "csv" | "xlsx" = "csv"): Promise<{ entetes: string[]; lignes: CelluleCsv[][]; nbLignes: number }> {
  if (can("depenses.exporter", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à exporter les dépenses.");
  return withTenant(ctx, async (db) => {
    const where = whereFiltres(ctx, filtres);
    const lignes: CelluleCsv[][] = [];
    const taille = 500;
    for (let skip = 0; ; skip += taille) {
      const page = await db.depense.findMany({ where, include: depenseInclude, orderBy: [{ dateDepense: "asc" }, { creeLe: "asc" }], skip, take: taille });
      for (const d of page) {
        lignes.push([
          isoDate(d.dateDepense),
          d.libelle,
          d.categorie,
          d.budgetPoste?.libelle ?? "",
          d.prestataire?.nom ?? "",
          d.montantHt ? toApiString(d.montantHt) : "",
          d.tva ? toApiString(d.tva) : "",
          toApiString(d.montantTtc),
          d.statut,
          d.source,
          d.methodePaiement ?? "",
          d.referencePaiement ?? "",
          d.payeLe ? isoDate(d.payeLe) : "",
          d._count.factures,
        ]);
      }
      if (page.length < taille) break;
    }
    await journaliserExport(db, ctx, { type: "DEPENSES", filtres: filtres as Record<string, unknown>, nbLignes: lignes.length, format });
    return {
      entetes: ["date", "libelle", "categorie", "poste", "prestataire", "montant_ht", "tva", "montant_ttc", "statut", "source", "methode_paiement", "reference_paiement", "paye_le", "nb_factures"],
      lignes,
      nbLignes: lignes.length,
    };
  });
}

export async function obtenirDepense(ctx: TenantContext, id: string) {
  if (can("depenses.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à consulter les dépenses.");
  return withTenant(ctx, async (db) => {
    const d = await db.depense.findUnique({ where: { id }, include: depenseDetailInclude });
    if (!d || d.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Dépense introuvable.");
    const params = await chargerParametresDepenses(db, ctx.coproprieteId);
    return {
      ...d,
      niveau_approbation_requis: niveauApprobationRequis(params.seuilApprobationConseil, d.montantTtc),
      seuil_non_configure: params.seuilApprobationConseil === null,
    };
  });
}

/** GET /depenses/{id}/documents — URLs signées 15 min des factures et de la preuve de paiement. */
export async function documentsDepense(ctx: TenantContext, id: string) {
  if (can("depenses.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à consulter les dépenses.");
  return withTenant(ctx, async (db) => {
    const d = await db.depense.findUnique({
      where: { id },
      include: { factures: { include: { document: true } }, justificatifPaiementDocument: true },
    });
    if (!d || d.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Dépense introuvable.");
    const factures = await urlsSigneesDocuments(d.factures.map((f) => f.document));
    const justificatif = d.justificatifPaiementDocument ? (await urlsSigneesDocuments([d.justificatifPaiementDocument]))[0]! : null;
    return {
      factures: d.factures.map((f, i) => ({ facture_id: f.id, numero: f.numero, statut: f.statut, ...factures[i]! })),
      justificatif_paiement: justificatif,
    };
  });
}

// ── Création / modification ───────────────────────────────────────────────────

export async function creerDepense(ctx: TenantContext, input: DepenseCreateInput) {
  if (can("depenses.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic crée une dépense (Doc A §8).");
  return withTenant(ctx, async (db) => {
    await verifierReferences(db, ctx, input);
    const budget = await resoudreBudget(db, ctx, input);
    const depense = await db.depense.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        budgetAgId: budget.budgetAgId,
        budgetPosteId: budget.budgetPosteId,
        prestataireId: input.prestataire_id ?? null,
        categorie: input.categorie,
        libelle: input.libelle,
        description: input.description ?? null,
        montantHt: input.montant_ht ? money(input.montant_ht).toString() : null,
        tva: input.tva ? money(input.tva).toString() : null,
        montantTtc: money(input.montant_ttc).toString(),
        dateDepense: dateUtc(input.date_depense),
        source: input.source,
        incidentId: input.incident_id ?? null,
        resolutionAgId: input.resolution_ag_id ?? null,
        creeParId: ctx.utilisateurId,
        statut: "BROUILLON",
      },
      include: depenseInclude,
    });
    await journal(db, ctx, depense.id, "CREEE", { montant_ttc: toApiString(depense.montantTtc), source: depense.source });
    await audit(db, ctx, "DEPENSE_CREEE", depense.id, undefined, { libelle: depense.libelle, montant_ttc: toApiString(depense.montantTtc), categorie: depense.categorie, source: depense.source });
    return depense;
  });
}

export async function modifierDepense(ctx: TenantContext, id: string, input: DepenseUpdateInput) {
  if (can("depenses.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic modifie une dépense.");
  return withTenant(ctx, async (db) => {
    const avant = await chargerDepense(db, ctx, id);
    if (avant.statut !== "BROUILLON" && avant.statut !== "REJETEE") {
      throw new DepenseError("DEPENSE_STATUT_INVALIDE", `Une dépense ${avant.statut} ne se modifie pas : seuls BROUILLON et REJETEE sont éditables (une dépense payée se corrige par une nouvelle dépense).`);
    }
    await verifierReferences(db, ctx, input);
    const categorie = input.categorie ?? avant.categorie;
    const budget = await resoudreBudget(db, ctx, { ...input, categorie, date_depense: input.date_depense ?? isoDate(avant.dateDepense) }, avant);
    // Montants : HT/TVA arrivent ensemble (schéma) ; TTC seul autorisé (efface HT/TVA si incohérents).
    const montantTtc = input.montant_ttc !== undefined ? money(input.montant_ttc) : money(avant.montantTtc);
    let montantHt = input.montant_ht !== undefined ? (input.montant_ht ? money(input.montant_ht) : null) : avant.montantHt ? money(avant.montantHt) : null;
    let tva = input.tva !== undefined ? (input.tva ? money(input.tva) : null) : avant.tva ? money(avant.tva) : null;
    if (montantHt && tva && !montantHt.plus(tva).equals(montantTtc)) {
      if (input.montant_ttc !== undefined && input.montant_ht === undefined) {
        montantHt = null;
        tva = null;
      } else {
        throw new DepenseError("UNPROCESSABLE_ENTITY", "montant_ttc doit être égal à montant_ht + tva.");
      }
    }
    const apres = await db.depense.update({
      where: { id },
      data: {
        categorie,
        budgetAgId: budget.budgetAgId,
        budgetPosteId: budget.budgetPosteId,
        ...(input.libelle !== undefined ? { libelle: input.libelle } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.prestataire_id !== undefined ? { prestataireId: input.prestataire_id ?? null } : {}),
        ...(input.incident_id !== undefined ? { incidentId: input.incident_id ?? null } : {}),
        ...(input.resolution_ag_id !== undefined ? { resolutionAgId: input.resolution_ag_id ?? null } : {}),
        ...(input.date_depense !== undefined ? { dateDepense: dateUtc(input.date_depense) } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        montantTtc: montantTtc.toString(),
        montantHt: montantHt ? montantHt.toString() : null,
        tva: tva ? tva.toString() : null,
      },
      include: depenseInclude,
    });
    const diff = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    await journal(db, ctx, id, "MODIFIEE", { champs: Object.keys(diff) });
    await audit(db, ctx, "DEPENSE_MODIFIEE", id, { libelle: avant.libelle, montant_ttc: toApiString(avant.montantTtc), source: avant.source, budget_poste_id: avant.budgetPosteId }, { libelle: apres.libelle, montant_ttc: toApiString(apres.montantTtc), source: apres.source, budget_poste_id: apres.budgetPosteId });
    return apres;
  });
}

// ── Workflow d'approbation ────────────────────────────────────────────────────

export async function soumettreDepense(ctx: TenantContext, id: string, cle?: string) {
  if (can("depenses.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic soumet une dépense.");
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /depenses/${id}/soumettre`, payload: { id } }, async (db) => {
    const avant = await chargerDepense(db, ctx, id);
    if (avant.statut !== "BROUILLON" && avant.statut !== "REJETEE") {
      throw new DepenseError("DEPENSE_STATUT_INVALIDE", `Seule une dépense BROUILLON ou REJETEE peut être soumise (statut actuel : ${avant.statut}).`);
    }
    const params = await chargerParametresDepenses(db, ctx.coproprieteId);
    assertReserveJustifiee(avant, params);
    const niveau = niveauApprobationRequis(params.seuilApprobationConseil, avant.montantTtc);
    const seuilConfigure = params.seuilApprobationConseil !== null;
    // Sous un seuil CONFIGURÉ, le syndic approuve d'office en soumettant ; seuil non configuré →
    // approbation explicite (deux temps) pour que le rapport puisse signaler l'absence de seuil.
    const directe = niveau === "SYNDIC" && seuilConfigure && (ctx.role === "SYNDIC" || ctx.role === "SUPER_ADMIN");
    const apres = await db.depense.update({
      where: { id },
      data: directe
        ? { statut: "APPROUVEE", approuveParId: ctx.utilisateurId, approuveLe: new Date(), motifRejet: null }
        : { statut: "A_APPROUVER", motifRejet: null },
      include: depenseInclude,
    });
    await journal(db, ctx, id, "SOUMISE", { niveau, seuil: params.seuilApprobationConseil ? toApiString(params.seuilApprobationConseil) : null, seuil_configure: seuilConfigure });
    if (directe) await journal(db, ctx, id, "APPROUVEE", { automatique_sous_seuil: true });
    await audit(db, ctx, "DEPENSE_SOUMISE", id, { statut: avant.statut }, { statut: apres.statut, niveau, seuil_configure: seuilConfigure });
    if (directe) await audit(db, ctx, "DEPENSE_APPROUVEE", id, { statut: "BROUILLON" }, { statut: "APPROUVEE", sous_seuil: true });
    if (!directe && niveau === "CONSEIL") {
      await notifierRoles(db, ctx, ["CONSEIL_SYNDICAL"], "DEPENSE_A_APPROUVER", { depense_id: id, libelle: apres.libelle, montant: toApiString(apres.montantTtc) });
    }
    return { ...apres, niveau_approbation_requis: niveau, seuil_non_configure: !seuilConfigure };
  });
}

function assertPeutDecider(ctx: TenantContext, niveau: NiveauApprobation) {
  const permission = can("depenses.approuver", ctx.role);
  if (permission === false) throw new PermissionRefuseeError("Rôle non autorisé à approuver ou rejeter une dépense.");
  // "scoped" (syndic) : seulement sous le seuil — au-dessus, la décision appartient au conseil (Doc A §8.3).
  if (permission === "scoped" && niveau === "CONSEIL") {
    throw new DepenseError("DEPENSE_APPROBATION_CONSEIL_REQUISE", "Cette dépense dépasse le seuil d'approbation : la décision appartient au conseil syndical.");
  }
}

export async function approuverDepense(ctx: TenantContext, id: string, cle?: string) {
  if (can("depenses.approuver", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé à approuver une dépense.");
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /depenses/${id}/approuver`, payload: { id } }, async (db) => {
    const avant = await chargerDepense(db, ctx, id);
    if (avant.statut !== "A_APPROUVER") throw new DepenseError("DEPENSE_STATUT_INVALIDE", `Seule une dépense A_APPROUVER peut être approuvée (statut actuel : ${avant.statut}).`);
    const params = await chargerParametresDepenses(db, ctx.coproprieteId);
    const niveau = niveauApprobationRequis(params.seuilApprobationConseil, avant.montantTtc);
    assertPeutDecider(ctx, niveau);
    const apres = await db.depense.update({ where: { id }, data: { statut: "APPROUVEE", approuveParId: ctx.utilisateurId, approuveLe: new Date(), motifRejet: null }, include: depenseInclude });
    await journal(db, ctx, id, "APPROUVEE", { niveau });
    await audit(db, ctx, "DEPENSE_APPROUVEE", id, { statut: "A_APPROUVER" }, { statut: "APPROUVEE", niveau });
    await notifierUtilisateur(db, ctx, avant.creeParId, "DEPENSE_APPROUVEE", { depense_id: id, libelle: apres.libelle, montant: toApiString(apres.montantTtc) });
    return apres;
  });
}

export async function rejeterDepense(ctx: TenantContext, id: string, input: DepenseRejeterInput, cle?: string) {
  if (can("depenses.approuver", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé à rejeter une dépense.");
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /depenses/${id}/rejeter`, payload: { id, ...input } }, async (db) => {
    const avant = await chargerDepense(db, ctx, id);
    if (avant.statut !== "A_APPROUVER") throw new DepenseError("DEPENSE_STATUT_INVALIDE", `Seule une dépense A_APPROUVER peut être rejetée (statut actuel : ${avant.statut}).`);
    const params = await chargerParametresDepenses(db, ctx.coproprieteId);
    const niveau = niveauApprobationRequis(params.seuilApprobationConseil, avant.montantTtc);
    assertPeutDecider(ctx, niveau);
    const apres = await db.depense.update({ where: { id }, data: { statut: "REJETEE", motifRejet: input.motif }, include: depenseInclude });
    await journal(db, ctx, id, "REJETEE", { motif: input.motif, niveau });
    await audit(db, ctx, "DEPENSE_REJETEE", id, { statut: "A_APPROUVER" }, { statut: "REJETEE", motif: input.motif });
    await notifierUtilisateur(db, ctx, avant.creeParId, "DEPENSE_REJETEE", { depense_id: id, libelle: apres.libelle, montant: toApiString(apres.montantTtc), motif: input.motif });
    return apres;
  });
}

// ── Paiement ──────────────────────────────────────────────────────────────────

/** Solde de la réserve = Σ mouvements (jamais un champ stocké — Master Spec 6.5). */
export async function soldeFondsReserve(db: TenantDb, coproprieteId: string) {
  const fonds = await db.fondsReserve.findUnique({ where: { coproprieteId }, select: { id: true } });
  if (!fonds) return { fondsReserveId: null, solde: money(0) };
  const agg = await db.fondsReserveMouvement.aggregate({ where: { fondsReserveId: fonds.id }, _sum: { montant: true } });
  return { fondsReserveId: fonds.id, solde: money(agg._sum.montant ?? 0) };
}

export async function payerDepense(ctx: TenantContext, id: string, input: DepensePayerInput, cle?: string) {
  if (can("depenses.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic paie une dépense (le conseil contrôle, il ne paie pas — Doc A §8).");
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /depenses/${id}/payer`, payload: { id, ...input } }, async (db) => {
    const avant = await chargerDepense(db, ctx, id);
    if (avant.statut !== "APPROUVEE") throw new DepenseError("DEPENSE_STATUT_INVALIDE", `Seule une dépense APPROUVEE peut être payée (statut actuel : ${avant.statut}).`);
    const params = await chargerParametresDepenses(db, ctx.coproprieteId);
    assertReserveJustifiee(avant, params);

    // Réserve : le mouvement DEPENSE part dans la MÊME transaction que le passage en PAYEE ; le solde
    // ne peut jamais devenir négatif (422 ici, trigger en base pour la concurrence).
    let mouvementId: string | null = null;
    if (avant.source === "FONDS_RESERVE") {
      let { fondsReserveId, solde } = await soldeFondsReserve(db, ctx.coproprieteId);
      if (!fondsReserveId) {
        const fonds = await db.fondsReserve.create({ data: { coproprieteId: ctx.coproprieteId } });
        fondsReserveId = fonds.id;
        solde = money(0);
      }
      if (solde.lessThan(money(avant.montantTtc))) {
        throw new DepenseError("FONDS_RESERVE_INSUFFISANT", `Solde du fonds de réserve insuffisant : ${toApiString(solde)} MAD disponibles pour ${toApiString(avant.montantTtc)} MAD.`);
      }
      const mouvement = await db.fondsReserveMouvement.create({
        data: {
          fondsReserveId,
          type: "DEPENSE",
          montant: money(avant.montantTtc).negated().toString(),
          resolutionAgId: avant.resolutionAgId,
          depenseId: id,
          description: avant.libelle,
        },
      });
      mouvementId = mouvement.id;
    }

    // Preuve du paiement sortant (reçu de virement, photo du chèque) → Document JUSTIFICATIF_DEPENSE,
    // visible du conseil (contrôle) et du syndic. Rapprochement bancaire manuel : aucune API bancaire.
    let justificatifId: string | null = null;
    if (input.justificatif) {
      const doc = await attacherDocument(db, ctx, { module: "depenses", type: "JUSTIFICATIF_DEPENSE", nom: input.justificatif.nom, storagePath: input.justificatif.storage_path, visibilite: "CONSEIL_SYNDICAL" });
      justificatifId = doc.id;
    }

    // Les factures de la dépense (hors CONTESTEE) sont réglées par ce paiement.
    await db.facture.updateMany({ where: { depenseId: id, statut: { in: ["RECUE", "VERIFIEE"] } }, data: { statut: "REGLEE" } });
    const apres = await db.depense.update({
      where: { id },
      data: {
        statut: "PAYEE",
        payeLe: dateUtc(input.date_paiement),
        methodePaiement: input.methode,
        referencePaiement: input.reference ?? null,
        justificatifPaiementDocumentId: justificatifId,
      },
      include: depenseDetailInclude,
    });
    await journal(db, ctx, id, "PAYEE", { methode: input.methode, reference: input.reference ?? null, date_paiement: input.date_paiement, source: avant.source, justificatif_document_id: justificatifId, mouvement_reserve_id: mouvementId });
    await audit(db, ctx, "DEPENSE_PAYEE", id, { statut: "APPROUVEE" }, { statut: "PAYEE", methode: input.methode, reference: input.reference ?? null, montant_ttc: toApiString(avant.montantTtc), source: avant.source, mouvement_reserve_id: mouvementId });
    return apres;
  });
}

export async function annulerDepense(ctx: TenantContext, id: string, input: DepenseAnnulerInput, cle?: string) {
  if (can("depenses.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic annule une dépense.");
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /depenses/${id}/annuler`, payload: { id, ...input } }, async (db) => {
    const avant = await chargerDepense(db, ctx, id);
    if (avant.statut === "PAYEE" || avant.statut === "ANNULEE") {
      throw new DepenseError("DEPENSE_STATUT_INVALIDE", `Une dépense ${avant.statut} ne s'annule pas (une dépense payée se corrige par une nouvelle dépense).`);
    }
    const apres = await db.depense.update({ where: { id }, data: { statut: "ANNULEE" }, include: depenseInclude });
    await journal(db, ctx, id, "ANNULEE", { motif: input.motif ?? null, statut_avant: avant.statut });
    await audit(db, ctx, "DEPENSE_ANNULEE", id, { statut: avant.statut }, { statut: "ANNULEE", motif: input.motif ?? null });
    return apres;
  });
}

// ── Factures ──────────────────────────────────────────────────────────────────

export async function ajouterFacture(ctx: TenantContext, depenseId: string, input: FactureCreateInput, cle?: string) {
  if (can("depenses.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic ajoute une facture.");
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /depenses/${depenseId}/factures`, payload: { depenseId, ...input } }, async (db) => {
    const depense = await chargerDepense(db, ctx, depenseId);
    if (depense.statut === "ANNULEE") throw new DepenseError("DEPENSE_STATUT_INVALIDE", "Impossible d'ajouter une facture à une dépense annulée.");
    if (input.prestataire_id) await verifierReferences(db, ctx, { prestataire_id: input.prestataire_id });
    const document = await attacherDocument(db, ctx, { module: "depenses", type: "FACTURE", nom: input.document.nom, storagePath: input.document.storage_path, visibilite: "CONSEIL_SYNDICAL" });
    const facture = await db.facture.create({
      data: {
        depenseId,
        prestataireId: input.prestataire_id ?? depense.prestataireId,
        numero: input.numero ?? null,
        dateFacture: dateUtc(input.date_facture),
        dateEcheance: input.date_echeance ? dateUtc(input.date_echeance) : null,
        montantTtc: money(input.montant_ttc).toString(),
        // Une dépense déjà payée : la facture arrivée après coup est réglée.
        statut: depense.statut === "PAYEE" ? "REGLEE" : "RECUE",
        documentId: document.id,
      },
      include: { document: { select: { id: true, nom: true, type: true } } },
    });
    await journal(db, ctx, depenseId, "FACTURE_AJOUTEE", { facture_id: facture.id, numero: facture.numero, montant_ttc: toApiString(facture.montantTtc) });
    await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId, action: "FACTURE_AJOUTEE", entite: "facture", entiteId: facture.id, apres: { depense_id: depenseId, numero: facture.numero, montant_ttc: toApiString(facture.montantTtc) } });
    return facture;
  });
}

export async function modifierStatutFacture(ctx: TenantContext, depenseId: string, factureId: string, input: FactureUpdateInput) {
  if (can("depenses.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic modifie une facture.");
  return withTenant(ctx, async (db) => {
    await chargerDepense(db, ctx, depenseId);
    const avant = await db.facture.findUnique({ where: { id: factureId } });
    if (!avant || avant.depenseId !== depenseId) throw new IntrouvableError("Facture introuvable.");
    const apres = await db.facture.update({ where: { id: factureId }, data: { statut: input.statut }, include: { document: { select: { id: true, nom: true, type: true } } } });
    if (input.statut === "CONTESTEE") await journal(db, ctx, depenseId, "FACTURE_CONTESTEE", { facture_id: factureId, numero: avant.numero });
    await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId, action: "FACTURE_STATUT_MODIFIE", entite: "facture", entiteId: factureId, avant: { statut: avant.statut }, apres: { statut: apres.statut } });
    return apres;
  });
}

export async function preparerUploadDepense(ctx: TenantContext, input: DepenseUploadUrlInput) {
  if (can("depenses.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic téléverse une facture ou une preuve de paiement.");
  return preparerUploadModule(ctx, "depenses", input.nom_fichier);
}

// ── Incident → dépense ────────────────────────────────────────────────────────

/** Catégorie d'incident (Doc A §5.1) → catégorie de dépense (Doc A §3.5). */
export const CATEGORIE_INCIDENT_VERS_DEPENSE: Record<string, DepenseCreateInput["categorie"]> = {
  PLOMBERIE: "REPARATIONS",
  ELECTRICITE: "REPARATIONS",
  ASCENSEUR: "REPARATIONS",
  STRUCTURE: "TRAVAUX",
  EQUIPEMENTS_COLLECTIFS: "REPARATIONS",
  NETTOYAGE: "ENTRETIEN_COURANT",
  JARDINS_ESPACES_VERTS: "ENTRETIEN_COURANT",
  SECURITE: "ENTRETIEN_COURANT",
  PARKING: "ENTRETIEN_COURANT",
  NUISANCES: "AUTRE",
  ADMINISTRATIF: "ADMINISTRATIF",
};

/**
 * POST /incidents/{id}/depense — BROUILLON pré-rempli depuis l'incident : prestataire assigné,
 * catégorie mappée, libellé = sous-catégorie, description. Le syndic complète et soumet ensuite.
 */
export async function creerDepenseDepuisIncident(ctx: TenantContext, incidentId: string, input: IncidentDepenseCreateInput) {
  if (can("depenses.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic crée une dépense depuis un incident.");
  const incident = await withTenant(ctx, (db) => db.incident.findUnique({ where: { id: incidentId }, select: { id: true, coproprieteId: true, categorie: true, sousCategorie: true, description: true, assigneAId: true, creeLe: true } }));
  if (!incident || incident.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Incident introuvable.");
  const categorie = CATEGORIE_INCIDENT_VERS_DEPENSE[incident.categorie] ?? "AUTRE";
  return creerDepense(ctx, {
    categorie,
    libelle: input.libelle ?? `${incident.sousCategorie} (incident)`,
    description: input.description ?? incident.description ?? null,
    montant_ht: input.montant_ht ?? null,
    tva: input.tva ?? null,
    montant_ttc: input.montant_ttc,
    date_depense: input.date_depense ?? isoDate(new Date()),
    source: input.source,
    budget_poste_id: input.budget_poste_id ?? null,
    prestataire_id: incident.assigneAId,
    incident_id: incident.id,
    resolution_ag_id: null,
  });
}

export { CheminHorsPerimetreError };
