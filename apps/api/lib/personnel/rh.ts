/**
 * Service Personnel RH — M20 (Doc A §9 : profils, embauche « CDI ou CDD, CNSS obligatoire »,
 * absence / remplacement, départ). Fiche RH (contrat, salaire, CNSS masqué), fiches de paie (aide au
 * calcul depuis `parametres_paie_json`, dépense PERSONNEL créée et soumise à la validation dans la même
 * transaction), congés (solde depuis `jours_conge_annuels`), présences (saisie syndic / pointage de
 * l'employé), évaluations (syndic, conseil), planning hebdomadaire. Journal `personnel_log` append-only
 * + audit_log ; montants via lib/money ; données RH masquées pour tout rôle non syndic hors l'employé.
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
import { assertCheminDansPerimetre, attacherDocument, preparerUploadModule, urlsSigneesDocuments } from "../documents/attach";
import { creerDepenseDb, soumettreDepenseDb } from "../depenses/depenses";
import { calculerPaie, joursOuvrables, lireParametresPaie, type ParametresPaie, type ResultatPaie } from "./paie";
import type { CongeCreateInput, CongeDeciderInput, EvaluationCreateInput, FichePaieCreateInput, FichePaieUpdateInput, PersonnelRhUpdateInput, PersonnelUploadUrlInput, PresenceSelfInput, PresencesUpsertInput } from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
export class RhError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}

type TypeLog = "FICHE_CREEE" | "FICHE_MODIFIEE" | "STATUT_CHANGE" | "CNSS_CONSULTE" | "PAIE_BROUILLON" | "PAIE_VALIDEE" | "PAIE_PAYEE" | "CONGE_DEMANDE" | "CONGE_APPROUVE" | "CONGE_REFUSE" | "CONGE_ANNULE" | "PRESENCE_SAISIE" | "EVALUATION" | "DOCUMENT_AJOUTE";

export async function journal(db: TenantDb, ctx: { coproprieteId: string; utilisateurId: string | null }, personnelId: string, type: TypeLog, details?: Record<string, unknown>) {
  await db.personnelLog.createMany({ data: [{ coproprieteId: ctx.coproprieteId, personnelId, type, acteurId: ctx.utilisateurId, detailsJson: (details ?? Prisma.DbNull) as Prisma.InputJsonValue }] });
}
async function audit(db: TenantDb, ctx: TenantContext, action: string, entite: string, entiteId: string, avant?: unknown, apres?: unknown) {
  await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId, action, entite, entiteId, avant: avant as Prisma.InputJsonValue, apres: apres as Prisma.InputJsonValue });
}
async function syndics(db: TenantDb, coproprieteId: string) {
  return (await db.roleUtilisateur.findMany({ where: { coproprieteId, actif: true, role: "SYNDIC" }, select: { utilisateurId: true }, distinct: ["utilisateurId"] })).map((s) => s.utilisateurId);
}
export async function notifier(db: TenantDb, coproprieteId: string, utilisateurIds: string[], templateCode: string, contenu: Record<string, unknown>) {
  await Promise.all([...new Set(utilisateurIds)].map((u) => envoyerNotification(db, { coproprieteId, utilisateurId: u, templateCode, canal: "PUSH", contenuJson: contenu as Prisma.InputJsonValue })));
}

export function masquerCnss(n: string | null): string | null {
  return n ? `${"•".repeat(Math.max(0, n.length - 4))}${n.slice(-4)}` : null;
}
export function dateUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function periodeCourante(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

// ── Fiche RH ───────────────────────────────────────────────────────────────────

// `utilisateur` n'est PAS inclus via Prisma : la policy RLS `utilisateur` peut masquer le compte d'un
// collègue et Prisma refuse alors une relation obligatoire à null. Les identités sont chargées à part
// (`nomsUtilisateurs`, findMany → seules les lignes visibles reviennent) et attachées en nullable.
const personnelInclude = {
  logementLot: { select: { id: true, numero: true } },
  documentContrat: { select: { id: true, nom: true, type: true, storagePath: true } },
} satisfies Prisma.PersonnelInclude;
export type Identite = { id: string; nom: string | null; prenom: string | null; telephone: string | null; email: string | null; languePreferee: string };
type PersonnelRow = Prisma.PersonnelGetPayload<{ include: typeof personnelInclude }> & { utilisateur: Identite | null };

export async function nomsUtilisateurs(db: TenantDb, ids: string[]): Promise<Map<string, Identite>> {
  const uniques = [...new Set(ids)];
  if (uniques.length === 0) return new Map();
  const rows = await db.utilisateur.findMany({ where: { id: { in: uniques } }, select: { id: true, nom: true, prenom: true, telephone: true, email: true, languePreferee: true } });
  return new Map(rows.map((u) => [u.id, u]));
}
export function nomComplet(u: { nom: string | null; prenom: string | null } | null | undefined, repli = "—"): string {
  const n = u ? [u.prenom, u.nom].filter(Boolean).join(" ") : "";
  return n || repli;
}

/** La fiche complète pour le syndic / l'employé concerné ; la fiche « d'urgence » (statut, logement, poste, contact) pour les autres. */
export function presenterPersonnel<T extends PersonnelRow>(p: T, ctx: TenantContext) {
  const complet = ctx.role === "SYNDIC" || ctx.role === "SUPER_ADMIN" || p.utilisateurId === ctx.utilisateurId;
  const { numeroCnss, documentContrat, ...reste } = p;
  const base = {
    ...reste,
    salaireBrutMensuel: complet && p.salaireBrutMensuel ? toApiString(p.salaireBrutMensuel) : null,
    numeroCnssMasque: complet ? masquerCnss(numeroCnss) : null,
    cnssRenseigne: complet ? Boolean(numeroCnss) : null,
    documentContrat: complet && documentContrat ? { id: documentContrat.id, nom: documentContrat.nom, type: documentContrat.type } : null,
    horairesJson: p.horairesJson,
  };
  if (!complet) {
    return { ...base, typeContrat: null, dateEmbauche: null, dateFinContrat: null, notes: null, contactUrgence: p.contactUrgence, horairesJson: p.horairesJson };
  }
  return base;
}

async function chargerPersonnel(db: TenantDb, ctx: TenantContext, id: string): Promise<PersonnelRow> {
  const p = await db.personnel.findUnique({ where: { id }, include: personnelInclude });
  if (!p || p.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Fiche personnel introuvable.");
  const noms = await nomsUtilisateurs(db, [p.utilisateurId]);
  return { ...p, utilisateur: noms.get(p.utilisateurId) ?? null };
}

/** Fiche de l'employé appelant (GARDIEN…) ; introuvable = 404. */
export async function maFiche(db: TenantDb, ctx: TenantContext): Promise<PersonnelRow> {
  const p = await db.personnel.findFirst({ where: { coproprieteId: ctx.coproprieteId, utilisateurId: ctx.utilisateurId }, include: personnelInclude });
  if (!p) throw new IntrouvableError("Aucune fiche personnel pour cet utilisateur.");
  const noms = await nomsUtilisateurs(db, [p.utilisateurId]);
  return { ...p, utilisateur: noms.get(p.utilisateurId) ?? null };
}

/** RH « scoped » : syndic → toute fiche ; employé → la sienne seulement. */
async function assertAccesRh(db: TenantDb, ctx: TenantContext, personnelId: string, action = "personnel.rh.lire") {
  const permission = can(action, ctx.role);
  if (permission === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  const p = await chargerPersonnel(db, ctx, personnelId);
  if (permission === "scoped" && p.utilisateurId !== ctx.utilisateurId) throw new PermissionRefuseeError("Vous ne pouvez consulter que votre propre dossier.");
  return p;
}

export async function preparerUploadPersonnel(ctx: TenantContext, input: PersonnelUploadUrlInput) {
  if (can("personnel.rh.gerer", ctx.role) !== true && can("personnel.conges.demander", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return preparerUploadModule(ctx, "personnel", input.nom_fichier);
}

export async function modifierPersonnelRh(ctx: TenantContext, id: string, input: PersonnelRhUpdateInput) {
  if (can("personnel.rh.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic gère le dossier RH.");
  return withTenant(ctx, async (db) => {
    const avant = await chargerPersonnel(db, ctx, id);
    if (input.logement_lot_id) {
      const lot = await db.lot.findUnique({ where: { id: input.logement_lot_id }, select: { typeLot: true, coproprieteId: true } });
      if (!lot || lot.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Lot de logement introuvable.");
      if (lot.typeLot !== "LOGE_GARDIEN") throw new RhError("UNPROCESSABLE_ENTITY", "Le logement de fonction doit être un lot LOGE_GARDIEN (Doc A §9.2).");
    }
    const data: Prisma.PersonnelUncheckedUpdateInput = {
      ...(input.poste !== undefined ? { poste: input.poste } : {}),
      ...(input.type_contrat !== undefined ? { typeContrat: input.type_contrat } : {}),
      ...(input.date_embauche !== undefined ? { dateEmbauche: input.date_embauche ? dateUtc(input.date_embauche) : null } : {}),
      ...(input.date_fin_contrat !== undefined ? { dateFinContrat: input.date_fin_contrat ? dateUtc(input.date_fin_contrat) : null, finContratNotifieLe: null } : {}),
      ...(input.salaire_brut_mensuel !== undefined ? { salaireBrutMensuel: input.salaire_brut_mensuel ? money(input.salaire_brut_mensuel).toString() : null } : {}),
      ...(input.numero_cnss !== undefined ? { numeroCnss: input.numero_cnss } : {}),
      ...(input.contact_urgence !== undefined ? { contactUrgence: input.contact_urgence } : {}),
      ...(input.horaires !== undefined ? { horairesJson: (input.horaires ?? Prisma.DbNull) as Prisma.InputJsonValue } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.statut !== undefined ? { statut: input.statut } : {}),
      ...(input.logement_lot_id !== undefined ? { logementLotId: input.logement_lot_id } : {}),
    };
    if (input.contrat_travail) {
      assertCheminDansPerimetre(ctx, "personnel", input.contrat_travail.storage_path);
      const doc = await attacherDocument(db, ctx, { module: "personnel", type: "CONTRAT_TRAVAIL", nom: input.contrat_travail.nom, storagePath: input.contrat_travail.storage_path, visibilite: "SYNDIC_ONLY" });
      data.documentContratId = doc.id;
      await journal(db, ctx, id, "DOCUMENT_AJOUTE", { document_id: doc.id, type: "CONTRAT_TRAVAIL" });
    }
    // Départ (Doc A §9.2 « restitution logement ») : le logement de service est libéré.
    if (input.statut === "PARTI") data.logementLotId = null;
    const apresBrut = await db.personnel.update({ where: { id }, data, include: personnelInclude });
    const apres: PersonnelRow = { ...apresBrut, utilisateur: avant.utilisateur };
    const champs = Object.keys(input).filter((k) => (input as Record<string, unknown>)[k] !== undefined && k !== "numero_cnss");
    await journal(db, ctx, id, input.statut && input.statut !== avant.statut ? "STATUT_CHANGE" : "FICHE_MODIFIEE", { champs, ...(input.statut ? { statut: input.statut } : {}), ...(input.numero_cnss !== undefined ? { cnss_modifie: true } : {}) });
    // Audit sans PII sensible : jamais le n° CNSS ni le salaire en clair.
    await audit(db, ctx, "PERSONNEL_RH_MODIFIE", "personnel", id, { statut: avant.statut, poste: avant.poste }, { statut: apres.statut, poste: apres.poste, champs });
    return presenterPersonnel(apres, ctx);
  });
}

/** GET /personnel/{id} — fiche + solde de congés + synthèse paie / présences (complet pour syndic / l'employé). */
export async function obtenirPersonnel(ctx: TenantContext, id: string, now = new Date()) {
  if (can("personnel.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const p = await chargerPersonnel(db, ctx, id);
    const complet = ctx.role === "SYNDIC" || ctx.role === "SUPER_ADMIN" || p.utilisateurId === ctx.utilisateurId;
    const base = presenterPersonnel(p, ctx);
    if (!complet) return { ...base, solde_conges: null, paie: null, presences_mois: null, evaluation_moyenne: null, documents: [] };
    const annee = String(now.getUTCFullYear());
    const [copro, congesAnnee, fiches, presences, evaluations] = await Promise.all([
      db.copropriete.findUnique({ where: { id: ctx.coproprieteId }, select: { parametresPaieJson: true } }),
      db.conge.findMany({ where: { personnelId: id, type: "ANNUEL", statut: "APPROUVE", dateDebut: { gte: dateUtc(`${annee}-01-01`), lt: dateUtc(`${Number(annee) + 1}-01-01`) } }, select: { nbJours: true } }),
      db.fichePaie.findMany({ where: { personnelId: id }, orderBy: { periode: "desc" }, take: 3, select: { id: true, periode: true, statut: true, net: true, brut: true } }),
      db.presencePersonnel.findMany({ where: { personnelId: id, date: { gte: dateUtc(`${periodeCourante(now)}-01`) } }, select: { statut: true } }),
      ctx.role === "SYNDIC" || ctx.role === "SUPER_ADMIN" ? db.evaluationPersonnel.aggregate({ where: { personnelId: id }, _avg: { note: true }, _count: { _all: true } }) : Promise.resolve(null),
    ]);
    const params = lireParametresPaie(copro?.parametresPaieJson);
    const pris = congesAnnee.reduce((a, c) => a.plus(money(c.nbJours)), money(0));
    const docs = p.documentContrat ? await urlsSigneesDocuments([p.documentContrat]) : [];
    return {
      ...base,
      solde_conges: {
        annee,
        acquis: params?.jours_conge_annuels ?? null,
        pris: pris.toString(),
        solde: params?.jours_conge_annuels ? money(params.jours_conge_annuels).minus(pris).toString() : null,
        parametres_non_configures: !params?.jours_conge_annuels,
      },
      paie: { parametres_configures: params !== null, dernieres: fiches.map((f) => ({ ...f, net: toApiString(f.net), brut: toApiString(f.brut) })) },
      presences_mois: { periode: periodeCourante(now), presents: presences.filter((x) => x.statut === "PRESENT").length, absents: presences.filter((x) => x.statut === "ABSENT").length, conges: presences.filter((x) => x.statut === "CONGE" || x.statut === "MALADIE").length },
      evaluation_moyenne: evaluations ? { moyenne: evaluations._avg.note ? Number(evaluations._avg.note.toFixed(2)) : null, nb: evaluations._count._all } : null,
      documents: docs,
    };
  });
}

/** GET /personnel/{id}/cnss — n° CNSS complet, syndic seul, audité. */
export async function lireCnss(ctx: TenantContext, id: string) {
  if (can("personnel.rh.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic consulte le n° CNSS complet.");
  return withTenant(ctx, async (db) => {
    const p = await chargerPersonnel(db, ctx, id);
    await journal(db, ctx, id, "CNSS_CONSULTE");
    await audit(db, ctx, "CNSS_CONSULTE", "personnel", id, undefined, { renseigne: Boolean(p.numeroCnss) });
    return { personnel_id: id, numero_cnss: p.numeroCnss };
  });
}

// ── Paramètres de paie ─────────────────────────────────────────────────────────

export async function definirParametresPaie(ctx: TenantContext, coproprieteId: string, parametres: ParametresPaie | null) {
  if (can("personnel.rh.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic configure la paie.");
  if (coproprieteId !== ctx.coproprieteId) throw new PermissionRefuseeError("Copropriété hors périmètre.");
  return withTenant(ctx, async (db) => {
    const avant = await db.copropriete.findUnique({ where: { id: coproprieteId }, select: { parametresPaieJson: true } });
    await db.copropriete.update({ where: { id: coproprieteId }, data: { parametresPaieJson: (parametres ?? Prisma.DbNull) as Prisma.InputJsonValue } });
    await audit(db, ctx, "PAIE_PARAMETRES_MODIFIES", "copropriete", coproprieteId, { configures: avant?.parametresPaieJson !== null }, { configures: parametres !== null, source: parametres?.source ?? null });
    return { parametres_paie: parametres };
  });
}

export async function lireParametresPaieCopro(ctx: TenantContext) {
  if (can("personnel.rh.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic consulte les paramètres de paie.");
  return withTenant(ctx, async (db) => {
    const copro = await db.copropriete.findUnique({ where: { id: ctx.coproprieteId }, select: { parametresPaieJson: true } });
    return { parametres_paie: lireParametresPaie(copro?.parametresPaieJson) };
  });
}

// ── Fiches de paie ─────────────────────────────────────────────────────────────

const ficheInclude = { personnel: { select: { id: true, poste: true, utilisateurId: true } }, depense: { select: { id: true, statut: true, montantTtc: true } } } satisfies Prisma.FichePaieInclude;
type FicheRow = Prisma.FichePaieGetPayload<{ include: typeof ficheInclude }>;
function presenterFiche(f: FicheRow, noms?: Map<string, Identite>) {
  const u = noms?.get(f.personnel.utilisateurId) ?? null;
  return { ...f, brut: toApiString(f.brut), primes: f.primes ? toApiString(f.primes) : null, retenues: f.retenues ? toApiString(f.retenues) : null, net: toApiString(f.net), coutTotalEmployeur: toApiString(f.coutTotalEmployeur), depense: f.depense ? { ...f.depense, montantTtc: toApiString(f.depense.montantTtc) } : null, personnel: { ...f.personnel, nom: u ? nomComplet(u, "") || null : null } };
}
async function presenterFiches(db: TenantDb, rows: FicheRow[]) {
  const noms = await nomsUtilisateurs(db, rows.map((r) => r.personnel.utilisateurId));
  return rows.map((r) => presenterFiche(r, noms));
}

async function absencesInjustifiees(db: TenantDb, personnelId: string, periode: string) {
  const [y, m] = periode.split("-").map(Number) as [number, number];
  return db.presencePersonnel.count({ where: { personnelId, statut: "ABSENT", date: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) } } });
}

/** Calcule une fiche (paramètres présents) ou un brouillon « brut seul » (paramètres absents). */
export async function calculerFicheDb(db: TenantDb, coproprieteId: string, personnel: { id: string; salaireBrutMensuel: Prisma.Decimal | null }, input: FichePaieCreateInput | (FichePaieUpdateInput & { periode: string })) {
  const copro = await db.copropriete.findUnique({ where: { id: coproprieteId }, select: { parametresPaieJson: true } });
  const params = lireParametresPaie(copro?.parametresPaieJson);
  const brut = input.brut ?? (personnel.salaireBrutMensuel ? toApiString(personnel.salaireBrutMensuel) : null);
  if (!brut) throw new RhError("UNPROCESSABLE_ENTITY", "Aucun salaire brut : renseignez `salaire_brut_mensuel` sur la fiche RH ou `brut` sur la fiche de paie.");
  const joursAbs = input.jours_absence_injustifiee ?? (await absencesInjustifiees(db, personnel.id, input.periode));
  if (!params) {
    const b = money(brut), primes = money(input.primes ?? 0), retenues = money(input.retenues ?? 0);
    return { params: null as ParametresPaie | null, resultat: null as ResultatPaie | null, brut, primes: input.primes ?? null, retenues: input.retenues ?? null, joursAbs, data: { brut: b.toString(), primes: input.primes ? primes.toString() : null, retenues: input.retenues ? retenues.toString() : null, cotisationsSalarialesJson: {}, cotisationsPatronalesJson: {}, net: b.plus(primes).minus(retenues).greaterThan(0) ? b.plus(primes).minus(retenues).toString() : "0", coutTotalEmployeur: b.plus(primes).toString(), detailsJson: { parametres_non_configures: true, jours_absence_injustifiee: joursAbs } as Prisma.InputJsonValue } };
  }
  const r = calculerPaie(params, { brut, primes: input.primes, retenues: input.retenues, jours_absence_injustifiee: joursAbs });
  return { params, resultat: r, brut, primes: input.primes ?? null, retenues: input.retenues ?? null, joursAbs, data: { brut: r.brut, primes: input.primes ? r.primes : null, retenues: input.retenues ? r.retenues : null, cotisationsSalarialesJson: r.cotisations_salariales as Prisma.InputJsonValue, cotisationsPatronalesJson: r.cotisations_patronales as Prisma.InputJsonValue, net: r.net, coutTotalEmployeur: r.cout_total_employeur, detailsJson: r as unknown as Prisma.InputJsonValue } };
}

export async function creerFichePaie(ctx: TenantContext, personnelId: string, input: FichePaieCreateInput) {
  if (can("personnel.rh.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic prépare les fiches de paie.");
  return withTenant(ctx, async (db) => {
    const p = await chargerPersonnel(db, ctx, personnelId);
    const existante = await db.fichePaie.findUnique({ where: { personnelId_periode: { personnelId, periode: input.periode } } });
    if (existante && existante.statut !== "BROUILLON") throw new RhError("PAIE_STATUT_INVALIDE", `Une fiche ${existante.statut} existe déjà pour ${input.periode}.`);
    const calc = await calculerFicheDb(db, ctx.coproprieteId, p, input);
    const f = existante
      ? await db.fichePaie.update({ where: { id: existante.id }, data: calc.data, include: ficheInclude })
      : await db.fichePaie.create({ data: { coproprieteId: ctx.coproprieteId, personnelId, periode: input.periode, ...calc.data }, include: ficheInclude });
    await journal(db, ctx, personnelId, "PAIE_BROUILLON", { fiche_id: f.id, periode: input.periode, parametres_configures: calc.params !== null });
    return { ...presenterFiche(f, new Map(p.utilisateur ? [[p.utilisateurId, p.utilisateur]] : [])), regeneree: existante !== null };
  });
}

export async function modifierFichePaie(ctx: TenantContext, personnelId: string, ficheId: string, input: FichePaieUpdateInput) {
  if (can("personnel.rh.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic modifie une fiche de paie.");
  return withTenant(ctx, async (db) => {
    const p = await chargerPersonnel(db, ctx, personnelId);
    const f = await db.fichePaie.findUnique({ where: { id: ficheId } });
    if (!f || f.personnelId !== personnelId) throw new IntrouvableError("Fiche de paie introuvable.");
    if (f.statut !== "BROUILLON") throw new RhError("PAIE_STATUT_INVALIDE", `Une fiche ${f.statut} ne se modifie plus.`);
    const calc = await calculerFicheDb(db, ctx.coproprieteId, p, { periode: f.periode, brut: input.brut ?? toApiString(f.brut), primes: input.primes === undefined ? (f.primes ? toApiString(f.primes) : null) : input.primes, retenues: input.retenues === undefined ? (f.retenues ? toApiString(f.retenues) : null) : input.retenues, jours_absence_injustifiee: input.jours_absence_injustifiee });
    const maj = await db.fichePaie.update({ where: { id: ficheId }, data: calc.data, include: ficheInclude });
    await journal(db, ctx, personnelId, "PAIE_BROUILLON", { fiche_id: ficheId, periode: f.periode, recalcul: true });
    return presenterFiche(maj, new Map(p.utilisateur ? [[p.utilisateurId, p.utilisateur]] : []));
  });
}

/** POST …/fiches-paie/{fid}/valider — recalcul avec les paramètres (422 si absents), dépense PERSONNEL créée et soumise, PDF déposé. */
export async function validerFichePaie(ctx: TenantContext, personnelId: string, ficheId: string, cle?: string) {
  if (can("personnel.rh.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic valide une fiche de paie.");
  const resultat = await withTenantIdempotent(ctx, { cle, endpoint: `POST /personnel/${personnelId}/fiches-paie/${ficheId}/valider`, payload: { personnelId, ficheId } }, async (db) => {
    const p = await chargerPersonnel(db, ctx, personnelId);
    const f = await db.fichePaie.findUnique({ where: { id: ficheId } });
    if (!f || f.personnelId !== personnelId) throw new IntrouvableError("Fiche de paie introuvable.");
    if (f.statut !== "BROUILLON") throw new RhError("PAIE_STATUT_INVALIDE", `Seule une fiche BROUILLON se valide (statut actuel : ${f.statut}).`);
    const calc = await calculerFicheDb(db, ctx.coproprieteId, p, { periode: f.periode, brut: toApiString(f.brut), primes: f.primes ? toApiString(f.primes) : null, retenues: f.retenues ? toApiString(f.retenues) : null, jours_absence_injustifiee: (f.detailsJson as { jours_absence_injustifiee?: number } | null)?.jours_absence_injustifiee });
    if (!calc.params || !calc.resultat) {
      throw new RhError("PAIE_PARAMETRES_NON_CONFIGURES", "Paramètres de paie non configurés (CNSS, AMO, IR, SMIG…) : renseignez-les dans Paramètres → Paie avant de valider (LEGAL_QUESTIONS_BRIEF §11).");
    }
    // Dépense PERSONNEL = coût total employeur (salaire + charges patronales), soumise à l'approbation M16.
    const nom = nomComplet(p.utilisateur, p.poste);
    const depense = await creerDepenseDb(db, ctx, {
      categorie: "PERSONNEL",
      libelle: `Paie ${f.periode} — ${nom}`,
      description: `Salaire brut ${calc.resultat.brut} MAD, net ${calc.resultat.net} MAD, charges patronales ${calc.resultat.cotisations_patronales.total} MAD.`,
      montant_ht: null,
      tva: null,
      montant_ttc: calc.resultat.cout_total_employeur,
      date_depense: `${f.periode}-28`.slice(0, 7) + "-28",
      source: "COMPTE_COURANT",
      budget_poste_id: null,
      prestataire_id: null,
      incident_id: null,
      resolution_ag_id: null,
      contrat_id: null,
      personnel_id: personnelId,
      periode_paie: f.periode,
    });
    await soumettreDepenseDb(db, ctx, depense.id);
    const maj = await db.fichePaie.update({ where: { id: ficheId }, data: { ...calc.data, statut: "VALIDEE", depenseId: depense.id, valideParId: ctx.utilisateurId, valideLe: new Date() }, include: ficheInclude });
    await journal(db, ctx, personnelId, "PAIE_VALIDEE", { fiche_id: ficheId, periode: f.periode, depense_id: depense.id, net: calc.resultat.net });
    await audit(db, ctx, "PAIE_VALIDEE", "fiche_paie", ficheId, { statut: "BROUILLON" }, { statut: "VALIDEE", periode: f.periode, depense_id: depense.id });
    await notifier(db, ctx.coproprieteId, [p.utilisateurId], "PAIE_VALIDEE", { fiche_id: ficheId, personnel_id: personnelId, periode: f.periode, net: calc.resultat.net });
    return { fiche: presenterFiche(maj, new Map(p.utilisateur ? [[p.utilisateurId, p.utilisateur]] : [])), calc, personnel: p };
  });
  // PDF déposé en GED (SYNDIC_ONLY) hors transaction — l'employé lit le PDF via GET …/pdf (rendu à la demande).
  try {
    const { genererFichePaiePdf } = await import("./fiche-paie-pdf");
    const { televerserDocument } = await import("../storage/supabase-storage");
    const { cheminModule } = await import("../documents/attach");
    const copro = await withTenant(ctx, (db) => db.copropriete.findUnique({ where: { id: ctx.coproprieteId }, select: { nom: true, adresse: true, ville: true } }));
    const buffer = await genererFichePaiePdf({ fiche: resultat.fiche, resultat: resultat.calc.resultat!, personnel: resultat.personnel, copropriete: copro! }, "fr");
    const chemin = cheminModule(ctx, "personnel", `fiche-paie-${resultat.fiche.periode}.pdf`);
    await televerserDocument(chemin, buffer, "application/pdf");
    await withTenant(ctx, async (db) => {
      const doc = await attacherDocument(db, ctx, { module: "personnel", type: "FICHE_PAIE", nom: `Fiche de paie ${resultat.fiche.periode}.pdf`, storagePath: chemin, visibilite: "SYNDIC_ONLY" });
      await db.fichePaie.update({ where: { id: ficheId }, data: { documentId: doc.id } });
    });
  } catch (e) {
    await withTenant(ctx, (db) => audit(db, ctx, "PAIE_PDF_ECHEC", "fiche_paie", ficheId, undefined, { erreur: e instanceof Error ? e.message : String(e) }));
  }
  return resultat.fiche;
}

export async function listerFichesPaie(ctx: TenantContext, personnelId: string, filtres: { periode?: string; statut?: string }) {
  return withTenant(ctx, async (db) => {
    await assertAccesRh(db, ctx, personnelId);
    const rows = await db.fichePaie.findMany({ where: { personnelId, ...(filtres.periode ? { periode: filtres.periode } : {}), ...(filtres.statut ? { statut: filtres.statut as never } : {}) }, orderBy: { periode: "desc" }, include: ficheInclude });
    return presenterFiches(db, rows);
  });
}

/** GET /personnel/fiches-paie?periode= — vue paie du mois (syndic). */
export async function listerFichesPaieCopropriete(ctx: TenantContext, periode: string) {
  if (can("personnel.rh.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic consulte la paie de la copropriété.");
  return withTenant(ctx, async (db) => {
    const [rows, personnels] = await Promise.all([
      db.fichePaie.findMany({ where: { coproprieteId: ctx.coproprieteId, periode }, include: ficheInclude, orderBy: { creeLe: "asc" } }),
      db.personnel.findMany({ where: { coproprieteId: ctx.coproprieteId, statut: { in: ["PRESENT", "ABSENT", "REMPLACE"] } }, select: { id: true, poste: true, salaireBrutMensuel: true, utilisateurId: true } }),
    ]);
    const noms = await nomsUtilisateurs(db, [...rows.map((r) => r.personnel.utilisateurId), ...personnels.map((p) => p.utilisateurId)]);
    const total = rows.reduce((a, f) => a.plus(money(f.coutTotalEmployeur)), money(0));
    const netTotal = rows.reduce((a, f) => a.plus(money(f.net)), money(0));
    return {
      periode,
      fiches: rows.map((r) => presenterFiche(r, noms)),
      sans_fiche: personnels.filter((p) => !rows.some((f) => f.personnelId === p.id)).map((p) => ({ id: p.id, poste: p.poste, nom: nomComplet(noms.get(p.utilisateurId), p.poste), salaire_brut_mensuel: p.salaireBrutMensuel ? toApiString(p.salaireBrutMensuel) : null })),
      totaux: { cout_total_employeur: toApiString(total), net: toApiString(netTotal), nb: rows.length },
    };
  });
}

export async function pdfFichePaie(ctx: TenantContext, personnelId: string, ficheId: string, langue: "fr" | "ar") {
  const { fiche, personnel, copropriete } = await withTenant(ctx, async (db) => {
    const p = await assertAccesRh(db, ctx, personnelId);
    const f = await db.fichePaie.findUnique({ where: { id: ficheId }, include: ficheInclude });
    if (!f || f.personnelId !== personnelId) throw new IntrouvableError("Fiche de paie introuvable.");
    if (f.statut === "BROUILLON" && ctx.role !== "SYNDIC" && ctx.role !== "SUPER_ADMIN") throw new RhError("PAIE_STATUT_INVALIDE", "Fiche non encore validée.");
    const copro = await db.copropriete.findUniqueOrThrow({ where: { id: ctx.coproprieteId }, select: { nom: true, adresse: true, ville: true } });
    return { fiche: presenterFiche(f, new Map(p.utilisateur ? [[p.utilisateurId, p.utilisateur]] : [])), personnel: p, copropriete: copro };
  });
  const details = fiche.detailsJson as ResultatPaie | { parametres_non_configures: true } | null;
  if (!details || "parametres_non_configures" in details) throw new RhError("PAIE_PARAMETRES_NON_CONFIGURES", "Fiche calculée sans paramètres : aucun PDF.");
  const { genererFichePaiePdf } = await import("./fiche-paie-pdf");
  const buffer = await genererFichePaiePdf({ fiche, resultat: details, personnel, copropriete }, langue);
  return { buffer, nomFichier: `fiche-paie-${fiche.periode}-${langue}.pdf` };
}

// ── Congés ─────────────────────────────────────────────────────────────────────

const congeInclude = { personnel: { select: { id: true, poste: true, utilisateurId: true } }, remplacant: { select: { id: true, poste: true, utilisateurId: true } }, document: { select: { id: true, nom: true } } } satisfies Prisma.CongeInclude;
type CongeRow = Prisma.CongeGetPayload<{ include: typeof congeInclude }>;
function presenterConge(c: CongeRow, noms?: Map<string, Identite>) {
  const u = noms?.get(c.personnel.utilisateurId) ?? null;
  const r = c.remplacant ? noms?.get(c.remplacant.utilisateurId) ?? null : null;
  return { ...c, nbJours: c.nbJours.toString(), personnel: { ...c.personnel, nom: u ? nomComplet(u, "") || null : null }, remplacant: c.remplacant ? { ...c.remplacant, nom: r ? nomComplet(r, "") || null : null } : null };
}
async function presenterConges(db: TenantDb, rows: CongeRow[]) {
  const noms = await nomsUtilisateurs(db, rows.flatMap((r) => [r.personnel.utilisateurId, ...(r.remplacant ? [r.remplacant.utilisateurId] : [])]));
  return rows.map((r) => presenterConge(r, noms));
}

async function soldeConges(db: TenantDb, coproprieteId: string, personnelId: string, annee: string) {
  const copro = await db.copropriete.findUnique({ where: { id: coproprieteId }, select: { parametresPaieJson: true } });
  const params = lireParametresPaie(copro?.parametresPaieJson);
  const pris = (await db.conge.findMany({ where: { personnelId, type: "ANNUEL", statut: "APPROUVE", dateDebut: { gte: dateUtc(`${annee}-01-01`), lt: dateUtc(`${Number(annee) + 1}-01-01`) } }, select: { nbJours: true } })).reduce((a, c) => a.plus(money(c.nbJours)), money(0));
  return { acquis: params?.jours_conge_annuels ? money(params.jours_conge_annuels) : null, pris };
}

export async function demanderConge(ctx: TenantContext, input: CongeCreateInput, cle?: string) {
  const permission = can("personnel.conges.demander", ctx.role);
  if (permission === false) throw new PermissionRefuseeError("Rôle non autorisé à demander un congé.");
  return withTenantIdempotent(ctx, { cle, endpoint: "POST /personnel/conges", payload: input }, async (db) => {
    const p = permission === "scoped" || !input.personnel_id ? await maFiche(db, ctx) : await chargerPersonnel(db, ctx, input.personnel_id);
    if (permission === "scoped" && input.personnel_id && input.personnel_id !== p.id) throw new PermissionRefuseeError("Vous ne pouvez demander un congé que pour vous-même.");
    const debut = dateUtc(input.date_debut), fin = dateUtc(input.date_fin);
    const nbJours = input.nb_jours ? money(input.nb_jours) : money(joursOuvrables(debut, fin));
    if (input.remplacant_personnel_id) {
      const r = await db.personnel.findUnique({ where: { id: input.remplacant_personnel_id }, select: { coproprieteId: true } });
      if (!r || r.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Remplaçant introuvable.");
    }
    // Chevauchement avec un congé approuvé ou en attente.
    const chevauche = await db.conge.findFirst({ where: { personnelId: p.id, statut: { in: ["DEMANDE", "APPROUVE"] }, dateDebut: { lte: fin }, dateFin: { gte: debut } } });
    if (chevauche) throw new RhError("CONGE_STATUT_INVALIDE", "Un congé existe déjà sur cette période.");
    let documentId: string | null = null;
    if (input.certificat) {
      assertCheminDansPerimetre(ctx, "personnel", input.certificat.storage_path);
      // L'employé n'a pas l'INSERT sur `document` : le certificat est rattaché par le syndic à l'approbation
      // si l'appelant est l'employé (le chemin est mémorisé dans le motif technique). Le syndic l'attache directement.
      if (ctx.role === "SYNDIC" || ctx.role === "SUPER_ADMIN") {
        const doc = await attacherDocument(db, ctx, { module: "personnel", type: "CERTIFICAT_CONGE", nom: input.certificat.nom, storagePath: input.certificat.storage_path, visibilite: "SYNDIC_ONLY" });
        documentId = doc.id;
      }
    }
    const c = await db.conge.create({
      data: { coproprieteId: ctx.coproprieteId, personnelId: p.id, type: input.type, dateDebut: debut, dateFin: fin, nbJours: nbJours.toString(), motif: input.motif ?? null, documentId, remplacantPersonnelId: input.remplacant_personnel_id ?? null, statut: "DEMANDE" },
      include: congeInclude,
    });
    await journal(db, ctx, p.id, "CONGE_DEMANDE", { conge_id: c.id, type: c.type, debut: input.date_debut, fin: input.date_fin, nb_jours: nbJours.toString(), ...(input.certificat && !documentId ? { certificat_chemin: input.certificat.storage_path, certificat_nom: input.certificat.nom } : {}) });
    const nom = nomComplet(p.utilisateur, p.poste);
    await notifier(db, ctx.coproprieteId, (await syndics(db, ctx.coproprieteId)).filter((u) => u !== ctx.utilisateurId), "CONGE_DEMANDE", { conge_id: c.id, personnel_id: p.id, nom, type: c.type, debut: input.date_debut, fin: input.date_fin, jours: nbJours.toString() });
    return (await presenterConges(db, [c]))[0]!;
  });
}

export async function deciderConge(ctx: TenantContext, congeId: string, decision: "APPROUVE" | "REFUSE", input: CongeDeciderInput, cle?: string) {
  if (can("personnel.conges.approuver", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic décide des congés.");
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /personnel/conges/${congeId}/${decision.toLowerCase()}`, payload: { congeId, ...input } }, async (db) => {
    const c = await db.conge.findUnique({ where: { id: congeId }, include: congeInclude });
    if (!c || c.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Congé introuvable.");
    if (c.statut !== "DEMANDE") throw new RhError("CONGE_STATUT_INVALIDE", `Seule une demande en attente se décide (statut actuel : ${c.statut}).`);
    if (decision === "REFUSE" && !input.motif_refus) throw new RhError("UNPROCESSABLE_ENTITY", "Le motif du refus est obligatoire.");
    if (decision === "APPROUVE" && c.type === "ANNUEL") {
      const solde = await soldeConges(db, ctx.coproprieteId, c.personnelId, String(c.dateDebut.getUTCFullYear()));
      if (solde.acquis && solde.pris.plus(money(c.nbJours)).greaterThan(solde.acquis)) {
        throw new RhError("CONGE_SOLDE_INSUFFISANT", `Solde de congés insuffisant : ${solde.acquis.minus(solde.pris).toString()} j disponibles pour ${c.nbJours.toString()} j demandés.`);
      }
    }
    // Certificat téléversé par l'employé à la demande : rattaché maintenant (le syndic a l'INSERT sur document).
    let documentId = c.documentId;
    if (!documentId) {
      const log = await db.personnelLog.findFirst({ where: { personnelId: c.personnelId, type: "CONGE_DEMANDE", detailsJson: { path: ["conge_id"], equals: congeId } }, orderBy: { horodatage: "desc" } });
      const d = log?.detailsJson as { certificat_chemin?: string; certificat_nom?: string } | null;
      if (d?.certificat_chemin) {
        const doc = await attacherDocument(db, ctx, { module: "personnel", type: "CERTIFICAT_CONGE", nom: d.certificat_nom ?? "certificat", storagePath: d.certificat_chemin, visibilite: "SYNDIC_ONLY" });
        documentId = doc.id;
      }
    }
    const maj = await db.conge.update({ where: { id: congeId }, data: { statut: decision, traiteParId: ctx.utilisateurId, traiteLe: new Date(), motifRefus: decision === "REFUSE" ? input.motif_refus : null, documentId, ...(input.remplacant_personnel_id !== undefined ? { remplacantPersonnelId: input.remplacant_personnel_id } : {}) }, include: congeInclude });
    // Congé approuvé → présences CONGE / MALADIE posées pour chaque jour ouvrable (idempotent : upsert).
    if (decision === "APPROUVE") {
      const statut = c.type === "MALADIE" ? "MALADIE" : "CONGE";
      for (let d = new Date(c.dateDebut); d <= c.dateFin; d = new Date(d.getTime() + 86_400_000)) {
        if (d.getUTCDay() === 0) continue;
        await db.presencePersonnel.upsert({ where: { personnelId_date: { personnelId: c.personnelId, date: d } }, create: { coproprieteId: ctx.coproprieteId, personnelId: c.personnelId, date: d, statut, saisiParId: ctx.utilisateurId, commentaire: `Congé ${c.type}` }, update: { statut, saisiParId: ctx.utilisateurId } });
      }
    }
    await journal(db, ctx, c.personnelId, decision === "APPROUVE" ? "CONGE_APPROUVE" : "CONGE_REFUSE", { conge_id: congeId, motif_refus: input.motif_refus ?? null });
    await audit(db, ctx, decision === "APPROUVE" ? "CONGE_APPROUVE" : "CONGE_REFUSE", "conge", congeId, { statut: "DEMANDE" }, { statut: decision, nb_jours: c.nbJours.toString() });
    const presente = (await presenterConges(db, [maj]))[0]!;
    const remplacant = presente.remplacant?.nom ? ` — ${presente.remplacant.nom}` : "";
    await notifier(db, ctx.coproprieteId, [c.personnel.utilisateurId], decision === "APPROUVE" ? "CONGE_APPROUVE" : "CONGE_REFUSE", { conge_id: congeId, personnel_id: c.personnelId, debut: isoDate(c.dateDebut), fin: isoDate(c.dateFin), remplacant, motif: input.motif_refus ?? "" });
    return presente;
  });
}

export async function annulerConge(ctx: TenantContext, congeId: string) {
  return withTenant(ctx, async (db) => {
    const c = await db.conge.findUnique({ where: { id: congeId }, include: congeInclude });
    if (!c || c.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Congé introuvable.");
    const syndic = can("personnel.conges.approuver", ctx.role) === true;
    if (!syndic && c.personnel.utilisateurId !== ctx.utilisateurId) throw new PermissionRefuseeError("Vous ne pouvez annuler que vos propres demandes.");
    if (c.statut !== "DEMANDE" && !(syndic && c.statut === "APPROUVE" && c.dateDebut > new Date())) throw new RhError("CONGE_STATUT_INVALIDE", "Cette demande ne peut plus être annulée.");
    const maj = await db.conge.update({ where: { id: congeId }, data: { statut: "ANNULE" }, include: congeInclude });
    if (c.statut === "APPROUVE") await db.presencePersonnel.deleteMany({ where: { personnelId: c.personnelId, date: { gte: c.dateDebut, lte: c.dateFin }, statut: { in: ["CONGE", "MALADIE"] } } });
    await journal(db, ctx, c.personnelId, "CONGE_ANNULE", { conge_id: congeId });
    return (await presenterConges(db, [maj]))[0]!;
  });
}

export async function listerConges(ctx: TenantContext, personnelId: string | null, filtres: { statut?: string; annee?: string }) {
  return withTenant(ctx, async (db) => {
    let where: Prisma.CongeWhereInput = { coproprieteId: ctx.coproprieteId };
    if (personnelId) {
      await assertAccesRh(db, ctx, personnelId, can("personnel.rh.lire", ctx.role) === false && can("personnel.planning.lire", ctx.role) !== false ? "personnel.planning.lire" : "personnel.rh.lire");
      where = { ...where, personnelId };
    } else if (can("personnel.planning.lire", ctx.role) === "scoped") {
      const p = await maFiche(db, ctx);
      where = { ...where, personnelId: p.id };
    } else if (can("personnel.planning.lire", ctx.role) !== true) {
      throw new PermissionRefuseeError("Rôle non autorisé.");
    }
    if (filtres.statut) where = { ...where, statut: filtres.statut as never };
    if (filtres.annee) where = { ...where, dateDebut: { gte: dateUtc(`${filtres.annee}-01-01`), lt: dateUtc(`${Number(filtres.annee) + 1}-01-01`) } };
    const rows = await db.conge.findMany({ where, include: congeInclude, orderBy: [{ statut: "asc" }, { dateDebut: "desc" }] });
    return presenterConges(db, rows);
  });
}

// ── Présences ──────────────────────────────────────────────────────────────────

export async function saisirPresences(ctx: TenantContext, personnelId: string, input: PresencesUpsertInput) {
  const permission = can("personnel.presence.saisir", ctx.role);
  if (permission === false) throw new PermissionRefuseeError("Rôle non autorisé à saisir les présences.");
  return withTenant(ctx, async (db) => {
    const p = await chargerPersonnel(db, ctx, personnelId);
    if (permission === "scoped" && p.utilisateurId !== ctx.utilisateurId) throw new PermissionRefuseeError("Vous ne pouvez pointer que pour vous-même.");
    const rows = [];
    for (const x of input.presences) {
      rows.push(await db.presencePersonnel.upsert({ where: { personnelId_date: { personnelId, date: dateUtc(x.date) } }, create: { coproprieteId: ctx.coproprieteId, personnelId, date: dateUtc(x.date), statut: x.statut, commentaire: x.commentaire ?? null, saisiParId: ctx.utilisateurId }, update: { statut: x.statut, commentaire: x.commentaire ?? null, saisiParId: ctx.utilisateurId } }));
    }
    await journal(db, ctx, personnelId, "PRESENCE_SAISIE", { nb: rows.length, du: input.presences[0]!.date, au: input.presences[input.presences.length - 1]!.date });
    // Absence signalée par le syndic → statut ABSENT de la fiche (Doc A §9.2 « alerte syndic ») si la date est aujourd'hui.
    return rows;
  });
}

/** POST /personnel/me/presence — pointage de l'employé (mobile, file hors-ligne, Idempotency-Key). */
export async function pointer(ctx: TenantContext, input: PresenceSelfInput, cle?: string, now = new Date()) {
  if (can("personnel.presence.saisir", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenantIdempotent(ctx, { cle, endpoint: "POST /personnel/me/presence", payload: input }, async (db) => {
    const p = await maFiche(db, ctx);
    const date = input.date ? dateUtc(input.date) : dateUtc(isoDate(now));
    const r = await db.presencePersonnel.upsert({ where: { personnelId_date: { personnelId: p.id, date } }, create: { coproprieteId: ctx.coproprieteId, personnelId: p.id, date, statut: input.statut, commentaire: input.commentaire ?? null, saisiParId: ctx.utilisateurId }, update: { statut: input.statut, commentaire: input.commentaire ?? null, saisiParId: ctx.utilisateurId } });
    await journal(db, ctx, p.id, "PRESENCE_SAISIE", { self: true, date: isoDate(date), statut: input.statut });
    return r;
  });
}

export async function listerPresences(ctx: TenantContext, personnelId: string, from: string, to: string) {
  return withTenant(ctx, async (db) => {
    await assertAccesRh(db, ctx, personnelId, can("personnel.rh.lire", ctx.role) === false ? "personnel.planning.lire" : "personnel.rh.lire");
    return db.presencePersonnel.findMany({ where: { personnelId, date: { gte: dateUtc(from), lte: dateUtc(to) } }, orderBy: { date: "asc" } });
  });
}

// ── Évaluations ────────────────────────────────────────────────────────────────

export async function evaluer(ctx: TenantContext, personnelId: string, input: EvaluationCreateInput) {
  if (can("personnel.evaluer", ctx.role) !== true) throw new PermissionRefuseeError("Seuls le syndic et le conseil syndical évaluent le personnel.");
  return withTenant(ctx, async (db) => {
    await chargerPersonnel(db, ctx, personnelId);
    const e = await db.evaluationPersonnel.upsert({
      where: { personnelId_periode_evaluateurId: { personnelId, periode: input.periode, evaluateurId: ctx.utilisateurId } },
      create: { coproprieteId: ctx.coproprieteId, personnelId, periode: input.periode, note: input.note, commentaire: input.commentaire ?? null, evaluateurId: ctx.utilisateurId },
      update: { note: input.note, commentaire: input.commentaire ?? null },
      include: { evaluateur: { select: { id: true, nom: true, prenom: true } } },
    });
    await journal(db, ctx, personnelId, "EVALUATION", { evaluation_id: e.id, periode: input.periode, note: input.note });
    await audit(db, ctx, "PERSONNEL_EVALUE", "personnel", personnelId, undefined, { periode: input.periode, note: input.note });
    return e;
  });
}

export async function listerEvaluations(ctx: TenantContext, personnelId: string) {
  if (can("personnel.evaluer", ctx.role) !== true) throw new PermissionRefuseeError("Évaluations réservées au syndic et au conseil.");
  return withTenant(ctx, async (db) => {
    await chargerPersonnel(db, ctx, personnelId);
    const rows = await db.evaluationPersonnel.findMany({ where: { personnelId }, orderBy: [{ periode: "desc" }, { creeLe: "desc" }], include: { evaluateur: { select: { id: true, nom: true, prenom: true } } } });
    const moyenne = rows.length ? rows.reduce((a, r) => a + r.note, 0) / rows.length : null;
    return { evaluations: rows, moyenne: moyenne === null ? null : Number(moyenne.toFixed(2)) };
  });
}

// ── Planning ───────────────────────────────────────────────────────────────────

export async function planning(ctx: TenantContext, semaine?: string, now = new Date()) {
  const permission = can("personnel.planning.lire", ctx.role);
  if (permission === false) throw new PermissionRefuseeError("Rôle non autorisé à consulter le planning.");
  const ref = semaine ? dateUtc(semaine) : dateUtc(isoDate(now));
  const lundi = new Date(ref.getTime() - ((ref.getUTCDay() + 6) % 7) * 86_400_000);
  const dimanche = new Date(lundi.getTime() + 6 * 86_400_000);
  return withTenant(ctx, async (db) => {
    const where: Prisma.PersonnelWhereInput = { coproprieteId: ctx.coproprieteId, statut: { notIn: ["PARTI"] }, ...(permission === "scoped" ? { utilisateurId: ctx.utilisateurId } : {}) };
    const bruts = await db.personnel.findMany({ where, include: personnelInclude, orderBy: { creeLe: "asc" } });
    const nomsP = await nomsUtilisateurs(db, bruts.map((p) => p.utilisateurId));
    const personnels: PersonnelRow[] = bruts.map((p) => ({ ...p, utilisateur: nomsP.get(p.utilisateurId) ?? null }));
    const ids = personnels.map((p) => p.id);
    const [conges, presences] = await Promise.all([
      db.conge.findMany({ where: { personnelId: { in: ids }, statut: "APPROUVE", dateDebut: { lte: dimanche }, dateFin: { gte: lundi } }, include: congeInclude }),
      db.presencePersonnel.findMany({ where: { personnelId: { in: ids }, date: { gte: lundi, lte: dimanche } } }),
    ]);
    const jours = Array.from({ length: 7 }, (_, i) => new Date(lundi.getTime() + i * 86_400_000));
    const cles = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"] as const;
    return {
      semaine: isoDate(lundi),
      jours: jours.map(isoDate),
      personnels: personnels.map((p) => {
        const horaires = (p.horairesJson ?? {}) as Record<string, { debut: string; fin: string }[]>;
        return {
          ...presenterPersonnel(p, ctx),
          jours: jours.map((d, i) => {
            const conge = conges.find((c) => c.personnelId === p.id && c.dateDebut <= d && c.dateFin >= d);
            const presence = presences.find((x) => x.personnelId === p.id && isoDate(x.date) === isoDate(d));
            const remplacant = conge?.remplacant ? nomComplet(nomsP.get(conge.remplacant.utilisateurId) ?? null, conge.remplacant.poste) : null;
            return { date: isoDate(d), plages: horaires[cles[i]!] ?? [], conge: conge ? { id: conge.id, type: conge.type, remplacant } : null, presence: presence ? { statut: presence.statut, commentaire: presence.commentaire } : null };
          }),
        };
      }),
    };
  });
}
