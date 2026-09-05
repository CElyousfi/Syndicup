/**
 * Service Justificatifs de paiement — M17 (Doc A §3.3 « chèque sans provision / virement mal
 * référencé », §3.4 imputation FIFO, §12.3 confidentialité par lot).
 *
 * Le résident (ou le syndic / gardien au nom d'un lot) déclare « j'ai payé » : montant, méthode
 * (virement / chèque / espèces — jamais CMI), banque, bénéficiaire, référence et preuve (Document
 * JUSTIFICATIF_PAIEMENT). Le syndic valide contre le relevé bancaire — aucune API bancaire, le
 * rapprochement est manuel et fondé sur la preuve — ce qui crée le(s) `paiement` VALIDE via le
 * moteur financier existant (ciblé ou FIFO sur solde), met à jour les lignes d'appel et émet la
 * quittance. Un rejet ne touche à rien sur le lot. Toute écriture probante est idempotente et
 * auditée ; les montants passent par lib/money.
 *
 * Espèces à la loge : le gardien saisit → justificatif ESPECES EN_ATTENTE que le syndic confirme.
 * ⚠️ Écart signalé (ROADMAP M17) : `paiement` est append-only (GRANT SELECT, INSERT), donc aucun
 * paiement n'est créé « EN_ATTENTE » puis basculé VALIDE — la ligne paiement naît à la confirmation.
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
import { assertCheminDansPerimetre, preparerUploadModule, CheminHorsPerimetreError } from "../documents/attach";
import { creerUrlSignee } from "../storage/supabase-storage";
import { appliquerPaiement, appliquerPaiementFifo } from "../finances/finances";
import type { Pagination } from "../http/pagination";
import type { JustificatifCreateInput, JustificatifRejeterInput, JustificatifValiderInput, JustificatifUploadUrlInput, JustificatifsFiltres, PaiementEspecesInput } from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
/**
 * Preuve → ligne `document` via la fonction SECURITY DEFINER `justificatif_attacher_preuve`
 * (un résident n'a pas l'INSERT sur `document`) ; le périmètre est vérifié ici ET dans la fonction.
 */
async function attacherPreuve(db: TenantDb, ctx: TenantContext, preuve: { storage_path: string; nom: string }): Promise<string> {
  assertCheminDansPerimetre(ctx, "justificatifs", preuve.storage_path);
  const rows = await db.$queryRaw<{ id: string }[]>`SELECT public.justificatif_attacher_preuve(${ctx.coproprieteId}::uuid, ${preuve.nom}, ${preuve.storage_path}, ${ctx.utilisateurId}::uuid) AS id`;
  return rows[0]!.id;
}

export class JustificatifError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}

function dateUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

const justificatifInclude = {
  lot: { select: { id: true, numero: true, typeLot: true } },
  declarePar: { select: { id: true, nom: true, prenom: true } },
  traitePar: { select: { id: true, nom: true, prenom: true } },
  document: { select: { id: true, nom: true } },
} satisfies Prisma.JustificatifPaiementInclude;

/** Lots où l'appelant est propriétaire ou occupant actif (règle payeur M5 : un locataire peut payer). */
async function lotsDuResident(db: TenantDb, utilisateurId: string): Promise<Set<string>> {
  const [p, o] = await Promise.all([
    db.lotProprietaire.findMany({ where: { utilisateurId, dateFin: null }, select: { lotId: true } }),
    db.lotOccupant.findMany({ where: { utilisateurId, dateFin: null }, select: { lotId: true } }),
  ]);
  return new Set([...p, ...o].map((x) => x.lotId));
}

async function notifierRoles(db: TenantDb, ctx: TenantContext, roles: ("SYNDIC" | "CONSEIL_SYNDICAL")[], templateCode: string, contenu: Record<string, unknown>) {
  const destinataires = await db.roleUtilisateur.findMany({ where: { coproprieteId: ctx.coproprieteId, actif: true, role: { in: roles } }, select: { utilisateurId: true }, distinct: ["utilisateurId"] });
  await Promise.all(destinataires.filter((d) => d.utilisateurId !== ctx.utilisateurId).map((d) => envoyerNotification(db, { coproprieteId: ctx.coproprieteId, utilisateurId: d.utilisateurId, templateCode, canal: "PUSH", contenuJson: contenu as Prisma.InputJsonValue })));
}

export async function preparerUploadJustificatif(ctx: TenantContext, input: JustificatifUploadUrlInput) {
  if (can("justificatifs.declarer", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé à déclarer un paiement.");
  return preparerUploadModule(ctx, "justificatifs", input.nom_fichier);
}

/** POST /finances/justificatifs — déclaration « j'ai payé » (résident) ou au nom d'un lot (syndic / gardien). */
export async function declarerJustificatif(ctx: TenantContext, input: JustificatifCreateInput, cle?: string) {
  const permission = can("justificatifs.declarer", ctx.role);
  if (permission === false) throw new PermissionRefuseeError("Rôle non autorisé à déclarer un paiement.");
  const lotId = input.pour_lot_id ?? input.lot_id!;
  return withTenantIdempotent(ctx, { cle, endpoint: "POST /finances/justificatifs", payload: input }, async (db) => {
    if (permission === "scoped") {
      const mesLots = await lotsDuResident(db, ctx.utilisateurId);
      if (!mesLots.has(lotId)) throw new PermissionRefuseeError("Vous ne pouvez déclarer un paiement que pour un lot dont vous êtes propriétaire ou occupant.");
    }
    const lot = await db.lot.findUnique({ where: { id: lotId }, select: { id: true, coproprieteId: true, numero: true } });
    if (!lot || lot.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Lot introuvable.");
    if (input.appel_de_fonds_lot_id) {
      const ligne = await db.appelDeFondsLot.findUnique({ where: { id: input.appel_de_fonds_lot_id }, select: { lotId: true, statut: true } });
      if (!ligne || ligne.lotId !== lotId) throw new IntrouvableError("Ligne d'appel de fonds introuvable pour ce lot.");
      if (ligne.statut === "PAYE") throw new JustificatifError("UNPROCESSABLE_ENTITY", "Cette ligne d'appel est déjà soldée : déclarez un paiement sur solde ou ciblez une autre échéance.");
    }
    // Preuve obligatoire sauf espèces saisies par le syndic / gardien eux-mêmes (ils tiennent la caisse).
    const especesInternes = input.methode === "ESPECES" && (ctx.role === "SYNDIC" || ctx.role === "GARDIEN" || ctx.role === "SUPER_ADMIN");
    if (!input.preuve && !especesInternes) {
      throw new JustificatifError("JUSTIFICATIF_PREUVE_REQUISE", "Joignez la preuve du paiement (reçu de virement, photo du chèque ou du bordereau).");
    }
    let documentId: string | null = null;
    if (input.preuve) documentId = await attacherPreuve(db, ctx, input.preuve);
    const j = await db.justificatifPaiement.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        lotId,
        appelDeFondsLotId: input.appel_de_fonds_lot_id ?? null,
        declareParId: ctx.utilisateurId,
        montant: money(input.montant).toString(),
        methode: input.methode,
        datePaiementDeclaree: dateUtc(input.date_paiement),
        banqueEmettrice: input.banque_emettrice ?? null,
        beneficiaire: input.beneficiaire,
        reference: input.reference ?? null,
        documentId,
      },
      include: justificatifInclude,
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: ctx.role === "GARDIEN" && input.methode === "ESPECES" ? "PAIEMENT_ESPECES_SAISI" : "JUSTIFICATIF_DECLARE",
      entite: "justificatif_paiement",
      entiteId: j.id,
      apres: { lot_id: lotId, montant: toApiString(j.montant), methode: j.methode, reference: j.reference, preuve: Boolean(documentId), sur_solde: !input.appel_de_fonds_lot_id },
    });
    await notifierRoles(db, ctx, ["SYNDIC"], ctx.role === "GARDIEN" && input.methode === "ESPECES" ? "PAIEMENT_ESPECES_SAISI" : "JUSTIFICATIF_DECLARE", {
      justificatif_id: j.id,
      lot_id: lotId,
      lot: lot.numero,
      montant: toApiString(j.montant),
      methode: j.methode,
    });
    return j;
  });
}

export async function listerJustificatifs(ctx: TenantContext, filtres: JustificatifsFiltres, pagination: Pagination) {
  if (can("justificatifs.lire", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const where: Prisma.JustificatifPaiementWhereInput = {
      coproprieteId: ctx.coproprieteId,
      ...(filtres.statut ? { statut: filtres.statut } : {}),
      ...(filtres.lot_id ? { lotId: filtres.lot_id } : {}),
      ...(filtres.methode ? { methode: filtres.methode } : {}),
    };
    const [total, rows, parStatut] = await Promise.all([
      db.justificatifPaiement.count({ where }),
      // EN_ATTENTE d'abord (file de validation), puis les plus récents.
      db.justificatifPaiement.findMany({ where, include: justificatifInclude, orderBy: [{ statut: "asc" }, { creeLe: "desc" }], skip: pagination.skip, take: pagination.take }),
      db.justificatifPaiement.groupBy({ by: ["statut"], where: { ...where, statut: undefined }, _count: { _all: true }, _sum: { montant: true } }),
    ]);
    return { total, rows, par_statut: Object.fromEntries(parStatut.map((s) => [s.statut, { nb: s._count._all, montant: toApiString(s._sum.montant ?? 0) }])) };
  });
}

/** Détail + URL signée de la preuve (15 min) + lignes ouvertes du lot (validation côte à côte). */
export async function obtenirJustificatif(ctx: TenantContext, id: string) {
  if (can("justificatifs.lire", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const j = await db.justificatifPaiement.findUnique({ where: { id }, include: { ...justificatifInclude, paiements: { select: { id: true, montant: true, appelDeFondsLotId: true, horodatage: true } } } });
    if (!j || j.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Justificatif introuvable.");
    // La preuve est un document SYNDIC_ONLY : le chemin est lu par une fonction SECURITY DEFINER
    // (le justificatif lui-même a déjà été filtré par la RLS — l'appelant y a droit).
    let preuve: { nom: string; url: string } | null = null;
    if (j.documentId) {
      const rows = await db.$queryRaw<{ storage_path: string; nom: string }[]>`SELECT storage_path, nom FROM public.justificatif_preuve_chemin(${id}::uuid)`;
      const r = rows[0];
      if (r) preuve = { nom: r.nom, url: await creerUrlSignee(r.storage_path) };
    }
    const lignesOuvertes = await db.appelDeFondsLot.findMany({
      where: { lotId: j.lotId, statut: { in: ["IMPAYE", "PARTIEL"] } },
      select: { id: true, montantDu: true, montantPaye: true, statut: true, appelDeFonds: { select: { periode: true, type: true, dateEcheance: true } } },
    });
    lignesOuvertes.sort((a, b) => a.appelDeFonds.dateEcheance.getTime() - b.appelDeFonds.dateEcheance.getTime());
    return {
      ...j,
      preuve,
      lignes_ouvertes: lignesOuvertes.map((l) => ({ appel_de_fonds_lot_id: l.id, periode: l.appelDeFonds.periode, type: l.appelDeFonds.type, date_echeance: l.appelDeFonds.dateEcheance, montant_du: toApiString(l.montantDu), montant_paye: toApiString(l.montantPaye), restant: toApiString(money(l.montantDu).minus(money(l.montantPaye))), statut: l.statut })),
    };
  });
}

async function chargerEnAttente(db: TenantDb, ctx: TenantContext, id: string) {
  const j = await db.justificatifPaiement.findUnique({ where: { id }, include: justificatifInclude });
  if (!j || j.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Justificatif introuvable.");
  if (j.statut !== "EN_ATTENTE") throw new JustificatifError("JUSTIFICATIF_STATUT_INVALIDE", `Ce justificatif est déjà ${j.statut}.`);
  return j;
}

/**
 * POST /finances/justificatifs/{id}/valider — le syndic a rapproché la preuve du relevé :
 * paiement(s) VALIDE créés (ciblé ou FIFO), lignes d'appel mises à jour, quittance émise par le
 * moteur existant, résident notifié. Tout ou rien (même transaction).
 */
export async function validerJustificatif(ctx: TenantContext, id: string, input: JustificatifValiderInput = {}, cle?: string) {
  if (can("justificatifs.valider", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic valide un justificatif (rapprochement avec le relevé bancaire).");
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /finances/justificatifs/${id}/valider`, payload: { id, ...input } }, async (db) => {
    const j = await chargerEnAttente(db, ctx, id);
    const provenance = { justificatifId: j.id, enregistreParId: ctx.utilisateurId, dateValeur: input.date_valeur ? dateUtc(input.date_valeur) : j.datePaiementDeclaree, documentId: j.documentId };
    const methode = j.methode as "VIREMENT" | "CHEQUE" | "ESPECES";
    let affectations: Array<{ appel_de_fonds_lot_id: string; montant: string; statut: string }>;
    let premierPaiementId: string | null = null;
    let quittanceId: string | null = null;
    if (j.appelDeFondsLotId) {
      const r = await appliquerPaiement(db, ctx, { appelDeFondsLotId: j.appelDeFondsLotId, montant: toApiString(j.montant), methode, payeurUtilisateurId: j.declareParId, accepterTropPercu: false, notifier: false, provenance });
      affectations = [{ appel_de_fonds_lot_id: j.appelDeFondsLotId, montant: toApiString(j.montant), statut: r.statut }];
      premierPaiementId = r.paiement.id;
      quittanceId = r.quittance?.id ?? null;
    } else {
      const r = await appliquerPaiementFifo(db, ctx, { lotId: j.lotId, montant: toApiString(j.montant), methode, payeurUtilisateurId: j.declareParId, provenance });
      affectations = r.affectations;
      quittanceId = r.quittance?.id ?? null;
      const premier = await db.paiement.findFirst({ where: { justificatifId: j.id }, orderBy: { horodatage: "asc" }, select: { id: true } });
      premierPaiementId = premier?.id ?? null;
    }
    const apres = await db.justificatifPaiement.update({
      where: { id },
      data: { statut: "VALIDE", traiteParId: ctx.utilisateurId, traiteLe: new Date(), paiementId: premierPaiementId, detailsJson: { affectations, date_valeur: provenance.dateValeur.toISOString().slice(0, 10), quittance_id: quittanceId } as Prisma.InputJsonValue },
      include: justificatifInclude,
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: j.methode === "ESPECES" && j.declareParId !== ctx.utilisateurId ? "PAIEMENT_ESPECES_CONFIRME" : "JUSTIFICATIF_VALIDE",
      entite: "justificatif_paiement",
      entiteId: id,
      avant: { statut: "EN_ATTENTE" },
      apres: { statut: "VALIDE", montant: toApiString(j.montant), affectations, paiement_id: premierPaiementId },
    });
    await envoyerNotification(db, { coproprieteId: ctx.coproprieteId, utilisateurId: j.declareParId, templateCode: "PAIEMENT_VALIDE", canal: "PUSH", contenuJson: { justificatif_id: id, lot_id: j.lotId, lot: j.lot.numero, montant: toApiString(j.montant), quittance_id: quittanceId } });
    return { ...apres, affectations, quittance_id: quittanceId };
  });
}

/** POST /finances/justificatifs/{id}/rejeter — motif obligatoire ; rien n'est touché sur le lot. */
export async function rejeterJustificatif(ctx: TenantContext, id: string, input: JustificatifRejeterInput, cle?: string) {
  if (can("justificatifs.valider", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic rejette un justificatif.");
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /finances/justificatifs/${id}/rejeter`, payload: { id, ...input } }, async (db) => {
    const j = await chargerEnAttente(db, ctx, id);
    const apres = await db.justificatifPaiement.update({ where: { id }, data: { statut: "REJETE", traiteParId: ctx.utilisateurId, traiteLe: new Date(), motifRejet: input.motif }, include: justificatifInclude });
    await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId, action: "JUSTIFICATIF_REJETE", entite: "justificatif_paiement", entiteId: id, avant: { statut: "EN_ATTENTE" }, apres: { statut: "REJETE", motif: input.motif } });
    await envoyerNotification(db, { coproprieteId: ctx.coproprieteId, utilisateurId: j.declareParId, templateCode: "JUSTIFICATIF_REJETE", canal: "PUSH", contenuJson: { justificatif_id: id, lot_id: j.lotId, lot: j.lot.numero, montant: toApiString(j.montant), motif: input.motif } });
    return apres;
  });
}

/** POST /finances/justificatifs/{id}/annuler — par le déclarant, EN_ATTENTE seulement. */
export async function annulerJustificatif(ctx: TenantContext, id: string, cle?: string) {
  if (can("justificatifs.declarer", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /finances/justificatifs/${id}/annuler`, payload: { id } }, async (db) => {
    const j = await chargerEnAttente(db, ctx, id);
    if (j.declareParId !== ctx.utilisateurId && ctx.role !== "SYNDIC" && ctx.role !== "SUPER_ADMIN") throw new PermissionRefuseeError("Seul le déclarant (ou le syndic) annule une déclaration en attente.");
    const apres = await db.justificatifPaiement.update({ where: { id }, data: { statut: "ANNULE", traiteParId: ctx.utilisateurId, traiteLe: new Date() }, include: justificatifInclude });
    await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId, action: "JUSTIFICATIF_ANNULE", entite: "justificatif_paiement", entiteId: id, avant: { statut: "EN_ATTENTE" }, apres: { statut: "ANNULE" } });
    return apres;
  });
}

/**
 * POST /finances/paiements/especes — espèces reçues. Syndic : paiement VALIDE immédiat (il tient la
 * caisse) avec preuve facultative. Gardien : justificatif ESPECES EN_ATTENTE que le syndic confirme
 * (`POST /finances/paiements/{id}/confirmer` = valider). Idempotent (file hors-ligne mobile rejouée).
 */
export async function saisirEspeces(ctx: TenantContext, input: PaiementEspecesInput, cle?: string) {
  if (can("paiements.especes.saisir", ctx.role) !== true) throw new PermissionRefuseeError("Seuls le syndic et le gardien saisissent des espèces reçues.");
  const date = input.date_paiement ?? new Date().toISOString().slice(0, 10);
  if (ctx.role === "GARDIEN") {
    const j = await declarerJustificatif(ctx, { pour_lot_id: input.lot_id, appel_de_fonds_lot_id: input.appel_de_fonds_lot_id ?? null, montant: input.montant, methode: "ESPECES", date_paiement: date, beneficiaire: input.commentaire ?? "Espèces remises au gardien", preuve: input.preuve ?? null }, cle);
    return { type: "JUSTIFICATIF" as const, justificatif: j };
  }
  return withTenantIdempotent(ctx, { cle, endpoint: "POST /finances/paiements/especes", payload: input }, async (db) => {
    const lot = await db.lot.findUnique({ where: { id: input.lot_id }, select: { id: true, coproprieteId: true } });
    if (!lot || lot.coproprieteId !== ctx.coproprieteId) throw new IntrouvableError("Lot introuvable.");
    let documentId: string | null = null;
    if (input.preuve) documentId = await attacherPreuve(db, ctx, input.preuve);
    const provenance = { enregistreParId: ctx.utilisateurId, dateValeur: dateUtc(date), documentId };
    const r = input.appel_de_fonds_lot_id
      ? await appliquerPaiement(db, ctx, { appelDeFondsLotId: input.appel_de_fonds_lot_id, montant: input.montant, methode: "ESPECES", payeurUtilisateurId: input.payeur_utilisateur_id ?? null, accepterTropPercu: false, provenance })
      : await appliquerPaiementFifo(db, ctx, { lotId: input.lot_id, montant: input.montant, methode: "ESPECES", payeurUtilisateurId: input.payeur_utilisateur_id ?? null, provenance });
    await ecrireAuditLog(db, { coproprieteId: ctx.coproprieteId, acteurId: ctx.utilisateurId, action: "PAIEMENT_ESPECES_SAISI", entite: "lot", entiteId: input.lot_id, apres: { montant: toApiString(input.montant), preuve: Boolean(documentId), par: "SYNDIC" } });
    return { type: "PAIEMENT" as const, resultat: r };
  });
}

/** POST /finances/paiements/{id}/confirmer — {id} = justificatif ESPECES du gardien ; alias de valider. */
export async function confirmerEspeces(ctx: TenantContext, id: string, cle?: string) {
  return validerJustificatif(ctx, id, {}, cle);
}

// ── Job : relance du syndic ──────────────────────────────────────────────────
export async function executerRelanceJustificatifs(db: TenantDb, coproprieteId: string, now = new Date()): Promise<{ rappels: number; ignore: boolean }> {
  const copro = await db.copropriete.findUnique({ where: { id: coproprieteId }, select: { delaiValidationJustificatifJours: true } });
  // Délai non configuré : aucun rappel (jamais de valeur devinée).
  if (!copro?.delaiValidationJustificatifJours) return { rappels: 0, ignore: true };
  const limite = new Date(now.getTime() - copro.delaiValidationJustificatifJours * 24 * 3600 * 1000);
  const enRetard = await db.justificatifPaiement.findMany({ where: { coproprieteId, statut: "EN_ATTENTE", relanceEnvoyeeLe: null, creeLe: { lte: limite } }, select: { id: true } });
  if (enRetard.length === 0) return { rappels: 0, ignore: false };
  const syndics = await db.roleUtilisateur.findMany({ where: { coproprieteId, actif: true, role: "SYNDIC" }, select: { utilisateurId: true }, distinct: ["utilisateurId"] });
  await Promise.all(syndics.map((s) => envoyerNotification(db, { coproprieteId, utilisateurId: s.utilisateurId, templateCode: "JUSTIFICATIF_A_VALIDER_RELANCE", canal: "PUSH", contenuJson: { nb: String(enRetard.length), jours: String(copro.delaiValidationJustificatifJours) } })));
  await db.justificatifPaiement.updateMany({ where: { id: { in: enRetard.map((j) => j.id) } }, data: { relanceEnvoyeeLe: now } });
  return { rappels: enRetard.length, ignore: false };
}

export { CheminHorsPerimetreError };
