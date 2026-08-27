/**
 * Service documents — M9 (Master Spec Partie 9, Doc A §12.3).
 */
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import { creerUrlSignee } from "../storage/supabase-storage";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import type { DocumentCreateInput } from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}

export async function creerDocument(ctx: TenantContext, input: DocumentCreateInput) {
  if (can("documents.creer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut ajouter un document.");
  }
  return withTenant(ctx, async (db) => {
    const document = await db.document.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        type: input.type,
        nom: input.nom,
        visibilite: input.visibilite,
        storagePath: input.storage_path,
        creePar: ctx.utilisateurId,
      },
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "DOCUMENT_CREE",
      entite: "document",
      entiteId: document.id,
      apres: { type: document.type, visibilite: document.visibilite, nom: document.nom },
    });
    return document;
  });
}

/**
 * La liste est déjà filtrée par la policy RLS "tenant_isolation" sur `document` selon
 * `visibilite` (Doc A §12.3, défense en profondeur Partie 1.6) — aucun filtre applicatif
 * supplémentaire nécessaire ici.
 */
export async function listerDocuments(ctx: TenantContext) {
  if (can("documents.lire", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à lister les documents.");
  }
  return withTenant(ctx, (db) =>
    db.document.findMany({ where: { coproprieteId: ctx.coproprieteId }, orderBy: { creeLe: "desc" } })
  );
}

/**
 * Master Spec Partie 9.3 : "accès uniquement via URL signée à durée de vie courte (15 minutes),
 * générée par l'API après vérification RLS/permission". Le `findUnique` ci-dessous passe par
 * `withTenant` (RLS active) : un document non visible pour ce rôle/tenant renvoie déjà "introuvable"
 * avant même d'atteindre le storage.
 */
export async function obtenirUrlTelechargement(ctx: TenantContext, documentId: string) {
  if (can("documents.lire", ctx.role) !== true) {
    throw new PermissionRefuseeError("Rôle non autorisé à consulter ce document.");
  }
  const document = await withTenant(ctx, (db) => db.document.findUnique({ where: { id: documentId } }));
  if (!document) throw new IntrouvableError("Document introuvable.");
  const url = await creerUrlSignee(document.storagePath);
  return { document, url };
}
