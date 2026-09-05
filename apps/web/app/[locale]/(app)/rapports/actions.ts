"use server";

/** Server Actions — Rapports (M18). Génération / soumission = écritures probantes : `idempotent: true`. */
import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { RapportGestion } from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string { return String(fd.get(name) ?? "").trim(); }
function revalider(locale: string, ...paths: string[]) {
  for (const p of ["/rapports", "/rapports/gestion", "/rapports/transparence", "/documents", ...paths]) revalidatePath(`/${locale}${p}`);
}

export async function genererRapport(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const budget = champ(fd, "budget_ag_id");
  const res = await apiFetch<RapportGestion>("/rapports/gestion", { method: "POST", idempotent: true, body: { exercice: champ(fd, "exercice"), budget_ag_id: budget || null } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/rapports/gestion/${res.data.id}`);
  return success(undefined, { id: res.data.id, regenere: res.data.regenere === true, pdf_erreur: res.data.pdf_erreur ?? null, statut: res.data.statut });
}

export async function soumettreRapportAg(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "rapport_id");
  const majorite = champ(fd, "type_majorite");
  const res = await apiFetch<RapportGestion>(`/rapports/gestion/${id}/soumettre-ag`, { method: "POST", idempotent: true, body: { ag_id: champ(fd, "ag_id"), ...(majorite ? { type_majorite: majorite } : {}) } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/rapports/gestion/${id}`, `/ag/${champ(fd, "ag_id")}`);
  return success(undefined, { statut: res.data.statut });
}

export async function definirFacturesVisibles(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<{ factures_visibles_residents: boolean }>(`/coproprietes/${champ(fd, "copropriete_id")}/transparence`, { method: "PATCH", body: { factures_visibles_residents: champ(fd, "visible") === "1" } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, { visible: res.data.factures_visibles_residents });
}
