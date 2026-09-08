/**
 * M25 — Cabinet de syndic / portefeuille multi-résidences (Doc A §8). Un cabinet gère 5 à 40
 * copropriétés avec une petite équipe. Modèle d'autorisation (critique) : un membre du cabinet
 * n'accède à une copropriété QUE par une ligne `role_utilisateur` posée par la réconciliation
 * `cabinet_appliquer_acces` (gestionnaire principal → SYNDIC, comptable → SYNDIC_COMPTABLE lecture
 * seule) ; les policies RLS des tables de copropriété ne regardent jamais cabinet_membre. Retirer
 * un membre ou terminer un mandat révoque ces rôles dans la même transaction. Journal append-only
 * `cabinet_log`, audit `CABINET_*` / `MANDAT_*` côté copropriété.
 */
import { Prisma } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import { can } from "../auth/permissions";
import { withActeur, withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import { regenererEcheances } from "../contrats/contrats";
import type { ErrorCode } from "../http/respond";
import type { Tri } from "../http/pagination";
import { money, toApiString } from "../money";
import type { CabinetCreateInput, CabinetUpdateInput, MandatCreateInput, MandatTerminerInput, MandatUpdateInput, MembreCreateInput, MembreUpdateInput, PortefeuilleFiltres, PrestataireModeleInput, RoleCabinet, TRIS_PORTEFEUILLE } from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
export class CabinetError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}

/** Acteur d'une requête « cabinet » : identité JWT + drapeau opérateur plateforme (aucune copropriété requise). */
export type Acteur = { utilisateurId: string; superAdmin: boolean };
const roleActeur = (a: Acteur) => (a.superAdmin ? "SUPER_ADMIN" : "CABINET") as "SUPER_ADMIN" | "CABINET";
const SYSTEME = "00000000-0000-0000-0000-000000000000";

async function roleDans(db: TenantDb, cabinetId: string): Promise<RoleCabinet | "SUPER_ADMIN" | null> {
  const r = await db.$queryRaw<{ role: string | null }[]>`SELECT public.cabinet_role_courant(${cabinetId}::uuid) AS role`;
  return (r[0]?.role ?? null) as RoleCabinet | "SUPER_ADMIN" | null;
}
async function exigerMembre(db: TenantDb, cabinetId: string, roles?: (RoleCabinet | "SUPER_ADMIN")[]) {
  const role = await roleDans(db, cabinetId);
  if (!role) throw new IntrouvableError("Cabinet introuvable.");
  if (roles && !roles.includes(role)) throw new PermissionRefuseeError("Réservé à l'administrateur du cabinet.");
  return role;
}
async function journal(db: TenantDb, cabinetId: string, type: Prisma.CabinetLogUncheckedCreateInput["type"], acteurId: string | null, details?: Record<string, unknown>, coproprieteId?: string | null) {
  await db.cabinetLog.create({ data: { cabinetId, type, acteurId: acteurId === SYSTEME ? null : acteurId, coproprieteId: coproprieteId ?? null, detailsJson: (details ?? undefined) as Prisma.InputJsonValue | undefined } });
}
async function appliquerAcces(db: TenantDb, cabinetId: string) {
  try {
    const r = await db.$queryRaw<{ r: { voulus: number; desactives: number } }[]>`SELECT public.cabinet_appliquer_acces(${cabinetId}::uuid) AS r`;
    return r[0]!.r;
  } catch (e) {
    if (e instanceof Error && /CONFLIT_SYNDIC/.test(e.message)) throw new CabinetError("CONFLIT_SYNDIC", "Un autre syndic est actif sur cette copropriété : le mandat doit être confirmé par lui avant de poser les accès.");
    throw e;
  }
}

// ── Présentation ─────────────────────────────────────────────────────────────
type CabinetRow = Prisma.CabinetGetPayload<{ include: { _count: { select: { membres: true; mandats: true } } } }>;
function presenterCabinet(c: CabinetRow, monRole: string | null) {
  return { id: c.id, nom: c.nom, raisonSociale: c.raisonSociale, ice: c.ice, rc: c.rc, adresse: c.adresse, telephone: c.telephone, email: c.email, logoStoragePath: c.logoStoragePath, statut: c.statut, parametres: (c.parametresJson ?? {}) as Record<string, unknown>, nbMembres: c._count.membres, nbMandats: c._count.mandats, monRole, creeLe: c.creeLe, modifieLe: c.modifieLe };
}
const cabinetInclude = { _count: { select: { membres: { where: { actif: true } }, mandats: { where: { actif: true, statut: "ACTIF" } } } } } satisfies Prisma.CabinetInclude;

// ── Cabinets ─────────────────────────────────────────────────────────────────
/** GET /cabinets — mes cabinets (SUPER_ADMIN : tous). */
export async function listerCabinets(a: Acteur) {
  return withActeur(a.utilisateurId, roleActeur(a), async (db) => {
    const rows = await db.cabinet.findMany({ include: cabinetInclude, orderBy: { nom: "asc" } });
    const roles = await db.cabinetMembre.findMany({ where: { utilisateurId: a.utilisateurId, actif: true }, select: { cabinetId: true, role: true } });
    const parCabinet = new Map(roles.map((r) => [r.cabinetId, r.role as string]));
    return rows.map((c) => presenterCabinet(c, a.superAdmin ? "SUPER_ADMIN" : (parCabinet.get(c.id) ?? null)));
  });
}
export async function obtenirCabinet(a: Acteur, id: string) {
  return withActeur(a.utilisateurId, roleActeur(a), async (db) => {
    const role = await exigerMembre(db, id);
    const c = await db.cabinet.findUnique({ where: { id }, include: cabinetInclude });
    if (!c) throw new IntrouvableError("Cabinet introuvable.");
    return presenterCabinet(c, role);
  });
}
/** POST /cabinets — SUPER_ADMIN ; l'administrateur désigné (ou l'opérateur) devient CABINET_ADMIN. */
export async function creerCabinet(a: Acteur, input: CabinetCreateInput) {
  if (!a.superAdmin) throw new PermissionRefuseeError("Seul l'opérateur plateforme crée un cabinet.");
  return withActeur(a.utilisateurId, "SUPER_ADMIN", async (db) => {
    const c = await db.cabinet.create({ data: { id: uuidv7(), nom: input.nom, raisonSociale: input.raison_sociale ?? null, ice: input.ice ?? null, rc: input.rc ?? null, adresse: input.adresse ?? null, telephone: input.telephone ?? null, email: input.email ?? null, parametresJson: (input.parametres ?? undefined) as Prisma.InputJsonValue | undefined }, include: cabinetInclude });
    const admin = input.admin_utilisateur_id ?? a.utilisateurId;
    await db.cabinetMembre.create({ data: { cabinetId: c.id, utilisateurId: admin, role: "CABINET_ADMIN" } });
    await journal(db, c.id, "CABINET_CREE", a.utilisateurId, { nom: c.nom, admin });
    await journal(db, c.id, "MEMBRE_AJOUTE", a.utilisateurId, { utilisateur_id: admin, role: "CABINET_ADMIN" });
    return presenterCabinet({ ...c, _count: { membres: 1, mandats: 0 } }, "CABINET_ADMIN");
  });
}
export async function modifierCabinet(a: Acteur, id: string, input: CabinetUpdateInput) {
  return withActeur(a.utilisateurId, roleActeur(a), async (db) => {
    await exigerMembre(db, id, ["CABINET_ADMIN", "SUPER_ADMIN"]);
    if (input.statut && !a.superAdmin) throw new PermissionRefuseeError("Seul l'opérateur plateforme suspend un cabinet.");
    const c = await db.cabinet.update({ where: { id }, data: { ...(input.nom !== undefined ? { nom: input.nom } : {}), ...(input.raison_sociale !== undefined ? { raisonSociale: input.raison_sociale } : {}), ...(input.ice !== undefined ? { ice: input.ice } : {}), ...(input.rc !== undefined ? { rc: input.rc } : {}), ...(input.adresse !== undefined ? { adresse: input.adresse } : {}), ...(input.telephone !== undefined ? { telephone: input.telephone } : {}), ...(input.email !== undefined ? { email: input.email } : {}), ...(input.parametres !== undefined ? { parametresJson: (input.parametres ?? Prisma.DbNull) as Prisma.InputJsonValue } : {}), ...(input.statut ? { statut: input.statut } : {}) }, include: cabinetInclude });
    await journal(db, id, "CABINET_MODIFIE", a.utilisateurId, { champs: Object.keys(input) });
    return presenterCabinet(c, await roleDans(db, id));
  });
}

// ── Membres ──────────────────────────────────────────────────────────────────
export async function listerMembres(a: Acteur, cabinetId: string) {
  return withActeur(a.utilisateurId, roleActeur(a), async (db) => {
    await exigerMembre(db, cabinetId);
    const rows = await db.cabinetMembre.findMany({ where: { cabinetId }, orderBy: [{ actif: "desc" }, { creeLe: "asc" }] });
    // Identités via la fonction SECURITY DEFINER dédiée (utilisateur invisible hors tenant).
    const ids = rows.map((r) => r.utilisateurId);
    const noms = ids.length ? await db.$queryRaw<{ id: string; nom: string | null; prenom: string | null }[]>`SELECT id, nom, prenom FROM public.cabinet_identites(${ids}::uuid[])` : [];
    const parId = new Map(noms.map((n) => [n.id, n]));
    const mandats = await db.cabinetCopropriete.findMany({ where: { cabinetId, actif: true, statut: "ACTIF" }, select: { gestionnairePrincipalId: true } });
    return rows.map((r) => ({ id: r.id, utilisateurId: r.utilisateurId, nom: parId.get(r.utilisateurId)?.nom ?? null, prenom: parId.get(r.utilisateurId)?.prenom ?? null, role: r.role, actif: r.actif, nbCoproprietes: mandats.filter((m) => m.gestionnairePrincipalId === r.utilisateurId).length, creeLe: r.creeLe }));
  });
}
/** POST /cabinets/{id}/membres — par id, téléphone ou e-mail d'un compte existant (aucun compte créé ici). */
export async function ajouterMembre(a: Acteur, cabinetId: string, input: MembreCreateInput) {
  return withActeur(a.utilisateurId, roleActeur(a), async (db) => {
    await exigerMembre(db, cabinetId, ["CABINET_ADMIN", "SUPER_ADMIN"]);
    const cible = await db.$queryRaw<{ id: string }[]>`SELECT id FROM public.cabinet_trouver_utilisateur(${input.utilisateur_id ?? null}::uuid, ${input.telephone ?? null}, ${input.email?.toLowerCase() ?? null})`;
    if (!cible[0]) throw new IntrouvableError("Aucun compte ne correspond (le membre doit d'abord créer son compte SyndicUp).");
    const utilisateurId = cible[0].id;
    const existant = await db.cabinetMembre.findUnique({ where: { cabinetId_utilisateurId: { cabinetId, utilisateurId } } });
    const m = existant
      ? await db.cabinetMembre.update({ where: { id: existant.id }, data: { role: input.role, actif: true } })
      : await db.cabinetMembre.create({ data: { cabinetId, utilisateurId, role: input.role } });
    await journal(db, cabinetId, existant ? "MEMBRE_MODIFIE" : "MEMBRE_AJOUTE", a.utilisateurId, { utilisateur_id: utilisateurId, role: input.role });
    const acces = await appliquerAcces(db, cabinetId);
    return { id: m.id, utilisateurId, role: m.role, actif: m.actif, acces };
  });
}
export async function modifierMembre(a: Acteur, cabinetId: string, membreId: string, input: MembreUpdateInput) {
  return withActeur(a.utilisateurId, roleActeur(a), async (db) => {
    await exigerMembre(db, cabinetId, ["CABINET_ADMIN", "SUPER_ADMIN"]);
    const m = await db.cabinetMembre.findFirst({ where: { id: membreId, cabinetId } });
    if (!m) throw new IntrouvableError("Membre introuvable.");
    if (input.actif === false && m.role === "CABINET_ADMIN" && (await db.cabinetMembre.count({ where: { cabinetId, role: "CABINET_ADMIN", actif: true } })) <= 1) throw new CabinetError("CABINET_STATUT_INVALIDE", "Un cabinet garde au moins un administrateur actif.");
    const maj = await db.cabinetMembre.update({ where: { id: membreId }, data: { ...(input.role ? { role: input.role } : {}), ...(input.actif !== undefined ? { actif: input.actif } : {}) } });
    await journal(db, cabinetId, input.actif === false ? "MEMBRE_RETIRE" : "MEMBRE_MODIFIE", a.utilisateurId, { utilisateur_id: m.utilisateurId, role: maj.role, actif: maj.actif });
    // Même transaction : les rôles de copropriété posés par le cabinet suivent (retrait = révocation).
    const acces = await appliquerAcces(db, cabinetId);
    return { id: maj.id, utilisateurId: maj.utilisateurId, role: maj.role, actif: maj.actif, acces };
  });
}

// ── Mandats ──────────────────────────────────────────────────────────────────
type FicheCopro = { id: string; nom: string; ville: string; nbLots: number; estDemo: boolean };
type MandatRow = Prisma.CabinetCoproprieteGetPayload<Record<string, never>> & { copropriete: FicheCopro };
/** Hors contexte copropriété, la table `copropriete` est invisible : fiche minimale via cabinet_coproprietes_fiche (SECURITY DEFINER, membres seulement). */
async function decorerMandats(db: TenantDb, rows: Prisma.CabinetCoproprieteGetPayload<Record<string, never>>[]): Promise<MandatRow[]> {
  const ids = [...new Set(rows.map((r) => r.coproprieteId))];
  const fiches = ids.length ? await db.$queryRaw<{ id: string; nom: string; ville: string; nb_lots: number; est_demo: boolean }[]>`SELECT id, nom, ville, nb_lots, est_demo FROM public.cabinet_coproprietes_fiche(${ids}::uuid[])` : [];
  const parId = new Map(fiches.map((f) => [f.id, { id: f.id, nom: f.nom, ville: f.ville, nbLots: f.nb_lots, estDemo: f.est_demo }]));
  return rows.map((r) => ({ ...r, copropriete: parId.get(r.coproprieteId) ?? { id: r.coproprieteId, nom: "—", ville: "", nbLots: 0, estDemo: false } }));
}
async function chargerMandat(db: TenantDb, id: string): Promise<MandatRow> {
  const m = await db.cabinetCopropriete.findUniqueOrThrow({ where: { id } });
  return (await decorerMandats(db, [m]))[0]!;
}
function presenterMandat(m: MandatRow) {
  return { id: m.id, cabinetId: m.cabinetId, copropriete: m.copropriete, gestionnairePrincipalId: m.gestionnairePrincipalId, dateDebutMandat: m.dateDebutMandat.toISOString().slice(0, 10), dateFinMandat: m.dateFinMandat?.toISOString().slice(0, 10) ?? null, resolutionAgId: m.resolutionAgId, honorairesMensuels: m.honorairesMensuels ? toApiString(m.honorairesMensuels) : null, contratId: m.contratId, statut: m.statut, confirmeParId: m.confirmeParId, confirmeLe: m.confirmeLe, actif: m.actif, creeLe: m.creeLe };
}
export async function listerMandats(a: Acteur, cabinetId: string) {
  return withActeur(a.utilisateurId, roleActeur(a), async (db) => {
    await exigerMembre(db, cabinetId);
    return (await decorerMandats(db, await db.cabinetCopropriete.findMany({ where: { cabinetId }, orderBy: [{ actif: "desc" }, { creeLe: "desc" }] }))).map(presenterMandat);
  });
}
/**
 * POST /cabinets/{id}/coproprietes — copropriété existante : mandat EN_ATTENTE, le SYNDIC en place est
 * notifié et confirme ; nouvelle copropriété : créée par le cabinet, mandat ACTIF immédiatement (le
 * gestionnaire principal devient son SYNDIC). Honoraires → contrat SYNDIC_PROFESSIONNEL à la confirmation.
 */
export async function proposerMandat(a: Acteur, cabinetId: string, input: MandatCreateInput) {
  const gestionnaire = input.gestionnaire_principal_id ?? a.utilisateurId;
  return withActeur(a.utilisateurId, roleActeur(a), async (db) => {
    await exigerMembre(db, cabinetId, ["CABINET_ADMIN", "SUPER_ADMIN"]);
    const cabinet = await db.cabinet.findUniqueOrThrow({ where: { id: cabinetId }, select: { nom: true, statut: true } });
    if (cabinet.statut !== "ACTIF") throw new CabinetError("CABINET_STATUT_INVALIDE", "Cabinet suspendu.");
    const membre = await db.cabinetMembre.findFirst({ where: { cabinetId, utilisateurId: gestionnaire, actif: true, role: { in: ["CABINET_ADMIN", "CABINET_GESTIONNAIRE"] } } });
    if (!membre) throw new CabinetError("CABINET_STATUT_INVALIDE", "Le gestionnaire principal doit être un membre actif (admin ou gestionnaire) du cabinet.");
    let coproprieteId = input.copropriete_id ?? null;
    let nouvelle = false;
    if (!coproprieteId) {
      coproprieteId = uuidv7();
      nouvelle = true;
      await db.$executeRaw`SELECT public.cabinet_creer_copropriete(${coproprieteId}::uuid, ${cabinetId}::uuid, ${input.nouvelle_copropriete!.nom}, ${input.nouvelle_copropriete!.adresse}, ${input.nouvelle_copropriete!.ville}, ${input.nouvelle_copropriete!.type_residence ?? "IMMEUBLE_COLLECTIF"}, ${input.nouvelle_copropriete!.nb_lots}::int, ${a.utilisateurId}::uuid)`;
    } else if (await db.cabinetCopropriete.findFirst({ where: { coproprieteId, actif: true }, select: { id: true } })) {
      throw new CabinetError("MANDAT_EXISTANT", "Un mandat actif ou en attente existe déjà sur cette copropriété.");
    }
    const m = await db.cabinetCopropriete.create({ data: { cabinetId, coproprieteId, gestionnairePrincipalId: gestionnaire, dateDebutMandat: new Date(`${input.date_debut_mandat}T00:00:00.000Z`), dateFinMandat: input.date_fin_mandat ? new Date(`${input.date_fin_mandat}T00:00:00.000Z`) : null, resolutionAgId: input.resolution_ag_id ?? null, honorairesMensuels: input.honoraires_mensuels ? money(input.honoraires_mensuels).toString() : null, statut: nouvelle ? "ACTIF" : "EN_ATTENTE", ...(nouvelle ? { confirmeParId: a.utilisateurId, confirmeLe: new Date() } : {}) } });
    await journal(db, cabinetId, "MANDAT_PROPOSE", a.utilisateurId, { mandat_id: m.id, nouvelle_copropriete: nouvelle, gestionnaire_principal_id: gestionnaire }, coproprieteId);
    if (nouvelle) {
      await db.copropriete.update({ where: { id: coproprieteId }, data: { cabinetId } }).catch(() => undefined);
      await appliquerAcces(db, cabinetId);
    }
    return { mandat: presenterMandat(await chargerMandat(db, m.id)), a_confirmer: !nouvelle, cabinet: cabinet.nom };
  }).then(async (r) => {
    // Notification au SYNDIC en place (contexte copropriété, hors transaction cabinet) + contrat d'honoraires si création directe.
    if (r.a_confirmer) await notifierSyndicEnPlace(r.mandat.copropriete.id, r.cabinet, gestionnaire, r.mandat.id);
    else if (r.mandat.honorairesMensuels) await creerContratHonoraires(r.mandat.copropriete.id, gestionnaire, r.mandat.id, r.cabinet);
    return r.mandat;
  });
}
async function notifierSyndicEnPlace(coproprieteId: string, cabinet: string, gestionnaire: string, mandatId: string) {
  const ctx: TenantContext = { utilisateurId: SYSTEME, coproprieteId, role: "SUPER_ADMIN" };
  await withTenant(ctx, async (db) => {
    const copro = await db.copropriete.findUnique({ where: { id: coproprieteId }, select: { nom: true } });
    const syndics = await db.roleUtilisateur.findMany({ where: { coproprieteId, role: "SYNDIC", actif: true }, select: { utilisateurId: true } });
    const g = await db.utilisateur.findUnique({ where: { id: gestionnaire }, select: { nom: true, prenom: true } }).catch(() => null);
    for (const s of syndics) await envoyerNotification(db, { coproprieteId, utilisateurId: s.utilisateurId, templateCode: "MANDAT_PROPOSE", canal: "PUSH", contenuJson: { mandat_id: mandatId, cabinet, residence: copro?.nom ?? "", gestionnaire: [g?.prenom, g?.nom].filter(Boolean).join(" ") || "—" } });
    await ecrireAuditLog(db, { coproprieteId, acteurId: null, action: "MANDAT_PROPOSE", entite: "cabinet_copropriete", entiteId: mandatId, apres: { cabinet } });
  });
}
async function creerContratHonoraires(coproprieteId: string, gestionnaire: string, mandatId: string, cabinet: string) {
  const ctx: TenantContext = { utilisateurId: gestionnaire, coproprieteId, role: "SYNDIC" };
  await withTenant(ctx, async (db) => {
    const m = await db.cabinetCopropriete.findUnique({ where: { id: mandatId } });
    if (!m || !m.honorairesMensuels || m.contratId) return;
    const c = await db.contrat.create({ data: { coproprieteId, type: "SYNDIC_PROFESSIONNEL", libelle: `Honoraires de syndic — ${cabinet}`, dateDebut: m.dateDebutMandat, dateFin: m.dateFinMandat, tacite: !m.dateFinMandat, periodicite: "MENSUELLE", montantPeriode: m.honorairesMensuels.toString(), resolutionAgId: m.resolutionAgId, notes: "Contrat créé par le mandat du cabinet (M25) — les échéances alimentent les dépenses HONORAIRES_SYNDIC.", creeParId: gestionnaire, statut: "ACTIF" } });
    await db.contratLog.create({ data: { coproprieteId, contratId: c.id, type: "CREE", acteurId: gestionnaire, detailsJson: { mandat_id: mandatId, cabinet } } });
    await regenererEcheances(db, { coproprieteId, utilisateurId: gestionnaire }, c, 12);
    await db.cabinetCopropriete.update({ where: { id: mandatId }, data: { contratId: c.id } });
    await ecrireAuditLog(db, { coproprieteId, acteurId: gestionnaire, action: "MANDAT_CONTRAT_HONORAIRES", entite: "contrat", entiteId: c.id, apres: { mandat_id: mandatId, montant_periode: m.honorairesMensuels.toString() } });
  });
}
/** POST /cabinets/{id}/coproprietes/{coproId}/confirmer — par le SYNDIC en place (contexte copropriété). Atomique (SQL). */
export async function confirmerMandat(ctx: TenantContext, cabinetId: string) {
  if (can("cabinet.mandat.confirmer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic en place confirme un mandat.");
  const r = await withTenant(ctx, async (db) => {
    const m0 = await db.cabinetCopropriete.findFirst({ where: { cabinetId, coproprieteId: ctx.coproprieteId, actif: true } });
    if (!m0) throw new IntrouvableError("Aucun mandat proposé par ce cabinet sur cette copropriété.");
    // La table `cabinet` est invisible depuis la copropriété : fiche publique (SECURITY DEFINER, mandat requis).
    const fiche = await db.$queryRaw<{ nom: string }[]>`SELECT nom FROM public.cabinet_fiche_publique(${cabinetId}::uuid)`;
    const m = { ...m0, cabinet: { nom: fiche[0]?.nom ?? "—" } };
    const res = await db.$queryRaw<{ r: { statut: string; syndics_cedes?: number } }[]>`SELECT public.cabinet_mandat_confirmer(${m.id}::uuid, ${ctx.utilisateurId}::uuid) AS r`;
    const statut = res[0]!.r.statut;
    if (statut === "STATUT_INVALIDE") throw new CabinetError("MANDAT_STATUT_INVALIDE", `Mandat ${m.statut} : rien à confirmer.`);
    if (statut === "NON_SYNDIC") throw new PermissionRefuseeError("Seul le syndic en place confirme un mandat.");
    if (statut === "MANDAT_EXISTANT") throw new CabinetError("MANDAT_EXISTANT", "Un autre mandat est déjà actif sur cette copropriété.");
    if (statut !== "OK") throw new IntrouvableError("Mandat introuvable.");
    await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId, action: "MANDAT_CONFIRME", entite: "cabinet_copropriete", entiteId: m.id, apres: { cabinet_id: cabinetId, gestionnaire_principal_id: m.gestionnairePrincipalId, syndics_cedes: res[0]!.r.syndics_cedes ?? 0 } });
    const copro = await db.copropriete.findUnique({ where: { id: ctx.coproprieteId }, select: { nom: true } });
    if (m.gestionnairePrincipalId && m.gestionnairePrincipalId !== ctx.utilisateurId) await envoyerNotification(db, { coproprieteId: ctx.coproprieteId, utilisateurId: m.gestionnairePrincipalId, templateCode: "MANDAT_CONFIRME", canal: "PUSH", contenuJson: { mandat_id: m.id, residence: copro?.nom ?? "", cabinet: m.cabinet.nom } });
    return { mandatId: m.id, gestionnaire: m.gestionnairePrincipalId, honoraires: m.honorairesMensuels, cabinet: m.cabinet.nom, syndicsCedes: res[0]!.r.syndics_cedes ?? 0 };
  });
  if (r.honoraires && r.gestionnaire) await creerContratHonoraires(ctx.coproprieteId, r.gestionnaire, r.mandatId, r.cabinet);
  return { mandat_id: r.mandatId, statut: "ACTIF", syndics_cedes: r.syndicsCedes };
}
export async function modifierMandat(a: Acteur, cabinetId: string, mandatId: string, input: MandatUpdateInput) {
  return withActeur(a.utilisateurId, roleActeur(a), async (db) => {
    await exigerMembre(db, cabinetId, ["CABINET_ADMIN", "SUPER_ADMIN"]);
    const m = await db.cabinetCopropriete.findFirst({ where: { id: mandatId, cabinetId } });
    if (!m) throw new IntrouvableError("Mandat introuvable.");
    if (!m.actif) throw new CabinetError("MANDAT_STATUT_INVALIDE", "Mandat terminé.");
    if (input.gestionnaire_principal_id) {
      const ok = await db.cabinetMembre.findFirst({ where: { cabinetId, utilisateurId: input.gestionnaire_principal_id, actif: true, role: { in: ["CABINET_ADMIN", "CABINET_GESTIONNAIRE"] } } });
      if (!ok) throw new CabinetError("CABINET_STATUT_INVALIDE", "Le gestionnaire principal doit être un membre actif (admin ou gestionnaire).");
    }
    await db.cabinetCopropriete.update({ where: { id: mandatId }, data: { ...(input.gestionnaire_principal_id !== undefined ? { gestionnairePrincipalId: input.gestionnaire_principal_id } : {}), ...(input.date_fin_mandat !== undefined ? { dateFinMandat: input.date_fin_mandat ? new Date(`${input.date_fin_mandat}T00:00:00.000Z`) : null } : {}), ...(input.honoraires_mensuels !== undefined ? { honorairesMensuels: input.honoraires_mensuels ? money(input.honoraires_mensuels).toString() : null } : {}), ...(input.resolution_ag_id !== undefined ? { resolutionAgId: input.resolution_ag_id } : {}) } });
    await journal(db, cabinetId, "MANDAT_MODIFIE", a.utilisateurId, { mandat_id: mandatId, champs: Object.keys(input) }, m.coproprieteId);
    // Changement de gestionnaire principal sur un mandat ACTIF : l'ancien perd SYNDIC, le nouveau le reçoit (même transaction).
    const acces = m.statut === "ACTIF" ? await appliquerAcces(db, cabinetId) : null;
    return { ...presenterMandat(await chargerMandat(db, mandatId)), acces };
  });
}
export async function terminerMandat(a: Acteur, cabinetId: string, mandatId: string, input: MandatTerminerInput) {
  const r = await withActeur(a.utilisateurId, roleActeur(a), async (db) => {
    await exigerMembre(db, cabinetId, ["CABINET_ADMIN", "SUPER_ADMIN"]);
    const m = await db.cabinetCopropriete.findFirst({ where: { id: mandatId, cabinetId }, include: { cabinet: { select: { nom: true } } } });
    if (!m) throw new IntrouvableError("Mandat introuvable.");
    const res = await db.$queryRaw<{ r: { statut: string } }[]>`SELECT public.cabinet_mandat_terminer(${mandatId}::uuid, ${input.date_fin ?? null}::date, ${a.utilisateurId}::uuid) AS r`;
    if (res[0]!.r.statut === "STATUT_INVALIDE") throw new CabinetError("MANDAT_STATUT_INVALIDE", "Mandat déjà terminé.");
    return { coproprieteId: m.coproprieteId, gestionnaire: m.gestionnairePrincipalId, cabinet: m.cabinet.nom, dateFin: input.date_fin ?? new Date().toISOString().slice(0, 10), motif: input.motif ?? null };
  });
  // Trace côté copropriété (le mandat est fini : contexte système).
  await withTenant({ utilisateurId: SYSTEME, coproprieteId: r.coproprieteId, role: "SUPER_ADMIN" }, async (db) => {
    await ecrireAuditLog(db, { coproprieteId: r.coproprieteId, acteurId: null, action: "MANDAT_TERMINE", entite: "cabinet_copropriete", entiteId: mandatId, apres: { cabinet: r.cabinet, date_fin: r.dateFin, motif: r.motif, par: a.utilisateurId } });
    const copro = await db.copropriete.findUnique({ where: { id: r.coproprieteId }, select: { nom: true } });
    const conseil = await db.roleUtilisateur.findMany({ where: { coproprieteId: r.coproprieteId, role: "CONSEIL_SYNDICAL", actif: true }, select: { utilisateurId: true } });
    for (const u of [...conseil.map((c) => c.utilisateurId), ...(r.gestionnaire ? [r.gestionnaire] : [])]) await envoyerNotification(db, { coproprieteId: r.coproprieteId, utilisateurId: u, templateCode: "MANDAT_TERMINE", canal: "PUSH", contenuJson: { mandat_id: mandatId, residence: copro?.nom ?? "", cabinet: r.cabinet, date_fin: r.dateFin } });
  });
  return { mandat_id: mandatId, statut: "TERMINE", date_fin: r.dateFin };
}
/** Mandat visible depuis une copropriété (Paramètres → Cabinet) : proposé ou actif. */
export async function mandatDeLaCopropriete(ctx: TenantContext) {
  if (can("cabinet.mandat.lire", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const m = await db.cabinetCopropriete.findFirst({ where: { coproprieteId: ctx.coproprieteId, actif: true }, orderBy: { creeLe: "desc" } });
    if (!m) return null;
    const cab = await db.$queryRaw<{ id: string; nom: string; raison_sociale: string | null; telephone: string | null; email: string | null }[]>`SELECT id, nom, raison_sociale, telephone, email FROM public.cabinet_fiche_publique(${m.cabinetId}::uuid)`;
    const g = m.gestionnairePrincipalId ? await db.$queryRaw<{ id: string; nom: string | null; prenom: string | null }[]>`SELECT id, nom, prenom FROM public.cabinet_identites(ARRAY[${m.gestionnairePrincipalId}::uuid])` : [];
    return { id: m.id, statut: m.statut, dateDebutMandat: m.dateDebutMandat.toISOString().slice(0, 10), dateFinMandat: m.dateFinMandat?.toISOString().slice(0, 10) ?? null, honorairesMensuels: m.honorairesMensuels ? toApiString(m.honorairesMensuels) : null, contratId: m.contratId, cabinet: cab[0] ?? { id: m.cabinetId, nom: "—", raison_sociale: null, telephone: null, email: null }, gestionnairePrincipal: g[0] ?? null, peutConfirmer: m.statut === "EN_ATTENTE" && can("cabinet.mandat.confirmer", ctx.role) === true };
  });
}

// ── Portefeuille (vue matérialisée), agenda, alertes ─────────────────────────
export type LignePortefeuille = { mandat_id: string; copropriete_id: string; nom: string; ville: string; est_demo: boolean; gestionnaire_principal_id: string | null; date_debut_mandat: Date; honoraires_mensuels: Prisma.Decimal | null; nb_lots: number; appele: Prisma.Decimal; encaisse: Prisma.Decimal; impayes_montant: Prisma.Decimal; impayes_nb_lots: number; justificatifs_en_attente: number; justificatif_plus_ancien: Date | null; incidents_ouverts: number; incidents_urgents: number; taches_retard: number; prochaine_ag: Date | null; contrats_expirant_30j: number; assurance_active: boolean; sejours_lcd_aujourdhui: number; derniere_activite: Date | null; calcule_le: Date };
function tauxRecouvrement(l: LignePortefeuille) {
  const appele = money(l.appele.toString());
  return appele.isZero() ? null : Number(money(l.encaisse.toString()).dividedBy(appele).times(100).toFixed(1));
}
function presenterLigne(l: LignePortefeuille, parametres: Record<string, unknown>, now: Date) {
  const seuil = typeof parametres.seuil_recouvrement === "number" ? parametres.seuil_recouvrement : null;
  const delaiJ = typeof parametres.delai_justificatifs_jours === "number" ? parametres.delai_justificatifs_jours : null;
  const taux = tauxRecouvrement(l);
  const alertes: string[] = [];
  if (!l.assurance_active) alertes.push("ASSURANCE_ABSENTE");
  if (seuil !== null && taux !== null && taux < seuil) alertes.push("RECOUVREMENT_FAIBLE");
  if (l.taches_retard > 0) alertes.push("TACHES_EN_RETARD");
  if (delaiJ !== null && l.justificatif_plus_ancien && now.getTime() - l.justificatif_plus_ancien.getTime() > delaiJ * 86_400_000) alertes.push("JUSTIFICATIFS_EN_ATTENTE");
  if (l.incidents_urgents > 0) alertes.push("INCIDENTS_URGENTS");
  return { mandat_id: l.mandat_id, copropriete_id: l.copropriete_id, nom: l.nom, ville: l.ville, est_demo: l.est_demo, gestionnaire_principal_id: l.gestionnaire_principal_id, date_debut_mandat: l.date_debut_mandat.toISOString().slice(0, 10), honoraires_mensuels: l.honoraires_mensuels ? toApiString(l.honoraires_mensuels) : null, nb_lots: l.nb_lots, appele: toApiString(l.appele), encaisse: toApiString(l.encaisse), taux_recouvrement: taux, impayes_montant: toApiString(l.impayes_montant), impayes_nb_lots: l.impayes_nb_lots, justificatifs_en_attente: l.justificatifs_en_attente, justificatif_plus_ancien: l.justificatif_plus_ancien, incidents_ouverts: l.incidents_ouverts, incidents_urgents: l.incidents_urgents, taches_retard: l.taches_retard, prochaine_ag: l.prochaine_ag, contrats_expirant_30j: l.contrats_expirant_30j, assurance_active: l.assurance_active, sejours_lcd_aujourdhui: l.sejours_lcd_aujourdhui, derniere_activite: l.derniere_activite, calcule_le: l.calcule_le, alertes };
}
export type LignePresentee = ReturnType<typeof presenterLigne>;
/** GET /cabinets/{id}/portefeuille — une ligne par copropriété visible (ADMIN / COMPTABLE : toutes ; GESTIONNAIRE : les siennes). */
export async function portefeuille(a: Acteur, cabinetId: string, filtres: PortefeuilleFiltres, tri: Tri<(typeof TRIS_PORTEFEUILLE)[number]>, now = new Date()) {
  return withActeur(a.utilisateurId, roleActeur(a), async (db) => {
    await exigerMembre(db, cabinetId);
    const cab = await db.cabinet.findUniqueOrThrow({ where: { id: cabinetId }, select: { parametresJson: true } });
    const parametres = (cab.parametresJson ?? {}) as Record<string, unknown>;
    const rows = await db.$queryRaw<LignePortefeuille[]>`SELECT * FROM public.cabinet_portefeuille(${cabinetId}::uuid)`;
    let lignes = rows.map((l) => presenterLigne(l, parametres, now)).filter((l) => !l.est_demo);
    if (filtres.q) lignes = lignes.filter((l) => `${l.nom} ${l.ville}`.toLowerCase().includes(filtres.q!.toLowerCase()));
    if (filtres.alerte) lignes = lignes.filter((l) => l.alertes.length > 0);
    const sens = tri.sens === "desc" ? -1 : 1;
    const cle = tri.champ;
    lignes.sort((x, y) => {
      const vx = x[cle] as string | number | Date | null, vy = y[cle] as string | number | Date | null;
      if (vx === null || vx === undefined) return 1; if (vy === null || vy === undefined) return -1;
      if (typeof vx === "number" && typeof vy === "number") return (vx - vy) * sens;
      if (vx instanceof Date && vy instanceof Date) return (vx.getTime() - vy.getTime()) * sens;
      return String(vx).localeCompare(String(vy), "fr", { numeric: true }) * sens;
    });
    const totaux = lignes.reduce((acc, l) => ({ coproprietes: acc.coproprietes + 1, lots: acc.lots + l.nb_lots, appele: acc.appele.plus(money(l.appele)), encaisse: acc.encaisse.plus(money(l.encaisse)), impayes: acc.impayes.plus(money(l.impayes_montant)), alertes: acc.alertes + l.alertes.length, honoraires: acc.honoraires.plus(money(l.honoraires_mensuels ?? "0")) }), { coproprietes: 0, lots: 0, appele: money(0), encaisse: money(0), impayes: money(0), alertes: 0, honoraires: money(0) });
    return { lignes, totaux: { coproprietes: totaux.coproprietes, lots: totaux.lots, appele: toApiString(totaux.appele), encaisse: toApiString(totaux.encaisse), taux_recouvrement: totaux.appele.isZero() ? null : Number(totaux.encaisse.dividedBy(totaux.appele).times(100).toFixed(1)), impayes: toApiString(totaux.impayes), alertes: totaux.alertes, honoraires_mensuels: toApiString(totaux.honoraires) }, calcule_le: rows[0]?.calcule_le ?? null, parametres };
  });
}
export const ENTETES_PORTEFEUILLE = ["copropriete", "ville", "nb_lots", "appele", "encaisse", "taux_recouvrement", "impayes_montant", "impayes_nb_lots", "justificatifs_en_attente", "incidents_ouverts", "incidents_urgents", "taches_retard", "prochaine_ag", "contrats_expirant_30j", "assurance_active", "sejours_lcd_aujourdhui", "honoraires_mensuels", "alertes"];
export function lignesCsv(lignes: LignePresentee[]) {
  return lignes.map((l) => [l.nom, l.ville, l.nb_lots, l.appele, l.encaisse, l.taux_recouvrement ?? "", l.impayes_montant, l.impayes_nb_lots, l.justificatifs_en_attente, l.incidents_ouverts, l.incidents_urgents, l.taches_retard, l.prochaine_ag ? l.prochaine_ag.toISOString().slice(0, 10) : "", l.contrats_expirant_30j, l.assurance_active, l.sejours_lcd_aujourdhui, l.honoraires_mensuels ?? "", l.alertes.join(" ")]);
}

async function coproprietesVisibles(db: TenantDb, cabinetId: string) {
  return db.$queryRaw<{ copropriete_id: string; nom: string }[]>`SELECT copropriete_id, nom FROM public.cabinet_coproprietes_visibles(${cabinetId}::uuid)`;
}
/** GET /cabinets/{id}/agenda — AG, échéances de contrats, tâches, paie, fin de mandat sur toutes les copropriétés visibles (fenêtre de 60 jours par défaut). */
export async function agenda(a: Acteur, cabinetId: string, jours = 60, now = new Date()) {
  const copros = await withActeur(a.utilisateurId, roleActeur(a), async (db) => { await exigerMembre(db, cabinetId); return coproprietesVisibles(db, cabinetId); });
  const fin = new Date(now.getTime() + jours * 86_400_000);
  const debut = new Date(now); debut.setUTCHours(0, 0, 0, 0);
  const evenements: { type: "AG" | "ECHEANCE_CONTRAT" | "TACHE" | "PAIE" | "FIN_MANDAT"; date: string; copropriete_id: string; copropriete: string; titre: string; lien: string; id: string; retard?: boolean }[] = [];
  for (const c of copros) {
    await withTenant({ utilisateurId: a.utilisateurId, coproprieteId: c.copropriete_id, role: "SUPER_ADMIN" }, async (db) => {
      const [ags, echeances, taches, paies, mandat] = await Promise.all([
        db.assembleeGenerale.findMany({ where: { coproprieteId: c.copropriete_id, dateAg: { gte: debut, lte: fin }, statut: { in: ["PLANIFIEE", "CONVOQUEE", "EN_COURS"] } }, select: { id: true, dateAg: true, type: true } }),
        db.contratEcheance.findMany({ where: { contrat: { coproprieteId: c.copropriete_id, statut: "ACTIF" }, statut: "A_VENIR", dateEcheance: { gte: debut, lte: fin } }, select: { id: true, dateEcheance: true, type: true, contrat: { select: { id: true, libelle: true } } } }),
        db.tache.findMany({ where: { coproprieteId: c.copropriete_id, statut: { in: ["A_FAIRE", "EN_COURS", "BLOQUEE"] }, dateEcheance: { not: null, lte: fin } }, select: { id: true, titre: true, dateEcheance: true } }),
        db.fichePaie.findMany({ where: { coproprieteId: c.copropriete_id, statut: { in: ["BROUILLON", "VALIDEE"] } }, select: { id: true, periode: true, statut: true }, take: 12 }).catch(() => []),
        db.cabinetCopropriete.findFirst({ where: { coproprieteId: c.copropriete_id, cabinetId, actif: true, dateFinMandat: { not: null, lte: fin } }, select: { id: true, dateFinMandat: true } }),
      ]);
      for (const ag of ags) evenements.push({ type: "AG", date: ag.dateAg.toISOString(), copropriete_id: c.copropriete_id, copropriete: c.nom, titre: `AG ${ag.type}`, lien: `/ag/${ag.id}`, id: ag.id });
      for (const e of echeances) evenements.push({ type: "ECHEANCE_CONTRAT", date: e.dateEcheance.toISOString(), copropriete_id: c.copropriete_id, copropriete: c.nom, titre: `${e.contrat.libelle} — ${e.type}`, lien: `/contrats/${e.contrat.id}`, id: e.id });
      for (const t of taches) evenements.push({ type: "TACHE", date: t.dateEcheance!.toISOString(), copropriete_id: c.copropriete_id, copropriete: c.nom, titre: t.titre, lien: `/taches/${t.id}`, id: t.id, retard: t.dateEcheance! < debut });
      for (const p of paies as { id: string; periode: string; statut: string }[]) { const d = new Date(`${p.periode}-01T00:00:00.000Z`); d.setUTCMonth(d.getUTCMonth() + 1, 5); if (d >= debut && d <= fin) evenements.push({ type: "PAIE", date: d.toISOString(), copropriete_id: c.copropriete_id, copropriete: c.nom, titre: `Paie ${p.periode} (${p.statut})`, lien: "/personnel/paie", id: p.id }); }
      if (mandat?.dateFinMandat) evenements.push({ type: "FIN_MANDAT", date: mandat.dateFinMandat.toISOString(), copropriete_id: c.copropriete_id, copropriete: c.nom, titre: "Fin de mandat", lien: "/parametres", id: mandat.id });
    });
  }
  evenements.sort((x, y) => x.date.localeCompare(y.date));
  return { du: debut.toISOString().slice(0, 10), au: fin.toISOString().slice(0, 10), evenements };
}
/** GET /cabinets/{id}/alertes — flux transverse (assurance absente, recouvrement < seuil, tâches en retard, justificatifs > N jours, incidents urgents). */
export async function alertes(a: Acteur, cabinetId: string, now = new Date()) {
  const p = await portefeuille(a, cabinetId, {}, { champ: "nom", sens: "asc" }, now);
  const seuil = typeof p.parametres.seuil_recouvrement === "number" ? p.parametres.seuil_recouvrement : null;
  const delai = typeof p.parametres.delai_justificatifs_jours === "number" ? p.parametres.delai_justificatifs_jours : null;
  const items: { code: string; niveau: "danger" | "warn" | "info"; copropriete_id: string; copropriete: string; valeur: string | number | null; lien: string }[] = [];
  for (const l of p.lignes) {
    if (l.alertes.includes("ASSURANCE_ABSENTE")) items.push({ code: "ASSURANCE_ABSENTE", niveau: "danger", copropriete_id: l.copropriete_id, copropriete: l.nom, valeur: null, lien: "/contrats" });
    if (l.alertes.includes("RECOUVREMENT_FAIBLE")) items.push({ code: "RECOUVREMENT_FAIBLE", niveau: "warn", copropriete_id: l.copropriete_id, copropriete: l.nom, valeur: l.taux_recouvrement, lien: "/rapports?onglet=impayes" });
    if (l.alertes.includes("TACHES_EN_RETARD")) items.push({ code: "TACHES_EN_RETARD", niveau: "warn", copropriete_id: l.copropriete_id, copropriete: l.nom, valeur: l.taches_retard, lien: "/taches?retard=1" });
    if (l.alertes.includes("JUSTIFICATIFS_EN_ATTENTE")) items.push({ code: "JUSTIFICATIFS_EN_ATTENTE", niveau: "warn", copropriete_id: l.copropriete_id, copropriete: l.nom, valeur: l.justificatifs_en_attente, lien: "/justificatifs" });
    if (l.alertes.includes("INCIDENTS_URGENTS")) items.push({ code: "INCIDENTS_URGENTS", niveau: "danger", copropriete_id: l.copropriete_id, copropriete: l.nom, valeur: l.incidents_urgents, lien: "/incidents" });
  }
  items.sort((x, y) => (x.niveau === y.niveau ? x.copropriete.localeCompare(y.copropriete) : x.niveau === "danger" ? -1 : 1));
  return { items, parametres: { seuil_recouvrement: seuil, delai_justificatifs_jours: delai }, calcule_le: p.calcule_le };
}

// ── Annuaire de prestataires du cabinet ──────────────────────────────────────
export async function listerPrestatairesModeles(a: Acteur, cabinetId: string) {
  return withActeur(a.utilisateurId, roleActeur(a), async (db) => { await exigerMembre(db, cabinetId); return db.cabinetPrestataire.findMany({ where: { cabinetId }, orderBy: { nom: "asc" } }); });
}
export async function creerPrestataireModele(a: Acteur, cabinetId: string, input: PrestataireModeleInput) {
  return withActeur(a.utilisateurId, roleActeur(a), async (db) => {
    await exigerMembre(db, cabinetId, ["CABINET_ADMIN", "CABINET_GESTIONNAIRE", "SUPER_ADMIN"]);
    const p = await db.cabinetPrestataire.create({ data: { cabinetId, nom: input.nom, specialite: input.specialite, telephone: input.telephone ?? null, email: input.email ?? null, ice: input.ice ?? null, rc: input.rc ?? null, adresse: input.adresse ?? null, notes: input.notes ?? null } });
    await journal(db, cabinetId, "PRESTATAIRE_MODELE", a.utilisateurId, { prestataire_modele_id: p.id, nom: p.nom });
    return p;
  });
}
/** POST /cabinets/{id}/prestataires/{pid}/copier — copie (jamais référence) dans une copropriété visible ; contexte copropriété SYNDIC du gestionnaire. */
export async function copierPrestataire(a: Acteur, cabinetId: string, modeleId: string, coproprieteId: string) {
  const modele = await withActeur(a.utilisateurId, roleActeur(a), async (db) => {
    await exigerMembre(db, cabinetId, ["CABINET_ADMIN", "CABINET_GESTIONNAIRE", "SUPER_ADMIN"]);
    const visibles = await coproprietesVisibles(db, cabinetId);
    if (!visibles.some((c) => c.copropriete_id === coproprieteId)) throw new IntrouvableError("Copropriété hors du portefeuille visible.");
    const m = await db.cabinetPrestataire.findFirst({ where: { id: modeleId, cabinetId } });
    if (!m) throw new IntrouvableError("Prestataire modèle introuvable.");
    return m;
  });
  return withTenant({ utilisateurId: a.utilisateurId, coproprieteId, role: a.superAdmin ? "SUPER_ADMIN" : "SYNDIC" }, async (db) => {
    const deja = await db.prestataire.findFirst({ where: { coproprieteId, cabinetPrestataireId: modele.id }, select: { id: true } });
    if (deja) return { prestataire_id: deja.id, copie: false };
    const p = await db.prestataire.create({ data: { coproprieteId, nom: modele.nom, specialite: modele.specialite, contact: modele.telephone ?? modele.email ?? "", telephone: modele.telephone, email: modele.email, ice: modele.ice, rc: modele.rc, adresse: modele.adresse, notes: modele.notes, cabinetPrestataireId: modele.id } });
    await ecrireAuditLog(db, { coproprieteId, acteurId: a.utilisateurId, action: "PRESTATAIRE_CREE", entite: "prestataire", entiteId: p.id, apres: { nom: p.nom, specialite: p.specialite, depuis_cabinet: cabinetId } });
    return { prestataire_id: p.id, copie: true };
  });
}

/** Marque du cabinet mandataire d'une copropriété — en-tête des PDF (rapport, relevé, convocation). Null sans mandat actif. */
export async function marqueCabinet(db: TenantDb, coproprieteId: string): Promise<{ nom: string; raisonSociale: string | null; logoStoragePath: string | null } | null> {
  const r = await db.$queryRaw<{ nom: string; raison_sociale: string | null; logo_storage_path: string | null }[]>`SELECT nom, raison_sociale, logo_storage_path FROM public.cabinet_marque(${coproprieteId}::uuid)`.catch(() => []);
  return r[0] ? { nom: r[0].nom, raisonSociale: r[0].raison_sociale, logoStoragePath: r[0].logo_storage_path } : null;
}
