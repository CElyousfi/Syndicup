/**
 * Service parties communes — M8 (Master Spec Partie 2.2/9.4, Doc A §7).
 */
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import type {
  EspaceCommunCreateInput,
  ReservationCreateInput,
} from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
export class ContrainteMetierError extends Error {}

export async function creerEspaceCommun(ctx: TenantContext, input: EspaceCommunCreateInput) {
  if (can("espaces_communs.gerer_config", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut créer un espace commun.");
  }
  return withTenant(ctx, (db) =>
    db.espaceCommun.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        nom: input.nom,
        type: input.type,
        capacite: input.capacite ?? null,
        reservable: input.reservable ?? false,
        validationAutomatique: input.validation_automatique ?? false,
        reglesReservationJson: input.regles_reservation_json ?? undefined,
      },
    })
  );
}

export async function listerEspacesCommuns(ctx: TenantContext) {
  if (can("espaces_communs.lire", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à lister les espaces communs.");
  }
  return withTenant(ctx, (db) =>
    db.espaceCommun.findMany({ where: { coproprieteId: ctx.coproprieteId }, orderBy: { nom: "asc" } })
  );
}

/**
 * Doc A §7.2 "2 résidents veulent le même créneau" : détection de conflit en temps réel — une
 * nouvelle réservation ne peut chevaucher une réservation EN_ATTENTE ou CONFIRMEE existante sur
 * le même espace (les résultats ANNULEE/REJETEE ne comptent plus comme occupant le créneau).
 */
export async function creerReservation(ctx: TenantContext, input: ReservationCreateInput) {
  const permission = can("reservations.creer", ctx.role);
  if (permission === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à réserver un espace commun.");
  }
  return withTenant(ctx, async (db) => {
    const espace = await db.espaceCommun.findUnique({ where: { id: input.espace_id } });
    if (!espace) throw new IntrouvableError("Espace commun introuvable.");
    if (!espace.reservable) {
      throw new ContrainteMetierError("Cet espace n'est pas réservable.");
    }

    if (permission === "scoped") {
      const [proprietaire, occupant] = await Promise.all([
        db.lotProprietaire.findFirst({ where: { lotId: input.lot_id, utilisateurId: ctx.utilisateurId, dateFin: null } }),
        db.lotOccupant.findFirst({ where: { lotId: input.lot_id, utilisateurId: ctx.utilisateurId, dateFin: null } }),
      ]);
      if (!proprietaire && !occupant) {
        throw new PermissionRefuseeError("Vous n'êtes ni propriétaire ni occupant actif de ce lot.");
      }
    }

    const dateDebut = new Date(input.date_debut);
    const dateFin = new Date(input.date_fin);

    const conflit = await db.reservationEspaceCommun.findFirst({
      where: {
        espaceId: input.espace_id,
        statut: { in: ["EN_ATTENTE", "CONFIRMEE"] },
        dateDebut: { lt: dateFin },
        dateFin: { gt: dateDebut },
      },
    });
    if (conflit) {
      throw new ContrainteMetierError("Créneau déjà réservé ou en attente de validation pour cet espace (Doc A §7.2).");
    }

    return db.reservationEspaceCommun.create({
      data: {
        espaceId: input.espace_id,
        lotId: input.lot_id,
        utilisateurId: ctx.utilisateurId,
        dateDebut,
        dateFin,
        nombreInvites: input.nombre_invites ?? null,
        statut: espace.validationAutomatique ? "CONFIRMEE" : "EN_ATTENTE",
      },
    });
  });
}

export async function listerReservations(ctx: TenantContext, espaceId?: string) {
  if (can("espaces_communs.lire", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à lister les réservations.");
  }
  return withTenant(ctx, (db) =>
    db.reservationEspaceCommun.findMany({
      where: espaceId ? { espaceId } : undefined,
      orderBy: { dateDebut: "asc" },
    })
  );
}

export async function validerReservation(ctx: TenantContext, reservationId: string) {
  if (can("reservations.gerer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut valider une réservation.");
  }
  return withTenant(ctx, async (db) => {
    const reservation = await db.reservationEspaceCommun.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new IntrouvableError("Réservation introuvable.");
    if (reservation.statut !== "EN_ATTENTE") {
      throw new ContrainteMetierError(`Validation impossible depuis le statut ${reservation.statut}.`);
    }
    return db.reservationEspaceCommun.update({
      where: { id: reservationId },
      data: { statut: "CONFIRMEE" },
    });
  });
}

export async function rejeterReservation(ctx: TenantContext, reservationId: string, motif: string) {
  if (can("reservations.gerer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut rejeter une réservation.");
  }
  return withTenant(ctx, async (db) => {
    const reservation = await db.reservationEspaceCommun.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new IntrouvableError("Réservation introuvable.");
    if (reservation.statut !== "EN_ATTENTE") {
      throw new ContrainteMetierError(`Rejet impossible depuis le statut ${reservation.statut}.`);
    }
    return db.reservationEspaceCommun.update({
      where: { id: reservationId },
      data: { statut: "REJETEE", motifRejet: motif },
    });
  });
}

/**
 * Master Spec Partie 3.2 : `PATCH /reservations/:id`. "scoped" (auteur) vérifié en plus de la
 * RLS — la table n'est pas confidentielle par ligne (Doc A §7.2), donc un auteur pourrait sinon
 * annuler la réservation d'un autre résident par erreur d'ID.
 */
export async function annulerReservation(ctx: TenantContext, reservationId: string) {
  const permission = can("reservations.annuler", ctx.role);
  if (permission === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à annuler cette réservation.");
  }
  return withTenant(ctx, async (db) => {
    const reservation = await db.reservationEspaceCommun.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new IntrouvableError("Réservation introuvable.");
    if (permission === "scoped" && reservation.utilisateurId !== ctx.utilisateurId) {
      throw new PermissionRefuseeError("Seul l'auteur de la réservation (ou le syndic) peut l'annuler.");
    }
    if (reservation.statut === "ANNULEE" || reservation.statut === "REJETEE") {
      throw new ContrainteMetierError(`Annulation impossible depuis le statut ${reservation.statut}.`);
    }
    return db.reservationEspaceCommun.update({
      where: { id: reservationId },
      data: { statut: "ANNULEE" },
    });
  });
}
