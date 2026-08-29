"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { Personnel, Visite } from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

/** H2 — enregistrement d'une visite : écriture probante, Idempotency-Key obligatoire. */
export async function enregistrerVisite(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Visite>("/visites", {
    method: "POST",
    idempotent: true,
    body: {
      lot_id: champ(fd, "lot_id"),
      visiteur_nom: champ(fd, "visiteur_nom"),
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/visites`);
  return success();
}

/** H3 — réponse du résident : transition unique EN_ATTENTE → AUTORISE | REFUSE. */
export async function repondreVisite(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Visite>(`/visites/${champ(fd, "visite_id")}/statut`, {
    method: "PATCH",
    body: { statut: champ(fd, "statut") },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/visites`);
  return success();
}

export async function creerPersonnel(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const logement = champ(fd, "logement_lot_id");
  const res = await apiFetch<Personnel>("/personnel", {
    method: "POST",
    body: {
      utilisateur_id: champ(fd, "utilisateur_id"),
      statut: champ(fd, "statut") || "PRESENT",
      logement_lot_id: logement === "" ? null : logement,
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/personnel`);
  return success();
}

export async function changerStatutPersonnel(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const logement = champ(fd, "logement_lot_id");
  const res = await apiFetch<Personnel>(`/personnel/${champ(fd, "personnel_id")}/statut`, {
    method: "PATCH",
    body: {
      statut: champ(fd, "statut"),
      logement_lot_id: logement === "" ? null : logement,
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/personnel`);
  return success();
}
