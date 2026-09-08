/**
 * M22 — Tâches et suivi des décisions (Doc A §6 : exécution des résolutions adoptées ; §8 :
 * obligations récurrentes du syndic). Les incidents traitent les pannes ; la tâche porte le « à
 * faire » du syndic, visible du conseil (`visible_conseil`) et de l'assigné(e) (gardien, conseil…).
 *
 * Origines : MANUELLE, RESOLUTION_AG (hook finaliserResolution), CONTRAT (échéances de
 * renouvellement / visites), INCIDENT (résolu avec une dépense à régler), RAPPORT (rapport de
 * gestion à soumettre à l'AG), SYSTEME (récurrence). Chaque hook est idempotent (une tâche par
 * objet source). `tache_log` est append-only ; chaque transition est auditée.
 */
import { Prisma } from "@prisma/client";
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import type { ErrorCode } from "../http/respond";
import type { Pagination, Tri } from "../http/pagination";
import { journaliserExport, type CelluleCsv, type FormatExport } from "../http/export";
import { assertCheminDansPerimetre, attacherDocument, preparerUploadModule, urlsSigneesDocuments, CheminHorsPerimetreError } from "../documents/attach";
import { identites, type Identite } from "../communication/communication";
import type { FrequenceRecurrence, StatutTache, TacheAssignerInput, TacheChecklistInput, TacheCommentaireInput, TacheCreateInput, TacheStatutInput, TacheUpdateInput, TacheUploadUrlInput, TachesFiltres, TRIS_TACHE } from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
export class TacheError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}
export { CheminHorsPerimetreError };

const SYSTEME = "00000000-0000-0000-0000-000000000000";
type Ctx = { coproprieteId: string; utilisateurId: string | null };
type Checklist = { id: string; libelle: string; fait: boolean }[];
type Recurrence = { frequence: FrequenceRecurrence };

export function dateUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function ajouterJours(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
export function prochaineEcheance(base: Date, frequence: FrequenceRecurrence): Date {
  const mois = frequence === "MENSUELLE" ? 1 : frequence === "TRIMESTRIELLE" ? 3 : frequence === "SEMESTRIELLE" ? 6 : 12;
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + mois, 1));
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(base.getUTCDate(), dernier));
  return d;
}

function estGestion(ctx: TenantContext) {
  return ctx.role === "SYNDIC" || ctx.role === "SUPER_ADMIN";
}
function assertPeutGerer(ctx: TenantContext) {
  if (can("taches.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic gère les tâches.");
}
function assertPeutLire(ctx: TenantContext) {
  if (can("taches.lire", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
}
export async function journal(db: TenantDb, ctx: Ctx, tacheId: string, type: Prisma.TacheLogCreateManyInput["type"], details?: Record<string, unknown>) {
  await db.tacheLog.createMany({ data: [{ coproprieteId: ctx.coproprieteId, tacheId, type, acteurId: ctx.utilisateurId === SYSTEME ? null : ctx.utilisateurId, detailsJson: (details ?? Prisma.DbNull) as Prisma.InputJsonValue }] });
}
async function audit(db: TenantDb, ctx: Ctx, action: string, tacheId: string, avant?: unknown, apres?: unknown) {
  await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId === SYSTEME ? null : ctx.utilisateurId, action, entite: "tache", entiteId: tacheId, avant: avant as Prisma.InputJsonValue, apres: apres as Prisma.InputJsonValue });
}
export async function syndics(db: TenantDb, coproprieteId: string) {
  return (await db.roleUtilisateur.findMany({ where: { coproprieteId, actif: true, role: "SYNDIC" }, select: { utilisateurId: true }, distinct: ["utilisateurId"] })).map((s) => s.utilisateurId);
}
async function notifier(db: TenantDb, coproprieteId: string, ids: (string | null | undefined)[], templateCode: string, contenu: Record<string, unknown>) {
  for (const u of new Set(ids.filter((x): x is string => Boolean(x) && x !== SYSTEME))) {
    await envoyerNotification(db, { coproprieteId, utilisateurId: u, templateCode, canal: "PUSH", contenuJson: contenu as Prisma.InputJsonValue });
  }
}
function normaliserChecklist(items: { id?: string; libelle: string; fait?: boolean }[] | null | undefined): Checklist | null {
  if (!items) return null;
  const vus = new Set<string>();
  return items.map((it, i) => {
    let id = (it.id ?? `c${i + 1}`).toLowerCase();
    while (vus.has(id)) id = `${id}_${i}`;
    vus.add(id);
    return { id, libelle: it.libelle.trim(), fait: it.fait ?? false };
  });
}

// ── Présentation ─────────────────────────────────────────────────────────────

const tacheInclude = {
  contratEcheance: { select: { id: true, type: true, dateEcheance: true, contratId: true, contrat: { select: { libelle: true } } } },
  incident: { select: { id: true, categorie: true, statut: true } },
  rapportGestion: { select: { id: true, exercice: true, statut: true } },
  resolutionAg: { select: { id: true, ordre: true, texte: true, agId: true } },
  _count: { select: { commentaires: true, piecesJointes: true } },
} satisfies Prisma.TacheInclude;
type TacheRow = Prisma.TacheGetPayload<{ include: typeof tacheInclude }>;

export function presenter(t: TacheRow, noms: Map<string, Identite>, now = new Date()) {
  const checklist = (t.checklistJson as Checklist | null) ?? null;
  const enRetard = t.dateEcheance !== null && (t.statut === "A_FAIRE" || t.statut === "EN_COURS" || t.statut === "BLOQUEE") && isoDate(t.dateEcheance) < isoDate(now);
  return {
    id: t.id,
    coproprieteId: t.coproprieteId,
    titre: t.titre,
    description: t.description,
    origine: t.origine,
    resolutionAg: t.resolutionAg ? { id: t.resolutionAg.id, ordre: t.resolutionAg.ordre, texte: t.resolutionAg.texte, agId: t.resolutionAg.agId } : null,
    contratEcheance: t.contratEcheance ? { id: t.contratEcheance.id, type: t.contratEcheance.type, dateEcheance: t.contratEcheance.dateEcheance, contratId: t.contratEcheance.contratId, contratLibelle: t.contratEcheance.contrat.libelle } : null,
    incident: t.incident,
    rapportGestion: t.rapportGestion,
    assignee: t.assigneeId ? (noms.get(t.assigneeId) ?? { id: t.assigneeId, nom: null, prenom: null }) : null,
    creePar: t.creeParId ? (noms.get(t.creeParId) ?? { id: t.creeParId, nom: null, prenom: null }) : null,
    priorite: t.priorite,
    statut: t.statut,
    dateEcheance: t.dateEcheance ? isoDate(t.dateEcheance) : null,
    termineeLe: t.termineeLe,
    checklist,
    checklistFaits: checklist ? checklist.filter((c) => c.fait).length : 0,
    recurrence: (t.recurrenceJson as Recurrence | null) ?? null,
    recurrenceParenteId: t.recurrenceParenteId,
    visibleConseil: t.visibleConseil,
    enRetard,
    nbCommentaires: t._count.commentaires,
    nbPiecesJointes: t._count.piecesJointes,
    creeLe: t.creeLe,
    modifieLe: t.modifieLe,
  };
}
export type TachePresentee = ReturnType<typeof presenter>;

async function chargerTache(db: TenantDb, id: string) {
  const t = await db.tache.findUnique({ where: { id }, include: tacheInclude });
  if (!t) throw new IntrouvableError("Tâche introuvable.");
  return t;
}
async function presenterListe(db: TenantDb, rows: TacheRow[]) {
  const noms = await identites(db, rows.flatMap((r) => [r.assigneeId, r.creeParId]).filter((x): x is string => Boolean(x)));
  return rows.map((r) => presenter(r, noms));
}

// ── Liste / export ───────────────────────────────────────────────────────────

const OUVERTES: StatutTache[] = ["A_FAIRE", "EN_COURS", "BLOQUEE"];
function whereFiltres(ctx: TenantContext, f: TachesFiltres, now = new Date()): Prisma.TacheWhereInput {
  const where: Prisma.TacheWhereInput = { coproprieteId: ctx.coproprieteId };
  if (f.statut) where.statut = f.statut;
  else if (f.ouvertes) where.statut = { in: OUVERTES };
  if (f.priorite) where.priorite = f.priorite;
  if (f.origine) where.origine = f.origine;
  if (f.assignee_id) where.assigneeId = f.assignee_id;
  if (f.retard) {
    where.statut = { in: OUVERTES };
    where.dateEcheance = { lt: dateUtc(isoDate(now)) };
  }
  if (f.q) where.OR = [{ titre: { contains: f.q, mode: "insensitive" } }, { description: { contains: f.q, mode: "insensitive" } }];
  return where;
}
const ORDER: Record<(typeof TRIS_TACHE)[number], (s: "asc" | "desc") => Prisma.TacheOrderByWithRelationInput[]> = {
  date_echeance: (s) => [{ dateEcheance: { sort: s, nulls: "last" } }, { priorite: "desc" }],
  priorite: (s) => [{ priorite: s }, { dateEcheance: { sort: "asc", nulls: "last" } }],
  cree_le: (s) => [{ creeLe: s }],
  statut: (s) => [{ statut: s }, { dateEcheance: { sort: "asc", nulls: "last" } }],
  titre: (s) => [{ titre: s }],
};

export async function listerTaches(ctx: TenantContext, filtres: TachesFiltres, pagination: Pagination, tri: Tri<(typeof TRIS_TACHE)[number]>) {
  assertPeutLire(ctx);
  return withTenant(ctx, async (db) => {
    const where = whereFiltres(ctx, filtres);
    const [total, rows, parStatut, retard] = await Promise.all([
      db.tache.count({ where }),
      db.tache.findMany({ where, include: tacheInclude, orderBy: ORDER[tri.champ](tri.sens), skip: pagination.skip, take: pagination.take }),
      db.tache.groupBy({ by: ["statut"], where: { coproprieteId: ctx.coproprieteId }, _count: { _all: true } }),
      db.tache.count({ where: { coproprieteId: ctx.coproprieteId, statut: { in: OUVERTES }, dateEcheance: { lt: dateUtc(isoDate(new Date())) } } }),
    ]);
    const par_statut = Object.fromEntries(parStatut.map((p) => [p.statut, p._count._all]));
    return { total, rows: await presenterListe(db, rows), par_statut, retard };
  });
}

export const ENTETES_TACHES = ["titre", "origine", "priorite", "statut", "assignee", "date_echeance", "terminee_le", "en_retard", "visible_conseil", "nb_commentaires"];
export async function exporterTaches(ctx: TenantContext, filtres: TachesFiltres, format: FormatExport): Promise<{ entetes: string[]; lignes: CelluleCsv[][]; nbLignes: number }> {
  if (can("exports.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à exporter les tâches.");
  assertPeutLire(ctx);
  return withTenant(ctx, async (db) => {
    const rows = await db.tache.findMany({ where: whereFiltres(ctx, filtres), include: tacheInclude, orderBy: ORDER.date_echeance("asc") });
    const pres = await presenterListe(db, rows);
    const lignes: CelluleCsv[][] = pres.map((t) => [t.titre, t.origine, t.priorite, t.statut, t.assignee ? [t.assignee.prenom, t.assignee.nom].filter(Boolean).join(" ") : "", t.dateEcheance ?? "", t.termineeLe?.toISOString() ?? "", t.enRetard, t.visibleConseil, t.nbCommentaires]);
    await journaliserExport(db, ctx, { type: "TACHES", filtres: filtres as Record<string, unknown>, nbLignes: lignes.length, format });
    return { entetes: ENTETES_TACHES, lignes, nbLignes: lignes.length };
  });
}

/** GET /taches/mes-taches — tâches assignées à l'appelant (ouvertes d'abord). */
export async function mesTaches(ctx: TenantContext) {
  assertPeutLire(ctx);
  return withTenant(ctx, async (db) => {
    const rows = await db.tache.findMany({ where: { coproprieteId: ctx.coproprieteId, assigneeId: ctx.utilisateurId }, include: tacheInclude, orderBy: [{ statut: "asc" }, { dateEcheance: { sort: "asc", nulls: "last" } }] });
    return presenterListe(db, rows);
  });
}
/** GET /taches/retard — tâches ouvertes dont l'échéance est passée. */
export async function tachesEnRetard(ctx: TenantContext, now = new Date()) {
  assertPeutLire(ctx);
  return withTenant(ctx, async (db) => {
    const rows = await db.tache.findMany({ where: { coproprieteId: ctx.coproprieteId, statut: { in: OUVERTES }, dateEcheance: { lt: dateUtc(isoDate(now)) } }, include: tacheInclude, orderBy: [{ dateEcheance: "asc" }] });
    return presenterListe(db, rows);
  });
}

// ── Création / détail / modification ─────────────────────────────────────────

export async function preparerUploadTache(ctx: TenantContext, input: TacheUploadUrlInput) {
  if (can("taches.gerer", ctx.role) !== true && can("taches.maj_propre", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return preparerUploadModule(ctx, "taches", input.nom_fichier);
}
async function attacherPieces(db: TenantDb, ctx: TenantContext, tacheId: string, pieces: { storage_path: string; nom: string }[]) {
  for (const p of pieces) {
    assertCheminDansPerimetre(ctx, "taches", p.storage_path);
    const doc = await attacherDocument(db, ctx, { module: "taches", type: "TACHE_PJ", nom: p.nom, storagePath: p.storage_path, visibilite: "CONSEIL_SYNDICAL" });
    await db.document.update({ where: { id: doc.id }, data: { tacheId } });
    await journal(db, ctx, tacheId, "DOCUMENT_AJOUTE", { document_id: doc.id, nom: p.nom });
  }
}

async function assertAssigneeValide(db: TenantDb, coproprieteId: string, assigneeId: string | null | undefined) {
  if (!assigneeId) return;
  const r = await db.roleUtilisateur.findFirst({ where: { coproprieteId, utilisateurId: assigneeId, actif: true, role: { in: ["SYNDIC", "CONSEIL_SYNDICAL", "GARDIEN"] } } });
  if (!r) throw new TacheError("TACHE_ASSIGNEE_INVALIDE", "L'assigné(e) doit être syndic, membre du conseil ou personnel de la copropriété.");
}

export async function creerTache(ctx: TenantContext, input: TacheCreateInput) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    await assertAssigneeValide(db, ctx.coproprieteId, input.assignee_id);
    const t = await db.tache.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        titre: input.titre.trim(),
        description: input.description ?? null,
        origine: "MANUELLE",
        assigneeId: input.assignee_id ?? null,
        priorite: input.priorite,
        dateEcheance: input.date_echeance ? dateUtc(input.date_echeance) : null,
        checklistJson: (normaliserChecklist(input.checklist) ?? Prisma.DbNull) as Prisma.InputJsonValue,
        recurrenceJson: (input.recurrence ?? Prisma.DbNull) as Prisma.InputJsonValue,
        visibleConseil: input.visible_conseil,
        creeParId: ctx.utilisateurId,
      },
    });
    await attacherPieces(db, ctx, t.id, input.pieces_jointes);
    await journal(db, ctx, t.id, "CREEE", { origine: "MANUELLE", assignee_id: t.assigneeId });
    await audit(db, ctx, "TACHE_CREEE", t.id, undefined, { titre: t.titre, priorite: t.priorite, assignee_id: t.assigneeId, date_echeance: input.date_echeance ?? null });
    if (t.assigneeId && t.assigneeId !== ctx.utilisateurId) await notifier(db, ctx.coproprieteId, [t.assigneeId], "TACHE_ASSIGNEE", { tache_id: t.id, titre: t.titre, date_echeance: input.date_echeance ?? "—", priorite: t.priorite });
    return obtenirTacheDb(db, ctx, t.id);
  });
}

async function obtenirTacheDb(db: TenantDb, ctx: TenantContext, id: string) {
  const t = await chargerTache(db, id);
  const [docs, commentaires, logs] = await Promise.all([
    db.document.findMany({ where: { tacheId: id }, select: { id: true, nom: true, type: true, storagePath: true }, orderBy: { creeLe: "asc" } }),
    db.tacheCommentaire.findMany({ where: { tacheId: id }, orderBy: { creeLe: "asc" } }),
    db.tacheLog.findMany({ where: { tacheId: id }, orderBy: { horodatage: "asc" } }),
  ]);
  const noms = await identites(db, [t.assigneeId, t.creeParId, ...commentaires.map((c) => c.auteurId), ...logs.map((l) => l.acteurId)].filter((x): x is string => Boolean(x)));
  return {
    ...presenter(t, noms),
    piecesJointes: await urlsSigneesDocuments(docs),
    commentaires: commentaires.map((c) => ({ id: c.id, auteur: noms.get(c.auteurId) ?? { id: c.auteurId, nom: null, prenom: null }, contenu: c.contenu, creeLe: c.creeLe, mien: c.auteurId === ctx.utilisateurId })),
    journal: logs.map((l) => ({ id: l.id, type: l.type, acteur: l.acteurId ? (noms.get(l.acteurId) ?? { id: l.acteurId, nom: null, prenom: null }) : null, details: l.detailsJson, horodatage: l.horodatage })),
    peutModifier: estGestion(ctx),
    peutMettreAJour: estGestion(ctx) || t.assigneeId === ctx.utilisateurId,
  };
}
export type TacheDetail = Awaited<ReturnType<typeof obtenirTacheDb>>;
export async function obtenirTache(ctx: TenantContext, id: string) {
  assertPeutLire(ctx);
  return withTenant(ctx, (db) => obtenirTacheDb(db, ctx, id));
}

export async function modifierTache(ctx: TenantContext, id: string, input: TacheUpdateInput) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const avant = await chargerTache(db, id);
    if (avant.statut === "TERMINEE" || avant.statut === "ANNULEE") throw new TacheError("TACHE_STATUT_INVALIDE", `Une tâche ${avant.statut} ne se modifie plus.`);
    if (input.assignee_id !== undefined) await assertAssigneeValide(db, ctx.coproprieteId, input.assignee_id);
    await db.tache.update({
      where: { id },
      data: {
        ...(input.titre !== undefined ? { titre: input.titre.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.assignee_id !== undefined ? { assigneeId: input.assignee_id } : {}),
        ...(input.priorite !== undefined ? { priorite: input.priorite } : {}),
        ...(input.date_echeance !== undefined ? { dateEcheance: input.date_echeance ? dateUtc(input.date_echeance) : null } : {}),
        ...(input.checklist !== undefined ? { checklistJson: (normaliserChecklist(input.checklist) ?? Prisma.DbNull) as Prisma.InputJsonValue } : {}),
        ...(input.recurrence !== undefined ? { recurrenceJson: (input.recurrence ?? Prisma.DbNull) as Prisma.InputJsonValue } : {}),
        ...(input.visible_conseil !== undefined ? { visibleConseil: input.visible_conseil } : {}),
      },
    });
    if (input.pieces_jointes) await attacherPieces(db, ctx, id, input.pieces_jointes);
    await journal(db, ctx, id, "MODIFIEE", { champs: Object.keys(input) });
    await audit(db, ctx, "TACHE_MODIFIEE", id, { titre: avant.titre, assignee_id: avant.assigneeId, priorite: avant.priorite }, { champs: Object.keys(input) });
    if (input.assignee_id && input.assignee_id !== avant.assigneeId && input.assignee_id !== ctx.utilisateurId) {
      await notifier(db, ctx.coproprieteId, [input.assignee_id], "TACHE_ASSIGNEE", { tache_id: id, titre: input.titre ?? avant.titre, date_echeance: input.date_echeance ?? (avant.dateEcheance ? isoDate(avant.dateEcheance) : "—"), priorite: input.priorite ?? avant.priorite });
    }
    return obtenirTacheDb(db, ctx, id);
  });
}

// ── Transitions ──────────────────────────────────────────────────────────────

const TRANSITIONS: Record<StatutTache, StatutTache[]> = {
  A_FAIRE: ["EN_COURS", "BLOQUEE", "TERMINEE", "ANNULEE"],
  EN_COURS: ["A_FAIRE", "BLOQUEE", "TERMINEE", "ANNULEE"],
  BLOQUEE: ["A_FAIRE", "EN_COURS", "TERMINEE", "ANNULEE"],
  TERMINEE: ["A_FAIRE"],
  ANNULEE: ["A_FAIRE"],
};

/** Récurrence : à la clôture, la prochaine occurrence est créée une seule fois (parent + échéance uniques). */
async function creerOccurrenceSuivante(db: TenantDb, ctx: Ctx, t: TacheRow) {
  const rec = t.recurrenceJson as Recurrence | null;
  if (!rec?.frequence) return null;
  const base = t.dateEcheance ?? new Date();
  const prochaine = prochaineEcheance(base, rec.frequence);
  const existante = await db.tache.findFirst({ where: { recurrenceParenteId: t.id }, select: { id: true } });
  if (existante) return existante.id;
  const checklist = (t.checklistJson as Checklist | null)?.map((c) => ({ ...c, fait: false })) ?? null;
  const n = await db.tache.create({
    data: {
      coproprieteId: t.coproprieteId, titre: t.titre, description: t.description, origine: "SYSTEME", assigneeId: t.assigneeId, priorite: t.priorite,
      dateEcheance: prochaine, checklistJson: (checklist ?? Prisma.DbNull) as Prisma.InputJsonValue, recurrenceJson: rec as unknown as Prisma.InputJsonValue,
      recurrenceParenteId: t.id, visibleConseil: t.visibleConseil, creeParId: t.creeParId,
    },
  });
  await journal(db, ctx, n.id, "RECURRENCE", { parente_id: t.id, frequence: rec.frequence, date_echeance: isoDate(prochaine) });
  await journal(db, ctx, t.id, "RECURRENCE", { suivante_id: n.id, date_echeance: isoDate(prochaine) });
  return n.id;
}

export async function changerStatutTache(ctx: TenantContext, id: string, input: TacheStatutInput) {
  const permission = can("taches.gerer", ctx.role) === true ? "all" : can("taches.maj_propre", ctx.role);
  if (permission === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const t = await chargerTache(db, id);
    if (permission !== "all" && t.assigneeId !== ctx.utilisateurId) throw new PermissionRefuseeError("Vous ne mettez à jour que vos propres tâches.");
    if (permission !== "all" && input.statut === "ANNULEE") throw new PermissionRefuseeError("Seul le syndic annule une tâche.");
    if (t.statut === input.statut) return { ...(await obtenirTacheDb(db, ctx, id)), deja: true, suivante_id: null as string | null };
    if (!TRANSITIONS[t.statut].includes(input.statut)) throw new TacheError("TACHE_STATUT_INVALIDE", `Transition ${t.statut} → ${input.statut} impossible.`);
    const termine = input.statut === "TERMINEE";
    await db.tache.update({ where: { id }, data: { statut: input.statut, termineeLe: termine ? new Date() : null } });
    if (input.piece_jointe) await attacherPieces(db, ctx, id, [input.piece_jointe]);
    if (input.commentaire) await db.tacheCommentaire.create({ data: { tacheId: id, auteurId: ctx.utilisateurId, contenu: input.commentaire.trim() } });
    await journal(db, ctx, id, "STATUT_CHANGE", { de: t.statut, vers: input.statut, commentaire: input.commentaire ?? null });
    await audit(db, ctx, "TACHE_STATUT_CHANGE", id, { statut: t.statut }, { statut: input.statut });
    let suivante: string | null = null;
    if (termine) {
      suivante = await creerOccurrenceSuivante(db, ctx, t);
      // Une échéance de contrat liée est réalisée en même temps que sa tâche.
      if (t.contratEcheance) await db.contratEcheance.updateMany({ where: { id: t.contratEcheance.id, statut: "A_VENIR" }, data: { statut: "REALISEE" } });
    }
    // Le syndic est prévenu quand un assigné avance ; l'assigné quand le syndic change son statut.
    const dest = ctx.utilisateurId === t.assigneeId ? await syndics(db, ctx.coproprieteId) : [t.assigneeId];
    await notifier(db, ctx.coproprieteId, dest.filter((u) => u !== ctx.utilisateurId), "TACHE_STATUT", { tache_id: id, titre: t.titre, statut: input.statut });
    return { ...(await obtenirTacheDb(db, ctx, id)), deja: false, suivante_id: suivante };
  });
}

export async function assignerTache(ctx: TenantContext, id: string, input: TacheAssignerInput) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const t = await chargerTache(db, id);
    await assertAssigneeValide(db, ctx.coproprieteId, input.assignee_id);
    await db.tache.update({ where: { id }, data: { assigneeId: input.assignee_id } });
    await journal(db, ctx, id, "ASSIGNEE", { de: t.assigneeId, vers: input.assignee_id });
    await audit(db, ctx, "TACHE_ASSIGNEE", id, { assignee_id: t.assigneeId }, { assignee_id: input.assignee_id });
    if (input.assignee_id && input.assignee_id !== ctx.utilisateurId) await notifier(db, ctx.coproprieteId, [input.assignee_id], "TACHE_ASSIGNEE", { tache_id: id, titre: t.titre, date_echeance: t.dateEcheance ? isoDate(t.dateEcheance) : "—", priorite: t.priorite });
    return obtenirTacheDb(db, ctx, id);
  });
}

export async function mettreAJourChecklist(ctx: TenantContext, id: string, input: TacheChecklistInput) {
  const permission = can("taches.gerer", ctx.role) === true ? "all" : can("taches.maj_propre", ctx.role);
  if (permission === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const t = await chargerTache(db, id);
    if (permission !== "all" && t.assigneeId !== ctx.utilisateurId) throw new PermissionRefuseeError("Vous ne mettez à jour que vos propres tâches.");
    let liste: Checklist;
    if (input.checklist) liste = normaliserChecklist(input.checklist) ?? [];
    else {
      liste = ((t.checklistJson as Checklist | null) ?? []).map((c) => (c.id === input.item_id ? { ...c, fait: input.fait! } : c));
      if (!liste.some((c) => c.id === input.item_id)) throw new IntrouvableError("Élément de checklist introuvable.");
    }
    await db.tache.update({ where: { id }, data: { checklistJson: liste as unknown as Prisma.InputJsonValue } });
    await journal(db, ctx, id, "CHECKLIST", { faits: liste.filter((c) => c.fait).length, total: liste.length });
    return obtenirTacheDb(db, ctx, id);
  });
}

export async function commenterTache(ctx: TenantContext, id: string, input: TacheCommentaireInput) {
  assertPeutLire(ctx);
  return withTenant(ctx, async (db) => {
    const t = await chargerTache(db, id);
    const c = await db.tacheCommentaire.create({ data: { tacheId: id, auteurId: ctx.utilisateurId, contenu: input.contenu.trim() } });
    await journal(db, ctx, id, "COMMENTAIRE", { commentaire_id: c.id });
    const dest = [t.assigneeId, t.creeParId, ...(ctx.role === "SYNDIC" ? [] : await syndics(db, ctx.coproprieteId))].filter((u) => u !== ctx.utilisateurId);
    await notifier(db, ctx.coproprieteId, dest, "TACHE_COMMENTAIRE", { tache_id: id, titre: t.titre, apercu: input.contenu.trim().slice(0, 120) });
    const noms = await identites(db, [ctx.utilisateurId]);
    return { id: c.id, auteur: noms.get(ctx.utilisateurId) ?? { id: ctx.utilisateurId, nom: null, prenom: null }, contenu: c.contenu, creeLe: c.creeLe, mien: true };
  });
}

// ── Hooks des autres modules (idempotents : une tâche par objet source) ──────

type TacheSysteme = {
  titre: string;
  description?: string | null;
  origine: "RESOLUTION_AG" | "CONTRAT" | "INCIDENT" | "RAPPORT" | "SYSTEME";
  resolutionAgId?: string | null;
  incidentId?: string | null;
  rapportGestionId?: string | null;
  priorite?: "BASSE" | "NORMALE" | "HAUTE" | "CRITIQUE";
  dateEcheance?: Date | null;
  assigneeId?: string | null;
  visibleConseil?: boolean;
};
/** Crée (une seule fois) une tâche système liée à un objet ; renvoie l'id (existante ou créée). */
export async function creerTacheSysteme(db: TenantDb, ctx: Ctx, input: TacheSysteme, unique: Prisma.TacheWhereInput) {
  const existante = await db.tache.findFirst({ where: { coproprieteId: ctx.coproprieteId, ...unique }, select: { id: true } });
  if (existante) return { id: existante.id, creee: false };
  const assignee = input.assigneeId ?? (await syndics(db, ctx.coproprieteId))[0] ?? null;
  const t = await db.tache.create({
    data: {
      coproprieteId: ctx.coproprieteId, titre: input.titre.slice(0, 200), description: input.description ?? null, origine: input.origine,
      resolutionAgId: input.resolutionAgId ?? null, incidentId: input.incidentId ?? null, rapportGestionId: input.rapportGestionId ?? null,
      assigneeId: assignee, priorite: input.priorite ?? "NORMALE", dateEcheance: input.dateEcheance ?? null, visibleConseil: input.visibleConseil ?? true,
      creeParId: ctx.utilisateurId === SYSTEME ? null : ctx.utilisateurId,
    },
  });
  await journal(db, ctx, t.id, "CREEE", { origine: input.origine, systeme: true });
  await audit(db, ctx, "TACHE_CREEE", t.id, undefined, { titre: t.titre, origine: input.origine, assignee_id: assignee });
  if (assignee) await notifier(db, ctx.coproprieteId, [assignee], "TACHE_ASSIGNEE", { tache_id: t.id, titre: t.titre, date_echeance: input.dateEcheance ? isoDate(input.dateEcheance) : "—", priorite: t.priorite });
  return { id: t.id, creee: true };
}

/** Hook M6 : résolution ADOPTEE marquée « nécessite exécution » → tâche « Exécuter la résolution … ». */
export async function tacheExecutionResolution(db: TenantDb, ctx: Ctx, resolution: { id: string; ordre: number; texte: string; necessiteExecution: boolean; agId: string }, resultat: string) {
  if (resultat !== "ADOPTEE" || !resolution.necessiteExecution) return null;
  const [ag, copro] = await Promise.all([db.assembleeGenerale.findUnique({ where: { id: resolution.agId }, select: { dateAg: true } }), db.copropriete.findUnique({ where: { id: ctx.coproprieteId }, select: { delaiExecutionResolutionJours: true } })]);
  const delai = copro?.delaiExecutionResolutionJours ?? null;
  const dateEcheance = delai && ag ? ajouterJours(new Date(Date.UTC(ag.dateAg.getUTCFullYear(), ag.dateAg.getUTCMonth(), ag.dateAg.getUTCDate())), delai) : null;
  return creerTacheSysteme(db, ctx, { titre: `Exécuter la résolution n° ${resolution.ordre} : ${resolution.texte}`, description: delai ? null : "Délai d'exécution non configuré (Paramètres → délai d'exécution des résolutions, brief §13) : aucune échéance posée.", origine: "RESOLUTION_AG", resolutionAgId: resolution.id, priorite: "HAUTE", dateEcheance }, { resolutionAgId: resolution.id, origine: "RESOLUTION_AG" });
}

/** Hook M19 : chaque échéance non financière A_VENIR (renouvellement, visite, contrôle) porte une tâche ; les annulées ferment la leur. */
export async function synchroniserTachesEcheances(db: TenantDb, ctx: Ctx, contratId: string) {
  const contrat = await db.contrat.findUnique({ where: { id: contratId }, select: { id: true, libelle: true, dateFin: true } });
  if (!contrat) return { creees: 0, annulees: 0 };
  const echeances = await db.contratEcheance.findMany({ where: { contratId, type: { in: ["RENOUVELLEMENT", "VISITE_TECHNIQUE", "CONTROLE_REGLEMENTAIRE", "AUTRE"] } }, select: { id: true, type: true, statut: true, dateEcheance: true, tacheId: true } });
  let creees = 0, annulees = 0;
  const libelles: Record<string, string> = { RENOUVELLEMENT: "Renouveler ou résilier le contrat", VISITE_TECHNIQUE: "Visite technique", CONTROLE_REGLEMENTAIRE: "Contrôle réglementaire", AUTRE: "Échéance" };
  for (const e of echeances) {
    if (e.statut === "A_VENIR" && !e.tacheId) {
      const t = await db.tache.create({ data: { coproprieteId: ctx.coproprieteId, titre: `${libelles[e.type] ?? "Échéance"} — ${contrat.libelle}`.slice(0, 200), description: e.type === "RENOUVELLEMENT" && contrat.dateFin ? `Le contrat expire le ${isoDate(contrat.dateFin)} ; cette échéance est la date limite du préavis.` : null, origine: "CONTRAT", priorite: e.type === "RENOUVELLEMENT" ? "HAUTE" : "NORMALE", dateEcheance: e.dateEcheance, assigneeId: (await syndics(db, ctx.coproprieteId))[0] ?? null, creeParId: null } });
      await db.contratEcheance.update({ where: { id: e.id }, data: { tacheId: t.id } });
      await journal(db, ctx, t.id, "CREEE", { origine: "CONTRAT", echeance_id: e.id, type: e.type });
      creees += 1;
    } else if (e.statut === "ANNULEE" && e.tacheId) {
      const r = await db.tache.updateMany({ where: { id: e.tacheId, statut: { in: OUVERTES } }, data: { statut: "ANNULEE" } });
      if (r.count) { await journal(db, ctx, e.tacheId, "STATUT_CHANGE", { vers: "ANNULEE", motif: "echeance_annulee" }); annulees += 1; }
    } else if ((e.statut === "REALISEE" || e.statut === "DEPENSE_GENEREE") && e.tacheId) {
      const r = await db.tache.updateMany({ where: { id: e.tacheId, statut: { in: OUVERTES } }, data: { statut: "TERMINEE", termineeLe: new Date() } });
      if (r.count) await journal(db, ctx, e.tacheId, "STATUT_CHANGE", { vers: "TERMINEE", motif: "echeance_realisee" });
    }
  }
  return { creees, annulees };
}

/** Hook M4/M16 : incident RESOLU avec une dépense encore à approuver / payer → tâche « Régler la dépense ». */
export async function tacheIncidentResolu(db: TenantDb, ctx: Ctx, incidentId: string) {
  const depense = await db.depense.findFirst({ where: { incidentId, statut: { in: ["BROUILLON", "A_APPROUVER", "APPROUVEE"] } }, select: { id: true, libelle: true, montantTtc: true, statut: true } });
  if (!depense) return null;
  return creerTacheSysteme(db, ctx, { titre: `Régler la dépense de l'incident : ${depense.libelle}`, description: `Dépense ${depense.statut} de ${depense.montantTtc.toString()} MAD liée à un incident résolu.`, origine: "INCIDENT", incidentId, priorite: "NORMALE", dateEcheance: ajouterJours(new Date(), 15) }, { incidentId, origine: "INCIDENT" });
}

/** Hook M18 : rapport de gestion GENERE → « Soumettre le rapport à l'AG » ; soumis → tâche terminée. */
export async function tacheRapportASoumettre(db: TenantDb, ctx: Ctx, rapport: { id: string; exercice: string }) {
  return creerTacheSysteme(db, ctx, { titre: `Soumettre le rapport de gestion ${rapport.exercice} à l'AG`, origine: "RAPPORT", rapportGestionId: rapport.id, priorite: "HAUTE" }, { rapportGestionId: rapport.id, origine: "RAPPORT" });
}
export async function terminerTachesLiees(db: TenantDb, ctx: Ctx, where: Prisma.TacheWhereInput, motif: string) {
  const ouvertes = await db.tache.findMany({ where: { coproprieteId: ctx.coproprieteId, statut: { in: OUVERTES }, ...where }, select: { id: true } });
  for (const t of ouvertes) {
    await db.tache.update({ where: { id: t.id }, data: { statut: "TERMINEE", termineeLe: new Date() } });
    await journal(db, ctx, t.id, "STATUT_CHANGE", { vers: "TERMINEE", motif });
  }
  return ouvertes.length;
}

/** GET /ag/{id}/resolutions/{rid}/execution — suivi d'exécution lisible par tout membre voyant l'AG (fonction SECURITY DEFINER). */
export async function executionResolution(ctx: TenantContext, agId: string, resolutionId: string) {
  return withTenant(ctx, async (db) => {
    const r = await db.agResolution.findFirst({ where: { id: resolutionId, agId }, select: { id: true, ordre: true, texte: true, resultat: true, necessiteExecution: true } });
    if (!r) throw new IntrouvableError("Résolution introuvable.");
    const rows = await db.$queryRaw<{ tache_id: string; titre: string; statut: StatutTache; date_echeance: Date | null; terminee_le: Date | null; cree_le: Date }[]>`SELECT * FROM public.resolution_execution(${resolutionId}::uuid)`;
    return {
      resolution_id: r.id, ordre: r.ordre, texte: r.texte, resultat: r.resultat, necessite_execution: r.necessiteExecution,
      taches: rows.map((t) => ({ tache_id: t.tache_id, titre: t.titre, statut: t.statut, date_echeance: t.date_echeance ? isoDate(t.date_echeance) : null, terminee_le: t.terminee_le, en_retard: t.date_echeance !== null && OUVERTES.includes(t.statut) && isoDate(t.date_echeance) < isoDate(new Date()) })),
    };
  });
}
