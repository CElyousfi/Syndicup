"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { Litige } from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

export async function declarerLitige(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Litige>("/litiges", {
    method: "POST",
    body: { type: champ(fd, "type"), description: champ(fd, "description") },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/litiges`);
  return success();
}

/** Escalade monotone +1 (0 syndic → 1 médiation AG → 2 tribunal) — motif obligatoire. */
export async function escaladerLitige(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Litige>(`/litiges/${champ(fd, "litige_id")}/escalade`, {
    method: "PATCH",
    body: { motif: champ(fd, "motif") },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/litiges`);
  return success();
}

export async function cloturerLitige(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Litige>(`/litiges/${champ(fd, "litige_id")}/statut`, {
    method: "PATCH",
    body: { statut: champ(fd, "statut"), motif: champ(fd, "motif") },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/litiges`);
  return success();
}
