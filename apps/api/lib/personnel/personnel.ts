/**
 * Service personnel / gardien & visites — M10 (Master Spec Partie 2.2/13.3, Doc A §9).
 *
 * Workflow visites (Doc A §9.2) : le gardien enregistre la visite → notification push au
 * résident du lot → le résident autorise ou refuse → le gardien reçoit la réponse. Les
 * notifications ci-dessous suivent le même câblage M9 que `ag.convoquer`/`incidents.creer`.
 */
import { can } from "../auth/permissions";
import { withTenant, type TenantDb } from "../tenant/db";
import { withTenantIdempotent } from "../http/idempotency";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import type {
  PersonnelCreateInput,
  PersonnelChangerStatutInput,
  VisiteCreateInput,
  VisiteChangerStatutInput,
} from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
export class ContrainteMetierError extends Error {}

/**
 * Doc A §9.2 : "Fiche gardien créée. Compte invité. Lié à la copropriété." — l'utilisateur doit
 * déjà avoir un rôle GARDIEN actif dans la copropriété (issu du flow d'invitation M2) avant que
 * sa fiche personnel ne soit créée ; sinon 422 explicite plutôt qu'une fiche orpheline.
 */
export async function creerPersonnel(ctx: TenantContext, input: PersonnelCreateInput) {
  if (can("personnel.gerer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut gérer le personnel.");
  }
  return withTenant(ctx, async (db) => {
    const roleGardien = await db.roleUtilisateur.findFirst({
      where: {
        utilisateurId: input.utilisateur_id,
        coproprieteId: ctx.coproprieteId,
        role: "GARDIEN",
        actif: true,
      },
    });
    if (!roleGardien) {
      throw new ContrainteMetierError(
        "Cet utilisateur n'a pas de rôle GARDIEN actif dans la copropriété (Doc A §9.2 : la fiche personnel suit l'invitation, pas l'inverse)."
      );
    }
    if (input.logement_lot_id) {
      await assertLotLogeGardien(db, input.logement_lot_id);
    }
    const existante = await db.personnel.findFirst({
      where: { utilisateurId: input.utilisateur_id, coproprieteId: ctx.coproprieteId },
    });
    if (existante) {
      throw new ContrainteMetierError("Une fiche personnel existe déjà pour cet utilisateur dans la copropriété.");
    }
    const fiche = await db.personnel.create({
      data: {
        utilisateurId: input.utilisateur_id,
        coproprieteId: ctx.coproprieteId,
        statut: input.statut ?? "PRESENT",
        logementLotId: input.logement_lot_id ?? null,
      },
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "PERSONNEL_CREE",
      entite: "personnel",
      entiteId: fiche.id,
      apres: { utilisateur_id: input.utilisateur_id, statut: fiche.statut },
    });
    return fiche;
  });
}

export async function listerPersonnel(ctx: TenantContext) {
  if (can("personnel.lire", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à lister le personnel.");
  }
  return withTenant(ctx, (db) =>
    db.personnel.findMany({
      where: { coproprieteId: ctx.coproprieteId },
      orderBy: { creeLe: "asc" },
    })
  );
}

/**
 * Doc A §9.2 "Gardien absent / remplacé" — le syndic met à jour présence et logement attribué.
 */
export async function changerStatutPersonnel(
  ctx: TenantContext,
  personnelId: string,
  input: PersonnelChangerStatutInput
) {
  if (can("personnel.gerer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut gérer le personnel.");
  }
  return withTenant(ctx, async (db) => {
    const fiche = await db.personnel.findUnique({ where: { id: personnelId } });
    if (!fiche) throw new IntrouvableError("Fiche personnel introuvable.");
    if (input.logement_lot_id) {
      await assertLotLogeGardien(db, input.logement_lot_id);
    }
    const updated = await db.personnel.update({
      where: { id: personnelId },
      data: {
        statut: input.statut,
        ...(input.logement_lot_id !== undefined ? { logementLotId: input.logement_lot_id } : {}),
      },
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "PERSONNEL_STATUT_CHANGE",
      entite: "personnel",
      entiteId: personnelId,
      avant: { statut: fiche.statut },
      apres: { statut: input.statut },
    });
    return updated;
  });
}

/**
 * Doc A §9.2 "Logement attribué (lot type LOGE_GARDIEN)" — un lot d'un autre type (appartement,
 * parking...) ne peut pas être attribué comme logement de fonction.
 */
async function assertLotLogeGardien(db: TenantDb, lotId: string) {
  const lot = await db.lot.findUnique({ where: { id: lotId } });
  if (!lot) throw new IntrouvableError("Lot de logement introuvable.");
  if (lot.typeLot !== "LOGE_GARDIEN") {
    throw new ContrainteMetierError(
      `Le logement de fonction doit être un lot de type LOGE_GARDIEN (Doc A §9.2), pas ${lot.typeLot}.`
    );
  }
}

/**
 * Doc A §9.2 : "Gardien enregistre → notification push au résident". Les destinataires notifiés
 * sont les propriétaires et occupants actifs du lot visité.
 */
export async function creerVisite(
  ctx: TenantContext,
  input: VisiteCreateInput,
  idempotencyKey?: string
) {
  if (can("visites.creer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le gardien (ou le syndic) peut enregistrer une visite.");
  }
  // Idempotence de la sync_queue offline mobile (Master Spec Partie 13.3) : l'app génère une
  // Idempotency-Key par visite ; un retry réseau ne crée jamais deux visites.
  return withTenantIdempotent(
    ctx,
    { cle: idempotencyKey, endpoint: "POST /visites", payload: input },
    async (db) => {
    const lot = await db.lot.findUnique({ where: { id: input.lot_id } });
    if (!lot) throw new IntrouvableError("Lot introuvable.");
    const visite = await db.visite.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        gardienId: ctx.utilisateurId,
        lotId: input.lot_id,
        visiteurNom: input.visiteur_nom,
      },
    });
    const residents = await residentsActifsDuLot(db, input.lot_id);
    await Promise.all(
      residents.map((utilisateurId) =>
        envoyerNotification(db, {
          coproprieteId: ctx.coproprieteId,
          utilisateurId,
          templateCode: "VISITE_NOUVELLE",
          canal: "PUSH",
          contenuJson: { visite_id: visite.id, visiteur_nom: input.visiteur_nom },
        })
      )
    );
    return visite;
  });
}

export async function listerVisites(ctx: TenantContext, lotId?: string) {
  const permission = can("visites.lire", ctx.role);
  if (permission === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à lister les visites.");
  }
  return withTenant(ctx, (db) =>
    // Le filtrage fin (résident → ses lots, gardien → ses enregistrements) est appliqué par la
    // policy RLS sur `visite` — le WHERE applicatif ci-dessous ne re-filtre que le gardien
    // ("scoped" explicite, défense en profondeur), les lots du résident étant déjà invisibles.
    db.visite.findMany({
      where: {
        coproprieteId: ctx.coproprieteId,
        ...(lotId ? { lotId } : {}),
        ...(permission === "scoped" && ctx.role === "GARDIEN" ? { gardienId: ctx.utilisateurId } : {}),
      },
      orderBy: { horodatage: "desc" },
    })
  );
}

/**
 * Doc A §9.2 : "Résident autorise ou refuse → Gardien reçoit la réponse". Le gardien peut aussi
 * clôturer lui-même en REFUSE (relai — permission "personnel.autoriser_visiteur", GARDIEN scoped
 * à ses propres enregistrements). Transition unique EN_ATTENTE → AUTORISE|REFUSE.
 */
export async function changerStatutVisite(
  ctx: TenantContext,
  visiteId: string,
  input: VisiteChangerStatutInput
) {
  const permission = can("personnel.autoriser_visiteur", ctx.role);
  if (permission === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à répondre à une visite.");
  }
  return withTenant(ctx, async (db) => {
    const visite = await db.visite.findUnique({ where: { id: visiteId } });
    if (!visite) throw new IntrouvableError("Visite introuvable.");
    if (visite.statut !== "EN_ATTENTE") {
      throw new ContrainteMetierError(`Réponse impossible depuis le statut ${visite.statut}.`);
    }
    if (permission === "scoped") {
      if (ctx.role === "GARDIEN") {
        if (visite.gardienId !== ctx.utilisateurId) {
          throw new PermissionRefuseeError("Un gardien ne répond qu'aux visites qu'il a lui-même enregistrées.");
        }
      } else {
        const [proprietaire, occupant] = await Promise.all([
          db.lotProprietaire.findFirst({
            where: { lotId: visite.lotId, utilisateurId: ctx.utilisateurId, dateFin: null },
          }),
          db.lotOccupant.findFirst({
            where: { lotId: visite.lotId, utilisateurId: ctx.utilisateurId, dateFin: null },
          }),
        ]);
        if (!proprietaire && !occupant) {
          throw new PermissionRefuseeError("Vous n'êtes ni propriétaire ni occupant actif du lot visité.");
        }
      }
    }
    const updated = await db.visite.update({
      where: { id: visiteId },
      data: { statut: input.statut },
    });
    // "Gardien reçoit la réponse" — sauf s'il est lui-même l'auteur de la réponse (relai).
    if (visite.gardienId !== ctx.utilisateurId) {
      await envoyerNotification(db, {
        coproprieteId: ctx.coproprieteId,
        utilisateurId: visite.gardienId,
        templateCode: "VISITE_REPONSE",
        canal: "PUSH",
        contenuJson: { visite_id: visiteId, statut: input.statut },
      });
    }
    return updated;
  });
}

/**
 * Lookup via la fonction SECURITY DEFINER `residents_actifs_du_lot` (migration M10) : les
 * policies RLS de `lot_proprietaire`/`lot_occupant` cachent au GARDIEN les lignes d'autrui, or
 * c'est lui qui enregistre la visite et doit notifier les résidents du lot visité.
 */
async function residentsActifsDuLot(db: TenantDb, lotId: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ utilisateur_id: string }[]>`
    SELECT utilisateur_id FROM public.residents_actifs_du_lot(${lotId}::uuid)
  `;
  return rows.map((r) => r.utilisateur_id);
}
