/**
 * M21 — Sondages consultatifs. Un sondage n'est JAMAIS un vote d'AG (Doc A §6) : aucune valeur
 * juridique, pondération par tantièmes purement informative. Les réponses individuelles ne sont
 * jamais exposées : chacun lit la sienne (RLS), les résultats viennent des fonctions SQL
 * `sondage_resultats` / `sondage_participation` (agrégats seulement).
 */
import { Prisma } from "@prisma/client";
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { envoyerNotification } from "../notifications/notifications";
import { withTenantIdempotent } from "../http/idempotency";
import type { Pagination, Tri } from "../http/pagination";
import { toApiString, money } from "../money";
import { audit, CommunicationError, destinatairesAudience, estGestion, identites, IntrouvableError, PermissionRefuseeError, type Identite } from "./communication";
import type { SondageCreateInput, SondageRepondreInput, SondageUpdateInput, SondagesFiltres, TRIS_SONDAGE } from "./schemas";

export const MENTION_SONDAGE = "Sondage consultatif : il n'a aucune valeur de vote d'assemblée générale (Doc A §6).";

type Option = { id: string; libelle: string };
function normaliserOptions(options: { id?: string; libelle: string }[]): Option[] {
  const vus = new Set<string>();
  return options.map((o, i) => {
    let id = (o.id ?? `opt${i + 1}`).toLowerCase();
    while (vus.has(id)) id = `${id}_${i}`;
    vus.add(id);
    return { id, libelle: o.libelle.trim() };
  });
}
function assertPeutGerer(ctx: TenantContext) {
  if (can("sondages.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seuls le syndic et le conseil syndical créent des sondages.");
}
async function chargerSondage(db: TenantDb, id: string) {
  const s = await db.sondage.findUnique({ where: { id } });
  if (!s) throw new IntrouvableError("Sondage introuvable.");
  return s;
}
type SondageRow = Prisma.SondageGetPayload<Record<string, never>>;

function presenter(s: SondageRow, maReponse: string[] | null, noms: Map<string, Identite>) {
  return {
    id: s.id,
    coproprieteId: s.coproprieteId,
    auteur: noms.get(s.auteurId) ?? { id: s.auteurId, nom: null, prenom: null },
    question: s.question,
    description: s.description,
    options: s.optionsJson as Option[],
    choixMultiple: s.choixMultiple,
    anonyme: s.anonyme,
    audience: s.audience,
    batiment: s.batiment,
    ponderationTantiemes: s.ponderationTantiemes,
    dateFin: s.dateFin,
    statut: s.statut,
    ouvertLe: s.ouvertLe,
    closLe: s.closLe,
    creeLe: s.creeLe,
    modifieLe: s.modifieLe,
    maReponse,
    mention: MENTION_SONDAGE,
  };
}

async function mesReponses(db: TenantDb, ctx: TenantContext, ids: string[]) {
  if (!ids.length) return new Map<string, string[]>();
  const rows = await db.sondageReponse.findMany({ where: { sondageId: { in: ids }, utilisateurId: ctx.utilisateurId }, select: { sondageId: true, choixJson: true } });
  return new Map(rows.map((r) => [r.sondageId, r.choixJson as string[]]));
}

const ORDER: Record<(typeof TRIS_SONDAGE)[number], (s: "asc" | "desc") => Prisma.SondageOrderByWithRelationInput[]> = {
  date_fin: (s) => [{ dateFin: s }],
  cree_le: (s) => [{ creeLe: s }],
  question: (s) => [{ question: s }],
};

export async function listerSondages(ctx: TenantContext, filtres: SondagesFiltres, pagination: Pagination, tri: Tri<(typeof TRIS_SONDAGE)[number]>) {
  if (can("sondages.repondre", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const where: Prisma.SondageWhereInput = { coproprieteId: ctx.coproprieteId };
    if (filtres.statut) where.statut = filtres.statut;
    else if (can("sondages.gerer", ctx.role) !== true) where.statut = { in: ["OUVERT", "CLOS"] };
    if (filtres.q) where.question = { contains: filtres.q, mode: "insensitive" };
    const [total, rows] = await Promise.all([db.sondage.count({ where }), db.sondage.findMany({ where, orderBy: [{ statut: "asc" }, ...ORDER[tri.champ](tri.sens)], skip: pagination.skip, take: pagination.take })]);
    const [miennes, noms] = await Promise.all([mesReponses(db, ctx, rows.map((r) => r.id)), identites(db, rows.map((r) => r.auteurId))]);
    return { total, rows: rows.map((r) => presenter(r, miennes.get(r.id) ?? null, noms)) };
  });
}

export async function creerSondage(ctx: TenantContext, input: SondageCreateInput) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const s = await db.sondage.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        auteurId: ctx.utilisateurId,
        question: input.question.trim(),
        description: input.description ?? null,
        optionsJson: normaliserOptions(input.options) as unknown as Prisma.InputJsonValue,
        choixMultiple: input.choix_multiple,
        anonyme: input.anonyme,
        audience: input.audience,
        batiment: input.audience === "BATIMENT" ? input.batiment ?? null : null,
        ponderationTantiemes: input.ponderation_tantiemes,
        dateFin: new Date(input.date_fin),
      },
    });
    await audit(db, ctx, "SONDAGE_CREE", "sondage", s.id, undefined, { question: s.question, audience: s.audience });
    return presenter(s, null, await identites(db, [s.auteurId]));
  });
}

export async function modifierSondage(ctx: TenantContext, id: string, input: SondageUpdateInput) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const avant = await chargerSondage(db, id);
    if (avant.statut !== "BROUILLON") throw new CommunicationError("SONDAGE_STATUT_INVALIDE", "Seul un brouillon se modifie (les réponses déjà données seraient faussées).");
    const audience = input.audience ?? avant.audience;
    const batiment = audience === "BATIMENT" ? (input.batiment === undefined ? avant.batiment : input.batiment) : null;
    if (audience === "BATIMENT" && !batiment) throw new CommunicationError("VALIDATION_ERROR", "`batiment` est requis pour l'audience BATIMENT.");
    const s = await db.sondage.update({
      where: { id },
      data: {
        ...(input.question !== undefined ? { question: input.question.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.options !== undefined ? { optionsJson: normaliserOptions(input.options) as unknown as Prisma.InputJsonValue } : {}),
        ...(input.choix_multiple !== undefined ? { choixMultiple: input.choix_multiple } : {}),
        ...(input.anonyme !== undefined ? { anonyme: input.anonyme } : {}),
        audience,
        batiment,
        ...(input.ponderation_tantiemes !== undefined ? { ponderationTantiemes: input.ponderation_tantiemes } : {}),
        ...(input.date_fin !== undefined ? { dateFin: new Date(input.date_fin) } : {}),
      },
    });
    await audit(db, ctx, "SONDAGE_MODIFIE", "sondage", id, { question: avant.question }, { champs: Object.keys(input) });
    return presenter(s, null, await identites(db, [s.auteurId]));
  });
}

export async function supprimerSondage(ctx: TenantContext, id: string) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const s = await chargerSondage(db, id);
    if (s.statut !== "BROUILLON") throw new CommunicationError("SONDAGE_STATUT_INVALIDE", "Seul un brouillon se supprime ; un sondage ouvert se clôt.");
    await db.sondage.delete({ where: { id } });
    await audit(db, ctx, "SONDAGE_SUPPRIME", "sondage", id, { question: s.question }, undefined);
    return { id, supprime: true };
  });
}

export async function ouvrirSondage(ctx: TenantContext, id: string, cle?: string) {
  assertPeutGerer(ctx);
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /sondages/${id}/ouvrir`, payload: { id } }, async (db) => {
    const s = await chargerSondage(db, id);
    if (s.statut !== "BROUILLON") throw new CommunicationError("SONDAGE_STATUT_INVALIDE", `Seul un brouillon s'ouvre (statut actuel : ${s.statut}).`);
    if (s.dateFin <= new Date()) throw new CommunicationError("SONDAGE_STATUT_INVALIDE", "La date de fin est déjà passée.");
    await db.sondage.update({ where: { id }, data: { statut: "OUVERT", ouvertLe: new Date() } });
    const destinataires = (await destinatairesAudience(db, ctx.coproprieteId, s.audience, s.batiment)).filter((u) => u !== ctx.utilisateurId);
    for (const u of destinataires) {
      await envoyerNotification(db, { coproprieteId: ctx.coproprieteId, utilisateurId: u, templateCode: "SONDAGE_OUVERT", canal: "PUSH", contenuJson: { sondage_id: id, question: s.question, date_fin: s.dateFin.toISOString().slice(0, 10) } });
    }
    await audit(db, ctx, "SONDAGE_OUVERT", "sondage", id, { statut: "BROUILLON" }, { statut: "OUVERT", destinataires: destinataires.length });
    return obtenirSondageDb(db, ctx, id);
  });
}

export async function cloreSondageDb(db: TenantDb, ctx: TenantContext, id: string, motif: "manuel" | "echeance") {
  const s = await chargerSondage(db, id);
  if (s.statut !== "OUVERT") throw new CommunicationError("SONDAGE_STATUT_INVALIDE", `Seul un sondage OUVERT se clôt (statut actuel : ${s.statut}).`);
  await db.sondage.update({ where: { id }, data: { statut: "CLOS", closLe: new Date() } });
  const participation = await participationDb(db, id);
  const destinataires = (await destinatairesAudience(db, s.coproprieteId, s.audience, s.batiment)).filter((u) => u !== ctx.utilisateurId);
  for (const u of destinataires) {
    await envoyerNotification(db, { coproprieteId: s.coproprieteId, utilisateurId: u, templateCode: "SONDAGE_CLOS", canal: "PUSH", contenuJson: { sondage_id: id, question: s.question, nb_reponses: String(participation.nb_reponses) } });
  }
  await audit(db, ctx, "SONDAGE_CLOS", "sondage", id, { statut: "OUVERT" }, { statut: "CLOS", motif, nb_reponses: participation.nb_reponses });
  return participation;
}
export async function cloreSondage(ctx: TenantContext, id: string, cle?: string) {
  assertPeutGerer(ctx);
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /sondages/${id}/clore`, payload: { id } }, async (db) => {
    await cloreSondageDb(db, ctx, id, "manuel");
    return obtenirSondageDb(db, ctx, id);
  });
}

export async function repondreSondage(ctx: TenantContext, id: string, input: SondageRepondreInput, cle?: string) {
  if (can("sondages.repondre", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à répondre.");
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /sondages/${id}/repondre`, payload: { id, choix: input.choix } }, async (db) => {
    const s = await chargerSondage(db, id);
    if (s.statut !== "OUVERT" || s.dateFin <= new Date()) throw new CommunicationError("SONDAGE_STATUT_INVALIDE", "Ce sondage n'est pas (ou plus) ouvert.");
    const options = (s.optionsJson as Option[]).map((o) => o.id);
    const choix = [...new Set(input.choix)];
    if (choix.some((c) => !options.includes(c))) throw new CommunicationError("SONDAGE_CHOIX_INVALIDE", "Option inconnue.");
    if (!s.choixMultiple && choix.length !== 1) throw new CommunicationError("SONDAGE_CHOIX_INVALIDE", "Ce sondage n'accepte qu'un seul choix.");
    const existante = await db.sondageReponse.findUnique({ where: { sondageId_utilisateurId: { sondageId: id, utilisateurId: ctx.utilisateurId } } });
    if (existante) throw new CommunicationError("SONDAGE_DEJA_REPONDU", "Vous avez déjà répondu à ce sondage.");
    await db.sondageReponse.createMany({ data: [{ sondageId: id, utilisateurId: ctx.utilisateurId, choixJson: choix }] });
    return obtenirSondageDb(db, ctx, id);
  });
}

async function participationDb(db: TenantDb, id: string) {
  const rows = await db.$queryRaw<{ nb_reponses: bigint; tantiemes: Prisma.Decimal | null }[]>`SELECT * FROM public.sondage_participation(${id}::uuid)`;
  const r = rows[0];
  return { nb_reponses: Number(r?.nb_reponses ?? 0), tantiemes: toApiString(money(r?.tantiemes?.toString() ?? "0")) };
}

/** Résultats agrégés — visibles de la gestion, de quiconque a répondu, et de tous une fois le sondage clos. */
export async function resultatsDb(db: TenantDb, ctx: TenantContext, s: SondageRow, maReponse: string[] | null) {
  const visibles = estGestion(ctx) || ctx.role === "CONSEIL_SYNDICAL" || s.statut === "CLOS" || maReponse !== null;
  if (!visibles) return null;
  const rows = await db.$queryRaw<{ option_id: string; nb: bigint; tantiemes: Prisma.Decimal | null }[]>`SELECT * FROM public.sondage_resultats(${s.id}::uuid)`;
  const participation = await participationDb(db, s.id);
  const parOption = new Map(rows.map((r) => [r.option_id, r]));
  const totalTantiemes = money(participation.tantiemes);
  const options = (s.optionsJson as Option[]).map((o) => {
    const r = parOption.get(o.id);
    const nb = Number(r?.nb ?? 0);
    const tant = money(r?.tantiemes?.toString() ?? "0");
    return {
      id: o.id,
      libelle: o.libelle,
      nb,
      pourcentage: participation.nb_reponses ? Number(((nb / participation.nb_reponses) * 100).toFixed(1)) : 0,
      tantiemes: toApiString(tant),
      pourcentage_tantiemes: totalTantiemes.greaterThan(0) ? Number(tant.dividedBy(totalTantiemes).times(100).toFixed(1)) : 0,
    };
  });
  const cibles = await destinatairesAudience(db, s.coproprieteId, s.audience, s.batiment);
  return { nb_reponses: participation.nb_reponses, nb_destinataires: cibles.length, tantiemes_exprimes: participation.tantiemes, ponderation_tantiemes: s.ponderationTantiemes, options, mention: MENTION_SONDAGE };
}

async function obtenirSondageDb(db: TenantDb, ctx: TenantContext, id: string) {
  const s = await chargerSondage(db, id);
  const maReponse = (await mesReponses(db, ctx, [id])).get(id) ?? null;
  return { ...presenter(s, maReponse, await identites(db, [s.auteurId])), resultats: await resultatsDb(db, ctx, s, maReponse) };
}
export async function obtenirSondage(ctx: TenantContext, id: string) {
  if (can("sondages.repondre", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, (db) => obtenirSondageDb(db, ctx, id));
}
export async function resultatsSondage(ctx: TenantContext, id: string) {
  if (can("sondages.repondre", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const s = await chargerSondage(db, id);
    const maReponse = (await mesReponses(db, ctx, [id])).get(id) ?? null;
    const r = await resultatsDb(db, ctx, s, maReponse);
    if (!r) throw new PermissionRefuseeError("Les résultats sont visibles après votre réponse ou à la clôture.");
    return { sondage_id: id, question: s.question, statut: s.statut, ...r };
  });
}
