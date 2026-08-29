"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { Profil } from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

export async function modifierProfil(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const langue = champ(fd, "langue_preferee") as "FR" | "AR";
  const res = await apiFetch<Profil>("/users/me", {
    method: "PATCH",
    body: {
      nom: champ(fd, "nom") || undefined,
      prenom: champ(fd, "prenom") || undefined,
      langue_preferee: langue || undefined,
    },
  });
  if (!res.ok) return fromApiError(res);

  // La langue choisie change TOUTE l'interface, y compris le sens de lecture (J1).
  const nouvelleLocale = langue === "AR" ? "ar" : "fr";
  if (nouvelleLocale !== locale) {
    redirect(`/${nouvelleLocale}/profil?enregistre=1`);
  }
  revalidatePath(`/${locale}/profil`);
  return success();
}

export async function anonymiserCompte(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const utilisateurId = champ(fd, "utilisateur_id");
  const res = await apiFetch<{ utilisateur_id: string; statut_compte: string }>(
    `/users/${utilisateurId}/anonymize`,
    { method: "POST", idempotent: true }
  );
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/membres/${utilisateurId}`);
  return success();
}
