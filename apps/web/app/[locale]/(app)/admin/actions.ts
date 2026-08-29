"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { Copropriete } from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

export async function creerCopropriete(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Copropriete>("/coproprietes", {
    method: "POST",
    body: {
      nom: champ(fd, "nom"),
      adresse: champ(fd, "adresse"),
      ville: champ(fd, "ville"),
      type_residence: champ(fd, "type_residence"),
      nb_lots: Number(champ(fd, "nb_lots")),
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/admin`);
  return success(undefined, { id: res.data.id, nom: res.data.nom });
}

/**
 * Première invitation SYNDIC d'une copropriété (assistant + fiche client) — permission
 * explicitement ouverte au super_admin dans la matrice (apps/api/lib/auth/permissions.ts).
 * La copropriété cible est passée explicitement à l'API : l'opérateur n'entre jamais
 * dans l'espace du client — tout le reste (lots, résidents…) revient au syndic invité.
 */
export async function inviterSyndicAdmin(_prev: FormState, fd: FormData): Promise<FormState> {
  const coproprieteId = champ(fd, "copropriete_id");
  const res = await apiFetch<{ code: string; expireLe: string }>("/invitations", {
    method: "POST",
    coproprieteId,
    body: { role_cible: "SYNDIC", canal: champ(fd, "canal") || "EMAIL", lot_id: null },
  });
  if (!res.ok) return fromApiError(res);
  return success(undefined, { code: res.data.code, expireLe: res.data.expireLe });
}
