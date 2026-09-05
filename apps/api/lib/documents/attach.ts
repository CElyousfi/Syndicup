/**
 * Pièces jointes de module — M16 (partagé M16→M25). Une seule implémentation pour :
 *   - préparer un téléversement (chemin canonique `<copropriete>/<module>/<uuid>-<nom>` dans le
 *     bucket privé + URL signée d'upload 2 h) ;
 *   - vérifier qu'un chemin fourni par le client vit dans le périmètre du tenant ET du module
 *     (défense en profondeur : un chemin bien formé d'une autre copropriété est rejeté) ;
 *   - attacher le fichier comme ligne `document` (typée, visibilité explicite) ;
 *   - produire des URLs signées de lecture (15 min, Master Spec Partie 9.3).
 * Tout fichier de tout module est une ligne `document` — jamais une table de fichiers par module.
 */
import { randomUUID } from "node:crypto";
import type { Document } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import type { TenantDb } from "../tenant/db";
import { creerUrlSignee, creerUrlUploadSignee } from "../storage/supabase-storage";
import type { TypeDocumentSysteme } from "./types";

export type ModuleDocument = "depenses" | "justificatifs" | "rapports" | "contrats" | "personnel" | "communication" | "taches" | "parkings" | "import";

export class CheminHorsPerimetreError extends Error {}

/** Nom de fichier assaini : ASCII sûr, jamais de traversée de chemin (même règle que documents.ts). */
export function assainirNomFichier(nom: string, defaut = "document"): string {
  const sur = nom
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
  return sur || defaut;
}

/** Chemin canonique d'un fichier de module dans le périmètre du tenant. */
export function cheminModule(ctx: TenantContext, module: ModuleDocument, nomFichier: string): string {
  return `${ctx.coproprieteId}/${module}/${randomUUID()}-${assainirNomFichier(nomFichier)}`;
}

/** URL signée d'upload (2 h) pour un fichier de module — l'appelant a déjà vérifié la permission. */
export async function preparerUploadModule(ctx: TenantContext, module: ModuleDocument, nomFichier: string) {
  const storagePath = cheminModule(ctx, module, nomFichier);
  const { url, token } = await creerUrlUploadSignee(storagePath);
  return { storage_path: storagePath, upload_url: url, token };
}

/** Le chemin appartient-il au périmètre `<copropriete courante>/<module>/` ? Lève sinon. */
export function assertCheminDansPerimetre(ctx: TenantContext, module: ModuleDocument, chemin: string): void {
  if (!chemin.startsWith(`${ctx.coproprieteId}/${module}/`)) {
    throw new CheminHorsPerimetreError("Fichier hors du périmètre de la copropriété.");
  }
}

/** Expression régulière Zod d'un chemin de module (uuid copro / module / nom assaini). */
export function regexCheminModule(module: ModuleDocument): RegExp {
  return new RegExp(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/${module}/[A-Za-z0-9._-]{1,180}$`, "i");
}

/**
 * Attache un fichier déjà téléversé comme ligne `document`. Appelé DANS la transaction du service
 * (même withTenant) : la ligne document et l'entité qui la référence sont commitées ensemble.
 */
export async function attacherDocument(
  db: TenantDb,
  ctx: TenantContext,
  params: { module: ModuleDocument; type: TypeDocumentSysteme; nom: string; storagePath: string; visibilite: "PUBLIC_COPROPRIETE" | "SYNDIC_ONLY" | "CONSEIL_SYNDICAL" }
): Promise<Document> {
  assertCheminDansPerimetre(ctx, params.module, params.storagePath);
  return db.document.create({
    data: {
      coproprieteId: ctx.coproprieteId,
      type: params.type,
      nom: params.nom.slice(0, 200),
      visibilite: params.visibilite,
      storagePath: params.storagePath,
      creePar: ctx.utilisateurId,
    },
  });
}

/** URLs signées de lecture (15 min) pour des documents déjà filtrés par RLS/permission. */
export async function urlsSigneesDocuments<T extends { id: string; nom: string; type: string; storagePath: string }>(docs: T[]) {
  const urls = await Promise.all(docs.map((d) => creerUrlSignee(d.storagePath)));
  return docs.map((d, i) => ({ document_id: d.id, nom: d.nom, type: d.type, url: urls[i]! }));
}
