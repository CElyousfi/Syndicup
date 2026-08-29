"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { DocumentCopro, Notification } from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

/**
 * Téléversement complet : URL signée d'upload (API) → PUT du fichier vers Supabase Storage
 * (exception d'architecture autorisée) → enregistrement des métadonnées (API). Le fichier ne
 * touche jamais le disque du serveur web.
 */
export async function televerserFichierDocument(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const locale = champ(fd, "locale");
  const fichier = fd.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return {
      status: "error",
      code: "VALIDATION_ERROR",
      message: "Fichier manquant.",
      fields: { fichier: "Fichier manquant." },
    };
  }

  const prep = await apiFetch<{ storage_path: string; upload_url: string; token: string }>(
    "/documents/upload-url",
    {
      method: "POST",
      body: {
        nom_fichier: fichier.name,
        content_type: fichier.type || "application/octet-stream",
      },
    }
  );
  if (!prep.ok) return fromApiError(prep);

  const contenu = await fichier.arrayBuffer();
  const upload = await fetch(prep.data.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": fichier.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: contenu,
  });
  if (!upload.ok) {
    return {
      status: "error",
      code: "INTERNAL_ERROR",
      message: `Téléversement refusé par le stockage (${upload.status}).`,
    };
  }

  const res = await apiFetch<DocumentCopro>("/documents", {
    method: "POST",
    body: {
      type: champ(fd, "type"),
      nom: champ(fd, "nom") || fichier.name,
      visibilite: champ(fd, "visibilite"),
      storage_path: prep.data.storage_path,
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/documents`);
  return success();
}

/** L'URL signée (15 min) est générée AU CLIC, jamais stockée — redirection immédiate. */
export async function telechargerDocument(fd: FormData): Promise<void> {
  const id = champ(fd, "document_id");
  const res = await apiFetch<{ url: string }>(`/documents/${id}/download-url`);
  if (res.ok) redirect(res.data.url);
}

export async function marquerNotificationLue(fd: FormData): Promise<void> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "notification_id");
  await apiFetch<Notification>(`/notifications/${id}/read`, { method: "PATCH" });
  revalidatePath(`/${locale}/notifications`);
  revalidatePath(`/${locale}`, "layout");
}

export async function supprimerDocument(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<{ id: string }>(`/documents/${champ(fd, "document_id")}`, {
    method: "DELETE",
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/documents`);
  return success();
}
