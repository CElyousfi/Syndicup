/**
 * M23 — Parkings et caves (Doc A §4). Les places titrées restent des lots (PARKING / CAVE, charges
 * par tantièmes) ; ce module gère les emplacements NON titrés (communs, visiteurs, PMR, moto,
 * vélo, caves communes), leur attribution (AG, rotation, location interne, temporaire, avec
 * redevance éventuelle), les véhicules déclarés (plaque normalisée, unique par copropriété), les
 * badges / télécommandes (caution via M17), les places visiteurs (gardien) et « véhicule sur ma
 * place ». Deux couches : permissions ici, policies RLS en base (résidents = leurs lots).
 */
import { Prisma } from "@prisma/client";
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import { withTenantIdempotent } from "../http/idempotency";
import type { ErrorCode } from "../http/respond";
import type { Pagination, Tri } from "../http/pagination";
import { journaliserExport, type CelluleCsv, type FormatExport } from "../http/export";
import { money, toApiString } from "../money";
import { identites, type Identite } from "../communication/communication";
import { normaliserImmatriculation, type AttribuerInput, type BadgeCreateInput, type BadgePerduInput, type BadgeRestituerInput, type BadgeUpdateInput, type BadgesFiltres, type EmplacementCreateInput, type EmplacementUpdateInput, type EmplacementsFiltres, type LibererInput, type NotifierVehiculeInput, type TRIS_EMPLACEMENT, type VehiculeCreateInput, type VehiculeUpdateInput, type VehiculesFiltres, type VisiteEmplacementInput } from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
export class ParkingError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}

const SYSTEME = "00000000-0000-0000-0000-000000000000";
type Ctx = { coproprieteId: string; utilisateurId: string | null };
export const dateUtc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function estGestion(ctx: TenantContext) {
  return ctx.role === "SYNDIC" || ctx.role === "SUPER_ADMIN";
}
function assertPeutGerer(ctx: TenantContext) {
  if (can("parkings.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic gère les parkings.");
}
function assertPeutLire(ctx: TenantContext) {
  if (can("parkings.lire", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
}
async function audit(db: TenantDb, ctx: Ctx, action: string, entite: string, entiteId: string, avant?: unknown, apres?: unknown) {
  await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId === SYSTEME ? null : ctx.utilisateurId, action, entite, entiteId, avant: avant as Prisma.InputJsonValue, apres: apres as Prisma.InputJsonValue });
}
async function notifier(db: TenantDb, coproprieteId: string, ids: (string | null | undefined)[], templateCode: string, contenu: Record<string, unknown>) {
  for (const u of new Set(ids.filter((x): x is string => Boolean(x) && x !== SYSTEME))) {
    await envoyerNotification(db, { coproprieteId, utilisateurId: u, templateCode, canal: "PUSH", contenuJson: contenu as Prisma.InputJsonValue });
  }
}
/** Résidents (propriétaires actifs + occupants en cours) d'un lot — fonction SECURITY DEFINER `residents_du_lot` (utilisable depuis un contexte gardien). */
export async function residentsDuLot(db: TenantDb, lotId: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ utilisateur_id: string }[]>`SELECT utilisateur_id FROM public.residents_du_lot(${lotId}::uuid)`;
  return rows.map((r) => r.utilisateur_id);
}
function estContrainteUnique(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}
/** Fiche complète dans la transaction courante. */
async function ficheEmplacement(db: TenantDb, id: string) {
  const e = await chargerEmplacement(db, id);
  const [pres] = await presenterEmplacements(db, [e]);
  const attributions = await db.attributionEmplacement.findMany({ where: { emplacementId: id }, orderBy: { dateDebut: "desc" } });
  const [lots, noms] = await Promise.all([numerosLots(db, attributions.map((a) => a.lotId)), identites(db, attributions.map((a) => a.creeParId).filter((x): x is string => Boolean(x)))]);
  return { ...pres!, attributions: attributions.map((a) => presenterAttribution(a, lots, noms)) };
}
export async function syndics(db: TenantDb, coproprieteId: string) {
  return (await db.roleUtilisateur.findMany({ where: { coproprieteId, actif: true, role: "SYNDIC" }, select: { utilisateurId: true }, distinct: ["utilisateurId"] })).map((s) => s.utilisateurId);
}
export async function gardiens(db: TenantDb, coproprieteId: string) {
  return (await db.roleUtilisateur.findMany({ where: { coproprieteId, actif: true, role: "GARDIEN" }, select: { utilisateurId: true }, distinct: ["utilisateurId"] })).map((s) => s.utilisateurId);
}
/** Lots (numéros) visibles pour les présentations — la RLS `lot` limite déjà les résidents à leurs lots. */
async function numerosLots(db: TenantDb, ids: string[]) {
  const uniques = [...new Set(ids)];
  if (!uniques.length) return new Map<string, string>();
  const rows = await db.lot.findMany({ where: { id: { in: uniques } }, select: { id: true, numero: true } });
  return new Map(rows.map((l) => [l.id, l.numero]));
}

// ── Emplacements ─────────────────────────────────────────────────────────────

const emplacementInclude = { _count: { select: { attributions: true, visites: true } } } satisfies Prisma.EmplacementInclude;
type EmplacementRow = Prisma.EmplacementGetPayload<{ include: typeof emplacementInclude }>;
type AttributionRow = Prisma.AttributionEmplacementGetPayload<Record<string, never>>;

function presenterAttribution(a: AttributionRow, lots: Map<string, string>, noms: Map<string, Identite>, now = new Date()) {
  const active = a.dateDebut <= now && (!a.dateFin || a.dateFin >= dateUtc(isoDate(now)));
  return { id: a.id, emplacementId: a.emplacementId, lotId: a.lotId, lotNumero: lots.get(a.lotId) ?? null, type: a.type, dateDebut: isoDate(a.dateDebut), dateFin: a.dateFin ? isoDate(a.dateFin) : null, resolutionAgId: a.resolutionAgId, redevanceMensuelle: a.redevanceMensuelle ? toApiString(a.redevanceMensuelle) : null, notes: a.notes, active, creePar: a.creeParId ? (noms.get(a.creeParId) ?? { id: a.creeParId, nom: null, prenom: null }) : null, creeLe: a.creeLe };
}
function presenterEmplacement(e: EmplacementRow, courante: ReturnType<typeof presenterAttribution> | null) {
  return { id: e.id, coproprieteId: e.coproprieteId, type: e.type, code: e.code, niveau: e.niveau, attribuable: e.attribuable, statut: e.statut, notes: e.notes, nbAttributions: e._count.attributions, attributionCourante: courante, creeLe: e.creeLe, modifieLe: e.modifieLe };
}
async function attributionsCourantes(db: TenantDb, emplacementIds: string[], now = new Date()) {
  if (!emplacementIds.length) return new Map<string, AttributionRow>();
  const aujourdhui = dateUtc(isoDate(now));
  const rows = await db.attributionEmplacement.findMany({ where: { emplacementId: { in: emplacementIds }, dateDebut: { lte: aujourdhui }, OR: [{ dateFin: null }, { dateFin: { gte: aujourdhui } }] }, orderBy: { dateDebut: "desc" } });
  const m = new Map<string, AttributionRow>();
  for (const r of rows) if (!m.has(r.emplacementId)) m.set(r.emplacementId, r);
  return m;
}
async function presenterEmplacements(db: TenantDb, rows: EmplacementRow[]) {
  const courantes = await attributionsCourantes(db, rows.map((r) => r.id));
  const attrs = [...courantes.values()];
  const [lots, noms] = await Promise.all([numerosLots(db, attrs.map((a) => a.lotId)), identites(db, attrs.map((a) => a.creeParId).filter((x): x is string => Boolean(x)))]);
  return rows.map((r) => { const c = courantes.get(r.id); return presenterEmplacement(r, c ? presenterAttribution(c, lots, noms) : null); });
}
function whereEmplacements(ctx: TenantContext, f: EmplacementsFiltres): Prisma.EmplacementWhereInput {
  const where: Prisma.EmplacementWhereInput = { coproprieteId: ctx.coproprieteId };
  if (f.type) where.type = f.type;
  if (f.niveau) where.niveau = f.niveau;
  if (f.statut) where.statut = f.statut;
  if (f.q) where.code = { contains: f.q, mode: "insensitive" };
  return where;
}
const ORDER_EMP: Record<(typeof TRIS_EMPLACEMENT)[number], (s: "asc" | "desc") => Prisma.EmplacementOrderByWithRelationInput[]> = {
  code: (s) => [{ code: s }],
  niveau: (s) => [{ niveau: { sort: s, nulls: "last" } }, { code: "asc" }],
  type: (s) => [{ type: s }, { code: "asc" }],
  statut: (s) => [{ statut: s }, { code: "asc" }],
};

export async function listerEmplacements(ctx: TenantContext, filtres: EmplacementsFiltres, pagination: Pagination, tri: Tri<(typeof TRIS_EMPLACEMENT)[number]>) {
  assertPeutLire(ctx);
  return withTenant(ctx, async (db) => {
    const where = whereEmplacements(ctx, filtres);
    const [total, rows, parStatut] = await Promise.all([db.emplacement.count({ where }), db.emplacement.findMany({ where, include: emplacementInclude, orderBy: ORDER_EMP[tri.champ](tri.sens), skip: pagination.skip, take: pagination.take }), db.emplacement.groupBy({ by: ["statut"], where: { coproprieteId: ctx.coproprieteId }, _count: { _all: true } })]);
    return { total, rows: await presenterEmplacements(db, rows), par_statut: Object.fromEntries(parStatut.map((p) => [p.statut, p._count._all])) };
  });
}
export const ENTETES_EMPLACEMENTS = ["code", "type", "niveau", "statut", "attribuable", "lot_beneficiaire", "type_attribution", "date_debut", "date_fin", "redevance_mensuelle"];
export async function exporterEmplacements(ctx: TenantContext, filtres: EmplacementsFiltres, format: FormatExport): Promise<{ entetes: string[]; lignes: CelluleCsv[][]; nbLignes: number }> {
  if (can("exports.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à exporter.");
  assertPeutLire(ctx);
  return withTenant(ctx, async (db) => {
    const rows = await presenterEmplacements(db, await db.emplacement.findMany({ where: whereEmplacements(ctx, filtres), include: emplacementInclude, orderBy: ORDER_EMP.niveau("asc") }));
    const lignes: CelluleCsv[][] = rows.map((e) => [e.code, e.type, e.niveau ?? "", e.statut, e.attribuable, e.attributionCourante?.lotNumero ?? "", e.attributionCourante?.type ?? "", e.attributionCourante?.dateDebut ?? "", e.attributionCourante?.dateFin ?? "", e.attributionCourante?.redevanceMensuelle ?? ""]);
    await journaliserExport(db, ctx, { type: "EMPLACEMENTS", filtres: filtres as Record<string, unknown>, nbLignes: lignes.length, format });
    return { entetes: ENTETES_EMPLACEMENTS, lignes, nbLignes: lignes.length };
  });
}
/** GET /emplacements/plan — grille par niveau avec occupation (pas de CAO). */
export async function planEmplacements(ctx: TenantContext) {
  assertPeutLire(ctx);
  return withTenant(ctx, async (db) => {
    const rows = await presenterEmplacements(db, await db.emplacement.findMany({ where: { coproprieteId: ctx.coproprieteId }, include: emplacementInclude, orderBy: ORDER_EMP.niveau("asc") }));
    const niveaux = new Map<string, typeof rows>();
    for (const r of rows) { const k = r.niveau ?? "—"; if (!niveaux.has(k)) niveaux.set(k, []); niveaux.get(k)!.push(r); }
    const total = rows.length, attribues = rows.filter((r) => r.attributionCourante).length, horsService = rows.filter((r) => r.statut === "HORS_SERVICE").length;
    const visiteurs = rows.filter((r) => r.type === "PARKING_VISITEUR");
    const aujourdhui = new Date(); aujourdhui.setUTCHours(0, 0, 0, 0);
    const occupees = await db.visite.findMany({ where: { coproprieteId: ctx.coproprieteId, emplacementId: { in: visiteurs.map((v) => v.id) }, horodatage: { gte: aujourdhui } }, select: { emplacementId: true } });
    const occ = new Set(occupees.map((o) => o.emplacementId));
    return { niveaux: [...niveaux.entries()].map(([niveau, emplacements]) => ({ niveau, emplacements: emplacements.map((e) => ({ ...e, visiteurOccupee: e.type === "PARKING_VISITEUR" && occ.has(e.id) })) })), totaux: { total, attribues, disponibles: total - attribues - horsService, hors_service: horsService, visiteurs: visiteurs.length, visiteurs_occupees: occ.size } };
  });
}
async function chargerEmplacement(db: TenantDb, id: string) {
  const e = await db.emplacement.findUnique({ where: { id }, include: emplacementInclude });
  if (!e) throw new IntrouvableError("Emplacement introuvable.");
  return e;
}
export async function obtenirEmplacement(ctx: TenantContext, id: string) {
  assertPeutLire(ctx);
  return withTenant(ctx, (db) => ficheEmplacement(db, id));
}
export async function creerEmplacement(ctx: TenantContext, input: EmplacementCreateInput) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const existant = await db.emplacement.findUnique({ where: { coproprieteId_code: { coproprieteId: ctx.coproprieteId, code: input.code.trim() } } });
    if (existant) throw new ParkingError("EMPLACEMENT_CODE_EXISTANT", `L'emplacement « ${input.code.trim()} » existe déjà.`);
    const e = await db.emplacement.create({ data: { coproprieteId: ctx.coproprieteId, type: input.type, code: input.code.trim(), niveau: input.niveau ?? null, attribuable: input.type === "PARKING_VISITEUR" ? false : input.attribuable, notes: input.notes ?? null }, include: emplacementInclude });
    await audit(db, ctx, "EMPLACEMENT_CREE", "emplacement", e.id, undefined, { code: e.code, type: e.type });
    return presenterEmplacement(e, null);
  });
}
export async function modifierEmplacement(ctx: TenantContext, id: string, input: EmplacementUpdateInput) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const avant = await chargerEmplacement(db, id);
    if (input.statut === "HORS_SERVICE" && avant.statut === "ATTRIBUE") throw new ParkingError("EMPLACEMENT_STATUT_INVALIDE", "Libérez l'emplacement avant de le mettre hors service.");
    if (input.code && input.code.trim() !== avant.code) {
      const doublon = await db.emplacement.findUnique({ where: { coproprieteId_code: { coproprieteId: ctx.coproprieteId, code: input.code.trim() } } });
      if (doublon) throw new ParkingError("EMPLACEMENT_CODE_EXISTANT", `L'emplacement « ${input.code.trim()} » existe déjà.`);
    }
    const e = await db.emplacement.update({ where: { id }, data: { ...(input.type !== undefined ? { type: input.type } : {}), ...(input.code !== undefined ? { code: input.code.trim() } : {}), ...(input.niveau !== undefined ? { niveau: input.niveau } : {}), ...(input.attribuable !== undefined ? { attribuable: input.attribuable } : {}), ...(input.statut !== undefined ? { statut: input.statut } : {}), ...(input.notes !== undefined ? { notes: input.notes } : {}) }, include: emplacementInclude });
    await audit(db, ctx, "EMPLACEMENT_MODIFIE", "emplacement", id, { code: avant.code, statut: avant.statut }, { champs: Object.keys(input) });
    const [pres] = await presenterEmplacements(db, [e]);
    return pres!;
  });
}
export async function supprimerEmplacement(ctx: TenantContext, id: string) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const e = await chargerEmplacement(db, id);
    if (e._count.attributions > 0 || e._count.visites > 0) throw new ParkingError("EMPLACEMENT_STATUT_INVALIDE", "Un emplacement ayant un historique se met hors service, il ne se supprime pas.");
    await db.emplacement.delete({ where: { id } });
    await audit(db, ctx, "EMPLACEMENT_SUPPRIME", "emplacement", id, { code: e.code }, undefined);
    return { id, supprime: true };
  });
}

// ── Attributions ─────────────────────────────────────────────────────────────

export async function attribuerEmplacement(ctx: TenantContext, id: string, input: AttribuerInput, cle?: string) {
  assertPeutGerer(ctx);
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /emplacements/${id}/attribuer`, payload: { id, ...input } }, async (db) => {
    const e = await chargerEmplacement(db, id);
    if (e.statut === "HORS_SERVICE") throw new ParkingError("EMPLACEMENT_STATUT_INVALIDE", "Emplacement hors service.");
    if (!e.attribuable || e.type === "PARKING_VISITEUR") throw new ParkingError("EMPLACEMENT_STATUT_INVALIDE", "Cet emplacement n'est pas attribuable (place visiteur ou commune non attribuable).");
    const lot = await db.lot.findUnique({ where: { id: input.lot_id }, select: { id: true, numero: true, coproprieteId: true } });
    if (!lot || lot.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Lot introuvable.");
    const debut = dateUtc(input.date_debut), fin = input.date_fin ? dateUtc(input.date_fin) : null;
    // Chevauchement : toute attribution dont la période coupe [debut, fin] → 409.
    const chevauche = await db.attributionEmplacement.findFirst({ where: { emplacementId: id, dateDebut: { lte: fin ?? new Date("2999-12-31") }, OR: [{ dateFin: null }, { dateFin: { gte: debut } }] } });
    if (chevauche) throw new ParkingError("ATTRIBUTION_CHEVAUCHEMENT", `L'emplacement est déjà attribué sur cette période (du ${isoDate(chevauche.dateDebut)}${chevauche.dateFin ? ` au ${isoDate(chevauche.dateFin)}` : ""}).`);
    if (input.resolution_ag_id) {
      const r = await db.agResolution.findUnique({ where: { id: input.resolution_ag_id }, select: { resultat: true, ag: { select: { coproprieteId: true } } } });
      if (!r || r.ag.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Résolution introuvable.");
      if (r.resultat !== "ADOPTEE") throw new ParkingError("EMPLACEMENT_STATUT_INVALIDE", "La résolution d'AG liée doit être ADOPTEE.");
    }
    const a = await db.attributionEmplacement.create({ data: { coproprieteId: ctx.coproprieteId, emplacementId: id, lotId: input.lot_id, type: input.type, dateDebut: debut, dateFin: fin, resolutionAgId: input.resolution_ag_id ?? null, redevanceMensuelle: input.redevance_mensuelle ? money(input.redevance_mensuelle).toString() : null, notes: input.notes ?? null, creeParId: ctx.utilisateurId } });
    const aujourdhui = dateUtc(isoDate(new Date()));
    if (debut <= aujourdhui && (!fin || fin >= aujourdhui)) await db.emplacement.update({ where: { id }, data: { statut: "ATTRIBUE" } });
    await audit(db, ctx, "EMPLACEMENT_ATTRIBUE", "emplacement", id, { statut: e.statut }, { attribution_id: a.id, lot_id: lot.id, type: a.type, date_debut: input.date_debut, date_fin: input.date_fin ?? null, redevance_mensuelle: input.redevance_mensuelle ?? null });
    await notifier(db, ctx.coproprieteId, await residentsDuLot(db, lot.id), "ATTRIBUTION_EMPLACEMENT", { emplacement_id: id, code: e.code, lot: lot.numero, date_debut: input.date_debut, date_fin: input.date_fin ?? "—", redevance: input.redevance_mensuelle ?? "0" });
    return ficheEmplacement(db, id);
  });
}
export async function libererEmplacement(ctx: TenantContext, id: string, input: LibererInput) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const e = await chargerEmplacement(db, id);
    const courante = (await attributionsCourantes(db, [id])).get(id);
    if (!courante) throw new ParkingError("EMPLACEMENT_STATUT_INVALIDE", "Aucune attribution en cours sur cet emplacement.");
    // `date_fin` = dernier jour d'occupation (inclus). Sans date : la place est libre dès aujourd'hui (fin = hier).
    const aujourdhui = dateUtc(isoDate(new Date()));
    let fin = input.date_fin ? dateUtc(input.date_fin) : new Date(aujourdhui.getTime() - 86_400_000);
    if (input.date_fin && fin < courante.dateDebut) throw new ParkingError("EMPLACEMENT_STATUT_INVALIDE", "La date de fin précède le début de l'attribution.");
    if (fin < courante.dateDebut) fin = courante.dateDebut;
    await db.attributionEmplacement.update({ where: { id: courante.id }, data: { dateFin: fin, expireeNotifieeLe: fin < aujourdhui ? new Date() : null, notes: input.motif ? `${courante.notes ? `${courante.notes}\n` : ""}${input.motif}` : courante.notes } });
    if (fin < aujourdhui || !input.date_fin) await db.emplacement.update({ where: { id }, data: { statut: "DISPONIBLE" } });
    await audit(db, ctx, "EMPLACEMENT_LIBERE", "emplacement", id, { statut: e.statut, attribution_id: courante.id }, { date_fin: isoDate(fin), motif: input.motif ?? null });
    await notifier(db, ctx.coproprieteId, await residentsDuLot(db, courante.lotId), "ATTRIBUTION_EXPIREE", { emplacement_id: id, code: e.code, date_fin: isoDate(fin) });
    return ficheEmplacement(db, id);
  });
}
/** Attributions d'un résident (ses lots) ou d'un lot — RLS. */
export async function mesAttributions(ctx: TenantContext, lotId?: string) {
  return withTenant(ctx, async (db) => {
    const rows = await db.attributionEmplacement.findMany({ where: { coproprieteId: ctx.coproprieteId, ...(lotId ? { lotId } : {}) }, include: { emplacement: { select: { id: true, code: true, type: true, niveau: true, statut: true } } }, orderBy: [{ dateDebut: "desc" }] });
    const [lots, noms] = await Promise.all([numerosLots(db, rows.map((r) => r.lotId)), identites(db, rows.map((r) => r.creeParId).filter((x): x is string => Boolean(x)))]);
    return rows.map((r) => ({ ...presenterAttribution(r, lots, noms), emplacement: r.emplacement }));
  });
}

// ── Véhicules ────────────────────────────────────────────────────────────────

async function assertLotDuResident(db: TenantDb, ctx: TenantContext, lotId: string) {
  if (estGestion(ctx)) return;
  const mien = await db.$queryRaw<{ lot_id: string }[]>`SELECT lot_id FROM public.lots_du_resident_courant() WHERE lot_id = ${lotId}::uuid`;
  if (!mien.length) throw new PermissionRefuseeError("Vous ne déclarez des véhicules que pour vos lots.");
}
type VehiculeRow = Prisma.VehiculeGetPayload<Record<string, never>>;
function presenterVehicule(v: VehiculeRow, lots: Map<string, string>) {
  return { id: v.id, coproprieteId: v.coproprieteId, lotId: v.lotId, lotNumero: lots.get(v.lotId) ?? null, utilisateurId: v.utilisateurId, immatriculation: v.immatriculation, marque: v.marque, couleur: v.couleur, type: v.type, actif: v.actif, creeLe: v.creeLe, modifieLe: v.modifieLe };
}
export async function listerVehicules(ctx: TenantContext, filtres: VehiculesFiltres) {
  if (can("vehicules.gerer_propres", ctx.role) === false && can("parkings.lire", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const where: Prisma.VehiculeWhereInput = { coproprieteId: ctx.coproprieteId };
    if (filtres.lot_id) where.lotId = filtres.lot_id;
    if (filtres.actif !== undefined) where.actif = filtres.actif === "1" || filtres.actif === "true";
    if (filtres.q) where.immatriculation = { contains: normaliserImmatriculation(filtres.q) };
    const rows = await db.vehicule.findMany({ where, orderBy: [{ actif: "desc" }, { immatriculation: "asc" }] });
    const lots = await numerosLots(db, rows.map((r) => r.lotId));
    return rows.map((r) => presenterVehicule(r, lots));
  });
}
export async function creerVehicule(ctx: TenantContext, brut: VehiculeCreateInput) {
  if (can("vehicules.gerer_propres", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé à déclarer un véhicule.");
  const input = { ...brut, immatriculation: normaliserImmatriculation(brut.immatriculation) };
  return withTenant(ctx, async (db) => {
    await assertLotDuResident(db, ctx, input.lot_id);
    const lot = await db.lot.findUnique({ where: { id: input.lot_id }, select: { id: true, numero: true } });
    if (!lot) throw new IntrouvableError("Lot introuvable.");
    const doublon = await db.vehicule.findUnique({ where: { coproprieteId_immatriculation: { coproprieteId: ctx.coproprieteId, immatriculation: input.immatriculation } } });
    if (doublon) throw new ParkingError("IMMATRICULATION_EXISTANTE", `La plaque ${input.immatriculation} est déjà déclarée${doublon.lotId === input.lot_id ? " pour ce lot" : " sur un autre lot"}.`);
    let v;
    try {
      v = await db.vehicule.create({ data: { coproprieteId: ctx.coproprieteId, lotId: input.lot_id, utilisateurId: estGestion(ctx) ? null : ctx.utilisateurId, immatriculation: input.immatriculation, marque: input.marque ?? null, couleur: input.couleur ?? null, type: input.type } });
    } catch (e) {
      // Le doublon peut être invisible sous RLS (véhicule d'un autre lot) : l'index unique tranche.
      if (estContrainteUnique(e)) throw new ParkingError("IMMATRICULATION_EXISTANTE", `La plaque ${input.immatriculation} est déjà déclarée dans la copropriété.`);
      throw e;
    }
    await audit(db, ctx, "VEHICULE_DECLARE", "vehicule", v.id, undefined, { lot_id: lot.id, immatriculation: v.immatriculation, type: v.type });
    return presenterVehicule(v, new Map([[lot.id, lot.numero]]));
  });
}
export async function modifierVehicule(ctx: TenantContext, id: string, brut: VehiculeUpdateInput) {
  if (can("vehicules.gerer_propres", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  const input = { ...brut, ...(brut.immatriculation !== undefined ? { immatriculation: normaliserImmatriculation(brut.immatriculation) } : {}) };
  return withTenant(ctx, async (db) => {
    const avant = await db.vehicule.findUnique({ where: { id } });
    if (!avant) throw new IntrouvableError("Véhicule introuvable.");
    await assertLotDuResident(db, ctx, avant.lotId);
    if (input.immatriculation && input.immatriculation !== avant.immatriculation) {
      const doublon = await db.vehicule.findUnique({ where: { coproprieteId_immatriculation: { coproprieteId: ctx.coproprieteId, immatriculation: input.immatriculation } } });
      if (doublon) throw new ParkingError("IMMATRICULATION_EXISTANTE", `La plaque ${input.immatriculation} est déjà déclarée.`);
    }
    let v;
    try {
      v = await db.vehicule.update({ where: { id }, data: { ...(input.immatriculation !== undefined ? { immatriculation: input.immatriculation } : {}), ...(input.marque !== undefined ? { marque: input.marque } : {}), ...(input.couleur !== undefined ? { couleur: input.couleur } : {}), ...(input.type !== undefined ? { type: input.type } : {}), ...(input.actif !== undefined ? { actif: input.actif } : {}) } });
    } catch (e) {
      if (estContrainteUnique(e)) throw new ParkingError("IMMATRICULATION_EXISTANTE", `La plaque ${input.immatriculation} est déjà déclarée dans la copropriété.`);
      throw e;
    }
    await audit(db, ctx, "VEHICULE_MODIFIE", "vehicule", id, { immatriculation: avant.immatriculation, actif: avant.actif }, { champs: Object.keys(input) });
    const lots = await numerosLots(db, [v.lotId]);
    return presenterVehicule(v, lots);
  });
}
export async function supprimerVehicule(ctx: TenantContext, id: string) {
  return modifierVehicule(ctx, id, { actif: false });
}
/** GET /vehicules/recherche — gardien / syndic, AUDITÉE (VEHICULE_RECHERCHE) : plaque → lot, résidents à prévenir. */
export async function rechercherVehicule(ctx: TenantContext, brut: string) {
  if (can("vehicules.rechercher", ctx.role) !== true) throw new PermissionRefuseeError("La recherche de plaque est réservée au gardien et au syndic.");
  const immatriculation = normaliserImmatriculation(brut);
  return withTenant(ctx, async (db) => {
    const rows = await db.vehicule.findMany({ where: { coproprieteId: ctx.coproprieteId, actif: true, OR: [{ immatriculation }, { immatriculation: { contains: immatriculation } }] }, orderBy: { immatriculation: "asc" }, take: 10 });
    const lots = await numerosLots(db, rows.map((r) => r.lotId));
    await audit(db, ctx, "VEHICULE_RECHERCHE", "vehicule", rows[0]?.id ?? "00000000-0000-0000-0000-000000000000", undefined, { immatriculation, resultats: rows.length });
    const exact = rows.find((r) => r.immatriculation === immatriculation) ?? null;
    return { immatriculation, exact: exact ? presenterVehicule(exact, lots) : null, similaires: rows.filter((r) => r.id !== exact?.id).map((r) => presenterVehicule(r, lots)) };
  });
}
/** Plaques actives (cache hors-ligne du gardien) — gardien / syndic. */
export async function plaquesActives(ctx: TenantContext) {
  if (can("vehicules.rechercher", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const rows = await db.vehicule.findMany({ where: { coproprieteId: ctx.coproprieteId, actif: true }, select: { immatriculation: true, lotId: true, marque: true, couleur: true, type: true } });
    const lots = await numerosLots(db, rows.map((r) => r.lotId));
    return rows.map((r) => ({ immatriculation: r.immatriculation, lot: lots.get(r.lotId) ?? null, marque: r.marque, couleur: r.couleur, type: r.type }));
  });
}

// ── Badges ───────────────────────────────────────────────────────────────────

type BadgeRow = Prisma.BadgeGetPayload<{ include: { cautionPaiement: { select: { id: true; montant: true; methode: true } } } }>;
const badgeInclude = { cautionPaiement: { select: { id: true, montant: true, methode: true } } } satisfies Prisma.BadgeInclude;
function presenterBadge(b: BadgeRow, lots: Map<string, string>, noms: Map<string, Identite>) {
  return { id: b.id, coproprieteId: b.coproprieteId, lotId: b.lotId, lotNumero: lots.get(b.lotId) ?? null, type: b.type, identifiant: b.identifiant, statut: b.statut, remisLe: isoDate(b.remisLe), remisPar: b.remisParId ? (noms.get(b.remisParId) ?? { id: b.remisParId, nom: null, prenom: null }) : null, restitueLe: b.restitueLe ? isoDate(b.restitueLe) : null, cautionMontant: b.cautionMontant ? toApiString(b.cautionMontant) : null, cautionPaiement: b.cautionPaiement ? { id: b.cautionPaiement.id, montant: toApiString(b.cautionPaiement.montant), methode: b.cautionPaiement.methode } : null, notes: b.notes, creeLe: b.creeLe };
}
async function presenterBadges(db: TenantDb, rows: BadgeRow[]) {
  const [lots, noms] = await Promise.all([numerosLots(db, rows.map((r) => r.lotId)), identites(db, rows.map((r) => r.remisParId).filter((x): x is string => Boolean(x)))]);
  return rows.map((r) => presenterBadge(r, lots, noms));
}
export async function listerBadges(ctx: TenantContext, filtres: BadgesFiltres) {
  if (can("parkings.lire", ctx.role) === false && can("vehicules.gerer_propres", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const where: Prisma.BadgeWhereInput = { coproprieteId: ctx.coproprieteId };
    if (filtres.lot_id) where.lotId = filtres.lot_id;
    if (filtres.type) where.type = filtres.type;
    if (filtres.statut) where.statut = filtres.statut;
    return presenterBadges(db, await db.badge.findMany({ where, include: badgeInclude, orderBy: [{ statut: "asc" }, { type: "asc" }, { identifiant: "asc" }] }));
  });
}
async function chargerBadge(db: TenantDb, id: string) {
  const b = await db.badge.findUnique({ where: { id }, include: badgeInclude });
  if (!b) throw new IntrouvableError("Badge introuvable.");
  return b;
}
async function assertPaiementCaution(db: TenantDb, ctx: TenantContext, paiementId: string | null | undefined, lotId: string) {
  if (!paiementId) return;
  const p = await db.paiement.findUnique({ where: { id: paiementId }, select: { lotId: true } });
  if (!p) throw new IntrouvableError("Paiement de caution introuvable.");
  if (p.lotId !== lotId) throw new ParkingError("BADGE_STATUT_INVALIDE", "Le paiement de caution doit appartenir au lot du badge.");
}
export async function creerBadge(ctx: TenantContext, input: BadgeCreateInput) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const lot = await db.lot.findUnique({ where: { id: input.lot_id }, select: { id: true, numero: true } });
    if (!lot) throw new IntrouvableError("Lot introuvable.");
    const doublon = await db.badge.findUnique({ where: { coproprieteId_type_identifiant: { coproprieteId: ctx.coproprieteId, type: input.type, identifiant: input.identifiant.trim() } } });
    if (doublon) throw new ParkingError("BADGE_IDENTIFIANT_EXISTANT", `Le badge ${input.identifiant.trim()} (${input.type}) existe déjà.`);
    await assertPaiementCaution(db, ctx, input.caution_paiement_id, input.lot_id);
    const b = await db.badge.create({ data: { coproprieteId: ctx.coproprieteId, lotId: input.lot_id, type: input.type, identifiant: input.identifiant.trim(), remisLe: dateUtc(input.remis_le), remisParId: ctx.utilisateurId, cautionMontant: input.caution_montant ? money(input.caution_montant).toString() : null, cautionPaiementId: input.caution_paiement_id ?? null, notes: input.notes ?? null }, include: badgeInclude });
    await audit(db, ctx, "BADGE_REMIS", "badge", b.id, undefined, { lot_id: lot.id, type: b.type, identifiant: b.identifiant, caution: input.caution_montant ?? null });
    await notifier(db, ctx.coproprieteId, await residentsDuLot(db, lot.id), "BADGE_REMIS", { badge_id: b.id, type: b.type, identifiant: b.identifiant, lot: lot.numero });
    return (await presenterBadges(db, [b]))[0]!;
  });
}
export async function modifierBadge(ctx: TenantContext, id: string, input: BadgeUpdateInput) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const avant = await chargerBadge(db, id);
    await assertPaiementCaution(db, ctx, input.caution_paiement_id, avant.lotId);
    const b = await db.badge.update({ where: { id }, data: { ...(input.identifiant !== undefined ? { identifiant: input.identifiant.trim() } : {}), ...(input.caution_montant !== undefined ? { cautionMontant: input.caution_montant ? money(input.caution_montant).toString() : null } : {}), ...(input.caution_paiement_id !== undefined ? { cautionPaiementId: input.caution_paiement_id } : {}), ...(input.notes !== undefined ? { notes: input.notes } : {}) }, include: badgeInclude });
    await audit(db, ctx, "BADGE_MODIFIE", "badge", id, { identifiant: avant.identifiant }, { champs: Object.keys(input) });
    return (await presenterBadges(db, [b]))[0]!;
  });
}
export async function declarerBadgePerdu(ctx: TenantContext, id: string, input: BadgePerduInput) {
  if (can("parkings.gerer", ctx.role) !== true && can("vehicules.gerer_propres", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const b = await chargerBadge(db, id);
    if (!estGestion(ctx)) await assertLotDuResident(db, ctx, b.lotId);
    if (b.statut !== "ACTIF") throw new ParkingError("BADGE_STATUT_INVALIDE", `Seul un badge ACTIF se déclare perdu (statut actuel : ${b.statut}).`);
    await db.badge.update({ where: { id }, data: { statut: "PERDU", notes: input.commentaire ? `${b.notes ? `${b.notes}\n` : ""}${input.commentaire}` : b.notes } });
    await audit(db, ctx, "BADGE_PERDU", "badge", id, { statut: "ACTIF" }, { statut: "PERDU" });
    const lots = await numerosLots(db, [b.lotId]);
    await notifier(db, ctx.coproprieteId, (await syndics(db, ctx.coproprieteId)).filter((u) => u !== ctx.utilisateurId), "BADGE_PERDU", { badge_id: id, type: b.type, identifiant: b.identifiant, lot: lots.get(b.lotId) ?? "" });
    // M22 — tâche « désactiver physiquement le badge » (une seule fois par badge).
    let tacheId: string | null = null;
    if (input.creer_tache && estGestion(ctx)) {
      const { creerTacheSysteme } = await import("../taches/taches");
      const t = await creerTacheSysteme(db, ctx, { titre: `Désactiver le badge perdu ${b.identifiant} (${b.type}) — lot ${lots.get(b.lotId) ?? ""}`, description: "Désactivation physique sur la centrale / le portail, puis remise d'un remplacement (dépense éventuelle).", origine: "SYSTEME", priorite: "HAUTE" }, { origine: "SYSTEME", titre: { startsWith: `Désactiver le badge perdu ${b.identifiant}` } });
      tacheId = t.id;
    }
    return { ...(await presenterBadges(db, [await chargerBadge(db, id)]))[0]!, tache_id: tacheId };
  });
}
export async function restituerBadge(ctx: TenantContext, id: string, input: BadgeRestituerInput) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const b = await chargerBadge(db, id);
    if (b.statut === "RESTITUE") throw new ParkingError("BADGE_STATUT_INVALIDE", "Badge déjà restitué.");
    const quand = input.restitue_le ? dateUtc(input.restitue_le) : dateUtc(isoDate(new Date()));
    await db.badge.update({ where: { id }, data: { statut: "RESTITUE", restitueLe: quand } });
    await audit(db, ctx, "BADGE_RESTITUE", "badge", id, { statut: b.statut }, { statut: "RESTITUE", restitue_le: isoDate(quand), caution_rendue: input.caution_rendue, caution_montant: b.cautionMontant ? toApiString(b.cautionMontant) : null });
    return (await presenterBadges(db, [await chargerBadge(db, id)]))[0]!;
  });
}
export async function desactiverBadge(ctx: TenantContext, id: string) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const b = await chargerBadge(db, id);
    if (b.statut === "DESACTIVE" || b.statut === "RESTITUE") throw new ParkingError("BADGE_STATUT_INVALIDE", `Badge déjà ${b.statut}.`);
    await db.badge.update({ where: { id }, data: { statut: "DESACTIVE" } });
    await audit(db, ctx, "BADGE_DESACTIVE", "badge", id, { statut: b.statut }, { statut: "DESACTIVE" });
    return (await presenterBadges(db, [await chargerBadge(db, id)]))[0]!;
  });
}

// ── Places visiteurs ─────────────────────────────────────────────────────────

/** POST /visites/{id}/emplacement — gardien (sa visite) ou syndic : place visiteur + plaque + heure limite. */
export async function attribuerPlaceVisiteur(ctx: TenantContext, visiteId: string, input: VisiteEmplacementInput) {
  const permission = can("visites.creer", ctx.role);
  if (permission !== true) throw new PermissionRefuseeError("Seul le gardien (ou le syndic) attribue une place visiteur.");
  return withTenant(ctx, async (db) => {
    const v = await db.visite.findUnique({ where: { id: visiteId } });
    if (!v) throw new IntrouvableError("Visite introuvable.");
    if (ctx.role === "GARDIEN" && v.gardienId !== ctx.utilisateurId) throw new PermissionRefuseeError("Vous n'attribuez une place que pour vos propres visites.");
    let emplacement: { id: string; code: string } | null = null;
    if (input.emplacement_id) {
      const e = await chargerEmplacement(db, input.emplacement_id);
      if (e.type !== "PARKING_VISITEUR" || e.statut === "HORS_SERVICE") throw new ParkingError("EMPLACEMENT_NON_VISITEUR", "Choisissez une place visiteur en service.");
      const aujourdhui = new Date(); aujourdhui.setUTCHours(0, 0, 0, 0);
      const occupee = await db.visite.findFirst({ where: { emplacementId: e.id, id: { not: visiteId }, horodatage: { gte: aujourdhui }, OR: [{ heureLimite: null }, { heureLimite: { gt: new Date() } }] } });
      if (occupee) throw new ParkingError("ATTRIBUTION_CHEVAUCHEMENT", `La place ${e.code} est déjà occupée par un visiteur.`);
      emplacement = { id: e.id, code: e.code };
    }
    const maj = await db.visite.update({ where: { id: visiteId }, data: { emplacementId: emplacement?.id ?? null, immatriculation: input.immatriculation ? normaliserImmatriculation(input.immatriculation) || null : null, heureLimite: input.heure_limite ? new Date(input.heure_limite) : null } });
    await audit(db, ctx, "VISITE_EMPLACEMENT", "visite", visiteId, { emplacement_id: v.emplacementId }, { emplacement_id: maj.emplacementId, immatriculation: maj.immatriculation, heure_limite: maj.heureLimite?.toISOString() ?? null });
    return { ...maj, emplacement };
  });
}
/** GET /parkings/visiteurs/aujourdhui — gardien / syndic : places visiteurs occupées aujourd'hui. */
export async function visiteursAujourdhui(ctx: TenantContext, now = new Date()) {
  if (can("vehicules.rechercher", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const aujourdhui = new Date(now); aujourdhui.setUTCHours(0, 0, 0, 0);
    const [visites, sejours, places] = await Promise.all([
      db.visite.findMany({ where: { coproprieteId: ctx.coproprieteId, emplacementId: { not: null }, horodatage: { gte: aujourdhui } }, include: { emplacement: { select: { id: true, code: true, niveau: true } } }, orderBy: { horodatage: "desc" } }),
      db.sejourCourteDuree.findMany({ where: { emplacementId: { not: null }, dateArrivee: { lte: now }, dateDepart: { gte: aujourdhui }, statut: { in: ["EN_COURS", "PREVU"] } }, select: { id: true, lotId: true, voyageurPrincipalNom: true, plaqueVehicule: true, dateDepart: true, emplacement: { select: { id: true, code: true, niveau: true } } } }),
      db.emplacement.findMany({ where: { coproprieteId: ctx.coproprieteId, type: "PARKING_VISITEUR", statut: { not: "HORS_SERVICE" } }, select: { id: true, code: true, niveau: true } }),
    ]);
    const lots = await numerosLots(db, [...visites.map((v) => v.lotId), ...sejours.map((s) => s.lotId)]);
    const occupees = new Set([...visites.map((v) => v.emplacementId!), ...sejours.map((s) => s.emplacement?.id).filter(Boolean)]);
    return {
      visites: visites.map((v) => ({ visite_id: v.id, visiteur_nom: v.visiteurNom, lot: lots.get(v.lotId) ?? null, immatriculation: v.immatriculation, heure_limite: v.heureLimite, depassee: Boolean(v.heureLimite && v.heureLimite < now), emplacement: v.emplacement, horodatage: v.horodatage })),
      sejours: sejours.map((s) => ({ sejour_id: s.id, voyageur: s.voyageurPrincipalNom, lot: lots.get(s.lotId) ?? null, immatriculation: s.plaqueVehicule, date_depart: s.dateDepart, emplacement: s.emplacement })),
      places_libres: places.filter((p) => !occupees.has(p.id)),
    };
  });
}

// ── « Véhicule sur ma place » ────────────────────────────────────────────────

/** POST /incidents/{id}/notifier-vehicule — gardien / syndic : la plaque signalée est cherchée (auditée) et le lot prévenu. */
export async function notifierVehiculeMalStationne(ctx: TenantContext, incidentId: string, input: NotifierVehiculeInput) {
  if (can("vehicules.rechercher", ctx.role) !== true) throw new PermissionRefuseeError("Réservé au gardien et au syndic.");
  return withTenant(ctx, async (db) => {
    const inc = await db.incident.findUnique({ where: { id: incidentId }, include: { emplacement: { select: { code: true } }, lot: { select: { numero: true } } } });
    if (!inc) throw new IntrouvableError("Incident introuvable.");
    const plaque = normaliserImmatriculation(input.immatriculation ?? inc.immatriculationSignalee ?? "");
    if (!plaque) throw new ParkingError("IMMATRICULATION_INCONNUE", "Aucune plaque signalée sur cet incident.");
    const v = await db.vehicule.findUnique({ where: { coproprieteId_immatriculation: { coproprieteId: ctx.coproprieteId, immatriculation: plaque } } });
    await audit(db, ctx, "VEHICULE_RECHERCHE", "incident", incidentId, undefined, { immatriculation: plaque, trouve: Boolean(v) });
    if (!v || !v.actif) throw new ParkingError("IMMATRICULATION_INCONNUE", `Plaque ${plaque} inconnue : véhicule extérieur — procédure fourrière selon le règlement (Doc A §4.2).`);
    const dest = await residentsDuLot(db, v.lotId);
    await notifier(db, ctx.coproprieteId, dest, "VEHICULE_MAL_STATIONNE", { incident_id: incidentId, immatriculation: plaque, emplacement: inc.emplacement?.code ?? inc.lot?.numero ?? "—", message: input.message ?? "" });
    await db.incidentLog.create({ data: { incidentId, statutAvant: inc.statut, statutApres: inc.statut, acteurId: ctx.utilisateurId, commentaire: `Propriétaire du véhicule ${plaque} notifié (${dest.length} résident(s)).` } });
    const lots = await numerosLots(db, [v.lotId]);
    return { immatriculation: plaque, lot: lots.get(v.lotId) ?? null, notifies: dest.length };
  });
}
