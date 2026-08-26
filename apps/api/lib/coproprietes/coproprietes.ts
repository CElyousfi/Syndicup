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
    if (input.delai_convocation_jours !== undefined)
      data.delaiConvocationJours = input.delai_convocation_jours;
    if (input.quorum_premiere_convocation !== undefined)
      data.quorumPremiereConvocation = input.quorum_premiere_convocation;
    if (input.limite_procurations_mandataire !== undefined)
      data.limiteProcurationsMandataire = input.limite_procurations_mandataire;

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
        total_tantiemes: avant.totalTantiemes?.toString() ?? null,
      },
      apres: {
        nom: maj.nom,
        nb_lots: maj.nbLots,
        delai_convocation_jours: maj.delaiConvocationJours,
        quorum_premiere_convocation: maj.quorumPremiereConvocation?.toString() ?? null,
        limite_procurations_mandataire: maj.limiteProcurationsMandataire,
        total_tantiemes: maj.totalTantiemes?.toString() ?? null,
      },
    });
    return maj;
  });
}
