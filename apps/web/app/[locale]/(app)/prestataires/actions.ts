"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { Prestataire } from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

function optionnel(fd: FormData, name: string): string | null {
  const v = champ(fd, name);
  return v === "" ? null : v;
}

export async function modifierPrestataire(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "prestataire_id");
  // M16 — fiche fournisseur : les champs absents du formulaire ne sont pas envoyés ; le RIB n'est
  // envoyé que s'il a été ressaisi (le champ est vide par défaut — jamais pré-rempli en clair).
  const rib = optionnel(fd, "rib");
  const res = await apiFetch<Prestataire>(`/prestataires/${id}`, {
    method: "PATCH",
    body: {
      nom: champ(fd, "nom"),
      specialite: champ(fd, "specialite"),
      contact: champ(fd, "contact") || optionnel(fd, "telephone") || optionnel(fd, "email") || undefined,
      actif: fd.get("actif") === "on",
      ...(fd.has("telephone") ? { telephone: optionnel(fd, "telephone") } : {}),
      ...(fd.has("email") ? { email: optionnel(fd, "email") } : {}),
      ...(fd.has("ice") ? { ice: optionnel(fd, "ice") } : {}),
      ...(fd.has("rc") ? { rc: optionnel(fd, "rc") } : {}),
      ...(fd.has("adresse") ? { adresse: optionnel(fd, "adresse") } : {}),
      ...(fd.has("notes") ? { notes: optionnel(fd, "notes") } : {}),
      ...(rib ? { rib: rib.replace(/\s+/g, "") } : {}),
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/prestataires`);
  revalidatePath(`/${locale}/prestataires/${id}`);
  return success();
}

/** Bascule actif/inactif en un clic — la voie recommandée quand la suppression est refusée. */
export async function basculerPrestataire(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Prestataire>(`/prestataires/${champ(fd, "prestataire_id")}`, {
    method: "PATCH",
    body: { actif: champ(fd, "actif") === "true" },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/prestataires`);
  return success();
}

export async function supprimerPrestataire(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<{ id: string }>(`/prestataires/${champ(fd, "prestataire_id")}`, {
    method: "DELETE",
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/prestataires`);
  return success();
}
