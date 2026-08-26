/**
 * Service incidents/prestataires — M7 (Master Spec Partie 2.2, Doc A §5). Toutes les écritures
 * passent par withTenant (RLS + contexte tenant, CLAUDE.md §1.8).
 */
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import type { TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import type {
  IncidentCreateInput,
  IncidentChangerStatutInput,
  PrestataireCreateInput,
} from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IncidentIntrouvableError extends Error {}
export class PrestataireIntrouvableError extends Error {}
export class ContrainteMetierError extends Error {}

/**
 * Délai SLA par palier d'urgence (Master Spec Partie 2.2 : champ `sla_deadline`). ⚠️ Simplification
 * signalée : Doc A §5.1 donne une grille beaucoup plus fine par catégorie/sous-catégorie (30 min
 * à 1 semaine selon le cas précis) — ici on ne retient que 3 seuils par palier d'urgence, le plus
 * contraignant de chaque palier observé dans Doc A §5.1/§5.3 (ex. 30 min = ascenseur bloqué avec
 * personne / incendie, tous deux classés URGENCE_MAXIMALE faute du 4e palier — voir schema.prisma
 * UrgenceIncident). À affiner par catégorie si le produit le demande explicitement.
 */
const SLA_HEURES: Record<string, number> = {
  NORMALE: 48,
  URGENTE: 4,
  URGENCE_MAXIMALE: 0.5,
};

function calculerSlaDeadline(urgence: string): Date {
  const heures = SLA_HEURES[urgence] ?? SLA_HEURES.NORMALE!;
  return new Date(Date.now() + heures * 60 * 60 * 1000);
}

export async function creerIncident(ctx: TenantContext, input: IncidentCreateInput) {
  if (can("incidents.creer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à créer un incident (Doc A §5).");
  }
  return withTenant(ctx, async (db) => {
    if (input.lot_id) {
      const lot = await db.lot.findUnique({ where: { id: input.lot_id } });
      if (!lot) throw new IncidentIntrouvableError("Lot introuvable.");
    }
    const incident = await db.incident.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        lotId: input.lot_id ?? null,
        categorie: input.categorie,
        sousCategorie: input.sous_categorie,
        description: input.description ?? null,
        partie: input.partie,
        urgence: input.urgence,
        creePar: ctx.utilisateurId,
        slaDeadline: calculerSlaDeadline(input.urgence),
      },
    });
    await db.incidentLog.create({
      data: {
        incidentId: incident.id,
        statutAvant: null,
        statutApres: "OUVERT",
        acteurId: ctx.utilisateurId,
        commentaire: "Ouverture du ticket.",
      },
    });
    if (input.urgence === "URGENCE_MAXIMALE") {
      await notifierUrgenceMaximale(db, ctx.coproprieteId, incident.id);
    }
    return incident;
  });
}

/**
 * Notification mass-push sur urgence maximale (Doc A §5.3) — le champ M9 marqué "Non livré" dans
 * ROADMAP_BACKLOG.md. Destinataires : SYNDIC + GARDIEN (les seuls rôles avec `incidents.assigner`/
 * suivi opérationnel de terrain — Doc A §5.3 ne mentionne pas le conseil syndical ici). Le créateur
 * de l'incident n'est jamais notifié de son propre signalement.
 */
async function notifierUrgenceMaximale(db: TenantDb, coproprieteId: string, incidentId: string) {
  const destinataires = await db.roleUtilisateur.findMany({
    where: { coproprieteId, actif: true, role: { in: ["SYNDIC", "GARDIEN"] } },
    select: { utilisateurId: true },
    distinct: ["utilisateurId"],
  });
  await Promise.all(
    destinataires.map((d) =>
      envoyerNotification(db, {
        coproprieteId,
        utilisateurId: d.utilisateurId,
        templateCode: "INCIDENT_URGENCE_MAXIMALE",
        canal: "PUSH",
        contenuJson: { incident_id: incidentId },
      })
    )
  );
}

export async function listerIncidents(ctx: TenantContext, page: number, limit: number) {
  if (can("incidents.voir_tous_copropriete", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à lister les incidents.");
  }
  return withTenant(ctx, async (db) => {
    const [total, rows] = await Promise.all([
      db.incident.count({ where: { coproprieteId: ctx.coproprieteId } }),
      db.incident.findMany({
        where: { coproprieteId: ctx.coproprieteId },
        orderBy: { creeLe: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, rows };
  });
}

export async function obtenirIncident(ctx: TenantContext, incidentId: string) {
  if (can("incidents.voir_tous_copropriete", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter cet incident.");
  }
  const incident = await withTenant(ctx, (db) =>
    db.incident.findUnique({ where: { id: incidentId } })
  );
  if (!incident) throw new IncidentIntrouvableError("Incident introuvable.");
  return incident;
}

/**
 * PRESTATAIRE : la permission "scoped" n'est qu'une porte d'entrée — la vérification fine (ce
 * ticket lui est-il assigné ?) est refaite ici en plus de la policy RLS (défense en profondeur,
 * Partie 1.6), parce qu'un PRESTATAIRE sans compte `prestataire.utilisateur_id` lié ne doit
 * jamais pouvoir changer le statut d'AUCUN ticket, y compris par erreur de filtrage applicatif.
 */
export async function changerStatutIncident(
  ctx: TenantContext,
  incidentId: string,
  input: IncidentChangerStatutInput
) {
  const permission = can("incidents.changer_statut", ctx.role);
  if (permission === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à changer le statut d'un incident.");
  }
  return withTenant(ctx, async (db) => {
    const incident = await db.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new IncidentIntrouvableError("Incident introuvable.");

    if (permission === "scoped" && ctx.role === "PRESTATAIRE") {
      await assertPrestataireAssigne(db, ctx.utilisateurId, incident.assigneAId);
    }

    const statutAvant = incident.statut;
    const [, log] = await Promise.all([
      db.incident.update({ where: { id: incidentId }, data: { statut: input.statut } }),
      db.incidentLog.create({
        data: {
          incidentId,
          statutAvant,
          statutApres: input.statut,
          acteurId: ctx.utilisateurId,
          commentaire: input.commentaire ?? null,
        },
      }),
    ]);
    return log;
  });
}

async function assertPrestataireAssigne(
  db: TenantDb,
  utilisateurId: string,
  assigneAId: string | null
) {
  if (!assigneAId) {
    throw new PermissionRefuseeError("Ce ticket n'est assigné à aucun prestataire.");
  }
  const prestataire = await db.prestataire.findUnique({ where: { id: assigneAId } });
  if (!prestataire || prestataire.utilisateurId !== utilisateurId) {
    throw new PermissionRefuseeError("Ce ticket n'est pas assigné à ce prestataire.");
  }
}

/**
 * Assignation à un prestataire (Master Spec Partie 4.2, `POST /incidents/:id/assign`). Décision
 * produit : un ticket OUVERT passe automatiquement en EN_COURS lors de son assignation — pas
 * dicté explicitement par le Master Spec, mais cohérent avec le sens même de "prestataire
 * mandaté" (Doc A §5.3, colonne workflow des cas spéciaux) plutôt que de laisser un ticket assigné
 * rester au statut OUVERT.
 */
export async function assignerIncident(
  ctx: TenantContext,
  incidentId: string,
  prestataireId: string
) {
  if (can("incidents.assigner", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut assigner un incident à un prestataire.");
  }
  return withTenant(ctx, async (db) => {
    const incident = await db.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new IncidentIntrouvableError("Incident introuvable.");

    const prestataire = await db.prestataire.findUnique({ where: { id: prestataireId } });
    if (!prestataire || prestataire.coproprieteId !== ctx.coproprieteId) {
      throw new PrestataireIntrouvableError("Prestataire introuvable.");
    }
    if (!prestataire.actif) {
      throw new ContrainteMetierError("Ce prestataire est inactif.");
    }

    const statutAvant = incident.statut;
    const nouveauStatut = statutAvant === "OUVERT" ? "EN_COURS" : statutAvant;

    const [updated] = await Promise.all([
      db.incident.update({
        where: { id: incidentId },
        data: { assigneAId: prestataireId, statut: nouveauStatut },
      }),
      db.incidentLog.create({
        data: {
          incidentId,
          statutAvant,
          statutApres: nouveauStatut,
          acteurId: ctx.utilisateurId,
          commentaire: `Assigné au prestataire ${prestataire.nom}.`,
        },
      }),
      ecrireAuditLog(db, {
        coproprieteId: ctx.coproprieteId,
        acteurId: ctx.utilisateurId,
        action: "INCIDENT_ASSIGNE",
        entite: "incident",
        entiteId: incidentId,
        avant: { assigne_a: incident.assigneAId },
        apres: { assigne_a: prestataireId },
      }),
    ]);
    return updated;
  });
}

export async function creerPrestataire(ctx: TenantContext, input: PrestataireCreateInput) {
  if (can("prestataires.gerer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut créer un prestataire.");
  }
  return withTenant(ctx, (db) =>
    db.prestataire.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        nom: input.nom,
        specialite: input.specialite,
        contact: input.contact,
        utilisateurId: input.utilisateur_id ?? null,
      },
    })
  );
}

export async function listerPrestataires(ctx: TenantContext) {
  if (can("prestataires.lire", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à lister les prestataires.");
  }
  return withTenant(ctx, (db) =>
    db.prestataire.findMany({
      where: { coproprieteId: ctx.coproprieteId },
      orderBy: { nom: "asc" },
    })
  );
}
