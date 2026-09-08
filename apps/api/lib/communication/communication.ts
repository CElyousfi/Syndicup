/**
 * M21 — Communication : tableau d'affichage (annonces, accusés de lecture, commentaires modérés),
 * contacts utiles, préférences de notification. Doc A §8 (information des copropriétaires par le
 * syndic), §12 (confidentialité : les résidents ne voient jamais qui a lu).
 *
 * Deux couches : l'audience est filtrée ici (fan-out, listes) ET par la policy RLS
 * (`communication_audience_ok`). Publier = action probante (Idempotency-Key, audit, notifications).
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
import { assertCheminDansPerimetre, attacherDocument, preparerUploadModule, urlsSigneesDocuments, CheminHorsPerimetreError } from "../documents/attach";
import { assainirMarkdown, texteBrut } from "./sanitize";
import { PREFERENCES_DEFAUT, preferencesNotificationSchema, type AnnonceCreateInput, type AnnoncePublierInput, type AnnonceUpdateInput, type AnnoncesFiltres, type Audience, type CommentaireCreateInput, type CommunicationUploadUrlInput, type ContactUtileInput, type ContactUtileUpdateInput, type PreferencesNotification, type TRIS_ANNONCE } from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
export class CommunicationError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}
export { CheminHorsPerimetreError };

const SYSTEME = "00000000-0000-0000-0000-000000000000";
const ROLES_PROPRIETAIRES = ["PROPRIETAIRE", "INDIVISAIRE", "PERSONNE_MORALE_REPRESENTANT"] as const;

export function estGestion(ctx: TenantContext) {
  return ctx.role === "SYNDIC" || ctx.role === "SUPER_ADMIN";
}
function assertPeutGerer(ctx: TenantContext, categorie?: string) {
  if (can("annonces.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seuls le syndic et le conseil syndical publient des annonces.");
  if (categorie === "URGENCE" && !estGestion(ctx)) throw new PermissionRefuseeError("Les annonces URGENCE sont réservées au syndic.");
}
export async function audit(db: TenantDb, ctx: TenantContext, action: string, entite: string, entiteId: string, avant?: unknown, apres?: unknown) {
  await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId === SYSTEME ? null : ctx.utilisateurId, action, entite, entiteId, avant: avant as Prisma.InputJsonValue, apres: apres as Prisma.InputJsonValue });
}

// ── Audience ─────────────────────────────────────────────────────────────────

/** Identifiants des membres actifs du tenant appartenant à l'audience (même règle que `communication_audience_ok`). */
export async function destinatairesAudience(db: TenantDb, coproprieteId: string, audience: Audience, batiment: string | null): Promise<string[]> {
  const roles = await db.roleUtilisateur.findMany({ where: { coproprieteId, actif: true }, select: { utilisateurId: true, role: true } });
  const membres = new Set(roles.map((r) => r.utilisateurId));
  if (audience === "TOUS") return [...membres];
  if (audience === "CONSEIL") return [...new Set(roles.filter((r) => r.role === "CONSEIL_SYNDICAL").map((r) => r.utilisateurId))];
  const lots = await db.lot.findMany({ where: { coproprieteId }, select: { id: true, batiment: true } });
  const lotIds = lots.map((l) => l.id);
  if (audience === "PROPRIETAIRES") {
    const parRole = roles.filter((r) => (ROLES_PROPRIETAIRES as readonly string[]).includes(r.role)).map((r) => r.utilisateurId);
    const parLot = await db.lotProprietaire.findMany({ where: { lotId: { in: lotIds }, dateFin: null }, select: { utilisateurId: true } });
    return [...new Set([...parRole, ...parLot.map((p) => p.utilisateurId)])].filter((u) => membres.has(u));
  }
  if (audience === "OCCUPANTS") {
    const parRole = roles.filter((r) => r.role === "LOCATAIRE").map((r) => r.utilisateurId);
    const parLot = await db.lotOccupant.findMany({ where: { lotId: { in: lotIds }, dateFin: null }, select: { utilisateurId: true } });
    return [...new Set([...parRole, ...parLot.map((o) => o.utilisateurId)])].filter((u) => membres.has(u));
  }
  // BATIMENT
  const cibles = lots.filter((l) => l.batiment && l.batiment === batiment).map((l) => l.id);
  if (!cibles.length) return [];
  const [prop, occ] = await Promise.all([
    db.lotProprietaire.findMany({ where: { lotId: { in: cibles }, dateFin: null }, select: { utilisateurId: true } }),
    db.lotOccupant.findMany({ where: { lotId: { in: cibles }, dateFin: null }, select: { utilisateurId: true } }),
  ]);
  return [...new Set([...prop, ...occ].map((x) => x.utilisateurId))].filter((u) => membres.has(u));
}

/** Préférences de notification d'un utilisateur (colonne nullable → défauts). */
export function preferencesDe(json: unknown): PreferencesNotification {
  const parsed = preferencesNotificationSchema.safeParse(json ?? {});
  return parsed.success ? parsed.data : PREFERENCES_DEFAUT;
}

// ── Présentation ─────────────────────────────────────────────────────────────

const annonceInclude = {
  _count: { select: { commentaires: { where: { masqueParId: null } }, lectures: true } },
} satisfies Prisma.AnnonceInclude;
type AnnonceRow = Prisma.AnnonceGetPayload<{ include: typeof annonceInclude }>;
export type Identite = { id: string; nom: string | null; prenom: string | null };

/** Nom / prénom des membres du tenant (fonction SECURITY DEFINER bornée : un résident ne lit pas `utilisateur`). */
export async function identites(db: TenantDb, ids: string[]): Promise<Map<string, Identite>> {
  const uniques = [...new Set(ids)];
  if (!uniques.length) return new Map();
  const rows = await db.$queryRaw<Identite[]>`SELECT id, nom, prenom FROM public.communication_identites(${uniques}::uuid[])`;
  return new Map(rows.map((r) => [r.id, r]));
}
const identiteOu = (m: Map<string, Identite>, id: string): Identite => m.get(id) ?? { id, nom: null, prenom: null };

function presenterAnnonce(a: AnnonceRow, ctx: TenantContext, lues: Set<string>, noms: Map<string, Identite>) {
  const gestion = can("annonces.gerer", ctx.role) === true;
  return {
    id: a.id,
    coproprieteId: a.coproprieteId,
    auteur: identiteOu(noms, a.auteurId),
    titre: a.titre,
    contenu: a.contenu,
    apercu: texteBrut(a.contenu, 160),
    categorie: a.categorie,
    audience: a.audience,
    batiment: a.batiment,
    epingle: a.epingle,
    publieLe: a.publieLe,
    expireLe: a.expireLe,
    statut: a.statut,
    commentairesActives: a.commentairesActives,
    creeLe: a.creeLe,
    modifieLe: a.modifieLe,
    lu: lues.has(a.id),
    nbCommentaires: a._count.commentaires,
    // Les comptes de lecture ne sortent que pour la gestion (Doc A §12 : jamais entre résidents).
    nbLectures: gestion ? a._count.lectures : null,
  };
}

async function luesPar(db: TenantDb, ctx: TenantContext, annonceIds: string[]) {
  if (!annonceIds.length) return new Set<string>();
  const rows = await db.annonceLecture.findMany({ where: { annonceId: { in: annonceIds }, utilisateurId: ctx.utilisateurId }, select: { annonceId: true } });
  return new Set(rows.map((r) => r.annonceId));
}

async function chargerAnnonce(db: TenantDb, id: string) {
  const a = await db.annonce.findUnique({ where: { id }, include: annonceInclude });
  if (!a) throw new IntrouvableError("Annonce introuvable.");
  return a;
}

// ── Annonces ─────────────────────────────────────────────────────────────────

function whereAnnonces(ctx: TenantContext, filtres: AnnoncesFiltres): Prisma.AnnonceWhereInput {
  const gestion = can("annonces.gerer", ctx.role) === true;
  const where: Prisma.AnnonceWhereInput = { coproprieteId: ctx.coproprieteId };
  if (filtres.categorie) where.categorie = filtres.categorie;
  if (filtres.audience) where.audience = filtres.audience;
  // Un résident ne voit que les annonces publiées (la RLS l'impose aussi) ; par défaut la liste
  // exclut les archivées et les annonces expirées.
  if (filtres.statut) where.statut = gestion ? filtres.statut : "PUBLIEE";
  else if (gestion) where.statut = { in: ["BROUILLON", "PUBLIEE"] };
  else where.statut = "PUBLIEE";
  if (!filtres.statut) where.OR = [{ expireLe: null }, { expireLe: { gt: new Date() } }];
  if (filtres.q) where.AND = [{ OR: [{ titre: { contains: filtres.q, mode: "insensitive" } }, { contenu: { contains: filtres.q, mode: "insensitive" } }] }];
  return where;
}
const ORDER_ANNONCE: Record<(typeof TRIS_ANNONCE)[number], (s: "asc" | "desc") => Prisma.AnnonceOrderByWithRelationInput[]> = {
  publie_le: (s) => [{ epingle: "desc" }, { publieLe: { sort: s, nulls: "last" } }, { creeLe: s }],
  cree_le: (s) => [{ epingle: "desc" }, { creeLe: s }],
  titre: (s) => [{ titre: s }],
  categorie: (s) => [{ categorie: s }, { publieLe: "desc" }],
};

export async function listerAnnonces(ctx: TenantContext, filtres: AnnoncesFiltres, pagination: Pagination, tri: Tri<(typeof TRIS_ANNONCE)[number]>) {
  if (can("annonces.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const where = whereAnnonces(ctx, filtres);
    let ids: string[] | undefined;
    if (filtres.non_lues) {
      const lues = await db.annonceLecture.findMany({ where: { utilisateurId: ctx.utilisateurId }, select: { annonceId: true } });
      where.id = { notIn: lues.map((l) => l.annonceId) };
      ids = [];
    }
    const [total, rows, nonLues] = await Promise.all([
      db.annonce.count({ where }),
      db.annonce.findMany({ where, include: annonceInclude, orderBy: ORDER_ANNONCE[tri.champ](tri.sens), skip: pagination.skip, take: pagination.take }),
      db.annonce.count({ where: { coproprieteId: ctx.coproprieteId, statut: "PUBLIEE", OR: [{ expireLe: null }, { expireLe: { gt: new Date() } }], lectures: { none: { utilisateurId: ctx.utilisateurId } } } }),
    ]);
    void ids;
    const [lues, noms] = await Promise.all([luesPar(db, ctx, rows.map((r) => r.id)), identites(db, rows.map((r) => r.auteurId))]);
    return { total, rows: rows.map((r) => presenterAnnonce(r, ctx, lues, noms)), non_lues: nonLues };
  });
}

export const ENTETES_ANNONCES = ["titre", "categorie", "audience", "batiment", "statut", "epingle", "publie_le", "expire_le", "auteur", "nb_lectures", "nb_commentaires"];
export async function exporterAnnonces(ctx: TenantContext, filtres: AnnoncesFiltres, format: FormatExport): Promise<{ entetes: string[]; lignes: CelluleCsv[][]; nbLignes: number }> {
  if (can("exports.lire", ctx.role) !== true || can("annonces.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à exporter les annonces.");
  return withTenant(ctx, async (db) => {
    const rows = await db.annonce.findMany({ where: whereAnnonces(ctx, filtres), include: annonceInclude, orderBy: [{ publieLe: "desc" }] });
    const noms = await identites(db, rows.map((r) => r.auteurId));
    const lignes: CelluleCsv[][] = rows.map((a) => [a.titre, a.categorie, a.audience, a.batiment ?? "", a.statut, a.epingle, a.publieLe?.toISOString() ?? "", a.expireLe?.toISOString() ?? "", [noms.get(a.auteurId)?.prenom, noms.get(a.auteurId)?.nom].filter(Boolean).join(" "), a._count.lectures, a._count.commentaires]);
    await journaliserExport(db, ctx, { type: "ANNONCES", filtres: filtres as Record<string, unknown>, nbLignes: lignes.length, format });
    return { entetes: ENTETES_ANNONCES, lignes, nbLignes: lignes.length };
  });
}

export async function preparerUploadCommunication(ctx: TenantContext, input: CommunicationUploadUrlInput) {
  assertPeutGerer(ctx);
  return preparerUploadModule(ctx, "communication", input.nom_fichier);
}

async function attacherPieces(db: TenantDb, ctx: TenantContext, annonceId: string, pieces: { storage_path: string; nom: string }[]) {
  for (const p of pieces) {
    assertCheminDansPerimetre(ctx, "communication", p.storage_path);
    const doc = await attacherDocument(db, ctx, { module: "communication", type: "ANNONCE_PJ", nom: p.nom, storagePath: p.storage_path, visibilite: "PUBLIC_COPROPRIETE" });
    await db.document.update({ where: { id: doc.id }, data: { annonceId } });
  }
}

export async function creerAnnonce(ctx: TenantContext, input: AnnonceCreateInput) {
  assertPeutGerer(ctx, input.categorie);
  return withTenant(ctx, async (db) => {
    const a = await db.annonce.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        auteurId: ctx.utilisateurId,
        titre: input.titre.trim(),
        contenu: assainirMarkdown(input.contenu),
        categorie: input.categorie,
        audience: input.audience,
        batiment: input.audience === "BATIMENT" ? input.batiment ?? null : null,
        epingle: input.epingle,
        expireLe: input.expire_le ? new Date(input.expire_le) : null,
        commentairesActives: input.commentaires_actives,
      },
    });
    await attacherPieces(db, ctx, a.id, input.pieces_jointes);
    await audit(db, ctx, "ANNONCE_CREEE", "annonce", a.id, undefined, { titre: a.titre, categorie: a.categorie, audience: a.audience });
    return obtenirAnnonceDb(db, ctx, a.id);
  });
}

async function obtenirAnnonceDb(db: TenantDb, ctx: TenantContext, id: string) {
  const a = await chargerAnnonce(db, id);
  const gestion = can("annonces.gerer", ctx.role) === true;
  const [docs, commentaires, lues] = await Promise.all([
    db.document.findMany({ where: { annonceId: id }, select: { id: true, nom: true, type: true, storagePath: true }, orderBy: { creeLe: "asc" } }),
    db.annonceCommentaire.findMany({ where: { annonceId: id }, orderBy: { creeLe: "asc" } }),
    luesPar(db, ctx, [id]),
  ]);
  const noms = await identites(db, [a.auteurId, ...commentaires.map((c) => c.auteurId)]);
  return {
    ...presenterAnnonce(a, ctx, lues, noms),
    piecesJointes: await urlsSigneesDocuments(docs),
    commentaires: commentaires.map((c) => ({ id: c.id, auteur: identiteOu(noms, c.auteurId), contenu: c.contenu, masque: c.masqueParId !== null, creeLe: c.creeLe, mien: c.auteurId === ctx.utilisateurId })),
    // Cible théorique (nombre de membres dans l'audience) — gestion seulement.
    nbDestinataires: gestion ? (await destinatairesAudience(db, ctx.coproprieteId, a.audience, a.batiment)).length : null,
  };
}
export type AnnonceDetail = Awaited<ReturnType<typeof obtenirAnnonceDb>>;

export async function obtenirAnnonce(ctx: TenantContext, id: string) {
  if (can("annonces.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, (db) => obtenirAnnonceDb(db, ctx, id));
}

export async function modifierAnnonce(ctx: TenantContext, id: string, input: AnnonceUpdateInput) {
  assertPeutGerer(ctx, input.categorie);
  return withTenant(ctx, async (db) => {
    const avant = await chargerAnnonce(db, id);
    if (avant.statut === "ARCHIVEE") throw new CommunicationError("ANNONCE_STATUT_INVALIDE", "Une annonce archivée ne se modifie plus.");
    if (avant.categorie === "URGENCE" && !estGestion(ctx)) throw new PermissionRefuseeError("Les annonces URGENCE sont réservées au syndic.");
    const audience = input.audience ?? avant.audience;
    const batiment = audience === "BATIMENT" ? (input.batiment === undefined ? avant.batiment : input.batiment) : null;
    if (audience === "BATIMENT" && !batiment) throw new CommunicationError("VALIDATION_ERROR", "`batiment` est requis pour l'audience BATIMENT.");
    await db.annonce.update({
      where: { id },
      data: {
        ...(input.titre !== undefined ? { titre: input.titre.trim() } : {}),
        ...(input.contenu !== undefined ? { contenu: assainirMarkdown(input.contenu) } : {}),
        ...(input.categorie !== undefined ? { categorie: input.categorie } : {}),
        audience,
        batiment,
        ...(input.epingle !== undefined ? { epingle: input.epingle } : {}),
        ...(input.expire_le !== undefined ? { expireLe: input.expire_le ? new Date(input.expire_le) : null } : {}),
        ...(input.commentaires_actives !== undefined ? { commentairesActives: input.commentaires_actives } : {}),
      },
    });
    if (input.pieces_jointes) await attacherPieces(db, ctx, id, input.pieces_jointes);
    await audit(db, ctx, "ANNONCE_MODIFIEE", "annonce", id, { titre: avant.titre, audience: avant.audience, categorie: avant.categorie }, { champs: Object.keys(input) });
    return obtenirAnnonceDb(db, ctx, id);
  });
}

export async function supprimerAnnonce(ctx: TenantContext, id: string) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const a = await chargerAnnonce(db, id);
    if (a.statut !== "BROUILLON") throw new CommunicationError("ANNONCE_STATUT_INVALIDE", "Seul un brouillon se supprime ; archivez une annonce publiée.");
    await db.document.updateMany({ where: { annonceId: id }, data: { annonceId: null } });
    await db.annonce.delete({ where: { id } });
    await audit(db, ctx, "ANNONCE_SUPPRIMEE", "annonce", id, { titre: a.titre }, undefined);
    return { id, supprimee: true };
  });
}

/** Fan-out d'une annonce publiée : PUSH (centre in-app + FCM) selon la préférence, + SMS pour URGENCE si un fournisseur est configuré. */
export async function diffuserAnnonce(db: TenantDb, ctx: TenantContext, a: { id: string; coproprieteId: string; titre: string; contenu: string; categorie: string; audience: Audience; batiment: string | null; auteurId: string }) {
  const destinataires = (await destinatairesAudience(db, a.coproprieteId, a.audience, a.batiment)).filter((u) => u !== ctx.utilisateurId);
  const urgence = a.categorie === "URGENCE";
  const smsDisponible = Boolean(process.env.SMS_PROVIDER) || process.env.NODE_ENV !== "production";
  const prefs = await db.utilisateur.findMany({ where: { id: { in: destinataires } }, select: { id: true, preferencesNotificationJson: true } });
  const parId = new Map(prefs.map((p) => [p.id, preferencesDe(p.preferencesNotificationJson)]));
  const contenu = { annonce_id: a.id, titre: a.titre, categorie: a.categorie, apercu: texteBrut(a.contenu, 140) };
  let envoyes = 0;
  for (const u of destinataires) {
    const pref = parId.get(u) ?? PREFERENCES_DEFAUT;
    if (!urgence && !pref.annonces_push) continue;
    await envoyerNotification(db, { coproprieteId: a.coproprieteId, utilisateurId: u, templateCode: urgence ? "ANNONCE_URGENTE" : "ANNONCE_PUBLIEE", canal: "PUSH", contenuJson: contenu });
    if (urgence && smsDisponible) await envoyerNotification(db, { coproprieteId: a.coproprieteId, utilisateurId: u, templateCode: "ANNONCE_URGENTE", canal: "SMS", contenuJson: contenu });
    envoyes += 1;
  }
  return { destinataires: destinataires.length, envoyes };
}

export async function publierAnnonce(ctx: TenantContext, id: string, input: AnnoncePublierInput, cle?: string) {
  assertPeutGerer(ctx);
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /annonces/${id}/publier`, payload: { id, ...input } }, async (db) => {
    const a = await chargerAnnonce(db, id);
    if (a.statut !== "BROUILLON") throw new CommunicationError("ANNONCE_STATUT_INVALIDE", `Seul un brouillon se publie (statut actuel : ${a.statut}).`);
    if (a.categorie === "URGENCE" && !estGestion(ctx)) throw new PermissionRefuseeError("Les annonces URGENCE sont réservées au syndic.");
    const quand = input.publie_le ? new Date(input.publie_le) : new Date();
    if (a.expireLe && a.expireLe <= quand) throw new CommunicationError("ANNONCE_STATUT_INVALIDE", "La date d'expiration précède la publication.");
    if (quand.getTime() > Date.now() + 60_000) {
      // Publication programmée : reste BROUILLON (invisible des résidents) jusqu'au job horaire.
      await db.annonce.update({ where: { id }, data: { publieLe: quand } });
      await audit(db, ctx, "ANNONCE_PROGRAMMEE", "annonce", id, { statut: a.statut }, { publie_le: quand.toISOString() });
      return { ...(await obtenirAnnonceDb(db, ctx, id)), diffusion: { programmee: true, publie_le: quand.toISOString() } };
    }
    await db.annonce.update({ where: { id }, data: { statut: "PUBLIEE", publieLe: quand } });
    const diffusion = await diffuserAnnonce(db, ctx, { ...a, audience: a.audience });
    await audit(db, ctx, "ANNONCE_PUBLIEE", "annonce", id, { statut: a.statut }, { statut: "PUBLIEE", publie_le: quand.toISOString(), ...diffusion });
    return { ...(await obtenirAnnonceDb(db, ctx, id)), diffusion: { programmee: false, ...diffusion } };
  });
}

export async function archiverAnnonce(ctx: TenantContext, id: string) {
  assertPeutGerer(ctx);
  return withTenant(ctx, async (db) => {
    const a = await chargerAnnonce(db, id);
    if (a.statut === "ARCHIVEE") throw new CommunicationError("ANNONCE_STATUT_INVALIDE", "Annonce déjà archivée.");
    await db.annonce.update({ where: { id }, data: { statut: "ARCHIVEE", epingle: false } });
    await audit(db, ctx, "ANNONCE_ARCHIVEE", "annonce", id, { statut: a.statut }, { statut: "ARCHIVEE" });
    return obtenirAnnonceDb(db, ctx, id);
  });
}

/** POST /annonces/{id}/lu — accusé de lecture idempotent (unique annonce / utilisateur). */
export async function marquerLue(ctx: TenantContext, id: string) {
  if (can("annonces.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    await chargerAnnonce(db, id);
    const existante = await db.annonceLecture.findUnique({ where: { annonceId_utilisateurId: { annonceId: id, utilisateurId: ctx.utilisateurId } } });
    if (existante) return { annonce_id: id, lu_le: existante.luLe, deja: true };
    await db.annonceLecture.createMany({ data: [{ annonceId: id, utilisateurId: ctx.utilisateurId }] });
    const l = await db.annonceLecture.findUniqueOrThrow({ where: { annonceId_utilisateurId: { annonceId: id, utilisateurId: ctx.utilisateurId } } });
    return { annonce_id: id, lu_le: l.luLe, deja: false };
  });
}

/** GET /annonces/{id}/lectures — gestion : comptes + liste des lecteurs (jamais exposée aux résidents). */
export async function lecturesAnnonce(ctx: TenantContext, id: string) {
  if (can("annonces.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Statistiques de lecture réservées au syndic et au conseil.");
  return withTenant(ctx, async (db) => {
    const a = await chargerAnnonce(db, id);
    const [lectures, cibles] = await Promise.all([
      db.annonceLecture.findMany({ where: { annonceId: id }, orderBy: { luLe: "asc" }, select: { utilisateurId: true, luLe: true } }),
      destinatairesAudience(db, ctx.coproprieteId, a.audience, a.batiment),
    ]);
    const parId = await identites(db, lectures.map((l) => l.utilisateurId));
    return {
      annonce_id: id,
      nb_lu: lectures.length,
      nb_destinataires: cibles.length,
      lecteurs: lectures.map((l) => ({ utilisateur_id: l.utilisateurId, nom: parId.get(l.utilisateurId)?.nom ?? null, prenom: parId.get(l.utilisateurId)?.prenom ?? null, lu_le: l.luLe })),
    };
  });
}

// ── Commentaires ─────────────────────────────────────────────────────────────

export async function commenterAnnonce(ctx: TenantContext, id: string, input: CommentaireCreateInput) {
  if (can("annonces.commenter", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à commenter.");
  return withTenant(ctx, async (db) => {
    const a = await chargerAnnonce(db, id);
    if (a.statut !== "PUBLIEE") throw new CommunicationError("ANNONCE_STATUT_INVALIDE", "On ne commente qu'une annonce publiée.");
    if (!a.commentairesActives) throw new CommunicationError("COMMENTAIRES_DESACTIVES", "Les commentaires sont désactivés sur cette annonce.");
    const c = await db.annonceCommentaire.create({ data: { annonceId: id, auteurId: ctx.utilisateurId, contenu: assainirMarkdown(input.contenu) } });
    const auteur = identiteOu(await identites(db, [ctx.utilisateurId]), ctx.utilisateurId);
    // L'auteur de l'annonce est prévenu (sauf s'il se commente lui-même).
    if (a.auteurId !== ctx.utilisateurId) {
      await envoyerNotification(db, { coproprieteId: ctx.coproprieteId, utilisateurId: a.auteurId, templateCode: "ANNONCE_COMMENTAIRE", canal: "PUSH", contenuJson: { annonce_id: id, titre: a.titre, auteur: [auteur.prenom, auteur.nom].filter(Boolean).join(" "), apercu: texteBrut(c.contenu, 100) } });
    }
    return { id: c.id, auteur, contenu: c.contenu, masque: false, creeLe: c.creeLe, mien: true };
  });
}

export async function masquerCommentaire(ctx: TenantContext, id: string, commentaireId: string) {
  if (can("annonces.moderer", ctx.role) !== true) throw new PermissionRefuseeError("La modération est réservée au syndic.");
  return withTenant(ctx, async (db) => {
    const c = await db.annonceCommentaire.findFirst({ where: { id: commentaireId, annonceId: id } });
    if (!c) throw new IntrouvableError("Commentaire introuvable.");
    if (c.masqueParId) return { id: c.id, masque: true, deja: true };
    await db.annonceCommentaire.update({ where: { id: commentaireId }, data: { masqueParId: ctx.utilisateurId, masqueLe: new Date() } });
    await audit(db, ctx, "COMMENTAIRE_MASQUE", "annonce_commentaire", commentaireId, { masque: false }, { masque: true, annonce_id: id });
    return { id: c.id, masque: true, deja: false };
  });
}

// ── Contacts utiles ──────────────────────────────────────────────────────────

export async function listerContacts(ctx: TenantContext) {
  return withTenant(ctx, (db) => db.contactUtile.findMany({ where: { coproprieteId: ctx.coproprieteId }, orderBy: [{ ordre: "asc" }, { libelle: "asc" }] }));
}
function assertContacts(ctx: TenantContext) {
  if (can("contacts.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic gère les contacts utiles.");
}
export async function creerContact(ctx: TenantContext, input: ContactUtileInput) {
  assertContacts(ctx);
  return withTenant(ctx, async (db) => {
    const c = await db.contactUtile.create({ data: { coproprieteId: ctx.coproprieteId, libelle: input.libelle.trim(), telephone: input.telephone.trim(), ordre: input.ordre } });
    await audit(db, ctx, "CONTACT_UTILE_CREE", "contact_utile", c.id, undefined, { libelle: c.libelle });
    return c;
  });
}
export async function modifierContact(ctx: TenantContext, id: string, input: ContactUtileUpdateInput) {
  assertContacts(ctx);
  return withTenant(ctx, async (db) => {
    const avant = await db.contactUtile.findUnique({ where: { id } });
    if (!avant) throw new IntrouvableError("Contact introuvable.");
    const c = await db.contactUtile.update({ where: { id }, data: { ...(input.libelle !== undefined ? { libelle: input.libelle.trim() } : {}), ...(input.telephone !== undefined ? { telephone: input.telephone.trim() } : {}), ...(input.ordre !== undefined ? { ordre: input.ordre } : {}) } });
    await audit(db, ctx, "CONTACT_UTILE_MODIFIE", "contact_utile", id, { libelle: avant.libelle, telephone: avant.telephone }, { libelle: c.libelle, telephone: c.telephone });
    return c;
  });
}
export async function supprimerContact(ctx: TenantContext, id: string) {
  assertContacts(ctx);
  return withTenant(ctx, async (db) => {
    const avant = await db.contactUtile.findUnique({ where: { id } });
    if (!avant) throw new IntrouvableError("Contact introuvable.");
    await db.contactUtile.delete({ where: { id } });
    await audit(db, ctx, "CONTACT_UTILE_SUPPRIME", "contact_utile", id, { libelle: avant.libelle }, undefined);
    return { id, supprime: true };
  });
}

// ── Préférences de notification ──────────────────────────────────────────────

export async function lirePreferencesNotification(ctx: TenantContext) {
  return withTenant(ctx, async (db) => {
    const u = await db.utilisateur.findUnique({ where: { id: ctx.utilisateurId }, select: { preferencesNotificationJson: true } });
    return preferencesDe(u?.preferencesNotificationJson);
  });
}
export async function definirPreferencesNotification(ctx: TenantContext, input: PreferencesNotification) {
  return withTenant(ctx, async (db) => {
    await db.utilisateur.update({ where: { id: ctx.utilisateurId }, data: { preferencesNotificationJson: input as Prisma.InputJsonObject } });
    return input;
  });
}
