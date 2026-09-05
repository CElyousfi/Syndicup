/**
 * M12 — Module copropriétés (Master Spec Partie 2.2/3.2 : le tenant racine).
 *
 * Création : SUPER_ADMIN uniquement — l'id est généré côté application (uuidv7) AVANT la
 * transaction pour ouvrir un contexte tenant sur ce nouvel id (la policy WITH CHECK exige
 * copropriete_id = contexte). Modification : syndic sur SA copropriété ; les paramètres
 * légaux (délai convocation, quorum, procurations) sont saisis ici avec leur valeur
 * juridiquement confirmée — nullable sinon (LEGAL_QUESTIONS_BRIEF, CLAUDE.md §2).
 */
import { uuidv7 } from "uuidv7";
import { Prisma } from "@prisma/client";
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import type { RoleClaim } from "../tenant/jwt";
import { ecrireAuditLog } from "../audit/audit";
import { creerUrlSignee, creerUrlUploadSignee } from "../storage/supabase-storage";
import { randomUUID } from "node:crypto";
import type { LogoUploadUrlInput, PhotoUploadUrlInput } from "./schemas";
import type { CoproprieteCreateInput, CoproprieteUpdateInput } from "./schemas";

export class PermissionRefuseeError extends Error {}
export class CoproprieteIntrouvableError extends Error {}

/**
 * Liste les copropriétés visibles par l'appelant à partir de ses claims JWT VÉRIFIÉS :
 * une transaction withTenant par claim (le contexte RLS ne couvre qu'un tenant à la fois).
 * SUPER_ADMIN : la policy `current_role = 'SUPER_ADMIN'` rend toutes les copropriétés
 * visibles dans une seule transaction.
 */
export async function listerCoproprietes(utilisateurId: string, roles: RoleClaim[]) {
  const superAdmin = roles.find((r) => r.role === "SUPER_ADMIN");
  if (superAdmin) {
    const ctx: TenantContext = {
      utilisateurId,
      coproprieteId: superAdmin.copropriete_id,
      role: "SUPER_ADMIN",
    };
    return withTenant(ctx, (db) => db.copropriete.findMany({ orderBy: { nom: "asc" } }));
  }

  const vues = new Map<string, Awaited<ReturnType<typeof lireUne>>>();
  for (const claim of roles) {
    if (can("coproprietes.lire", claim.role) !== true) continue;
    if (vues.has(claim.copropriete_id)) continue;
    const ctx: TenantContext = {
      utilisateurId,
      coproprieteId: claim.copropriete_id,
      role: claim.role,
    };
    const copro = await lireUne(ctx);
    if (copro) vues.set(claim.copropriete_id, copro);
  }
  return [...vues.values()].filter((c) => c !== null);
}

function lireUne(ctx: TenantContext) {
  return withTenant(ctx, (db) => db.copropriete.findUnique({ where: { id: ctx.coproprieteId } }));
}

export async function obtenirCopropriete(ctx: TenantContext, coproprieteId: string) {
  if (can("coproprietes.lire", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter la copropriété.");
  }
  // Le contexte tenant fait autorité : un id différent de celui du JWT = introuvable (jamais
  // de lecture cross-tenant, RLS en défense en profondeur).
  if (coproprieteId !== ctx.coproprieteId && ctx.role !== "SUPER_ADMIN") {
    throw new CoproprieteIntrouvableError("Copropriété introuvable.");
  }
  const copro = await withTenant(ctx, (db) =>
    db.copropriete.findUnique({ where: { id: coproprieteId } })
  );
  if (!copro) throw new CoproprieteIntrouvableError("Copropriété introuvable.");
  return copro;
}

export async function obtenirConfig(ctx: TenantContext, coproprieteId: string) {
  if (can("coproprietes.lire_config", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter la configuration.");
  }
  const copro = await obtenirCopropriete(ctx, coproprieteId);
  return { config_json: copro.configJson ?? null };
}

export async function creerCopropriete(
  ctx: TenantContext,
  input: CoproprieteCreateInput
): Promise<Awaited<ReturnType<typeof lireUne>>> {
  if (can("coproprietes.creer", ctx.role) !== true) {
    throw new PermissionRefuseeError(
      "Seul le super_admin peut créer une copropriété (Master Spec Partie 3.2)."
    );
  }
  // uuidv7 généré AVANT withTenant : le contexte tenant de la transaction est celui de la
  // copropriété en cours de création (satisfait le WITH CHECK de la policy tenant_isolation).
  const nouvelleId = uuidv7();
  const ctxCreation: TenantContext = {
    utilisateurId: ctx.utilisateurId,
    coproprieteId: nouvelleId,
    role: "SUPER_ADMIN",
  };
  return withTenant(ctxCreation, async (db) => {
    const copro = await db.copropriete.create({
      data: {
        id: nouvelleId,
        nom: input.nom,
        adresse: input.adresse,
        ville: input.ville,
        typeResidence: input.type_residence,
        nbLots: input.nb_lots,
        configJson: (input.config_json ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    await ecrireAuditLog(db, {
      coproprieteId: nouvelleId,
      acteurId: ctx.utilisateurId,
      action: "COPROPRIETE_CREEE",
      entite: "copropriete",
      entiteId: nouvelleId,
      apres: { nom: copro.nom, ville: copro.ville, type_residence: copro.typeResidence },
    });
    return copro;
  });
}

/**
 * GET /coproprietes/:id/synthese-admin — santé d'une copropriété pour la console opérateur.
 * SUPER_ADMIN uniquement. Compteurs simples + montants en chaînes décimales : aucun calcul
 * monétaire ici (taux etc. côté client via sa librairie centimes — CLAUDE.md §1.1).
 */
export async function syntheseAdmin(ctx: TenantContext, coproprieteId: string) {
  if (ctx.role !== "SUPER_ADMIN") {
    throw new PermissionRefuseeError("Console opérateur : réservée au super_admin.");
  }
  const ctxCible: TenantContext = {
    utilisateurId: ctx.utilisateurId,
    coproprieteId,
    role: "SUPER_ADMIN",
  };
  return withTenant(ctxCible, async (db) => {
    const copro = await db.copropriete.findUnique({ where: { id: coproprieteId } });
    if (!copro) throw new CoproprieteIntrouvableError("Copropriété introuvable.");

    const maintenant = new Date();
    const [
      lots,
      residentsActifs,
      invitationsEnAttente,
      invitationsAcceptees,
      incidentsOuverts,
      slaDepasses,
      documents,
      sommes,
      prochaineAg,
      derniereActivite,
    ] = await Promise.all([
      db.lot.count({ where: { coproprieteId } }),
      db.roleUtilisateur.count({ where: { coproprieteId, actif: true } }),
      db.invitation.count({ where: { coproprieteId, statut: "EN_ATTENTE" } }),
      db.invitation.count({ where: { coproprieteId, statut: "ACCEPTEE" } }),
      db.incident.count({
        where: { coproprieteId, statut: { in: ["OUVERT", "EN_COURS"] } },
      }),
      db.incident.count({
        where: {
          coproprieteId,
          statut: { in: ["OUVERT", "EN_COURS"] },
          slaDeadline: { lt: maintenant },
        },
      }),
      db.document.count({ where: { coproprieteId } }),
      db.appelDeFondsLot.aggregate({
        where: { appelDeFonds: { coproprieteId } },
        _sum: { montantDu: true, montantPaye: true },
      }),
      db.assembleeGenerale.findFirst({
        where: { coproprieteId, statut: { in: ["PLANIFIEE", "CONVOQUEE", "EN_COURS"] } },
        orderBy: { dateAg: "asc" },
        select: { id: true, dateAg: true, type: true, statut: true },
      }),
      db.auditLog.findFirst({
        where: { coproprieteId },
        orderBy: { horodatage: "desc" },
        select: { horodatage: true },
      }),
    ]);

    return {
      lots,
      residents_actifs: residentsActifs,
      invitations_en_attente: invitationsEnAttente,
      invitations_acceptees: invitationsAcceptees,
      incidents_ouverts: incidentsOuverts,
      sla_depasses: slaDepasses,
      documents,
      montant_du: (sommes._sum.montantDu ?? 0).toString(),
      montant_paye: (sommes._sum.montantPaye ?? 0).toString(),
      prochaine_ag: prochaineAg
        ? {
            id: prochaineAg.id,
            date_ag: prochaineAg.dateAg.toISOString(),
            type: prochaineAg.type,
            statut: prochaineAg.statut,
          }
        : null,
      derniere_activite: derniereActivite?.horodatage.toISOString() ?? null,
    };
  });
}

export async function modifierCopropriete(
  ctx: TenantContext,
  coproprieteId: string,
  input: CoproprieteUpdateInput
) {
  if (can("coproprietes.modifier", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut modifier sa copropriété.");
  }
  if (coproprieteId !== ctx.coproprieteId && ctx.role !== "SUPER_ADMIN") {
    throw new CoproprieteIntrouvableError("Copropriété introuvable.");
  }
  return withTenant(ctx, async (db) => {
    const avant = await db.copropriete.findUnique({ where: { id: coproprieteId } });
    if (!avant) throw new CoproprieteIntrouvableError("Copropriété introuvable.");

    const data: Prisma.CoproprieteUpdateInput = {};
    if (input.nom !== undefined) data.nom = input.nom;
    if (input.adresse !== undefined) data.adresse = input.adresse;
    if (input.ville !== undefined) data.ville = input.ville;
    if (input.nb_lots !== undefined) data.nbLots = input.nb_lots;
    if (input.config_json !== undefined)
      data.configJson = (input.config_json ?? Prisma.DbNull) as Prisma.InputJsonValue;
    if (input.politique_recouvrement_json !== undefined)
      data.politiqueRecouvrementJson = (input.politique_recouvrement_json ??
        Prisma.DbNull) as Prisma.InputJsonValue;
    if (input.total_tantiemes !== undefined) data.totalTantiemes = input.total_tantiemes;
    if (input.logo_storage_path !== undefined) {
      // Défense en profondeur : le logo vit dans le périmètre storage de CETTE copropriété.
      if (input.logo_storage_path && !input.logo_storage_path.startsWith(`${coproprieteId}/branding/`)) {
        throw new PermissionRefuseeError("Logo hors du périmètre de la copropriété.");
      }
      data.logoStoragePath = input.logo_storage_path ?? null;
    }
    if (input.photos_json !== undefined) {
      // Même périmètre que le logo : chaque chemin appartient au dossier branding de CETTE copropriété.
      for (const chemin of Object.values(input.photos_json ?? {})) {
        if (!chemin.startsWith(`${coproprieteId}/branding/`)) {
          throw new PermissionRefuseeError("Photo hors du périmètre de la copropriété.");
        }
      }
      data.photosJson = (input.photos_json ?? Prisma.DbNull) as Prisma.InputJsonValue;
    }
    if (input.delai_convocation_jours !== undefined)
      data.delaiConvocationJours = input.delai_convocation_jours;
    if (input.quorum_premiere_convocation !== undefined)
      data.quorumPremiereConvocation = input.quorum_premiere_convocation;
    if (input.limite_procurations_mandataire !== undefined)
      data.limiteProcurationsMandataire = input.limite_procurations_mandataire;
    if (input.retention_desactivation_mois !== undefined)
      data.retentionDesactivationMois = input.retention_desactivation_mois;

    const maj = await db.copropriete.update({ where: { id: coproprieteId }, data });

    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "COPROPRIETE_MODIFIEE",
      entite: "copropriete",
      entiteId: coproprieteId,
      avant: {
        nom: avant.nom,
        nb_lots: avant.nbLots,
        delai_convocation_jours: avant.delaiConvocationJours,
        quorum_premiere_convocation: avant.quorumPremiereConvocation?.toString() ?? null,
        limite_procurations_mandataire: avant.limiteProcurationsMandataire,
        retention_desactivation_mois: avant.retentionDesactivationMois,
        total_tantiemes: avant.totalTantiemes?.toString() ?? null,
      },
      apres: {
        nom: maj.nom,
        nb_lots: maj.nbLots,
        delai_convocation_jours: maj.delaiConvocationJours,
        quorum_premiere_convocation: maj.quorumPremiereConvocation?.toString() ?? null,
        limite_procurations_mandataire: maj.limiteProcurationsMandataire,
        retention_desactivation_mois: maj.retentionDesactivationMois,
        total_tantiemes: maj.totalTantiemes?.toString() ?? null,
      },
    });
    return maj;
  });
}

/** POST /coproprietes/:id/logo/upload-url — téléversement direct du logo (syndic). */
export async function preparerUploadLogo(ctx: TenantContext, coproprieteId: string, input: LogoUploadUrlInput) {
  if (can("coproprietes.modifier", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut modifier le logo.");
  }
  if (coproprieteId !== ctx.coproprieteId && ctx.role !== "SUPER_ADMIN") {
    throw new CoproprieteIntrouvableError("Copropriété introuvable.");
  }
  const ext = input.content_type === "image/png" ? "png" : input.content_type === "image/webp" ? "webp" : input.content_type === "image/svg+xml" ? "svg" : "jpg";
  const storagePath = `${coproprieteId}/branding/logo-${randomUUID()}.${ext}`;
  const { url, token } = await creerUrlUploadSignee(storagePath);
  return { storage_path: storagePath, upload_url: url, token };
}

/** GET /coproprietes/:id/logo — URL signée courte du logo (tout membre), null sans logo. */
export async function urlLogo(ctx: TenantContext, coproprieteId: string) {
  if (can("coproprietes.lire", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé.");
  }
  if (coproprieteId !== ctx.coproprieteId && ctx.role !== "SUPER_ADMIN") {
    throw new CoproprieteIntrouvableError("Copropriété introuvable.");
  }
  const copro = await withTenant(ctx, (db) => db.copropriete.findUnique({ where: { id: coproprieteId }, select: { logoStoragePath: true } }));
  if (!copro) throw new CoproprieteIntrouvableError("Copropriété introuvable.");
  if (!copro.logoStoragePath) return { url: null };
  return { url: await creerUrlSignee(copro.logoStoragePath) };
}

/**
 * POST /coproprietes/:id/photos/upload-url — téléversement direct d'une photo de la résidence
 * (syndic). Le chemin porte l'emplacement (`photo-accueil-…`) pour rester lisible dans le bucket ;
 * il est ensuite enregistré dans `photos_json` via PATCH.
 */
export async function preparerUploadPhoto(ctx: TenantContext, coproprieteId: string, input: PhotoUploadUrlInput) {
  if (can("coproprietes.modifier", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut modifier les photos de la résidence.");
  }
  if (coproprieteId !== ctx.coproprieteId && ctx.role !== "SUPER_ADMIN") {
    throw new CoproprieteIntrouvableError("Copropriété introuvable.");
  }
  const ext = input.content_type === "image/png" ? "png" : input.content_type === "image/webp" ? "webp" : input.content_type === "image/svg+xml" ? "svg" : "jpg";
  const cle = input.cle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const storagePath = `${coproprieteId}/branding/photo-${cle}-${randomUUID()}.${ext}`;
  const { url, token } = await creerUrlUploadSignee(storagePath);
  return { storage_path: storagePath, upload_url: url, token };
}

/**
 * GET /coproprietes/:id/photos — URLs signées courtes de toutes les photos personnalisées
 * (tout membre) : `{ photos: { cle: url } }`, carte vide sans personnalisation.
 */
export async function urlsPhotos(ctx: TenantContext, coproprieteId: string) {
  if (can("coproprietes.lire", ctx.role) === false) {
    throw new PermissionRefuseeError("Rôle non autorisé.");
  }
  if (coproprieteId !== ctx.coproprieteId && ctx.role !== "SUPER_ADMIN") {
    throw new CoproprieteIntrouvableError("Copropriété introuvable.");
  }
  const copro = await withTenant(ctx, (db) => db.copropriete.findUnique({ where: { id: coproprieteId }, select: { photosJson: true } }));
  if (!copro) throw new CoproprieteIntrouvableError("Copropriété introuvable.");
  const chemins = (copro.photosJson ?? {}) as Record<string, string>;
  const entrees = await Promise.all(
    Object.entries(chemins)
      .filter(([, chemin]) => typeof chemin === "string" && chemin.startsWith(`${coproprieteId}/branding/`))
      .map(async ([cle, chemin]) => [cle, await creerUrlSignee(chemin)] as const)
  );
  return { photos: Object.fromEntries(entrees) as Record<string, string> };
}
