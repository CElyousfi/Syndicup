"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type {
  AgProcuration,
  AgResolution,
  AgVote,
  AssembleeGenerale,
  ClotureAgResult,
} from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

export async function creerAg(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  // datetime-local → ISO UTC exigé par l'API (z.string().datetime()).
  const brute = champ(fd, "date_ag");
  const dateAg = brute ? new Date(brute).toISOString() : "";
  const res = await apiFetch<AssembleeGenerale>("/ag", {
    method: "POST",
    body: { type: champ(fd, "type"), date_ag: dateAg },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/ag`);
  redirect(`/${locale}/ag/${res.data.id}`);
}

export async function ajouterResolution(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const agId = champ(fd, "ag_id");
  const res = await apiFetch<AgResolution>(`/ag/${agId}/resolutions`, {
    method: "POST",
    body: {
      ordre: Number(champ(fd, "ordre")),
      texte: champ(fd, "texte"),
      type_majorite: champ(fd, "type_majorite"),
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/ag/${agId}`);
  return success();
}

export async function convoquerAg(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const agId = champ(fd, "ag_id");
  const res = await apiFetch<AssembleeGenerale>(`/ag/${agId}/convoquer`, { method: "POST" });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/ag/${agId}`);
  return success();
}

export async function ouvrirAg(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const agId = champ(fd, "ag_id");
  const res = await apiFetch<AssembleeGenerale>(`/ag/${agId}/ouvrir`, { method: "POST" });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/ag/${agId}`);
  redirect(`/${locale}/ag/${agId}/seance`);
}

export async function annulerAg(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const agId = champ(fd, "ag_id");
  const res = await apiFetch<AssembleeGenerale>(`/ag/${agId}/annuler`, {
    method: "POST",
    body: { motif: champ(fd, "motif") },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/ag/${agId}`);
  return success();
}

export async function finaliserResolution(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const agId = champ(fd, "ag_id");
  const res = await apiFetch<AgResolution>(
    `/ag/${agId}/resolutions/${champ(fd, "resolution_id")}/finaliser`,
    { method: "POST" }
  );
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/ag/${agId}`);
  return success(undefined, { resultat: res.data.resultat });
}

/** Clôture — irréversible : fige les résultats et génère le PV (hash d'intégrité). */
export async function cloturerAg(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const agId = champ(fd, "ag_id");
  const res = await apiFetch<ClotureAgResult>(`/ag/${agId}/cloturer`, { method: "POST" });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/ag/${agId}`);
  redirect(`/${locale}/ag/${agId}/pv`);
}

/** Vote — écriture probante et immuable : Idempotency-Key obligatoire. */
export async function voter(_prev: FormState, fd: FormData): Promise<FormState> {
  const agId = champ(fd, "ag_id");
  const procurationId = champ(fd, "procuration_id");
  const lotId = champ(fd, "lot_id");
  const res = await apiFetch<AgVote>(`/ag/${agId}/votes`, {
    method: "POST",
    idempotent: true,
    body: {
      resolution_id: champ(fd, "resolution_id"),
      valeur: champ(fd, "valeur"),
      ...(procurationId
        ? { procuration_id: procurationId, lot_id: lotId || null }
        : { lot_id: lotId }),
    },
  });
  if (!res.ok) return fromApiError(res);
  return success(undefined, {
    resolutionId: res.data.resolutionId,
    valeur: res.data.valeur,
    lotId: res.data.lotId,
  });
}

export async function donnerProcuration(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const agId = champ(fd, "ag_id");
  const mandantId = champ(fd, "mandant_id");
  const res = await apiFetch<AgProcuration>(`/ag/${agId}/procurations`, {
    method: "POST",
    body: {
      lot_id: champ(fd, "lot_id"),
      mandataire_id: champ(fd, "mandataire_id"),
      ...(mandantId ? { mandant_id: mandantId } : {}),
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/ag/${agId}`);
  return success();
}

export async function revoquerProcuration(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const agId = champ(fd, "ag_id");
  const res = await apiFetch<AgProcuration>(
    `/ag/${agId}/procurations/${champ(fd, "procuration_id")}/revoquer`,
    { method: "POST" }
  );
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/ag/${agId}`);
  return success();
}
