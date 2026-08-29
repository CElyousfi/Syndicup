/**
 * Service documents — M9 (Master Spec Partie 9, Doc A §12.3).
 */
import { randomUUID } from "node:crypto";
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import { creerUrlSignee, creerUrlUploadSignee, supprimerObjet } from "../storage/supabase-storage";
import type { TenantContext } from "../tenant/context";
import { ecrireAuditLog } from "../audit/audit";
import { envoyerNotification } from "../notifications/notifications";
import type { DocumentCreateInput, DocumentUploadUrlInput } from "./schemas";

export class PermissionRefuseeError extends Error {}
export class IntrouvableError extends Error {}
export class ContrainteMetierError extends Error {}

/**
 * POST /documents/upload-url — prépare un téléversement : chemin canonique dans le périmètre du
 * tenant + URL signée d'upload (2 h). Le client téléverse directement au Storage (exception
 * d'architecture autorisée) puis enregistre les métadonnées via POST /documents.
 */
export async function preparerUpload(ctx: TenantContext, input: DocumentUploadUrlInput) {
  if (can("documents.creer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut téléverser un document.");
  }
  // Nom de fichier assaini : jamais de traversée de chemin, ASCII sûr pour le storage.
  const nomSur = input.nom_fichier
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
  const storagePath = `${ctx.coproprieteId}/documents/${randomUUID()}-${nomSur || "document"}`;
  const { url, token } = await creerUrlUploadSignee(storagePath);
  return { storage_path: storagePath, upload_url: url, token };
}

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
    // Les lecteurs légitimes sont prévenus selon la visibilité (Doc A §12.3) ; un document
    // SYNDIC_ONLY ne déclenche rien — personne d'autre ne doit en connaître l'existence.
    if (document.visibilite !== "SYNDIC_ONLY") {
      const lecteurs = await db.roleUtilisateur.findMany({
        where: {
          coproprieteId: ctx.coproprieteId,
          actif: true,
          utilisateurId: { not: ctx.utilisateurId },
          ...(document.visibilite === "CONSEIL_SYNDICAL"
            ? { role: { in: ["SYNDIC", "CONSEIL_SYNDICAL"] } }
            : {}),
        },
        select: { utilisateurId: true },
        distinct: ["utilisateurId"],
      });
      await Promise.all(
        lecteurs.map((l) =>
          envoyerNotification(db, {
            coproprieteId: ctx.coproprieteId,
            utilisateurId: l.utilisateurId,
            templateCode: "DOCUMENT_PUBLIE",
            canal: "PUSH",
            contenuJson: { document_id: document.id, nom: document.nom, type: document.type },
          })
        )
      );
    }
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

/**
 * DELETE /documents/:id — suppression d'un document téléversé par le syndic (rôle
 * `documents.creer`). Seuls les fichiers du dossier `<copropriete>/documents/` sont
 * supprimables : les PV d'AG et les quittances (générés par la plateforme, valeur probante)
 * ne passent jamais par ici. Objet storage retiré en meilleur effort, puis ligne supprimée
 * et trace d'audit.
 */
export async function supprimerDocument(ctx: TenantContext, documentId: string) {
  if (can("documents.creer", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut supprimer un document.");
  }
  return withTenant(ctx, async (db) => {
    const document = await db.document.findUnique({ where: { id: documentId } });
    if (!document || document.coproprieteId !== ctx.coproprieteId) {
      throw new IntrouvableError("Document introuvable.");
    }
    if (!document.storagePath.startsWith(`${ctx.coproprieteId}/documents/`)) {
      throw new ContrainteMetierError(
        "Ce document est généré par la plateforme (PV, quittance) : il ne peut pas être supprimé."
      );
    }
    await supprimerObjet(document.storagePath);
    await db.document.delete({ where: { id: documentId } });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "DOCUMENT_SUPPRIME",
      entite: "document",
      entiteId: documentId,
      avant: { nom: document.nom, type: document.type, visibilite: document.visibilite },
    });
    return { id: documentId };
  });
}
