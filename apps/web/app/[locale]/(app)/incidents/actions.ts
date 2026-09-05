"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { Incident, IncidentLog, Prestataire } from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

/**
 * Téléverse les photos du signalement : URL signée par photo (API) → PUT direct vers le
 * Storage (même exception d'architecture que les documents) → chemins renvoyés pour
 * POST /incidents. Le fichier ne touche jamais le disque du serveur web.
 */
async function televerserPhotos(fd: FormData): Promise<string[] | { erreur: FormState }> {
  const fichiers = fd
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, 5);
  const chemins: string[] = [];
  for (const fichier of fichiers) {
    const prep = await apiFetch<{ storage_path: string; upload_url: string }>(
      "/incidents/upload-url",
      {
        method: "POST",
        body: {
          nom_fichier: fichier.name || "photo.jpg",
          content_type: fichier.type || "image/jpeg",
        },
      }
    );
    if (!prep.ok) return { erreur: fromApiError(prep) };
    const upload = await fetch(prep.data.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": fichier.type || "image/jpeg",
        "x-upsert": "true",
      },
      body: await fichier.arrayBuffer(),
    });
    if (!upload.ok) {
      return {
        erreur: {
          status: "error",
          code: "INTERNAL_ERROR",
          message: `Téléversement refusé par le stockage (${upload.status}).`,
        },
      };
    }
    chemins.push(prep.data.storage_path);
  }
  return chemins;
}

export async function signalerIncident(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const lotId = champ(fd, "lot_id");
  const description = champ(fd, "description");
  const sejourId = champ(fd, "sejour_id");

  const photos = await televerserPhotos(fd);
  if (!Array.isArray(photos)) return photos.erreur;

  const res = await apiFetch<Incident>("/incidents", {
    method: "POST",
    body: {
      lot_id: lotId === "" ? null : lotId,
      categorie: champ(fd, "categorie"),
      sous_categorie: champ(fd, "sous_categorie"),
      description: description === "" ? null : description,
      partie: champ(fd, "partie"),
      urgence: champ(fd, "urgence"),
      ...(photos.length > 0 ? { photos } : {}),
      ...(sejourId !== "" ? { sejour_id: sejourId } : {}),
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/incidents`);
  redirect(`/${locale}/incidents/${res.data.id}?signale=1`);
}

export async function changerStatutIncident(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const incidentId = champ(fd, "incident_id");
  const commentaire = champ(fd, "commentaire");
  const res = await apiFetch<IncidentLog>(`/incidents/${incidentId}/statut`, {
    method: "PATCH",
    body: {
      statut: champ(fd, "statut"),
      commentaire: commentaire === "" ? null : commentaire,
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/incidents/${incidentId}`);
  return success();
}

export async function assignerIncident(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const incidentId = champ(fd, "incident_id");
  const res = await apiFetch<Incident>(`/incidents/${incidentId}/assign`, {
    method: "POST",
    body: { prestataire_id: champ(fd, "prestataire_id") },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/incidents/${incidentId}`);
  return success();
}

export async function creerPrestataire(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const utilisateurId = champ(fd, "utilisateur_id");
  const res = await apiFetch<Prestataire>("/prestataires", {
    method: "POST",
    body: {
      nom: champ(fd, "nom"),
      specialite: champ(fd, "specialite"),
      contact: champ(fd, "contact") || undefined,
      utilisateur_id: utilisateurId === "" ? null : utilisateurId,
      // M16 — fiche fournisseur (facultatif à la création).
      telephone: champ(fd, "telephone") || null,
      email: champ(fd, "email") || null,
      ice: champ(fd, "ice") || null,
      rc: champ(fd, "rc") || null,
      adresse: champ(fd, "adresse") || null,
      rib: champ(fd, "rib").replace(/\s+/g, "") || null,
      notes: champ(fd, "notes") || null,
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/prestataires`);
  return success();
}
