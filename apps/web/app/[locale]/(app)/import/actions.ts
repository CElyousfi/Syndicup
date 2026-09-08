"use server";

/** Server Actions — Import Excel & onboarding (M24). Le fichier est téléversé vers le stockage depuis l'action (URL signée), puis analysé par l'API. */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { DemoCopropriete, ImportJob } from "../../../../lib/api/types";

const BASE = "/import";
function champ(fd: FormData, name: string): string { return String(fd.get(name) ?? "").trim(); }
function optionnel(fd: FormData, name: string): string | null { const v = champ(fd, name); return v === "" ? null : v; }
function revalider(locale: string, ...suffixes: string[]) {
  for (const s of [BASE, "/tableau-de-bord", "/lots", "/invitations", ...suffixes]) revalidatePath(`/${locale}${s}`);
}

export async function creerImport(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const f = fd.get("fichier");
  if (!(f instanceof File) || f.size === 0) return { status: "error", code: "VALIDATION_ERROR", message: "Choisissez un fichier xlsx ou csv.", fields: { fichier: "Fichier requis." } };
  if (f.size > 20 * 1024 * 1024) return { status: "error", code: "VALIDATION_ERROR", message: "Fichier trop lourd (20 Mo max).", fields: { fichier: "20 Mo max." } };
  const contentType = f.type || (f.name.toLowerCase().endsWith(".csv") ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const prep = await apiFetch<{ storage_path: string; upload_url: string }>("/import/upload-url", { method: "POST", body: { nom_fichier: f.name || "import.xlsx", content_type: contentType } });
  if (!prep.ok) return fromApiError(prep);
  const up = await fetch(prep.data.upload_url, { method: "PUT", headers: { "Content-Type": contentType, "x-upsert": "true" }, body: await f.arrayBuffer() });
  if (!up.ok) return { status: "error", code: "INTERNAL_ERROR", message: `Téléversement refusé par le stockage (${up.status}).` };
  const canal = optionnel(fd, "canal");
  const res = await apiFetch<ImportJob>("/import", { method: "POST", body: { type: champ(fd, "type"), storage_path: prep.data.storage_path, nom_fichier: f.name || "import.xlsx", options: { inviter: champ(fd, "inviter") !== "off", ...(canal ? { canal } : {}), ...(optionnel(fd, "date_reference") ? { date_reference: champ(fd, "date_reference") } : {}) } } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  redirect(`/${locale}${BASE}/${res.data.id}`);
}

export async function modifierMapping(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "import_id");
  const nb = Number(champ(fd, "nb_colonnes")) || 0;
  const colonnes = Array.from({ length: nb }, (_, i) => ({ index: i, champ: optionnel(fd, `colonne_${i}`) }));
  const canal = optionnel(fd, "canal");
  const res = await apiFetch<ImportJob>(`/import/${id}/mapping`, { method: "PATCH", body: { colonnes, options: { inviter: champ(fd, "inviter") !== "off", ...(canal ? { canal } : {}), ...(optionnel(fd, "date_reference") ? { date_reference: champ(fd, "date_reference") } : {}) } } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success(undefined, { statut: res.data.statut });
}

export async function executerImport(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "import_id");
  const res = await apiFetch<ImportJob>(`/import/${id}/executer`, { method: "POST" });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success(undefined, { statut: res.data.statut });
}

export async function annulerImport(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "import_id");
  const res = await apiFetch<ImportJob>(`/import/${id}/annuler`, { method: "POST" });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success();
}

/** Progression (appelée par le client toutes les 2 s pendant l'exécution). */
export async function etatImport(id: string): Promise<ImportJob | null> {
  const res = await apiFetch<ImportJob>(`/import/${id}`);
  return res.ok ? res.data : null;
}

export async function envoyerInvitationsMasse(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const importJobId = optionnel(fd, "import_job_id");
  const res = await apiFetch<{ canal: string; total: number; envoyees: number; sans_contact: number; echouees: number }>("/invitations/envoyer-en-masse", { method: "POST", body: { canal: champ(fd, "canal"), ...(importJobId ? { import_job_id: importJobId } : {}) } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}

export async function creerDemo(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const jours = Number(champ(fd, "jours")) || 30;
  const res = await apiFetch<DemoCopropriete>(`/coproprietes/${champ(fd, "copropriete_id")}/demo`, { method: "POST", body: { ...(optionnel(fd, "nom") ? { nom: champ(fd, "nom") } : {}), jours } });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/admin`);
  return success(undefined, res.data);
}
