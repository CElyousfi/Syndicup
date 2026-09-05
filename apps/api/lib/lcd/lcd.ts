/**
 * Service Location courte durée — M15 (Doc A §10.2 « Résident loue sa villa via Airbnb »).
 *
 * Périmètre : côté copropriété uniquement (règlement, sécurité, nuisances). Rien sur les prix,
 * les paiements ou les calendriers des plateformes. Toutes les écritures passent par withTenant
 * (RLS + contexte tenant, CLAUDE.md §1.8) ; les écritures probantes (décision, séjour, arrivée,
 * départ) sont idempotentes (Idempotency-Key) et journalisées (audit_log + sejour_evenement
 * append-only).
 *
 * Valeurs légales : le régime et ses paramètres sont des paramètres de règlement propres à chaque
 * copropriété (LEGAL_QUESTIONS_BRIEF §7) — jamais devinés : régime NON_DEFINI ou paramètres
 * ENCADREE absents ⇒ 422 explicite, même discipline que delai_convocation_jours.
 */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import { withTenantIdempotent } from "../http/idempotency";
import { creerUrlSignee, creerUrlUploadSignee, supprimerObjet } from "../storage/supabase-storage";
import { genererCode, expiration } from "../auth/invitations";
import type { ErrorCode } from "../http/respond";
import {
  parametresLcdSchema,
  type DeclarationLcdCreateInput,
  type DeclarationLcdDecisionInput,
  type DeclarationLcdGestionnaireInput,
  type DeclarationLcdUpdateInput,
  type DeclarationLcdClotureInput,
  type DeclarationsFiltres,
  type ParametresLcd,
  type ReglementLcdUpdateInput,
  type SejourAnnulerInput,
  type SejourArriveeInput,
  type SejourCreateInput,
  type SejourUpdateInput,
  type SejoursFiltres,
  type SejourUploadUrlInput,
  type SejourPiecesJointesInput,
  type SejourPieceJointeSupprimerInput,
  MAX_PIECES_JOINTES_SEJOUR,
} from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
/** Règle métier violée — `code` = code d'erreur HTTP explicite (422 / 409), jamais une exception « bug ». */
export class LcdError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}

const JOUR_MS = 24 * 3600 * 1000;

function dateUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function aujourdhuiUtc(now = new Date()): Date {
  return dateUtc(isoDate(now));
}
function nuits(arrivee: Date, depart: Date): number {
  return Math.round((depart.getTime() - arrivee.getTime()) / JOUR_MS);
}

// ── Contexte règlement ─────────────────────────────────────────────────────

async function chargerReglement(db: TenantDb, coproprieteId: string) {
  const copro = await db.copropriete.findUnique({
    where: { id: coproprieteId },
    select: { regimeLcd: true, parametresLcdJson: true, regimeLcdAgResolutionId: true },
  });
  if (!copro) throw new IntrouvableError("Copropriété introuvable.");
  return copro;
}

/** Paramètres ENCADREE validés, ou null hors ENCADREE. 422 si ENCADREE sans paramètres valides. */
function parametresDe(copro: { regimeLcd: string; parametresLcdJson: unknown }): ParametresLcd | null {
  if (copro.regimeLcd !== "ENCADREE") return null;
  const parsed = parametresLcdSchema.safeParse(copro.parametresLcdJson);
  if (!parsed.success) {
    throw new LcdError(
      "LCD_PARAMETRE_NON_CONFIGURE",
      "Régime ENCADREE sans paramètres configurés : le syndic doit renseigner les paramètres du règlement (PUT /lcd/reglement)."
    );
  }
  return parsed.data;
}

function assertRegimeOuvert(copro: { regimeLcd: string }) {
  if (copro.regimeLcd === "NON_DEFINI") {
    throw new LcdError(
      "LCD_REGIME_NON_DEFINI",
      "Régime de location courte durée non défini pour cette copropriété : à fixer par le syndic (décision d'AG)."
    );
  }
  if (copro.regimeLcd === "INTERDITE") {
    throw new LcdError("LCD_INTERDITE", "Le règlement de copropriété interdit la location courte durée.");
  }
}

/** Lots dont l'appelant est propriétaire actif (visibles sous RLS lot_proprietaire). */
async function lotsProprietaireActif(db: TenantDb, utilisateurId: string): Promise<Set<string>> {
  const rows = await db.lotProprietaire.findMany({
    where: { utilisateurId, dateFin: null },
    select: { lotId: true },
  });
  return new Set(rows.map((r) => r.lotId));
}

/** Le propriétaire est-il occupant de son lot (Doc A §2.1/§2.2 : absent = MRE, bailleur, résidence secondaire) ? */
async function proprietaireOccupant(db: TenantDb, lotId: string, utilisateurId: string): Promise<boolean> {
  const row = await db.lotOccupant.findFirst({
    where: { lotId, utilisateurId, dateFin: null, typeOccupation: "PROPRIETAIRE_OCCUPANT" },
    select: { id: true },
  });
  return Boolean(row);
}

async function assertGestionnaireValide(db: TenantDb, ctx: TenantContext, gestionnaireId: string) {
  const role = await db.roleUtilisateur.findFirst({
    where: { utilisateurId: gestionnaireId, coproprieteId: ctx.coproprieteId, role: "GESTIONNAIRE_LCD", actif: true },
    select: { id: true },
  });
  if (!role) {
    throw new LcdError(
      "UNPROCESSABLE_ENTITY",
      "Ce compte n'a pas de rôle GESTIONNAIRE_LCD actif dans la copropriété — désignez-le via POST /lcd/declarations/{id}/gestionnaire."
    );
  }
}

async function evenement(
  db: TenantDb,
  ctx: { coproprieteId: string; utilisateurId: string | null },
  sejourId: string,
  type: "DECLARE" | "MODIFIE" | "ARRIVEE_CONFIRMEE" | "DEPART_CONFIRME" | "ANNULE" | "INCIDENT_LIE" | "GARDIEN_NOTIFIE",
  details?: Prisma.InputJsonValue
) {
  // Table append-only : INSERT sans RETURNING (la policy SELECT peut cacher la ligne à
  // l'acteur — même précaution que envoyerNotification).
  await db.sejourEvenement.createMany({
    data: [{ id: randomUUID(), coproprieteId: ctx.coproprieteId, sejourId, type, acteurId: ctx.utilisateurId, detailsJson: details ?? Prisma.DbNull }],
  });
}

// ── Règlement (SYNDIC) ─────────────────────────────────────────────────────

export async function obtenirReglement(ctx: TenantContext) {
  if (can("lcd.declaration.lire", ctx.role) === false && can("lcd.reglement.gerer", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé.");
  }
  return withTenant(ctx, async (db) => {
    const copro = await chargerReglement(db, ctx.coproprieteId);
    const resolution = copro.regimeLcdAgResolutionId
      ? await db.agResolution.findUnique({
          where: { id: copro.regimeLcdAgResolutionId },
          select: { id: true, texte: true, resultat: true, agId: true },
        })
      : null;
    return {
      regimeLcd: copro.regimeLcd,
      parametresLcdJson: copro.parametresLcdJson,
      regimeLcdAgResolutionId: copro.regimeLcdAgResolutionId,
      agResolution: resolution,
    };
  });
}

export async function modifierReglement(ctx: TenantContext, input: ReglementLcdUpdateInput) {
  if (can("lcd.reglement.gerer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic modifie le régime de location courte durée (décision d'AG, Doc A §10.2).");
  }
  return withTenant(ctx, async (db) => {
    const avant = await chargerReglement(db, ctx.coproprieteId);
    if (input.ag_resolution_id) {
      const resolution = await db.agResolution.findUnique({
        where: { id: input.ag_resolution_id },
        select: { resultat: true, ag: { select: { coproprieteId: true } } },
      });
      if (!resolution || resolution.ag.coproprieteId !== ctx.coproprieteId) {
        throw new IntrouvableError("Résolution d'AG introuvable dans cette copropriété.");
      }
      if (resolution.resultat !== "ADOPTEE") {
        throw new LcdError("UNPROCESSABLE_ENTITY", "La résolution d'AG liée doit être ADOPTEE.");
      }
    }
    const apres = await db.copropriete.update({
      where: { id: ctx.coproprieteId },
      data: {
        regimeLcd: input.regime_lcd,
        parametresLcdJson:
          input.regime_lcd === "ENCADREE" ? (input.parametres_lcd_json as Prisma.InputJsonValue) : Prisma.DbNull,
        regimeLcdAgResolutionId: input.ag_resolution_id ?? null,
      },
      select: { regimeLcd: true, parametresLcdJson: true, regimeLcdAgResolutionId: true },
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "LCD_REGLEMENT_MODIFIE",
      entite: "copropriete",
      entiteId: ctx.coproprieteId,
      avant: { regime_lcd: avant.regimeLcd, parametres_lcd_json: avant.parametresLcdJson, ag_resolution_id: avant.regimeLcdAgResolutionId } as Prisma.InputJsonValue,
      apres: { regime_lcd: apres.regimeLcd, parametres_lcd_json: apres.parametresLcdJson, ag_resolution_id: apres.regimeLcdAgResolutionId } as Prisma.InputJsonValue,
    });
    return apres;
  });
}

// ── Déclarations ───────────────────────────────────────────────────────────

const declarationInclude = {
  lot: { select: { id: true, numero: true, typeLot: true } },
} as const;

export async function listerDeclarations(ctx: TenantContext, filtres: DeclarationsFiltres) {
  if (can("lcd.declaration.lire", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, (db) =>
    db.lotLocationCourteDuree.findMany({
      where: { ...(filtres.lot_id ? { lotId: filtres.lot_id } : {}), ...(filtres.statut ? { statut: filtres.statut } : {}) },
      include: declarationInclude,
      // EN_ATTENTE d'abord (à traiter), puis les plus récentes.
      orderBy: [{ statut: "asc" }, { creeLe: "desc" }],
    })
  );
}

export async function obtenirDeclaration(ctx: TenantContext, id: string) {
  if (can("lcd.declaration.lire", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const d = await db.lotLocationCourteDuree.findUnique({
      where: { id },
      include: {
        ...declarationInclude,
        sejours: { orderBy: { dateArrivee: "desc" }, take: 20 },
      },
    });
    if (!d) throw new IntrouvableError("Déclaration introuvable.");
    return d;
  });
}

export async function creerDeclaration(ctx: TenantContext, input: DeclarationLcdCreateInput) {
  const permission = can("lcd.declaration.creer", ctx.role);
  if (permission === false) throw new PermissionRefuseeError("Rôle non autorisé à déclarer un lot en location courte durée.");
  return withTenant(ctx, async (db) => {
    const copro = await chargerReglement(db, ctx.coproprieteId);
    assertRegimeOuvert(copro);
    const parametres = parametresDe(copro);

    // Propriétaire actif du lot (scoped) — vérifié AVANT tout accès au lot : aucune fuite
    // d'existence d'un lot d'autrui ; le syndic saisit au nom du propriétaire.
    let proprietaireId = ctx.utilisateurId;
    if (permission === "scoped") {
      const mesLots = await lotsProprietaireActif(db, ctx.utilisateurId);
      if (!mesLots.has(input.lot_id)) throw new PermissionRefuseeError("Vous n'êtes pas propriétaire actif de ce lot.");
    }
    const lot = await db.lot.findUnique({ where: { id: input.lot_id }, select: { id: true, coproprieteId: true } });
    if (!lot) throw new IntrouvableError("Lot introuvable.");
    if (permission !== "scoped") {
      const proprio = await db.lotProprietaire.findFirst({ where: { lotId: lot.id, dateFin: null }, select: { utilisateurId: true }, orderBy: { dateDebut: "asc" } });
      if (!proprio) throw new LcdError("UNPROCESSABLE_ENTITY", "Ce lot n'a aucun propriétaire actif.");
      proprietaireId = proprio.utilisateurId;
    }

    const ouverte = await db.lotLocationCourteDuree.findFirst({ where: { lotId: lot.id, dateFin: null }, select: { id: true } });
    if (ouverte) throw new LcdError("CONFLICT", "Une déclaration est déjà ouverte pour ce lot.");

    if (input.gestionnaire_id) await assertGestionnaireValide(db, ctx, input.gestionnaire_id);
    if (parametres?.gestionnaire_obligatoire_si_proprietaire_absent && !input.gestionnaire_id) {
      const occupant = await proprietaireOccupant(db, lot.id, proprietaireId);
      if (!occupant) {
        throw new LcdError(
          "LCD_GESTIONNAIRE_REQUIS",
          "Le règlement exige un gestionnaire sur place quand le propriétaire n'occupe pas le lot (Doc A §2.1 : propriétaire MRE / absent)."
        );
      }
    }

    // AUTORISEE : validée d'office ; ENCADREE : le syndic valide.
    const statut = copro.regimeLcd === "AUTORISEE" ? "VALIDEE" : "EN_ATTENTE";
    const declaration = await db.lotLocationCourteDuree.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        lotId: lot.id,
        declareParId: ctx.utilisateurId,
        gestionnaireId: input.gestionnaire_id ?? null,
        plateformesJson: input.plateformes ?? Prisma.DbNull,
        contactUrgenceNom: input.contact_urgence_nom ?? null,
        contactUrgenceTelephone: input.contact_urgence_telephone ?? null,
        statut,
        dateDebut: input.date_debut ? dateUtc(input.date_debut) : aujourdhuiUtc(),
        ...(statut === "VALIDEE" ? { decideLe: new Date() } : {}),
      },
      include: declarationInclude,
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "LCD_DECLARATION_CREEE",
      entite: "lot_location_courte_duree",
      entiteId: declaration.id,
      apres: { lot_id: lot.id, statut, gestionnaire_id: declaration.gestionnaireId, regime: copro.regimeLcd },
    });
    if (statut === "EN_ATTENTE") {
      await notifierRoles(db, ctx, ["SYNDIC"], "LCD_DECLARATION_A_VALIDER", { declaration_id: declaration.id, lot: declaration.lot.numero });
    }
    return declaration;
  });
}

export async function modifierDeclaration(ctx: TenantContext, id: string, input: DeclarationLcdUpdateInput) {
  if (can("lcd.declaration.creer", ctx.role) === false && ctx.role !== "GESTIONNAIRE_LCD") {
    throw new PermissionRefuseeError("Rôle non autorisé.");
  }
  return withTenant(ctx, async (db) => {
    const avant = await db.lotLocationCourteDuree.findUnique({ where: { id } });
    if (!avant) throw new IntrouvableError("Déclaration introuvable.");
    if (avant.statut === "CLOTUREE") throw new LcdError("UNPROCESSABLE_ENTITY", "Déclaration clôturée.");
    if (input.gestionnaire_id) await assertGestionnaireValide(db, ctx, input.gestionnaire_id);
    const data: Prisma.LotLocationCourteDureeUpdateInput = {};
    if (input.plateformes !== undefined) data.plateformesJson = (input.plateformes ?? Prisma.DbNull) as Prisma.InputJsonValue;
    if (input.contact_urgence_nom !== undefined) data.contactUrgenceNom = input.contact_urgence_nom ?? null;
    if (input.contact_urgence_telephone !== undefined) data.contactUrgenceTelephone = input.contact_urgence_telephone ?? null;
    if (input.gestionnaire_id !== undefined) {
      // Le gestionnaire ne peut pas se remplacer lui-même par quelqu'un d'autre.
      if (ctx.role === "GESTIONNAIRE_LCD") throw new PermissionRefuseeError("Seul le propriétaire (ou le syndic) change le gestionnaire.");
      data.gestionnaire = input.gestionnaire_id ? { connect: { id: input.gestionnaire_id } } : { disconnect: true };
    }
    const apres = await db.lotLocationCourteDuree.update({ where: { id }, data, include: declarationInclude });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "LCD_DECLARATION_MODIFIEE",
      entite: "lot_location_courte_duree",
      entiteId: id,
      avant: { gestionnaire_id: avant.gestionnaireId, contact_urgence_nom: avant.contactUrgenceNom, plateformes: avant.plateformesJson } as Prisma.InputJsonValue,
      apres: { gestionnaire_id: apres.gestionnaireId, contact_urgence_nom: apres.contactUrgenceNom, plateformes: apres.plateformesJson } as Prisma.InputJsonValue,
    });
    return apres;
  });
}

export async function deciderDeclaration(ctx: TenantContext, id: string, input: DeclarationLcdDecisionInput, cle?: string) {
  if (can("lcd.declaration.decider", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic valide, refuse ou suspend une déclaration.");
  }
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /lcd/declarations/${id}/decision`, payload: input }, async (db) => {
    const avant = await db.lotLocationCourteDuree.findUnique({ where: { id }, include: declarationInclude });
    if (!avant) throw new IntrouvableError("Déclaration introuvable.");
    if (avant.statut === "CLOTUREE") throw new LcdError("UNPROCESSABLE_ENTITY", "Déclaration clôturée : aucune décision possible.");
    const apres = await db.lotLocationCourteDuree.update({
      where: { id },
      data: { statut: input.decision, motifDecision: input.motif ?? null, decideParId: ctx.utilisateurId, decideLe: new Date() },
      include: declarationInclude,
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "LCD_DECLARATION_DECISION",
      entite: "lot_location_courte_duree",
      entiteId: id,
      avant: { statut: avant.statut },
      apres: { statut: apres.statut, motif: input.motif ?? null },
    });
    // Propriétaire déclarant + gestionnaire : canal préféré (EMAIL bascule SMS sans adresse).
    const destinataires = new Set([avant.declareParId, ...(avant.gestionnaireId ? [avant.gestionnaireId] : [])]);
    await Promise.all(
      [...destinataires].map((utilisateurId) =>
        envoyerNotification(db, {
          coproprieteId: ctx.coproprieteId,
          utilisateurId,
          templateCode: "LCD_DECLARATION_DECISION",
          canal: "EMAIL",
          contenuJson: { declaration_id: id, lot: avant.lot.numero, decision: input.decision, motif: input.motif ?? "" },
        })
      )
    );
    return apres;
  });
}

export async function cloturerDeclaration(ctx: TenantContext, id: string, input: DeclarationLcdClotureInput) {
  if (can("lcd.declaration.creer", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const d = await db.lotLocationCourteDuree.findUnique({ where: { id } });
    if (!d) throw new IntrouvableError("Déclaration introuvable.");
    if (d.dateFin) throw new LcdError("UNPROCESSABLE_ENTITY", "Déclaration déjà clôturée.");
    const actif = await db.sejourCourteDuree.count({ where: { declarationLcdId: id, statut: { in: ["PREVU", "EN_COURS"] } } });
    if (actif > 0) throw new LcdError("CONFLICT", "Impossible de clôturer : un séjour est prévu ou en cours.");
    const apres = await db.lotLocationCourteDuree.update({
      where: { id },
      data: { dateFin: input.date_fin ? dateUtc(input.date_fin) : aujourdhuiUtc(), statut: "CLOTUREE" },
      include: declarationInclude,
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "LCD_DECLARATION_CLOTUREE",
      entite: "lot_location_courte_duree",
      entiteId: id,
      avant: { statut: d.statut, date_fin: null },
      apres: { statut: "CLOTUREE", date_fin: isoDate(apres.dateFin!) },
    });
    return apres;
  });
}

/**
 * Désignation / remplacement du gestionnaire : compte connu → rôle GESTIONNAIRE_LCD créé si absent
 * ; personne sans compte → invitation M2 (rôle GESTIONNAIRE_LCD, lot de la déclaration), liée à la
 * déclaration à l'acceptation (fonction SQL lcd_lier_gestionnaire_invitation).
 */
export async function designerGestionnaire(ctx: TenantContext, id: string, input: DeclarationLcdGestionnaireInput) {
  if (can("lcd.declaration.creer", ctx.role) === false) throw new PermissionRefuseeError("Seul le propriétaire (ou le syndic) désigne un gestionnaire.");
  return withTenant(ctx, async (db) => {
    const d = await db.lotLocationCourteDuree.findUnique({ where: { id }, include: declarationInclude });
    if (!d) throw new IntrouvableError("Déclaration introuvable.");
    if (d.statut === "CLOTUREE") throw new LcdError("UNPROCESSABLE_ENTITY", "Déclaration clôturée.");

    let utilisateurId = input.utilisateur_id ?? null;
    if (!utilisateurId && (input.email || input.telephone)) {
      const u = await db.utilisateur
        .findFirst({
          where: { OR: [...(input.email ? [{ email: input.email.toLowerCase() }] : []), ...(input.telephone ? [{ telephone: input.telephone }] : [])] },
          select: { id: true },
        })
        .catch(() => null);
      utilisateurId = u?.id ?? null;
    }

    if (utilisateurId) {
      const membre = await db.roleUtilisateur.findFirst({ where: { utilisateurId, coproprieteId: ctx.coproprieteId, actif: true }, select: { id: true, role: true } });
      if (!membre) throw new LcdError("UNPROCESSABLE_ENTITY", "Ce compte n'est pas membre de la copropriété — utilisez email/telephone pour l'inviter.");
      const dejaRole = await db.roleUtilisateur.findFirst({ where: { utilisateurId, coproprieteId: ctx.coproprieteId, role: "GESTIONNAIRE_LCD", actif: true }, select: { id: true } });
      if (!dejaRole) {
        await db.roleUtilisateur.create({ data: { utilisateurId, coproprieteId: ctx.coproprieteId, role: "GESTIONNAIRE_LCD", actif: true } });
      }
      const apres = await db.lotLocationCourteDuree.update({ where: { id }, data: { gestionnaireId: utilisateurId }, include: declarationInclude });
      await ecrireAuditLog(db, {
        coproprieteId: ctx.coproprieteId,
        acteurId: ctx.utilisateurId,
        action: "LCD_GESTIONNAIRE_DESIGNE",
        entite: "lot_location_courte_duree",
        entiteId: id,
        avant: { gestionnaire_id: d.gestionnaireId },
        apres: { gestionnaire_id: utilisateurId, mode: "COMPTE_EXISTANT" },
      });
      return { declaration: apres, invitation: null };
    }

    // Pas de compte visible : invitation M2 (le code n'apparaît jamais dans l'audit).
    const invitation = await db.invitation.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        lotId: d.lotId,
        roleCible: "GESTIONNAIRE_LCD",
        emetteurId: ctx.utilisateurId,
        canal: input.canal,
        code: genererCode(),
        expireLe: expiration(input.canal),
      },
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "LCD_GESTIONNAIRE_DESIGNE",
      entite: "lot_location_courte_duree",
      entiteId: id,
      avant: { gestionnaire_id: d.gestionnaireId },
      apres: { invitation_id: invitation.id, mode: "INVITATION", canal: input.canal },
    });
    return { declaration: d, invitation: { id: invitation.id, code: invitation.code, expireLe: invitation.expireLe, canal: invitation.canal } };
  });
}

// ── Séjours ────────────────────────────────────────────────────────────────

const sejourInclude = { lot: { select: { id: true, numero: true, typeLot: true } } } as const;

async function notifierRoles(
  db: TenantDb,
  ctx: TenantContext,
  roles: ("SYNDIC" | "GARDIEN")[],
  templateCode: string,
  contenu: Record<string, unknown>
): Promise<number> {
  const destinataires = await db.roleUtilisateur.findMany({
    where: { coproprieteId: ctx.coproprieteId, actif: true, role: { in: roles } },
    select: { utilisateurId: true },
    distinct: ["utilisateurId"],
  });
  const cibles = destinataires.filter((d) => d.utilisateurId !== ctx.utilisateurId);
  await Promise.all(
    cibles.map((d) =>
      envoyerNotification(db, { coproprieteId: ctx.coproprieteId, utilisateurId: d.utilisateurId, templateCode, canal: "PUSH", contenuJson: contenu as Prisma.InputJsonValue })
    )
  );
  return cibles.length;
}

/** Défense en profondeur : chaque pièce jointe vit dans le périmètre storage du tenant courant. */
function assertPiecesDansPerimetre(ctx: TenantContext, chemins: string[] | undefined) {
  for (const c of chemins ?? []) {
    if (!c.startsWith(`${ctx.coproprieteId}/lcd/sejours/`)) throw new PermissionRefuseeError("Pièce jointe hors du périmètre de la copropriété.");
  }
}

/** Règles ENCADREE + chevauchement — partagées par création et modification. */
async function verifierReglesSejour(
  db: TenantDb,
  params: {
    parametres: ParametresLcd | null;
    lotId: string;
    arrivee: Date;
    depart: Date;
    heure: string | null;
    nbVoyageurs: number;
    exclureSejourId?: string;
    now: Date;
  }
) {
  const { parametres, lotId, arrivee, depart, exclureSejourId, now } = params;
  if (parametres) {
    if (parametres.nb_voyageurs_max_par_lot !== null && params.nbVoyageurs > parametres.nb_voyageurs_max_par_lot) {
      throw new LcdError("LCD_VOYAGEURS_MAX", `Le règlement limite à ${parametres.nb_voyageurs_max_par_lot} voyageurs par lot.`);
    }
    if (parametres.declaration_prealable_obligatoire && parametres.delai_declaration_heures !== null) {
      const [h, m] = (params.heure ?? "00:00").split(":").map(Number);
      const arriveeMs = arrivee.getTime() + (h! * 60 + m!) * 60 * 1000;
      if (arriveeMs - now.getTime() < parametres.delai_declaration_heures * 3600 * 1000) {
        throw new LcdError(
          "LCD_DELAI_DECLARATION",
          `Le règlement impose une déclaration au moins ${parametres.delai_declaration_heures} h avant l'arrivée.`
        );
      }
    }
    if (parametres.nb_nuits_max_par_an !== null) {
      const annee = arrivee.getUTCFullYear();
      const autres = await db.sejourCourteDuree.findMany({
        where: {
          lotId,
          statut: { not: "ANNULE" },
          dateArrivee: { gte: new Date(Date.UTC(annee, 0, 1)), lt: new Date(Date.UTC(annee + 1, 0, 1)) },
          ...(exclureSejourId ? { id: { not: exclureSejourId } } : {}),
        },
        select: { dateArrivee: true, dateDepart: true },
      });
      const deja = autres.reduce((acc, s) => acc + nuits(s.dateArrivee, s.dateDepart), 0);
      if (deja + nuits(arrivee, depart) > parametres.nb_nuits_max_par_an) {
        throw new LcdError(
          "LCD_QUOTA_NUITS_DEPASSE",
          `Quota annuel dépassé : ${deja} nuit(s) déjà déclarées sur ${parametres.nb_nuits_max_par_an} en ${annee}.`
        );
      }
    }
  }
  // Chevauchement (intervalle semi-ouvert : départ le matin, arrivée le soir du même jour = OK).
  const chevauche = await db.sejourCourteDuree.findFirst({
    where: {
      lotId,
      statut: { in: ["PREVU", "EN_COURS"] },
      dateArrivee: { lt: depart },
      dateDepart: { gt: arrivee },
      ...(exclureSejourId ? { id: { not: exclureSejourId } } : {}),
    },
    select: { id: true },
  });
  if (chevauche) throw new LcdError("LCD_SEJOUR_CHEVAUCHEMENT", "Un autre séjour est déjà déclaré sur ce lot pour ces dates.");
}

async function declarationValideeDuLot(db: TenantDb, lotId: string) {
  const d = await db.lotLocationCourteDuree.findFirst({ where: { lotId, dateFin: null }, select: { id: true, statut: true, gestionnaireId: true, declareParId: true } });
  if (!d || d.statut !== "VALIDEE") {
    throw new LcdError("LCD_DECLARATION_NON_VALIDEE", "Aucune déclaration de location courte durée VALIDEE sur ce lot.");
  }
  return d;
}

async function assertPeutDeclarerSejour(db: TenantDb, ctx: TenantContext, lotId: string, declaration: { gestionnaireId: string | null }) {
  const permission = can("lcd.sejour.declarer", ctx.role);
  if (permission === false) throw new PermissionRefuseeError("Rôle non autorisé à déclarer un séjour.");
  if (permission === "scoped") {
    if (ctx.role === "GESTIONNAIRE_LCD") {
      if (declaration.gestionnaireId !== ctx.utilisateurId) throw new PermissionRefuseeError("Vous n'êtes pas le gestionnaire désigné de ce lot.");
    } else {
      const mesLots = await lotsProprietaireActif(db, ctx.utilisateurId);
      if (!mesLots.has(lotId)) throw new PermissionRefuseeError("Vous n'êtes pas propriétaire actif de ce lot.");
    }
  }
}

export async function listerSejours(ctx: TenantContext, filtres: SejoursFiltres) {
  if (can("lcd.sejour.lire", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, (db) =>
    db.sejourCourteDuree.findMany({
      where: {
        ...(filtres.lot_id ? { lotId: filtres.lot_id } : {}),
        ...(filtres.statut ? { statut: filtres.statut } : {}),
        ...(filtres.date_from ? { dateDepart: { gte: dateUtc(filtres.date_from) } } : {}),
        ...(filtres.date_to ? { dateArrivee: { lte: dateUtc(filtres.date_to) } } : {}),
      },
      include: sejourInclude,
      orderBy: [{ dateArrivee: "desc" }],
      take: 200,
    })
  );
}

/** Tableau de bord gardien : arrivées du jour, départs du jour, séjours en cours. */
export async function sejoursDuJour(ctx: TenantContext, now = new Date()) {
  if (can("lcd.sejour.lire", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  const jour = aujourdhuiUtc(now);
  return withTenant(ctx, async (db) => {
    const [arrivees, departs, enCours] = await Promise.all([
      db.sejourCourteDuree.findMany({ where: { statut: "PREVU", dateArrivee: jour }, include: sejourInclude, orderBy: { heureArriveePrevue: "asc" } }),
      db.sejourCourteDuree.findMany({ where: { statut: "EN_COURS", dateDepart: jour }, include: sejourInclude, orderBy: { lot: { numero: "asc" } } }),
      db.sejourCourteDuree.findMany({ where: { statut: "EN_COURS" }, include: sejourInclude, orderBy: { dateDepart: "asc" } }),
    ]);
    return { date: isoDate(jour), arrivees, departs, enCours };
  });
}

export async function obtenirSejour(ctx: TenantContext, id: string) {
  if (can("lcd.sejour.lire", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const s = await db.sejourCourteDuree.findUnique({
      where: { id },
      include: { ...sejourInclude, evenements: { orderBy: { horodatage: "asc" } } },
    });
    if (!s) throw new IntrouvableError("Séjour introuvable.");
    return s;
  });
}

export async function creerSejour(ctx: TenantContext, input: SejourCreateInput, cle?: string, now = new Date()) {
  return withTenantIdempotent(ctx, { cle, endpoint: "POST /lcd/sejours", payload: input }, async (db) => {
    const copro = await chargerReglement(db, ctx.coproprieteId);
    assertRegimeOuvert(copro);
    const parametres = parametresDe(copro);
    const declaration = await declarationValideeDuLot(db, input.lot_id);
    await assertPeutDeclarerSejour(db, ctx, input.lot_id, declaration);

    const arrivee = dateUtc(input.date_arrivee);
    const depart = dateUtc(input.date_depart);
    await verifierReglesSejour(db, { parametres, lotId: input.lot_id, arrivee, depart, heure: input.heure_arrivee_prevue ?? null, nbVoyageurs: input.nb_voyageurs, now });
    assertPiecesDansPerimetre(ctx, input.pieces_jointes);

    const sejour = await db.sejourCourteDuree.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        lotId: input.lot_id,
        declarationLcdId: declaration.id,
        declareParId: ctx.utilisateurId,
        dateArrivee: arrivee,
        dateDepart: depart,
        heureArriveePrevue: input.heure_arrivee_prevue ?? null,
        nbVoyageurs: input.nb_voyageurs,
        voyageurPrincipalNom: input.voyageur_principal_nom,
        voyageurTelephone: input.voyageur_telephone ?? null,
        voyageurNationalite: input.voyageur_nationalite?.toUpperCase() ?? null,
        pieceIdentiteType: input.piece_identite_type ?? null,
        pieceIdentiteFin: input.piece_identite_fin?.toUpperCase() ?? null,
        plaqueVehicule: input.plaque_vehicule ?? null,
        piecesJointes: input.pieces_jointes ?? [],
      },
      include: sejourInclude,
    });
    await evenement(db, ctx, sejour.id, "DECLARE", { nb_voyageurs: input.nb_voyageurs, date_arrivee: input.date_arrivee, date_depart: input.date_depart });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "LCD_SEJOUR_DECLARE",
      entite: "sejour_courte_duree",
      entiteId: sejour.id,
      // Jamais l'identité du voyageur dans l'audit : le séjour la porte, l'audit trace le geste.
      apres: { lot_id: input.lot_id, date_arrivee: input.date_arrivee, date_depart: input.date_depart, nb_voyageurs: input.nb_voyageurs },
    });

    // Syndic prévenu (in-app) ; gardien(s) si le règlement l'impose ou en régime ENCADREE.
    const contenu = { sejour_id: sejour.id, lot: sejour.lot.numero, date_arrivee: input.date_arrivee, date_depart: input.date_depart, nb_voyageurs: String(input.nb_voyageurs) };
    await notifierRoles(db, ctx, ["SYNDIC"], "LCD_SEJOUR_DECLARE", contenu);
    if (copro.regimeLcd === "ENCADREE" || parametres?.contact_gardien_obligatoire) {
      const n = await notifierRoles(db, ctx, ["GARDIEN"], "LCD_SEJOUR_GARDIEN", contenu);
      if (n > 0) {
        await db.sejourCourteDuree.update({ where: { id: sejour.id }, data: { gardienInformeLe: new Date() } });
        await evenement(db, { coproprieteId: ctx.coproprieteId, utilisateurId: null }, sejour.id, "GARDIEN_NOTIFIE", { destinataires: n });
      }
    }
    return sejour;
  });
}

export async function modifierSejour(ctx: TenantContext, id: string, input: SejourUpdateInput, now = new Date()) {
  return withTenant(ctx, async (db) => {
    const avant = await db.sejourCourteDuree.findUnique({ where: { id }, include: sejourInclude });
    if (!avant) throw new IntrouvableError("Séjour introuvable.");
    if (avant.statut !== "PREVU") throw new LcdError("UNPROCESSABLE_ENTITY", "Seul un séjour PREVU peut être modifié.");
    const declaration = await db.lotLocationCourteDuree.findUnique({ where: { id: avant.declarationLcdId }, select: { gestionnaireId: true } });
    await assertPeutDeclarerSejour(db, ctx, avant.lotId, { gestionnaireId: declaration?.gestionnaireId ?? null });
    const copro = await chargerReglement(db, ctx.coproprieteId);
    const parametres = parametresDe(copro);

    const arrivee = input.date_arrivee ? dateUtc(input.date_arrivee) : avant.dateArrivee;
    const depart = input.date_depart ? dateUtc(input.date_depart) : avant.dateDepart;
    if (depart <= arrivee) throw new LcdError("VALIDATION_ERROR", "La date de départ doit être postérieure à l'arrivée.");
    const nbVoyageurs = input.nb_voyageurs ?? avant.nbVoyageurs;
    const heure = input.heure_arrivee_prevue === undefined ? avant.heureArriveePrevue : (input.heure_arrivee_prevue ?? null);
    await verifierReglesSejour(db, { parametres, lotId: avant.lotId, arrivee, depart, heure, nbVoyageurs, exclureSejourId: id, now });
    assertPiecesDansPerimetre(ctx, input.pieces_jointes);

    const apres = await db.sejourCourteDuree.update({
      where: { id },
      data: {
        dateArrivee: arrivee,
        dateDepart: depart,
        heureArriveePrevue: heure,
        nbVoyageurs,
        ...(input.voyageur_principal_nom !== undefined ? { voyageurPrincipalNom: input.voyageur_principal_nom } : {}),
        ...(input.voyageur_telephone !== undefined ? { voyageurTelephone: input.voyageur_telephone ?? null } : {}),
        ...(input.voyageur_nationalite !== undefined ? { voyageurNationalite: input.voyageur_nationalite?.toUpperCase() ?? null } : {}),
        ...(input.piece_identite_type !== undefined ? { pieceIdentiteType: input.piece_identite_type ?? null } : {}),
        ...(input.piece_identite_fin !== undefined ? { pieceIdentiteFin: input.piece_identite_fin?.toUpperCase() ?? null } : {}),
        ...(input.plaque_vehicule !== undefined ? { plaqueVehicule: input.plaque_vehicule ?? null } : {}),
        ...(input.pieces_jointes !== undefined ? { piecesJointes: input.pieces_jointes } : {}),
      },
      include: sejourInclude,
    });
    await evenement(db, ctx, id, "MODIFIE", { champs: Object.keys(input).filter((k) => (input as Record<string, unknown>)[k] !== undefined) });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "LCD_SEJOUR_MODIFIE",
      entite: "sejour_courte_duree",
      entiteId: id,
      avant: { date_arrivee: isoDate(avant.dateArrivee), date_depart: isoDate(avant.dateDepart), nb_voyageurs: avant.nbVoyageurs },
      apres: { date_arrivee: isoDate(apres.dateArrivee), date_depart: isoDate(apres.dateDepart), nb_voyageurs: apres.nbVoyageurs },
    });
    return apres;
  });
}

export async function annulerSejour(ctx: TenantContext, id: string, input: SejourAnnulerInput, cle?: string) {
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /lcd/sejours/${id}/annuler`, payload: input }, async (db) => {
    const avant = await db.sejourCourteDuree.findUnique({ where: { id }, include: sejourInclude });
    if (!avant) throw new IntrouvableError("Séjour introuvable.");
    if (avant.statut !== "PREVU") throw new LcdError("UNPROCESSABLE_ENTITY", "Seul un séjour PREVU peut être annulé.");
    const declaration = await db.lotLocationCourteDuree.findUnique({ where: { id: avant.declarationLcdId }, select: { gestionnaireId: true } });
    await assertPeutDeclarerSejour(db, ctx, avant.lotId, { gestionnaireId: declaration?.gestionnaireId ?? null });
    const apres = await db.sejourCourteDuree.update({
      where: { id },
      data: { statut: "ANNULE", annuleLe: new Date(), motifAnnulation: input.motif ?? null },
      include: sejourInclude,
    });
    await evenement(db, ctx, id, "ANNULE", { motif: input.motif ?? null });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "LCD_SEJOUR_ANNULE",
      entite: "sejour_courte_duree",
      entiteId: id,
      avant: { statut: "PREVU" },
      apres: { statut: "ANNULE", motif: input.motif ?? null },
    });
    if (avant.gardienInformeLe) {
      await notifierRoles(db, ctx, ["GARDIEN"], "LCD_SEJOUR_ANNULE", { sejour_id: id, lot: avant.lot.numero, date_arrivee: isoDate(avant.dateArrivee) });
    }
    return apres;
  });
}

/** PREVU → EN_COURS (gardien / syndic). Le nombre constaté va dans l'événement, jamais sur la déclaration. */
export async function confirmerArrivee(ctx: TenantContext, id: string, input: SejourArriveeInput, cle?: string) {
  if (can("lcd.sejour.confirmer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le gardien ou le syndic confirme une arrivée.");
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /lcd/sejours/${id}/arrivee`, payload: input }, async (db) => {
    const s = await db.sejourCourteDuree.findUnique({ where: { id }, include: sejourInclude });
    if (!s) throw new IntrouvableError("Séjour introuvable.");
    if (s.statut !== "PREVU") throw new LcdError("UNPROCESSABLE_ENTITY", `Transition impossible depuis ${s.statut} (attendu : PREVU).`);
    const apres = await db.sejourCourteDuree.update({ where: { id }, data: { statut: "EN_COURS" }, include: sejourInclude });
    await evenement(db, ctx, id, "ARRIVEE_CONFIRMEE", {
      nb_voyageurs_declare: s.nbVoyageurs,
      ...(input.nb_voyageurs_constate !== null && input.nb_voyageurs_constate !== undefined ? { nb_voyageurs_constate: input.nb_voyageurs_constate } : {}),
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "LCD_SEJOUR_ARRIVEE",
      entite: "sejour_courte_duree",
      entiteId: id,
      avant: { statut: "PREVU" },
      apres: { statut: "EN_COURS", nb_voyageurs_constate: input.nb_voyageurs_constate ?? null },
    });
    return apres;
  });
}

/** EN_COURS → TERMINE (gardien / syndic). */
export async function confirmerDepart(ctx: TenantContext, id: string, cle?: string) {
  if (can("lcd.sejour.confirmer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le gardien ou le syndic confirme un départ.");
  return withTenantIdempotent(ctx, { cle, endpoint: `POST /lcd/sejours/${id}/depart`, payload: null }, async (db) => {
    const s = await db.sejourCourteDuree.findUnique({ where: { id }, include: sejourInclude });
    if (!s) throw new IntrouvableError("Séjour introuvable.");
    if (s.statut !== "EN_COURS") throw new LcdError("UNPROCESSABLE_ENTITY", `Transition impossible depuis ${s.statut} (attendu : EN_COURS).`);
    const apres = await db.sejourCourteDuree.update({ where: { id }, data: { statut: "TERMINE" }, include: sejourInclude });
    await evenement(db, ctx, id, "DEPART_CONFIRME", { auto: false });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "LCD_SEJOUR_DEPART",
      entite: "sejour_courte_duree",
      entiteId: id,
      avant: { statut: "EN_COURS" },
      apres: { statut: "TERMINE" },
    });
    return apres;
  });
}

// ── Pièces jointes (photos prises / fichiers) ──────────────────────────────

function nomFichierSur(nom: string): string {
  return nom.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 120) || "piece";
}

/** Qui peut ajouter une pièce : qui déclare (propriétaire, gestionnaire, syndic) + le gardien (photo à l'arrivée). */
function peutJoindre(ctx: TenantContext): boolean {
  return can("lcd.sejour.declarer", ctx.role) !== false || can("lcd.sejour.confirmer", ctx.role) === true;
}

/** POST /lcd/sejours/upload-url — URL signée d'upload (image ou PDF) dans `<copropriete>/lcd/sejours/`. */
export async function preparerUploadPieceJointe(ctx: TenantContext, input: SejourUploadUrlInput) {
  if (!peutJoindre(ctx)) throw new PermissionRefuseeError("Rôle non autorisé à joindre une pièce à un séjour.");
  const storagePath = `${ctx.coproprieteId}/lcd/sejours/${randomUUID()}-${nomFichierSur(input.nom_fichier)}`;
  const { url, token } = await creerUrlUploadSignee(storagePath);
  return { storage_path: storagePath, upload_url: url, token };
}

/** GET /lcd/sejours/:id/pieces-jointes — URLs signées 15 min (même visibilité que le séjour). */
export async function urlsPiecesJointes(ctx: TenantContext, id: string) {
  const s = await obtenirSejour(ctx, id);
  const urls = await Promise.all(s.piecesJointes.map((p) => creerUrlSignee(p)));
  return s.piecesJointes.map((path, i) => ({
    path,
    url: urls[i]!,
    nom: path.split("/").pop()!.replace(/^[0-9a-f-]{36}-/i, ""),
    type: /\.pdf$/i.test(path) ? "PDF" : "IMAGE",
  }));
}

/** POST /lcd/sejours/:id/pieces-jointes — ajoute des pièces (10 max, séjour non annulé). */
export async function ajouterPiecesJointes(ctx: TenantContext, id: string, input: SejourPiecesJointesInput) {
  if (!peutJoindre(ctx)) throw new PermissionRefuseeError("Rôle non autorisé à joindre une pièce à un séjour.");
  assertPiecesDansPerimetre(ctx, input.chemins);
  return withTenant(ctx, async (db) => {
    const s = await db.sejourCourteDuree.findUnique({ where: { id }, include: sejourInclude });
    if (!s) throw new IntrouvableError("Séjour introuvable.");
    if (s.statut === "ANNULE") throw new LcdError("UNPROCESSABLE_ENTITY", "Séjour annulé : aucune pièce jointe possible.");
    if (ctx.role !== "SYNDIC" && ctx.role !== "SUPER_ADMIN" && ctx.role !== "GARDIEN") {
      const declaration = await db.lotLocationCourteDuree.findUnique({ where: { id: s.declarationLcdId }, select: { gestionnaireId: true } });
      await assertPeutDeclarerSejour(db, ctx, s.lotId, { gestionnaireId: declaration?.gestionnaireId ?? null });
    }
    const chemins = [...new Set([...s.piecesJointes, ...input.chemins])];
    if (chemins.length > MAX_PIECES_JOINTES_SEJOUR) {
      throw new LcdError("UNPROCESSABLE_ENTITY", `${MAX_PIECES_JOINTES_SEJOUR} pièces jointes au maximum par séjour.`);
    }
    const apres = await db.sejourCourteDuree.update({ where: { id }, data: { piecesJointes: chemins }, include: sejourInclude });
    await evenement(db, ctx, id, "MODIFIE", { pieces_jointes_ajoutees: chemins.length - s.piecesJointes.length });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "LCD_SEJOUR_PIECE_JOINTE",
      entite: "sejour_courte_duree",
      entiteId: id,
      apres: { pieces_jointes: chemins.length, ajoutees: chemins.length - s.piecesJointes.length },
    });
    return apres;
  });
}

/** DELETE /lcd/sejours/:id/pieces-jointes — retire une pièce (déclarant / gestionnaire / syndic) et l'efface du stockage. */
export async function retirerPieceJointe(ctx: TenantContext, id: string, input: SejourPieceJointeSupprimerInput) {
  if (can("lcd.sejour.declarer", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  const apres = await withTenant(ctx, async (db) => {
    const s = await db.sejourCourteDuree.findUnique({ where: { id }, include: sejourInclude });
    if (!s) throw new IntrouvableError("Séjour introuvable.");
    if (ctx.role !== "SYNDIC" && ctx.role !== "SUPER_ADMIN") {
      const declaration = await db.lotLocationCourteDuree.findUnique({ where: { id: s.declarationLcdId }, select: { gestionnaireId: true } });
      await assertPeutDeclarerSejour(db, ctx, s.lotId, { gestionnaireId: declaration?.gestionnaireId ?? null });
    }
    if (!s.piecesJointes.includes(input.chemin)) throw new IntrouvableError("Pièce jointe introuvable.");
    const maj = await db.sejourCourteDuree.update({ where: { id }, data: { piecesJointes: s.piecesJointes.filter((c) => c !== input.chemin) }, include: sejourInclude });
    await evenement(db, ctx, id, "MODIFIE", { piece_jointe_retiree: true });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "LCD_SEJOUR_PIECE_JOINTE_RETIREE",
      entite: "sejour_courte_duree",
      entiteId: id,
      apres: { pieces_jointes: maj.piecesJointes.length },
    });
    return maj;
  });
  // Effacement du stockage hors transaction (best-effort : la ligne fait foi).
  await supprimerObjet(input.chemin).catch(() => undefined);
  return apres;
}

// ── Synthèse par lot ───────────────────────────────────────────────────────

export async function syntheseLot(ctx: TenantContext, lotId: string, now = new Date()) {
  if (can("lcd.declaration.lire", ctx.role) === false) throw new PermissionRefuseeError("Rôle non autorisé.");
  return withTenant(ctx, async (db) => {
    const lot = await db.lot.findUnique({ where: { id: lotId }, select: { id: true, numero: true } });
    if (!lot) throw new IntrouvableError("Lot introuvable.");
    const copro = await chargerReglement(db, ctx.coproprieteId);
    const parametres = copro.regimeLcd === "ENCADREE" ? parametresLcdSchema.safeParse(copro.parametresLcdJson) : null;
    const quota = parametres?.success ? parametres.data.nb_nuits_max_par_an : null;
    const annee = now.getUTCFullYear();
    const [declaration, sejoursAnnee, derniers, sejourIds] = await Promise.all([
      db.lotLocationCourteDuree.findFirst({ where: { lotId, dateFin: null }, include: declarationInclude }),
      db.sejourCourteDuree.findMany({
        where: { lotId, statut: { not: "ANNULE" }, dateArrivee: { gte: new Date(Date.UTC(annee, 0, 1)), lt: new Date(Date.UTC(annee + 1, 0, 1)) } },
        select: { dateArrivee: true, dateDepart: true },
      }),
      db.sejourCourteDuree.findMany({ where: { lotId }, include: sejourInclude, orderBy: { dateArrivee: "desc" }, take: 10 }),
      db.sejourCourteDuree.findMany({ where: { lotId }, select: { id: true } }),
    ]);
    const incidentsLies = sejourIds.length
      ? await db.incident.count({ where: { sejourId: { in: sejourIds.map((s) => s.id) } } })
      : 0;
    return {
      lot,
      regimeLcd: copro.regimeLcd,
      declaration,
      annee,
      nuitsUtilisees: sejoursAnnee.reduce((acc, s) => acc + nuits(s.dateArrivee, s.dateDepart), 0),
      nuitsQuota: quota,
      derniersSejours: derniers,
      incidentsLies,
    };
  });
}

// ── Lien incident ↔ séjour (appelé par le module incidents) ────────────────

/** Vérifie qu'un séjour peut être lié à un incident (EN_COURS, ou TERMINE depuis ≤ 7 jours, même lot). */
export async function verifierSejourPourIncident(db: TenantDb, sejourId: string, lotId: string | null | undefined, now = new Date()) {
  const s = await db.sejourCourteDuree.findUnique({ where: { id: sejourId }, select: { id: true, lotId: true, statut: true, dateDepart: true } });
  if (!s) throw new IntrouvableError("Séjour introuvable.");
  if (lotId && s.lotId !== lotId) throw new LcdError("UNPROCESSABLE_ENTITY", "Le séjour n'est pas sur le lot de l'incident.");
  const recent = s.statut === "TERMINE" && now.getTime() - s.dateDepart.getTime() <= 7 * JOUR_MS;
  if (s.statut !== "EN_COURS" && !recent) {
    throw new LcdError("UNPROCESSABLE_ENTITY", "Seul un séjour en cours (ou terminé depuis moins de 7 jours) peut être lié à un incident.");
  }
  return s;
}

export async function lierIncidentAuSejour(db: TenantDb, ctx: TenantContext, sejourId: string, incidentId: string) {
  await evenement(db, ctx, sejourId, "INCIDENT_LIE", { incident_id: incidentId });
}

// ── Job quotidien (Inngest) ────────────────────────────────────────────────

export interface ResultatJobSejours {
  coproprietes: number;
  rappelsArrivee: number;
  departsAutomatiques: number;
}

/**
 * `lcd-sejours-quotidien` — idempotent : le rappel d'arrivée n'est envoyé qu'une fois par
 * séjour (marqueur GARDIEN_NOTIFIE du jour), la clôture automatique ne s'applique qu'aux
 * séjours EN_COURS dont le départ est passé (jamais PREVU→EN_COURS automatiquement).
 */
export async function executerSejoursQuotidien(
  db: TenantDb,
  coproprieteId: string,
  now = new Date()
): Promise<Omit<ResultatJobSejours, "coproprietes">> {
  const jour = aujourdhuiUtc(now);
  const jourIso = isoDate(jour);
  let rappelsArrivee = 0;
  let departsAutomatiques = 0;

  const gardiens = await db.roleUtilisateur.findMany({
    where: { coproprieteId, actif: true, role: "GARDIEN" },
    select: { utilisateurId: true },
    distinct: ["utilisateurId"],
  });

  const arrivees = await db.sejourCourteDuree.findMany({
    where: { coproprieteId, statut: "PREVU", dateArrivee: jour },
    include: { lot: { select: { numero: true } }, evenements: { where: { type: "GARDIEN_NOTIFIE" }, select: { detailsJson: true } } },
  });
  for (const s of arrivees) {
    const dejaRappele = s.evenements.some((e) => (e.detailsJson as { rappel_jour?: string } | null)?.rappel_jour === jourIso);
    if (dejaRappele || gardiens.length === 0) continue;
    await Promise.all(
      gardiens.map((g) =>
        envoyerNotification(db, {
          coproprieteId,
          utilisateurId: g.utilisateurId,
          templateCode: "LCD_ARRIVEE_AUJOURDHUI",
          canal: "PUSH",
          contenuJson: { sejour_id: s.id, lot: s.lot.numero, nb_voyageurs: String(s.nbVoyageurs), heure: s.heureArriveePrevue ?? "" },
        })
      )
    );
    await evenement(db, { coproprieteId, utilisateurId: null }, s.id, "GARDIEN_NOTIFIE", { rappel_jour: jourIso, destinataires: gardiens.length });
    if (!s.gardienInformeLe) await db.sejourCourteDuree.update({ where: { id: s.id }, data: { gardienInformeLe: now } });
    rappelsArrivee += 1;
  }

  // Le lendemain du départ (date_depart < aujourd'hui) : clôture automatique si le gardien n'a pas confirmé.
  const aCloturer = await db.sejourCourteDuree.findMany({ where: { coproprieteId, statut: "EN_COURS", dateDepart: { lt: jour } }, select: { id: true } });
  for (const s of aCloturer) {
    await db.sejourCourteDuree.update({ where: { id: s.id }, data: { statut: "TERMINE" } });
    await evenement(db, { coproprieteId, utilisateurId: null }, s.id, "DEPART_CONFIRME", { auto: true, jour: jourIso });
    departsAutomatiques += 1;
  }
  return { rappelsArrivee, departsAutomatiques };
}
