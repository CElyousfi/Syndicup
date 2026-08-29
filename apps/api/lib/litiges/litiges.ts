/**
 * Service litiges — M11 (Master Spec Partie 2.2, Doc A §12.1).
 *
 * Workflow Doc A §12.1 : "résident soumet contestation avec motif → Syndic répond → Si non
 * résolu → Médiation AG → Tribunal". `escalade_niveau` encode l'étape courante :
 *   0 = traitement syndic (état initial), 1 = médiation AG, 2 = tribunal.
 * L'escalade est monotone (jamais décrémentée — valeur probante, chaque transition est tracée
 * en audit_log). Le porteur du litige est notifié à chaque escalade (câblage M9).
 *
 * ⚠️ LEGAL_QUESTIONS_BRIEF.md §0 : une étape de conciliation préalable obligatoire (Loi 30-24)
 * pourrait devoir s'insérer avant le niveau tribunal — non modélisée tant que non confirmée.
 */
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import type { LitigeCreateInput, LitigeEscaladerInput, LitigeResoudreInput } from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
export class ContrainteMetierError extends Error {}

/** Libellés du workflow Doc A §12.1 pour les traces/notifications. */
export const NIVEAUX_LITIGE = ["TRAITEMENT_SYNDIC", "MEDIATION_AG", "TRIBUNAL"] as const;

export async function creerLitige(ctx: TenantContext, input: LitigeCreateInput) {
  if (can("litiges.creer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à déclarer un litige.");
  }
  return withTenant(ctx, async (db) => {
    const litige = await db.conflitLitige.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        type: input.type,
        description: input.description,
        creePar: ctx.utilisateurId,
      },
    });
    const syndics = await db.roleUtilisateur.findMany({
      where: { coproprieteId: ctx.coproprieteId, actif: true, role: "SYNDIC" },
      select: { utilisateurId: true },
    });
    await Promise.all([
      ecrireAuditLog(db, {
        coproprieteId: ctx.coproprieteId,
        acteurId: ctx.utilisateurId,
        action: "LITIGE_DECLARE",
        entite: "conflit_litige",
        entiteId: litige.id,
        apres: { type: input.type },
      }),
      // Le syndic est prévenu à l'instant d'un nouveau litige à traiter.
      ...syndics
        .filter((s) => s.utilisateurId !== ctx.utilisateurId)
        .map((s) =>
          envoyerNotification(db, {
            coproprieteId: ctx.coproprieteId,
            utilisateurId: s.utilisateurId,
            templateCode: "LITIGE_NOUVEAU",
            canal: "PUSH",
            contenuJson: { litige_id: litige.id, type: input.type },
          })
        ),
    ]);
    return litige;
  });
}

export async function listerLitiges(ctx: TenantContext) {
  const permission = can("litiges.lire", ctx.role);
  if (permission === false) {
    throw new PermissionRefuseeError("Rôle non autorisé à lister les litiges.");
  }
  return withTenant(ctx, (db) =>
    // La policy RLS filtre déjà (résident → cree_par = lui) — WHERE applicatif en plus,
    // défense en profondeur (Partie 1.6).
    db.conflitLitige.findMany({
      where: {
        coproprieteId: ctx.coproprieteId,
        ...(permission === "scoped" ? { creePar: ctx.utilisateurId } : {}),
      },
      orderBy: { creeLe: "desc" },
    })
  );
}

/**
 * Doc A §12.1 : escalade monotone niveau + 1 (0 → 1 médiation AG, 1 → 2 tribunal). Refusée sur
 * un litige déjà RESOLU/CLOS ou déjà au niveau tribunal.
 */
export async function escaladerLitige(ctx: TenantContext, litigeId: string, input: LitigeEscaladerInput) {
  if (can("litiges.escalader", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seuls le syndic et le conseil syndical peuvent escalader un litige.");
  }
  return withTenant(ctx, async (db) => {
    const litige = await db.conflitLitige.findUnique({ where: { id: litigeId } });
    if (!litige) throw new IntrouvableError("Litige introuvable.");
    if (litige.statut !== "OUVERT") {
      throw new ContrainteMetierError(`Escalade impossible sur un litige ${litige.statut}.`);
    }
    if (litige.escaladeNiveau >= NIVEAUX_LITIGE.length - 1) {
      throw new ContrainteMetierError(
        "Le litige est déjà au niveau TRIBUNAL (Doc A §12.1) — aucune escalade supplémentaire possible."
      );
    }
    const nouveauNiveau = litige.escaladeNiveau + 1;
    const updated = await db.conflitLitige.update({
      where: { id: litigeId },
      data: { escaladeNiveau: nouveauNiveau },
    });
    await Promise.all([
      ecrireAuditLog(db, {
        coproprieteId: ctx.coproprieteId,
        acteurId: ctx.utilisateurId,
        action: "LITIGE_ESCALADE",
        entite: "conflit_litige",
        entiteId: litigeId,
        avant: { escalade_niveau: litige.escaladeNiveau, libelle: NIVEAUX_LITIGE[litige.escaladeNiveau] },
        apres: { escalade_niveau: nouveauNiveau, libelle: NIVEAUX_LITIGE[nouveauNiveau], motif: input.motif },
      }),
      // Le porteur du litige est informé de l'escalade — sauf si c'est lui qui escalade.
      litige.creePar !== ctx.utilisateurId
        ? envoyerNotification(db, {
            coproprieteId: ctx.coproprieteId,
            utilisateurId: litige.creePar,
            templateCode: "LITIGE_ESCALADE",
            canal: "EMAIL",
            contenuJson: { litige_id: litigeId, niveau: NIVEAUX_LITIGE[nouveauNiveau], motif: input.motif },
          })
        : Promise.resolve(null),
    ]);
    return updated;
  });
}

/**
 * Sortie de workflow (ajout nécessaire — Doc A §12.1 "Explication syndic suffit souvent") :
 * RESOLU (issue trouvée) ou CLOS (classé sans résolution interne, ex. décision judiciaire
 * externe enregistrée). Motif obligatoire, transition unique depuis OUVERT.
 */
export async function resoudreLitige(ctx: TenantContext, litigeId: string, input: LitigeResoudreInput) {
  if (can("litiges.resoudre", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut clôturer un litige.");
  }
  return withTenant(ctx, async (db) => {
    const litige = await db.conflitLitige.findUnique({ where: { id: litigeId } });
    if (!litige) throw new IntrouvableError("Litige introuvable.");
    if (litige.statut !== "OUVERT") {
      throw new ContrainteMetierError(`Le litige est déjà ${litige.statut}.`);
    }
    const updated = await db.conflitLitige.update({
      where: { id: litigeId },
      data: { statut: input.statut },
    });
    await Promise.all([
      ecrireAuditLog(db, {
        coproprieteId: ctx.coproprieteId,
        acteurId: ctx.utilisateurId,
        action: "LITIGE_CLOTURE",
        entite: "conflit_litige",
        entiteId: litigeId,
        avant: { statut: "OUVERT" },
        apres: { statut: input.statut, motif: input.motif },
      }),
      litige.creePar !== ctx.utilisateurId
        ? envoyerNotification(db, {
            coproprieteId: ctx.coproprieteId,
            utilisateurId: litige.creePar,
            templateCode: "LITIGE_CLOTURE",
            canal: "EMAIL",
            contenuJson: { litige_id: litigeId, statut: input.statut, motif: input.motif },
          })
        : Promise.resolve(null),
    ]);
    return updated;
  });
}
