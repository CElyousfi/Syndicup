/**
 * Service parties communes — M8 (Master Spec Partie 2.2/9.4, Doc A §7).
 */
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import type {
  EspaceCommunCreateInput,
  EspaceCommunUpdateInput,
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

    const reservation = await db.reservationEspaceCommun.create({
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
    if (reservation.statut === "EN_ATTENTE") {
      // Le syndic est prévenu immédiatement d'une demande à valider (flux temps réel).
      const syndics = await db.roleUtilisateur.findMany({
        where: { coproprieteId: ctx.coproprieteId, actif: true, role: "SYNDIC" },
        select: { utilisateurId: true },
      });
      await Promise.all(
        syndics.map((s) =>
          envoyerNotification(db, {
            coproprieteId: ctx.coproprieteId,
            utilisateurId: s.utilisateurId,
            templateCode: "RESERVATION_NOUVELLE",
            canal: "PUSH",
            contenuJson: { reservation_id: reservation.id, espace: espace.nom, date: reservation.dateDebut.toISOString().slice(0, 10) },
          })
        )
      );
    }
    return reservation;
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
    const maj = await db.reservationEspaceCommun.update({
      where: { id: reservationId },
      data: { statut: "CONFIRMEE" },
    });
    const espace = await db.espaceCommun.findUnique({ where: { id: reservation.espaceId } });
    await Promise.all([
      ecrireAuditLog(db, {
        coproprieteId: ctx.coproprieteId,
        acteurId: ctx.utilisateurId,
        action: "RESERVATION_VALIDEE",
        entite: "reservation_espace_commun",
        entiteId: reservationId,
        avant: { statut: "EN_ATTENTE" },
        apres: { statut: "CONFIRMEE" },
      }),
      // Le demandeur est prévenu de la décision (flux temps réel + boîte de réception).
      envoyerNotification(db, {
        coproprieteId: ctx.coproprieteId,
        utilisateurId: reservation.utilisateurId,
        templateCode: "RESERVATION_VALIDEE",
        canal: "PUSH",
        contenuJson: {
          reservation_id: reservationId,
          espace: espace?.nom ?? "",
          date: reservation.dateDebut.toISOString().slice(0, 10),
        },
      }),
    ]);
    return maj;
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
    const maj = await db.reservationEspaceCommun.update({
      where: { id: reservationId },
      data: { statut: "REJETEE", motifRejet: motif },
    });
    const espace = await db.espaceCommun.findUnique({ where: { id: reservation.espaceId } });
    await Promise.all([
      ecrireAuditLog(db, {
        coproprieteId: ctx.coproprieteId,
        acteurId: ctx.utilisateurId,
        action: "RESERVATION_REJETEE",
        entite: "reservation_espace_commun",
        entiteId: reservationId,
        avant: { statut: "EN_ATTENTE" },
        apres: { statut: "REJETEE", motif },
      }),
      envoyerNotification(db, {
        coproprieteId: ctx.coproprieteId,
        utilisateurId: reservation.utilisateurId,
        templateCode: "RESERVATION_REJETEE",
        canal: "PUSH",
        contenuJson: {
          reservation_id: reservationId,
          espace: espace?.nom ?? "",
          date: reservation.dateDebut.toISOString().slice(0, 10),
          motif,
        },
      }),
    ]);
    return maj;
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
    const maj = await db.reservationEspaceCommun.update({
      where: { id: reservationId },
      data: { statut: "ANNULEE" },
    });
    // Annulation par le résident : le syndic est prévenu (le créneau se libère).
    if (permission === "scoped") {
      const [espace, syndics] = await Promise.all([
        db.espaceCommun.findUnique({ where: { id: reservation.espaceId } }),
        db.roleUtilisateur.findMany({
          where: { coproprieteId: ctx.coproprieteId, actif: true, role: "SYNDIC" },
          select: { utilisateurId: true },
        }),
      ]);
      await Promise.all(
        syndics.map((s) =>
          envoyerNotification(db, {
            coproprieteId: ctx.coproprieteId,
            utilisateurId: s.utilisateurId,
            templateCode: "RESERVATION_ANNULEE",
            canal: "PUSH",
            contenuJson: {
              reservation_id: reservationId,
              espace: espace?.nom ?? "",
              date: reservation.dateDebut.toISOString().slice(0, 10),
            },
          })
        )
      );
    }
    return maj;
  });
}

/** PATCH /espaces-communs/:id — modification d'un espace (syndic). */
export async function modifierEspaceCommun(
  ctx: TenantContext,
  espaceId: string,
  input: EspaceCommunUpdateInput
) {
  if (can("espaces_communs.gerer_config", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut modifier un espace commun.");
  }
  return withTenant(ctx, async (db) => {
    const espace = await db.espaceCommun.findUnique({ where: { id: espaceId } });
    if (!espace || espace.coproprieteId !== ctx.coproprieteId) {
      throw new IntrouvableError("Espace commun introuvable.");
    }
    const maj = await db.espaceCommun.update({
      where: { id: espaceId },
      data: {
        ...(input.nom !== undefined ? { nom: input.nom } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.capacite !== undefined ? { capacite: input.capacite } : {}),
        ...(input.reservable !== undefined ? { reservable: input.reservable } : {}),
        ...(input.validation_automatique !== undefined
          ? { validationAutomatique: input.validation_automatique }
          : {}),
        ...(input.regles_reservation_json !== undefined
          ? { reglesReservationJson: (input.regles_reservation_json ?? undefined) as never }
          : {}),
      },
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "ESPACE_COMMUN_MODIFIE",
      entite: "espace_commun",
      entiteId: espaceId,
      avant: { nom: espace.nom, reservable: espace.reservable, capacite: espace.capacite },
      apres: { nom: maj.nom, reservable: maj.reservable, capacite: maj.capacite },
    });
    return maj;
  });
}

/**
 * DELETE /espaces-communs/:id — suppression (syndic). Refusée (409) dès qu'une réservation
 * existe : l'historique de réservation est une donnée de vie collective ; l'alternative est de
 * rendre l'espace non réservable (PATCH reservable=false).
 */
export async function supprimerEspaceCommun(ctx: TenantContext, espaceId: string) {
  if (can("espaces_communs.gerer_config", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut supprimer un espace commun.");
  }
  return withTenant(ctx, async (db) => {
    const espace = await db.espaceCommun.findUnique({ where: { id: espaceId } });
    if (!espace || espace.coproprieteId !== ctx.coproprieteId) {
      throw new IntrouvableError("Espace commun introuvable.");
    }
    const reservations = await db.reservationEspaceCommun.count({ where: { espaceId } });
    if (reservations > 0) {
      throw new ContrainteMetierError(
        "Des réservations existent pour cet espace : rendez-le non réservable plutôt que de le supprimer."
      );
    }
    await db.espaceCommun.delete({ where: { id: espaceId } });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "ESPACE_COMMUN_SUPPRIME",
      entite: "espace_commun",
      entiteId: espaceId,
      avant: { nom: espace.nom, type: espace.type },
    });
    return { id: espaceId };
  });
}
