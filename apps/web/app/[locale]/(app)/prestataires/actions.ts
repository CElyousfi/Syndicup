"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { Prestataire } from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

export async function modifierPrestataire(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Prestataire>(`/prestataires/${champ(fd, "prestataire_id")}`, {
    method: "PATCH",
    body: {
      nom: champ(fd, "nom"),
      specialite: champ(fd, "specialite"),
      contact: champ(fd, "contact"),
      actif: fd.get("actif") === "on",
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/prestataires`);
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
