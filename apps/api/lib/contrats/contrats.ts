/**
 * Service Contrats, assurances, échéances — M19 (Doc A §7 ascenseur / nettoyage / gardiennage /
 * jardins, §8 assurance de l'immeuble et responsabilité du syndic, §5 interventions).
 *
 * Cycle de vie : BROUILLON → ACTIF ⇄ SUSPENDU → RESILIE (motif) ; ACTIF → EXPIRE (job). L'activation
 * d'un contrat dont le montant de période dépasse `copropriete.seuil_contrat_ag` exige une
 * résolution d'AG ADOPTEE (paramètre nullable, PROVISOIRE — brief §10 : non configuré = aucun contrôle).
 * L'échéancier (PAIEMENT selon la périodicité, RENOUVELLEMENT à date_fin − préavis) est matérialisé
 * 12 mois à l'avance, de façon idempotente (contrainte unique contrat/type/date). Une échéance de
 * paiement génère une dépense BROUILLON (M16, même transaction, Idempotency-Key). Les assurances sont
 * des contrats ASSURANCE_* avec `details_assurance_json` + attestation. Journal `contrat_log`
 * append-only + audit_log ; les montants passent par lib/money.
 */
import { Prisma } from "@prisma/client";
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import { withTenantIdempotent } from "../http/idempotency";
import type { ErrorCode } from "../http/respond";
import { money, toApiString } from "../money";
import type { Pagination, Tri } from "../http/pagination";
import { journaliserExport, type CelluleCsv, type FormatExport } from "../http/export";
import { assertCheminDansPerimetre, attacherDocument, preparerUploadModule, urlsSigneesDocuments, CheminHorsPerimetreError } from "../documents/attach";
import { creerDepenseDb } from "../depenses/depenses";
import type { CategorieDepense } from "../depenses/schemas";
import { ajouterJours, ajouterMois, calculerEcheances, dateUtc, dureeEnMois, isoDate, jourUtc } from "./echeancier";
import { estAssurance, type ContratCreateInput, type ContratResilierInput, type ContratSuspendreInput, type ContratUpdateInput, type ContratUploadUrlInput, type ContratsFiltres, type EcheanceCreateInput, type EcheanceUpdateInput, type GenererDepenseInput, type TRIS_CONTRAT } from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
export class ContratError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}
export { CheminHorsPerimetreError };

export const HORIZON_MOIS_DEFAUT = 12;

/** Catégorie de dépense proposée pour une échéance de paiement, selon le type de contrat. */
export const CATEGORIE_CONTRAT_VERS_DEPENSE: Record<string, CategorieDepense> = {
  ASSURANCE_IMMEUBLE: "ASSURANCE",
  ASSURANCE_RC: "ASSURANCE",
  ASCENSEUR: "ENTRETIEN_COURANT",
  NETTOYAGE: "ENTRETIEN_COURANT",
  GARDIENNAGE: "PERSONNEL",
  JARDINAGE: "ENTRETIEN_COURANT",
  DERATISATION: "ENTRETIEN_COURANT",
  EAU: "ENERGIE_EAU",
  ELECTRICITE: "ENERGIE_EAU",
  INTERNET: "ADMINISTRATIF",
  SYNDIC_PROFESSIONNEL: "HONORAIRES_SYNDIC",
  TRAVAUX: "TRAVAUX",
  AUTRE: "AUTRE",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

type TypeLog = "CREE" | "MODIFIE" | "ACTIVE" | "SUSPENDU" | "RESILIE" | "EXPIRE" | "RECONDUIT" | "ECHEANCES_GENEREES" | "DEPENSE_GENEREE" | "ECHEANCE_MODIFIEE" | "DOCUMENT_AJOUTE";

export async function journal(db: TenantDb, ctx: { coproprieteId: string; utilisateurId: string | null }, contratId: string, type: TypeLog, details?: Record<string, unknown>) {
  await db.contratLog.createMany({ data: [{ coproprieteId: ctx.coproprieteId, contratId, type, acteurId: ctx.utilisateurId, detailsJson: (details ?? Prisma.DbNull) as Prisma.InputJsonValue }] });
}

async function audit(db: TenantDb, ctx: TenantContext, action: string, contratId: string, avant?: unknown, apres?: unknown) {
  await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId, action, entite: "contrat", entiteId: contratId, avant: avant as Prisma.InputJsonValue, apres: apres as Prisma.InputJsonValue });
}

export async function notifierRoles(db: TenantDb, coproprieteId: string, roles: ("SYNDIC" | "CONSEIL_SYNDICAL")[], templateCode: string, contenu: Record<string, unknown>, exclure?: string) {
  const destinataires = await db.roleUtilisateur.findMany({ where: { coproprieteId, actif: true, role: { in: roles } }, select: { utilisateurId: true }, distinct: ["utilisateurId"] });
  await Promise.all(destinataires.filter((d) => d.utilisateurId !== exclure).map((d) => envoyerNotification(db, { coproprieteId, utilisateurId: d.utilisateurId, templateCode, canal: "PUSH", contenuJson: contenu as Prisma.InputJsonValue })));
}

const contratInclude = {
  prestataire: { select: { id: true, nom: true, specialite: true, telephone: true, email: true } },
  budgetPoste: { select: { id: true, libelle: true, categorie: true } },
  resolutionAg: { select: { id: true, texte: true, resultat: true, agId: true } },
  document: { select: { id: true, nom: true, type: true, storagePath: true } },
  attestationDocument: { select: { id: true, nom: true, type: true, storagePath: true } },
  creePar: { select: { id: true, nom: true, prenom: true } },
  _count: { select: { echeances: true, depenses: true } },
} satisfies Prisma.ContratInclude;

const contratDetailInclude = {
  ...contratInclude,
  echeances: { orderBy: { dateEcheance: "asc" }, include: { depense: { select: { id: true, libelle: true, statut: true, montantTtc: true } } } },
  depenses: { orderBy: { dateDepense: "desc" }, take: 50, select: { id: true, libelle: true, statut: true, montantTtc: true, dateDepense: true } },
  logs: { orderBy: { horodatage: "asc" }, include: { acteur: { select: { id: true, nom: true, prenom: true } } } },
} satisfies Prisma.ContratInclude;

type ContratRow = Prisma.ContratGetPayload<{ include: typeof contratInclude }>;

function presenter<T extends ContratRow>(c: T, aujourdhui = jourUtc(new Date())) {
  const { document, attestationDocument, ...reste } = c;
  const joursAvantFin = c.dateFin ? Math.round((jourUtc(c.dateFin).getTime() - aujourdhui.getTime()) / 86_400_000) : null;
  return {
    ...reste,
    montantPeriode: c.montantPeriode ? toApiString(c.montantPeriode) : null,
    document: document ? { id: document.id, nom: document.nom, type: document.type } : null,
    attestationDocument: attestationDocument ? { id: attestationDocument.id, nom: attestationDocument.nom, type: attestationDocument.type } : null,
    jours_avant_fin: joursAvantFin,
    a_renouveler: c.statut === "ACTIF" && joursAvantFin !== null && joursAvantFin <= 90,
    est_assurance: estAssurance(c.type),
  };
}

async function chargerContrat(db: TenantDb, ctx: TenantContext, id: string) {
  const c = await db.contrat.findUnique({ where: { id }, include: contratInclude });
  if (!c || c.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Contrat introuvable.");
  return c;
}

async function verifierReferences(db: TenantDb, ctx: TenantContext, input: { prestataire_id?: string | null; budget_poste_id?: string | null; resolution_ag_id?: string | null }) {
  if (input.prestataire_id) {
    const p = await db.prestataire.findUnique({ where: { id: input.prestataire_id }, select: { coproprieteId: true } });
    if (!p || p.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Prestataire introuvable.");
  }
  if (input.budget_poste_id) {
    const poste = await db.budgetPoste.findUnique({ where: { id: input.budget_poste_id }, select: { budgetAg: { select: { coproprieteId: true } } } });
    if (!poste || poste.budgetAg.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Poste budgétaire introuvable.");
  }
  if (input.resolution_ag_id) {
    const r = await db.agResolution.findUnique({ where: { id: input.resolution_ag_id }, select: { resultat: true, ag: { select: { coproprieteId: true } } } });
    if (!r || r.ag.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Résolution d'AG introuvable.");
    if (r.resultat !== "ADOPTEE") throw new ContratError("UNPROCESSABLE_ENTITY", "La résolution d'AG liée doit être ADOPTEE.");
  }
}

async function attacherPieces(db: TenantDb, ctx: TenantContext, contratId: string, input: { document?: { storage_path: string; nom: string } | null; attestation?: { storage_path: string; nom: string } | null }) {
  const data: Prisma.ContratUncheckedUpdateInput = {};
  if (input.document) {
    assertCheminDansPerimetre(ctx, "contrats", input.document.storage_path);
    const doc = await attacherDocument(db, ctx, { module: "contrats", type: "CONTRAT", nom: input.document.nom, storagePath: input.document.storage_path, visibilite: "SYNDIC_ONLY" });
    data.documentId = doc.id;
    await journal(db, ctx, contratId, "DOCUMENT_AJOUTE", { document_id: doc.id, type: "CONTRAT" });
  }
  if (input.attestation) {
    assertCheminDansPerimetre(ctx, "contrats", input.attestation.storage_path);
    const doc = await attacherDocument(db, ctx, { module: "contrats", type: "ATTESTATION_ASSURANCE", nom: input.attestation.nom, storagePath: input.attestation.storage_path, visibilite: "CONSEIL_SYNDICAL" });
    data.attestationDocumentId = doc.id;
    await journal(db, ctx, contratId, "DOCUMENT_AJOUTE", { document_id: doc.id, type: "ATTESTATION_ASSURANCE" });
  }
  if (Object.keys(data).length) await db.contrat.update({ where: { id: contratId }, data });
}

function assertPeutGerer(ctx: TenantContext) {
  if (can("contrats.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic gère les contrats (Doc A §8).");
}
function assertPeutLire(ctx: TenantContext) {
  if (can("contrats.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à consulter les contrats.");
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function preparerUploadContrat(ctx: TenantContext, input: ContratUploadUrlInput) {
  assertPeutGerer(ctx);
  return preparerUploadModule(ctx, "contrats", input.nom_fichier);
}

export async function creerContrat(ctx: TenantContext, input: ContratCreateInput) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    await verifierReferences(db, ctx, input);
    const c = await db.contrat.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        prestataireId: input.prestataire_id ?? null,
        type: input.type,
        libelle: input.libelle,
        reference: input.reference ?? null,
        dateDebut: dateUtc(input.date_debut),
        dateFin: input.date_fin ? dateUtc(input.date_fin) : null,
        tacite: input.tacite ?? false,
        preavisJours: input.preavis_jours ?? null,
        periodicite: input.periodicite,
        montantPeriode: input.montant_periode ? money(input.montant_periode).toString() : null,
        budgetPosteId: input.budget_poste_id ?? null,
        resolutionAgId: input.resolution_ag_id ?? null,
        notes: input.notes ?? null,
        detailsAssuranceJson: estAssurance(input.type) && input.details_assurance ? (input.details_assurance as Prisma.InputJsonValue) : Prisma.DbNull,
        creeParId: ctx.utilisateurId,
        statut: "BROUILLON",
      },
    });
    await attacherPieces(db, ctx, c.id, input);
    await journal(db, ctx, c.id, "CREE", { type: c.type, libelle: c.libelle, periodicite: c.periodicite, montant_periode: c.montantPeriode ? toApiString(c.montantPeriode) : null });
    await audit(db, ctx, "CONTRAT_CREE", c.id, undefined, { type: c.type, libelle: c.libelle, prestataire_id: c.prestataireId, montant_periode: c.montantPeriode ? toApiString(c.montantPeriode) : null });
    return presenter(await chargerContrat(db, ctx, c.id));
  });
}

export async function modifierContrat(ctx: TenantContext, id: string, input: ContratUpdateInput) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const avant = await chargerContrat(db, ctx, id);
    if (avant.statut === "RESILIE" || avant.statut === "EXPIRE") throw new ContratError("CONTRAT_STATUT_INVALIDE", `Un contrat ${avant.statut} ne se modifie plus (créez un nouveau contrat).`);
    await verifierReferences(db, ctx, input);
    const type = input.type ?? avant.type;
    const dateDebut = input.date_debut ? dateUtc(input.date_debut) : avant.dateDebut;
    const dateFin = input.date_fin === undefined ? avant.dateFin : input.date_fin ? dateUtc(input.date_fin) : null;
    if (dateFin && dateFin < dateDebut) throw new ContratError("UNPROCESSABLE_ENTITY", "La date de fin doit être postérieure ou égale à la date de début.");
    const data: Prisma.ContratUncheckedUpdateInput = {
      type,
      libelle: input.libelle ?? avant.libelle,
      dateDebut,
      dateFin,
      periodicite: input.periodicite ?? avant.periodicite,
      ...(input.prestataire_id !== undefined ? { prestataireId: input.prestataire_id } : {}),
      ...(input.reference !== undefined ? { reference: input.reference } : {}),
      ...(input.tacite !== undefined ? { tacite: input.tacite } : {}),
      ...(input.preavis_jours !== undefined ? { preavisJours: input.preavis_jours } : {}),
      ...(input.montant_periode !== undefined ? { montantPeriode: input.montant_periode ? money(input.montant_periode).toString() : null } : {}),
      ...(input.budget_poste_id !== undefined ? { budgetPosteId: input.budget_poste_id } : {}),
      ...(input.resolution_ag_id !== undefined ? { resolutionAgId: input.resolution_ag_id } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.details_assurance !== undefined ? { detailsAssuranceJson: input.details_assurance && estAssurance(type) ? (input.details_assurance as Prisma.InputJsonValue) : Prisma.DbNull } : {}),
    };
    if (!estAssurance(type)) data.detailsAssuranceJson = Prisma.DbNull;
    await db.contrat.update({ where: { id }, data });
    await attacherPieces(db, ctx, id, input);
    const apres = await chargerContrat(db, ctx, id);
    const champs = Object.keys(input).filter((k) => (input as Record<string, unknown>)[k] !== undefined);
    await journal(db, ctx, id, "MODIFIE", { champs });
    await audit(db, ctx, "CONTRAT_MODIFIE", id, { libelle: avant.libelle, date_fin: avant.dateFin ? isoDate(avant.dateFin) : null, montant_periode: avant.montantPeriode ? toApiString(avant.montantPeriode) : null }, { libelle: apres.libelle, date_fin: apres.dateFin ? isoDate(apres.dateFin) : null, montant_periode: apres.montantPeriode ? toApiString(apres.montantPeriode) : null, champs });
    // Échéancier déjà généré et dates / périodicité / montant modifiés → régénération (les échéances
    // A_VENIR non liées à une dépense sont recalculées, les autres conservées).
    if (apres.statut === "ACTIF" && (input.date_debut || input.date_fin !== undefined || input.periodicite || input.montant_periode !== undefined || input.preavis_jours !== undefined)) {
      await regenererEcheances(db, ctx, apres, HORIZON_MOIS_DEFAUT);
    }
    return presenter(await chargerContrat(db, ctx, id));
  });
}

export async function obtenirContrat(ctx: TenantContext, id: string) {
  assertPeutLire(ctx);
  return withTenant(ctx, async (db) => {
    const c = await db.contrat.findUnique({ where: { id }, include: contratDetailInclude });
    if (!c || c.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Contrat introuvable.");
    const docs = await urlsSigneesDocuments([c.document, c.attestationDocument].filter((d): d is NonNullable<typeof d> => d !== null));
    const { echeances, depenses, logs, ...base } = c;
    return {
      ...presenter(base),
      documents: docs,
      echeances: echeances.map(presenterEcheance),
      depenses: depenses.map((d) => ({ ...d, montantTtc: toApiString(d.montantTtc) })),
      logs: logs.map((l) => ({ id: l.id, type: l.type, horodatage: l.horodatage, acteur: l.acteur, details: l.detailsJson })),
    };
  });
}

function whereFiltres(ctx: TenantContext, f: ContratsFiltres): Prisma.ContratWhereInput {
  return {
    coproprieteId: ctx.coproprieteId,
    ...(f.type ? { type: f.type } : {}),
    ...(f.statut ? { statut: f.statut } : {}),
    ...(f.prestataire_id ? { prestataireId: f.prestataire_id } : {}),
    ...(f.q ? { OR: [{ libelle: { contains: f.q, mode: "insensitive" } }, { reference: { contains: f.q, mode: "insensitive" } }, { prestataire: { nom: { contains: f.q, mode: "insensitive" } } }] } : {}),
  };
}

const ORDER_BY: Record<(typeof TRIS_CONTRAT)[number], (s: "asc" | "desc") => Prisma.ContratOrderByWithRelationInput[]> = {
  date_fin: (s) => [{ dateFin: { sort: s, nulls: "last" } }, { libelle: "asc" }],
  date_debut: (s) => [{ dateDebut: s }],
  libelle: (s) => [{ libelle: s }],
  montant_periode: (s) => [{ montantPeriode: { sort: s, nulls: "last" } }],
  statut: (s) => [{ statut: s }, { dateFin: { sort: "asc", nulls: "last" } }],
  cree_le: (s) => [{ creeLe: s }],
};

export async function listerContrats(ctx: TenantContext, filtres: ContratsFiltres, pagination: Pagination, tri: Tri<(typeof TRIS_CONTRAT)[number]>) {
  assertPeutLire(ctx);
  return withTenant(ctx, async (db) => {
    const where = whereFiltres(ctx, filtres);
    const [total, rows, parStatut, assurance] = await Promise.all([
      db.contrat.count({ where }),
      db.contrat.findMany({ where, include: contratInclude, orderBy: ORDER_BY[tri.champ](tri.sens), skip: pagination.skip, take: pagination.take }),
      db.contrat.groupBy({ by: ["statut"], where: { coproprieteId: ctx.coproprieteId }, _count: { _all: true } }),
      etatAssuranceDb(db, ctx.coproprieteId),
    ]);
    return { total, rows: rows.map((r) => presenter(r)), par_statut: Object.fromEntries(parStatut.map((p) => [p.statut, p._count._all])), assurance };
  });
}

export const ENTETES_CONTRATS = ["libelle", "type", "statut", "prestataire", "reference", "date_debut", "date_fin", "tacite", "preavis_jours", "periodicite", "montant_periode", "poste", "nb_echeances", "nb_depenses"];

export async function exporterContrats(ctx: TenantContext, filtres: ContratsFiltres, format: FormatExport): Promise<{ entetes: string[]; lignes: CelluleCsv[][]; nbLignes: number }> {
  if (can("exports.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à exporter les contrats.");
  return withTenant(ctx, async (db) => {
    const rows = await db.contrat.findMany({ where: whereFiltres(ctx, filtres), include: contratInclude, orderBy: [{ type: "asc" }, { libelle: "asc" }] });
    const lignes: CelluleCsv[][] = rows.map((c) => [c.libelle, c.type, c.statut, c.prestataire?.nom ?? "", c.reference ?? "", isoDate(c.dateDebut), c.dateFin ? isoDate(c.dateFin) : "", c.tacite, c.preavisJours, c.periodicite, c.montantPeriode ? toApiString(c.montantPeriode) : "", c.budgetPoste?.libelle ?? "", c._count.echeances, c._count.depenses]);
    await journaliserExport(db, ctx, { type: "CONTRATS", filtres: filtres as Record<string, unknown>, nbLignes: lignes.length, format });
    return { entetes: ENTETES_CONTRATS, lignes, nbLignes: lignes.length };
  });
}

// ── Cycle de vie ─────────────────────────────────────────────────────────────

export async function activerContrat(ctx: TenantContext, id: string, cle?: string) {
  assertPeutGerer(ctx);
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /contrats/${id}/activer`, payload: { id } }, async (db) => {
    const avant = await chargerContrat(db, ctx, id);
    if (avant.statut !== "BROUILLON" && avant.statut !== "SUSPENDU") throw new ContratError("CONTRAT_STATUT_INVALIDE", `Seul un contrat BROUILLON ou SUSPENDU peut être activé (statut actuel : ${avant.statut}).`);
    const copro = await db.copropriete.findUnique({ where: { id: ctx.coproprieteId }, select: { seuilContratAg: true } });
    if (copro?.seuilContratAg && avant.montantPeriode && money(avant.montantPeriode).greaterThan(money(copro.seuilContratAg)) && !avant.resolutionAgId) {
      throw new ContratError("CONTRAT_RESOLUTION_AG_REQUISE", `Le montant de période (${toApiString(avant.montantPeriode)} MAD) dépasse le seuil ${toApiString(copro.seuilContratAg)} MAD : liez une résolution d'AG ADOPTEE avant d'activer (Doc A §8, brief §10).`);
    }
    await db.contrat.update({ where: { id }, data: { statut: "ACTIF" } });
    await journal(db, ctx, id, "ACTIVE", { depuis: avant.statut });
    await audit(db, ctx, "CONTRAT_ACTIVE", id, { statut: avant.statut }, { statut: "ACTIF" });
    // Échéancier des 12 prochains mois — idempotent.
    if (avant.statut === "BROUILLON") await regenererEcheances(db, ctx, avant, HORIZON_MOIS_DEFAUT);
    return presenter(await chargerContrat(db, ctx, id));
  });
}

export async function suspendreContrat(ctx: TenantContext, id: string, input: ContratSuspendreInput, cle?: string) {
  assertPeutGerer(ctx);
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /contrats/${id}/suspendre`, payload: { id, ...input } }, async (db) => {
    const avant = await chargerContrat(db, ctx, id);
    if (avant.statut !== "ACTIF") throw new ContratError("CONTRAT_STATUT_INVALIDE", `Seul un contrat ACTIF peut être suspendu (statut actuel : ${avant.statut}).`);
    await db.contrat.update({ where: { id }, data: { statut: "SUSPENDU" } });
    await journal(db, ctx, id, "SUSPENDU", { motif: input.motif ?? null });
    await audit(db, ctx, "CONTRAT_SUSPENDU", id, { statut: "ACTIF" }, { statut: "SUSPENDU", motif: input.motif ?? null });
    return presenter(await chargerContrat(db, ctx, id));
  });
}

export async function resilierContrat(ctx: TenantContext, id: string, input: ContratResilierInput, cle?: string) {
  assertPeutGerer(ctx);
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /contrats/${id}/resilier`, payload: { id, ...input } }, async (db) => {
    const avant = await chargerContrat(db, ctx, id);
    if (avant.statut !== "ACTIF" && avant.statut !== "SUSPENDU" && avant.statut !== "BROUILLON") throw new ContratError("CONTRAT_STATUT_INVALIDE", `Un contrat ${avant.statut} ne peut pas être résilié.`);
    const dateResiliation = input.date_resiliation ? dateUtc(input.date_resiliation) : jourUtc(new Date());
    await db.contrat.update({ where: { id }, data: { statut: "RESILIE", motifResiliation: input.motif, dateResiliation } });
    // Les échéances futures tombent.
    const annulees = await db.contratEcheance.updateMany({ where: { contratId: id, statut: "A_VENIR", dateEcheance: { gt: dateResiliation } }, data: { statut: "ANNULEE" } });
    await journal(db, ctx, id, "RESILIE", { motif: input.motif, date_resiliation: isoDate(dateResiliation), echeances_annulees: annulees.count });
    await audit(db, ctx, "CONTRAT_RESILIE", id, { statut: avant.statut }, { statut: "RESILIE", motif: input.motif, date_resiliation: isoDate(dateResiliation) });
    return presenter(await chargerContrat(db, ctx, id));
  });
}

// ── Échéances ────────────────────────────────────────────────────────────────

type EcheanceRow = Prisma.ContratEcheanceGetPayload<{ include: { depense: { select: { id: true; libelle: true; statut: true; montantTtc: true } } } }>;
function presenterEcheance(e: EcheanceRow) {
  return { ...e, montant: e.montant ? toApiString(e.montant) : null, depense: e.depense ? { ...e.depense, montantTtc: toApiString(e.depense.montantTtc) } : null };
}

/**
 * Matérialise les échéances manquantes jusqu'à `aujourd'hui + horizon` (idempotent : contrainte unique
 * contrat / type / date, `skipDuplicates`). Les échéances A_VENIR sans dépense qui ne correspondent
 * plus au calcul (dates / périodicité modifiées) sont annulées.
 */
export async function regenererEcheances(db: TenantDb, ctx: { coproprieteId: string; utilisateurId: string | null }, c: { id: string; dateDebut: Date; dateFin: Date | null; periodicite: string; montantPeriode: Prisma.Decimal | null; preavisJours: number | null }, horizonMois: number, now = new Date()) {
  const aujourdhui = jourUtc(now);
  const calcul = calculerEcheances({ dateDebut: c.dateDebut, dateFin: c.dateFin, periodicite: c.periodicite as never, montantPeriode: c.montantPeriode ? toApiString(c.montantPeriode) : null, preavisJours: c.preavisJours, aPartirDe: aujourdhui, horizon: ajouterMois(aujourdhui, horizonMois) });
  const existantes = await db.contratEcheance.findMany({ where: { contratId: c.id }, select: { id: true, type: true, dateEcheance: true, statut: true, depenseId: true } });
  const cle = (t: string, d: Date) => `${t}|${isoDate(d)}`;
  const voulues = new Set(calcul.map((e) => cle(e.type, e.date)));
  // Annuler les A_VENIR calculées automatiquement (PAIEMENT / RENOUVELLEMENT) qui ne sont plus voulues et sont futures.
  const obsoletes = existantes.filter((e) => e.statut === "A_VENIR" && !e.depenseId && (e.type === "PAIEMENT" || e.type === "RENOUVELLEMENT") && jourUtc(e.dateEcheance) >= aujourdhui && !voulues.has(cle(e.type, e.dateEcheance)));
  if (obsoletes.length) await db.contratEcheance.updateMany({ where: { id: { in: obsoletes.map((o) => o.id) } }, data: { statut: "ANNULEE" } });
  const presentes = new Set(existantes.filter((e) => e.statut !== "ANNULEE" || voulues.has(cle(e.type, e.dateEcheance))).map((e) => cle(e.type, e.dateEcheance)));
  // Une échéance ANNULEE qui redevient voulue est réactivée (contrainte unique) plutôt que recréée.
  const reactiver = existantes.filter((e) => e.statut === "ANNULEE" && voulues.has(cle(e.type, e.dateEcheance)));
  if (reactiver.length) await db.contratEcheance.updateMany({ where: { id: { in: reactiver.map((r) => r.id) } }, data: { statut: "A_VENIR" } });
  const aCreer = calcul.filter((e) => !existantes.some((x) => cle(x.type, x.dateEcheance) === cle(e.type, e.date)));
  void presentes;
  if (aCreer.length) {
    await db.contratEcheance.createMany({ data: aCreer.map((e) => ({ contratId: c.id, type: e.type, dateEcheance: e.date, montant: e.montant, statut: "A_VENIR" as const })), skipDuplicates: true });
  }
  await journal(db, ctx, c.id, "ECHEANCES_GENEREES", { creees: aCreer.length, annulees: obsoletes.length, reactivees: reactiver.length, horizon_mois: horizonMois });
  return { creees: aCreer.length, annulees: obsoletes.length, reactivees: reactiver.length };
}

export async function genererEcheances(ctx: TenantContext, id: string, horizonMois = HORIZON_MOIS_DEFAUT) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const c = await chargerContrat(db, ctx, id);
    if (c.statut !== "ACTIF" && c.statut !== "BROUILLON") throw new ContratError("CONTRAT_STATUT_INVALIDE", `Échéancier indisponible pour un contrat ${c.statut}.`);
    const resultat = await regenererEcheances(db, ctx, c, horizonMois);
    const echeances = await db.contratEcheance.findMany({ where: { contratId: id }, orderBy: { dateEcheance: "asc" }, include: { depense: { select: { id: true, libelle: true, statut: true, montantTtc: true } } } });
    return { ...resultat, echeances: echeances.map(presenterEcheance) };
  });
}

export async function listerEcheances(ctx: TenantContext, id: string) {
  assertPeutLire(ctx);
  return withTenant(ctx, async (db) => {
    await chargerContrat(db, ctx, id);
    const rows = await db.contratEcheance.findMany({ where: { contratId: id }, orderBy: { dateEcheance: "asc" }, include: { depense: { select: { id: true, libelle: true, statut: true, montantTtc: true } } } });
    return rows.map(presenterEcheance);
  });
}

/** Échéance manuelle (visite technique, contrôle réglementaire…). */
export async function ajouterEcheance(ctx: TenantContext, id: string, input: EcheanceCreateInput) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const c = await chargerContrat(db, ctx, id);
    if (c.statut === "RESILIE" || c.statut === "EXPIRE") throw new ContratError("CONTRAT_STATUT_INVALIDE", `Aucune échéance sur un contrat ${c.statut}.`);
    const e = await db.contratEcheance.upsert({
      where: { contratId_type_dateEcheance: { contratId: id, type: input.type, dateEcheance: dateUtc(input.date_echeance) } },
      create: { contratId: id, type: input.type, dateEcheance: dateUtc(input.date_echeance), montant: input.montant ? money(input.montant).toString() : null },
      update: { statut: "A_VENIR", montant: input.montant ? money(input.montant).toString() : null },
      include: { depense: { select: { id: true, libelle: true, statut: true, montantTtc: true } } },
    });
    await journal(db, ctx, id, "ECHEANCE_MODIFIEE", { echeance_id: e.id, action: "AJOUT", type: e.type, date: isoDate(e.dateEcheance) });
    return presenterEcheance(e);
  });
}

export async function modifierEcheance(ctx: TenantContext, id: string, echeanceId: string, input: EcheanceUpdateInput) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    await chargerContrat(db, ctx, id);
    const avant = await db.contratEcheance.findUnique({ where: { id: echeanceId } });
    if (!avant || avant.contratId !== id) throw new IntrouvableError("Échéance introuvable.");
    if (avant.statut === "DEPENSE_GENEREE" && input.statut && input.statut !== "REALISEE") throw new ContratError("CONTRAT_ECHEANCE_STATUT_INVALIDE", "Une échéance dont la dépense est générée ne peut être qu'ajoutée aux réalisées.");
    const e = await db.contratEcheance.update({
      where: { id: echeanceId },
      data: {
        ...(input.statut ? { statut: input.statut } : {}),
        ...(input.date_echeance ? { dateEcheance: dateUtc(input.date_echeance) } : {}),
        ...(input.montant !== undefined ? { montant: input.montant ? money(input.montant).toString() : null } : {}),
      },
      include: { depense: { select: { id: true, libelle: true, statut: true, montantTtc: true } } },
    });
    await journal(db, ctx, id, "ECHEANCE_MODIFIEE", { echeance_id: echeanceId, avant: { statut: avant.statut, date: isoDate(avant.dateEcheance) }, apres: { statut: e.statut, date: isoDate(e.dateEcheance) } });
    return presenterEcheance(e);
  });
}

/** POST /contrats/{id}/echeances/{eid}/generer-depense — dépense BROUILLON liée (contrat, poste, prestataire). Idempotent. */
export async function genererDepenseDepuisEcheance(ctx: TenantContext, id: string, echeanceId: string, input: GenererDepenseInput, cle?: string) {
  assertPeutGerer(ctx);
  if (can("depenses.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic crée une dépense.");
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /contrats/${id}/echeances/${echeanceId}/generer-depense`, payload: { id, echeanceId, ...input } }, async (db) => {
    const c = await chargerContrat(db, ctx, id);
    const e = await db.contratEcheance.findUnique({ where: { id: echeanceId } });
    if (!e || e.contratId !== id) throw new IntrouvableError("Échéance introuvable.");
    if (e.statut !== "A_VENIR" && e.statut !== "MANQUEE") throw new ContratError("CONTRAT_ECHEANCE_STATUT_INVALIDE", `Seule une échéance A_VENIR ou MANQUEE génère une dépense (statut actuel : ${e.statut}).`);
    const montant = input.montant_ttc ?? (e.montant ? toApiString(e.montant) : c.montantPeriode ? toApiString(c.montantPeriode) : null);
    if (!montant || money(montant).lessThanOrEqualTo(0)) throw new ContratError("UNPROCESSABLE_ENTITY", "Montant TTC requis : le contrat n'a pas de montant de période.");
    const depense = await creerDepenseDb(db, ctx, {
      categorie: c.budgetPoste?.categorie ?? CATEGORIE_CONTRAT_VERS_DEPENSE[c.type] ?? "AUTRE",
      libelle: `${c.libelle} — ${e.type === "PAIEMENT" ? "échéance" : e.type.toLowerCase().replace("_", " ")} ${isoDate(e.dateEcheance)}`,
      description: c.reference ? `Contrat ${c.reference}` : null,
      montant_ht: null,
      tva: null,
      montant_ttc: money(montant).toFixed(2),
      date_depense: input.date_depense ?? isoDate(e.dateEcheance),
      source: input.source,
      budget_poste_id: c.budgetPosteId,
      prestataire_id: c.prestataireId,
      incident_id: null,
      resolution_ag_id: c.resolutionAgId,
      contrat_id: c.id,
    });
    await db.contratEcheance.update({ where: { id: echeanceId }, data: { statut: "DEPENSE_GENEREE", depenseId: depense.id } });
    await journal(db, ctx, id, "DEPENSE_GENEREE", { echeance_id: echeanceId, depense_id: depense.id, montant_ttc: toApiString(depense.montantTtc) });
    await audit(db, ctx, "CONTRAT_DEPENSE_GENEREE", id, undefined, { echeance_id: echeanceId, depense_id: depense.id, montant_ttc: toApiString(depense.montantTtc) });
    return { echeance: presenterEcheance(await db.contratEcheance.findUniqueOrThrow({ where: { id: echeanceId }, include: { depense: { select: { id: true, libelle: true, statut: true, montantTtc: true } } } })), depense: { ...depense, montantTtc: toApiString(depense.montantTtc) } };
  });
}

// ── Vues transverses ─────────────────────────────────────────────────────────

/** GET /contrats/echeancier?from&to — flux calendrier : toutes les échéances de la copropriété dans la fenêtre. */
export async function echeancier(ctx: TenantContext, from: string, to: string, filtres: { type?: string; statut?: string } = {}) {
  assertPeutLire(ctx);
  return withTenant(ctx, async (db) => {
    const rows = await db.contratEcheance.findMany({
      where: { contrat: { coproprieteId: ctx.coproprieteId, statut: { in: ["ACTIF", "SUSPENDU", "BROUILLON"] } }, dateEcheance: { gte: dateUtc(from), lte: dateUtc(to) }, ...(filtres.type ? { type: filtres.type as never } : {}), ...(filtres.statut ? { statut: filtres.statut as never } : {}) },
      orderBy: { dateEcheance: "asc" },
      include: { contrat: { select: { id: true, libelle: true, type: true, statut: true, prestataire: { select: { nom: true } } } }, depense: { select: { id: true, libelle: true, statut: true, montantTtc: true } } },
    });
    const total = rows.reduce((acc, e) => acc.plus(e.montant ? money(e.montant) : 0), money(0));
    return {
      from,
      to,
      total_montant: toApiString(total),
      echeances: rows.map((e) => ({ ...presenterEcheance(e), contrat: e.contrat })),
    };
  });
}

/** GET /contrats/a-renouveler?jours=90 — contrats ACTIF dont la fin tombe dans la fenêtre + expirés récents. */
export async function contratsARenouveler(ctx: TenantContext, jours = 90, now = new Date()) {
  assertPeutLire(ctx);
  return withTenant(ctx, async (db) => {
    const aujourdhui = jourUtc(now);
    const horizon = ajouterJours(aujourdhui, jours);
    const rows = await db.contrat.findMany({ where: { coproprieteId: ctx.coproprieteId, OR: [{ statut: "ACTIF", dateFin: { not: null, lte: horizon } }, { statut: "EXPIRE", dateFin: { gte: ajouterJours(aujourdhui, -jours) } }] }, include: contratInclude, orderBy: { dateFin: "asc" } });
    return rows.map((r) => presenter(r, aujourdhui));
  });
}

/** Invariant Doc A §8 : une assurance immeuble ACTIVE et non échue. */
export async function etatAssuranceDb(db: TenantDb, coproprieteId: string, now = new Date()) {
  const aujourdhui = jourUtc(now);
  const polices = await db.contrat.findMany({ where: { coproprieteId, type: { in: ["ASSURANCE_IMMEUBLE", "ASSURANCE_RC"] }, statut: "ACTIF" }, select: { id: true, type: true, libelle: true, dateFin: true, detailsAssuranceJson: true, attestationDocumentId: true } });
  const immeuble = polices.filter((p) => p.type === "ASSURANCE_IMMEUBLE" && (!p.dateFin || jourUtc(p.dateFin) >= aujourdhui));
  const rc = polices.filter((p) => p.type === "ASSURANCE_RC" && (!p.dateFin || jourUtc(p.dateFin) >= aujourdhui));
  return {
    immeuble_active: immeuble.length > 0,
    rc_active: rc.length > 0,
    polices: polices.map((p) => ({ id: p.id, type: p.type, libelle: p.libelle, date_fin: p.dateFin ? isoDate(p.dateFin) : null, echue: p.dateFin ? jourUtc(p.dateFin) < aujourdhui : false, attestation: p.attestationDocumentId !== null, assureur: (p.detailsAssuranceJson as { assureur?: string } | null)?.assureur ?? null })),
  };
}

export async function etatAssurance(ctx: TenantContext) {
  assertPeutLire(ctx);
  return withTenant(ctx, (db) => etatAssuranceDb(db, ctx.coproprieteId));
}

/** Indicateurs contrats du tableau de bord M18 (calculés sous le client tenant). */
export async function indicateursContrats(db: TenantDb, coproprieteId: string, now = new Date()) {
  const aujourdhui = jourUtc(now);
  const [actifs, aEchoir, echus, echeances30, manquees, assurance] = await Promise.all([
    db.contrat.count({ where: { coproprieteId, statut: "ACTIF" } }),
    db.contrat.count({ where: { coproprieteId, statut: "ACTIF", dateFin: { not: null, gte: aujourdhui, lte: ajouterJours(aujourdhui, 30) } } }),
    db.contrat.count({ where: { coproprieteId, statut: "EXPIRE", dateFin: { gte: ajouterJours(aujourdhui, -90) } } }),
    db.contratEcheance.findMany({ where: { contrat: { coproprieteId, statut: "ACTIF" }, statut: "A_VENIR", dateEcheance: { gte: aujourdhui, lte: ajouterJours(aujourdhui, 30) } }, select: { montant: true } }),
    db.contratEcheance.count({ where: { contrat: { coproprieteId }, statut: "MANQUEE" } }),
    etatAssuranceDb(db, coproprieteId, now),
  ]);
  return {
    actifs,
    a_echoir_30j: aEchoir,
    echus_90j: echus,
    echeances_30j: { nb: echeances30.length, montant: toApiString(echeances30.reduce((a, e) => a.plus(e.montant ? money(e.montant) : 0), money(0))) },
    echeances_manquees: manquees,
    assurance_immeuble_active: assurance.immeuble_active,
    assurance_rc_active: assurance.rc_active,
  };
}

/** Faits marquants M18 : contrats devenus ACTIF dont la date de début tombe dans l'exercice. */
export async function contratsSignesExercice(db: TenantDb, coproprieteId: string, exercice: string) {
  const rows = await db.contrat.findMany({ where: { coproprieteId, statut: { in: ["ACTIF", "SUSPENDU", "RESILIE", "EXPIRE"] }, dateDebut: { gte: dateUtc(`${exercice}-01-01`), lt: dateUtc(`${Number(exercice) + 1}-01-01`) } }, select: { id: true, libelle: true, type: true, dateDebut: true }, orderBy: { dateDebut: "asc" }, take: 30 });
  return rows.map((r) => ({ id: r.id, libelle: r.libelle, type: r.type, date: isoDate(r.dateDebut) }));
}

export { dureeEnMois };
