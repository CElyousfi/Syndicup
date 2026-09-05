/**
 * Service incidents/prestataires — M7 (Master Spec Partie 2.2, Doc A §5). Toutes les écritures
 * passent par withTenant (RLS + contexte tenant, CLAUDE.md §1.8).
 */
import { randomUUID } from "node:crypto";
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import type { TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import { creerUrlSignee, creerUrlUploadSignee } from "../storage/supabase-storage";
import { verifierSejourPourIncident, lierIncidentAuSejour, LcdError, IntrouvableError as SejourIntrouvableError } from "../lcd/lcd";
import { presenterPrestataire } from "../prestataires/prestataires";
import { money, toApiString } from "../money";
import type { ErrorCode } from "../http/respond";
import type {
  IncidentCreateInput,
  IncidentChangerStatutInput,
  IncidentUploadUrlInput,
  PrestataireCreateInput,
  PrestataireUpdateInput,
} from "./schemas";
import type { IncidentEvaluationInput } from "../depenses/schemas";

export class PermissionRefuseeError extends Error {}
export class IncidentIntrouvableError extends Error {}
export class PrestataireIntrouvableError extends Error {}
export class ContrainteMetierError extends Error {}
/** M16 — règle métier d'évaluation violée (422 / 409), code explicite. */
export class IncidentError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}

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

/**
 * POST /incidents/upload-url — prépare le téléversement d'UNE photo de signalement :
 * chemin canonique `<copropriete>/incidents/…` (bucket privé `documents`) + URL signée
 * d'upload. Même exception d'architecture que les documents (Master Spec Partie 9.3) :
 * le client téléverse directement au Storage, puis référence le chemin dans POST /incidents.
 */
export async function preparerUploadPhoto(ctx: TenantContext, input: IncidentUploadUrlInput) {
  if (can("incidents.creer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à créer un incident (Doc A §5).");
  }
  const nomSur = input.nom_fichier
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
  const storagePath = `${ctx.coproprieteId}/incidents/${randomUUID()}-${nomSur || "photo"}`;
  const { url, token } = await creerUrlUploadSignee(storagePath);
  return { storage_path: storagePath, upload_url: url, token };
}

export async function creerIncident(ctx: TenantContext, input: IncidentCreateInput) {
  if (can("incidents.creer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à créer un incident (Doc A §5).");
  }
  // Défense en profondeur : chaque photo doit vivre dans le périmètre storage du tenant
  // courant — un chemin d'une autre copropriété est rejeté même s'il est bien formé.
  const photos = input.photos ?? [];
  for (const p of photos) {
    if (!p.startsWith(`${ctx.coproprieteId}/incidents/`)) {
      throw new PermissionRefuseeError("Photo hors du périmètre de la copropriété.");
    }
  }
  return withTenant(ctx, async (db) => {
    if (input.lot_id) {
      const lot = await db.lot.findUnique({ where: { id: input.lot_id } });
      if (!lot) throw new IncidentIntrouvableError("Lot introuvable.");
    }
    // M15 — lien au séjour LCD : EN_COURS (ou TERMINE ≤ 7 jours), même lot ; vérifié sous RLS
    // (un résident ne peut lier qu'un séjour qu'il a le droit de voir).
    let sejourId: string | null = null;
    if (input.sejour_id) {
      const sejour = await verifierSejourPourIncident(db, input.sejour_id, input.lot_id).catch((e) => {
        if (e instanceof SejourIntrouvableError) throw new IncidentIntrouvableError("Séjour introuvable.");
        throw e;
      });
      sejourId = sejour.id;
    }
    const incident = await db.incident.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        lotId: input.lot_id ?? (sejourId ? (await db.sejourCourteDuree.findUnique({ where: { id: sejourId }, select: { lotId: true } }))?.lotId ?? null : null),
        sejourId,
        categorie: input.categorie,
        sousCategorie: input.sous_categorie,
        description: input.description ?? null,
        partie: input.partie,
        urgence: input.urgence,
        creePar: ctx.utilisateurId,
        slaDeadline: calculerSlaDeadline(input.urgence),
        photos,
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
    // Temps réel : le syndic et le gardien sont prévenus de CHAQUE signalement (le flux
    // /notifications/stream le pousse à l'écran sans rechargement) ; l'urgence maximale garde
    // son template dédié (Doc A §5.3), sans doublon.
    await notifierNouveauSignalement(db, ctx, incident);
    if (sejourId) await lierIncidentAuSejour(db, ctx, sejourId, incident.id);
    return incident;
  });
}
export { LcdError };

/**
 * Notification mass-push sur urgence maximale (Doc A §5.3) — le champ M9 marqué "Non livré" dans
 * ROADMAP_BACKLOG.md. Destinataires : SYNDIC + GARDIEN (les seuls rôles avec `incidents.assigner`/
 * suivi opérationnel de terrain — Doc A §5.3 ne mentionne pas le conseil syndical ici). Le créateur
 * de l'incident n'est jamais notifié de son propre signalement.
 */
async function notifierNouveauSignalement(
  db: TenantDb,
  ctx: TenantContext,
  incident: { id: string; categorie: string; sousCategorie: string; urgence: string }
) {
  const destinataires = await db.roleUtilisateur.findMany({
    where: { coproprieteId: ctx.coproprieteId, actif: true, role: { in: ["SYNDIC", "GARDIEN"] } },
    select: { utilisateurId: true },
    distinct: ["utilisateurId"],
  });
  const urgence = incident.urgence === "URGENCE_MAXIMALE";
  await Promise.all(
    destinataires
      // Urgence maximale = alerte de masse (tout le monde, créateur compris) ; sinon, on ne
      // notifie jamais quelqu'un de son propre signalement.
      .filter((d) => urgence || d.utilisateurId !== ctx.utilisateurId)
      .map((d) =>
        envoyerNotification(db, {
          coproprieteId: ctx.coproprieteId,
          utilisateurId: d.utilisateurId,
          templateCode: urgence ? "INCIDENT_URGENCE_MAXIMALE" : "INCIDENT_NOUVEAU",
          canal: "PUSH",
          contenuJson: { incident_id: incident.id, categorie: incident.categorie, sous_categorie: incident.sousCategorie },
        })
      )
  );
}


export async function listerIncidents(ctx: TenantContext, page: number, limit: number, filtres: { sejourId?: string } = {}) {
  if (can("incidents.voir_tous_copropriete", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à lister les incidents.");
  }
  const where = { coproprieteId: ctx.coproprieteId, ...(filtres.sejourId ? { sejourId: filtres.sejourId } : {}) };
  return withTenant(ctx, async (db) => {
    const [total, rows] = await Promise.all([
      db.incident.count({ where }),
      db.incident.findMany({
        where,
        orderBy: { creeLe: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, rows };
  });
}

/**
 * GET /incidents/:id/photos — URLs signées 15 min des photos du signalement (même règle
 * d'accès que le détail : la RLS + permission masquent hors périmètre avant le storage).
 */
export async function urlsPhotosIncident(ctx: TenantContext, incidentId: string) {
  const incident = await obtenirIncident(ctx, incidentId);
  const urls = await Promise.all(incident.photos.map((p) => creerUrlSignee(p)));
  return incident.photos.map((path, i) => ({ path, url: urls[i]! }));
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
 * GET /incidents/:id — détail + journal append-only (page F3 du brief frontend : la timeline
 * des changements de statut horodatés). La RLS sur incident/incident_log masque hors périmètre.
 */
export async function obtenirIncidentAvecJournal(ctx: TenantContext, incidentId: string) {
  if (can("incidents.voir_tous_copropriete", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter cet incident.");
  }
  // Le signalement porte son auteur (nom, contact) et chaque étape du journal son acteur :
  // un syndic ou un gardien n'est rattaché à aucun lot, l'annuaire par lots ne suffit pas.
  const identite = { id: true, nom: true, prenom: true, telephone: true, email: true } as const;
  const incident = await withTenant(ctx, async (db) => {
    const trouve = await db.incident.findUnique({
      where: { id: incidentId },
      include: { createur: { select: identite } },
    });
    if (!trouve) return null;
    const logs = await db.incidentLog.findMany({
      where: { incidentId },
      orderBy: { horodatage: "asc" },
      include: { acteur: { select: { id: true, nom: true, prenom: true } } },
    });
    // M16 — dépenses nées de cet incident (syndic / conseil) : liste + total engagé/payé.
    let depenses: Array<{ id: string; libelle: string; montantTtc: unknown; statut: string; dateDepense: Date; source: string }> = [];
    let totalDepenses: string | null = null;
    if (can("depenses.lire", ctx.role) === true) {
      depenses = await db.depense.findMany({
        where: { incidentId },
        orderBy: { dateDepense: "desc" },
        select: { id: true, libelle: true, montantTtc: true, statut: true, dateDepense: true, source: true },
      });
      totalDepenses = toApiString(
        depenses
          .filter((d) => d.statut === "APPROUVEE" || d.statut === "PAYEE")
          .reduce((acc, d) => acc.plus(money(d.montantTtc as string)), money(0))
      );
    }
    return { ...trouve, logs, depenses, total_depenses: totalDepenses };
  });
  if (!incident) throw new IncidentIntrouvableError("Incident introuvable.");
  return incident;
}

/**
 * POST /incidents/{id}/evaluation — M16 (Doc A §8.3 « syndic favorise certains prestataires » →
 * transparence) : le créateur du ticket (ou le syndic) note le prestataire d'un incident RESOLU /
 * FERME, une seule fois ; `prestataire.note_moyenne` est recalculée sur tous ses incidents notés.
 */
export async function evaluerPrestataireIncident(ctx: TenantContext, incidentId: string, input: IncidentEvaluationInput) {
  const permission = can("incidents.evaluer", ctx.role);
  if (permission === false) throw new PermissionRefuseeError("Rôle non autorisé à évaluer un prestataire.");
  return withTenant(ctx, async (db) => {
    const incident = await db.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new IncidentIntrouvableError("Incident introuvable.");
    if (permission === "scoped" && incident.creePar !== ctx.utilisateurId) {
      throw new PermissionRefuseeError("Seul l'auteur du signalement (ou le syndic) évalue le prestataire.");
    }
    if (incident.statut !== "RESOLU" && incident.statut !== "FERME") {
      throw new IncidentError("INCIDENT_NON_RESOLU", "Le prestataire ne s'évalue qu'une fois l'incident RESOLU ou FERME.");
    }
    if (!incident.assigneAId) throw new IncidentError("UNPROCESSABLE_ENTITY", "Aucun prestataire n'est assigné à cet incident.");
    if (incident.notePrestataire !== null) throw new IncidentError("INCIDENT_DEJA_EVALUE", "Ce prestataire a déjà été évalué pour cet incident.");
    const maj = await db.incident.update({
      where: { id: incidentId },
      data: { notePrestataire: input.note, commentairePrestataire: input.commentaire ?? null, evalueLe: new Date() },
    });
    // Recalcul de la moyenne par la fonction SECURITY DEFINER `prestataire_recalculer_note`
    // (migration m16) : un résident ne voit pas la table prestataire sous RLS, il ne doit pas
    // pouvoir la lire pour autant — la fonction ne renvoie que la moyenne.
    const rows = await db.$queryRaw<{ note_moyenne: string | null; nb: number }[]>`
      SELECT public.prestataire_recalculer_note(${incident.assigneAId}::uuid)::text AS note_moyenne,
             (SELECT count(*)::int FROM public.prestataire_notes(${incident.assigneAId}::uuid)) AS nb
    `;
    const { note_moyenne, nb } = rows[0] ?? { note_moyenne: null, nb: 0 };
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "INCIDENT_PRESTATAIRE_EVALUE",
      entite: "incident",
      entiteId: incidentId,
      apres: { prestataire_id: incident.assigneAId, note: input.note, note_moyenne, nb_evaluations: nb },
    });
    return { incident: maj, prestataire_id: incident.assigneAId, note_moyenne: note_moyenne ? money(note_moyenne).toFixed(2) : null, nb_evaluations: nb };
  });
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
    // Matrice Master Spec 7.1 : "Changement de statut ticket incident → Push → Créateur du
    // ticket" (pas d'auto-notification si le créateur change lui-même le statut).
    if (statutAvant !== input.statut && incident.creePar !== ctx.utilisateurId) {
      await envoyerNotification(db, {
        coproprieteId: ctx.coproprieteId,
        utilisateurId: incident.creePar,
        templateCode: "INCIDENT_STATUT_CHANGE",
        canal: "PUSH",
        contenuJson: {
          incident_id: incidentId,
          categorie: incident.categorie,
          statut: input.statut,
        },
      });
    }
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
      // Le prestataire (s'il a un compte) reçoit son ticket à l'instant ; le déclarant est
      // informé de la prise en charge.
      ...(prestataire.utilisateurId
        ? [
            envoyerNotification(db, {
              coproprieteId: ctx.coproprieteId,
              utilisateurId: prestataire.utilisateurId,
              templateCode: "INCIDENT_ASSIGNE",
              canal: "PUSH",
              contenuJson: {
                incident_id: incidentId,
                categorie: incident.categorie,
                sous_categorie: incident.sousCategorie,
              },
            }),
          ]
        : []),
      ...(nouveauStatut !== statutAvant && incident.creePar !== ctx.utilisateurId
        ? [
            envoyerNotification(db, {
              coproprieteId: ctx.coproprieteId,
              utilisateurId: incident.creePar,
              templateCode: "INCIDENT_STATUT_CHANGE",
              canal: "PUSH",
              contenuJson: {
                incident_id: incidentId,
                categorie: incident.categorie,
                statut: nouveauStatut,
              },
            }),
          ]
        : []),
    ]);
    return updated;
  });
}

export async function creerPrestataire(ctx: TenantContext, input: PrestataireCreateInput) {
  if (can("prestataires.gerer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut créer un prestataire.");
  }
  return withTenant(ctx, async (db) => {
    const prestataire = await db.prestataire.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        nom: input.nom,
        specialite: input.specialite,
        // `contact` (M7) reste renseigné pour les clients existants : téléphone ou email structuré sinon.
        contact: input.contact ?? input.telephone ?? input.email ?? "",
        utilisateurId: input.utilisateur_id ?? null,
        ice: input.ice ?? null,
        rc: input.rc ?? null,
        adresse: input.adresse ?? null,
        email: input.email ?? null,
        telephone: input.telephone ?? (input.contact && /^\+?[0-9 .-]{8,20}$/.test(input.contact) ? input.contact : null),
        rib: input.rib ?? null,
        notes: input.notes ?? null,
      },
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "PRESTATAIRE_CREE",
      entite: "prestataire",
      entiteId: prestataire.id,
      apres: { nom: prestataire.nom, specialite: prestataire.specialite, rib_renseigne: Boolean(prestataire.rib) },
    });
    return presenterPrestataire(prestataire);
  });
}

export async function listerPrestataires(ctx: TenantContext) {
  if (can("prestataires.lire", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à lister les prestataires.");
  }
  return withTenant(ctx, async (db) => {
    const rows = await db.prestataire.findMany({
      where: { coproprieteId: ctx.coproprieteId },
      orderBy: { nom: "asc" },
    });
    return rows.map(presenterPrestataire);
  });
}

/** PATCH /prestataires/:id — fiche et activation (syndic). */
export async function modifierPrestataire(
  ctx: TenantContext,
  prestataireId: string,
  input: PrestataireUpdateInput
) {
  if (can("prestataires.gerer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut modifier un prestataire.");
  }
  return withTenant(ctx, async (db) => {
    const prestataire = await db.prestataire.findUnique({ where: { id: prestataireId } });
    if (!prestataire || prestataire.coproprieteId !== ctx.coproprieteId) {
      throw new PrestataireIntrouvableError("Prestataire introuvable.");
    }
    const maj = await db.prestataire.update({
      where: { id: prestataireId },
      data: {
        ...(input.nom !== undefined ? { nom: input.nom } : {}),
        ...(input.specialite !== undefined ? { specialite: input.specialite } : {}),
        ...(input.contact !== undefined ? { contact: input.contact } : {}),
        ...(input.actif !== undefined ? { actif: input.actif } : {}),
        // M16 — fiche fournisseur (null = effacer le champ).
        ...(input.ice !== undefined ? { ice: input.ice ?? null } : {}),
        ...(input.rc !== undefined ? { rc: input.rc ?? null } : {}),
        ...(input.adresse !== undefined ? { adresse: input.adresse ?? null } : {}),
        ...(input.email !== undefined ? { email: input.email ?? null } : {}),
        ...(input.telephone !== undefined ? { telephone: input.telephone ?? null } : {}),
        ...(input.rib !== undefined ? { rib: input.rib ?? null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
      },
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "PRESTATAIRE_MODIFIE",
      entite: "prestataire",
      entiteId: prestataireId,
      // Jamais le RIB dans l'audit : seulement le fait qu'il a changé.
      avant: { nom: prestataire.nom, actif: prestataire.actif, rib_renseigne: Boolean(prestataire.rib) },
      apres: { nom: maj.nom, actif: maj.actif, rib_renseigne: Boolean(maj.rib), rib_modifie: input.rib !== undefined },
    });
    return presenterPrestataire(maj);
  });
}

/**
 * DELETE /prestataires/:id — suppression (syndic). Refusée (409) si des incidents lui ont été
 * assignés (traçabilité des interventions) : le désactiver est alors la bonne action.
 */
export async function supprimerPrestataire(ctx: TenantContext, prestataireId: string) {
  if (can("prestataires.gerer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut supprimer un prestataire.");
  }
  return withTenant(ctx, async (db) => {
    const prestataire = await db.prestataire.findUnique({ where: { id: prestataireId } });
    if (!prestataire || prestataire.coproprieteId !== ctx.coproprieteId) {
      throw new PrestataireIntrouvableError("Prestataire introuvable.");
    }
    const assignes = await db.incident.count({ where: { assigneAId: prestataireId } });
    if (assignes > 0) {
      throw new ContrainteMetierError(
        "Ce prestataire a des interventions dans l'historique : désactivez-le plutôt que de le supprimer."
      );
    }
    await db.prestataire.delete({ where: { id: prestataireId } });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "PRESTATAIRE_SUPPRIME",
      entite: "prestataire",
      entiteId: prestataireId,
      avant: { nom: prestataire.nom, specialite: prestataire.specialite },
    });
    return { id: prestataireId };
  });
}
