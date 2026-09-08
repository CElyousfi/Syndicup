"use server";

/** Server Actions — Tâches (M22). Statut / checklist rejouables ; pièces jointes téléversées depuis l'action. */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { TacheDetail } from "../../../../lib/api/types";

const BASE = "/taches";
function champ(fd: FormData, name: string): string { return String(fd.get(name) ?? "").trim(); }
function optionnel(fd: FormData, name: string): string | null { const v = champ(fd, name); return v === "" ? null : v; }
function revalider(locale: string, ...suffixes: string[]) {
  for (const s of [BASE, "/tableau-de-bord", "/ag", ...suffixes]) revalidatePath(`/${locale}${s}`);
}

async function televerserPieces(fd: FormData, name = "pieces"): Promise<{ storage_path: string; nom: string }[] | { erreur: FormState }> {
  const fichiers = fd.getAll(name).filter((f): f is File => f instanceof File && f.size > 0);
  const out: { storage_path: string; nom: string }[] = [];
  for (const f of fichiers) {
    if (f.size > 15 * 1024 * 1024) return { erreur: { status: "error", code: "VALIDATION_ERROR", message: "Fichier trop lourd (15 Mo max).", fields: { [name]: "15 Mo max." } } };
    const contentType = f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    const prep = await apiFetch<{ storage_path: string; upload_url: string }>("/taches/upload-url", { method: "POST", body: { nom_fichier: f.name || "piece.pdf", content_type: contentType } });
    if (!prep.ok) return { erreur: fromApiError(prep) };
    const up = await fetch(prep.data.upload_url, { method: "PUT", headers: { "Content-Type": contentType, "x-upsert": "true" }, body: await f.arrayBuffer() });
    if (!up.ok) return { erreur: { status: "error", code: "INTERNAL_ERROR", message: `Téléversement refusé par le stockage (${up.status}).` } };
    out.push({ storage_path: prep.data.storage_path, nom: f.name || "piece.pdf" });
  }
  return out;
}

function corps(fd: FormData) {
  const checklist = Array.from({ length: 50 }, (_, i) => champ(fd, `etape_${i + 1}`)).filter(Boolean).map((libelle, i) => ({ id: `c${i + 1}`, libelle, fait: champ(fd, `etape_fait_${i + 1}`) === "on" }));
  const recurrence = optionnel(fd, "recurrence");
  return {
    titre: champ(fd, "titre"),
    description: optionnel(fd, "description"),
    assignee_id: optionnel(fd, "assignee_id"),
    priorite: champ(fd, "priorite") || "NORMALE",
    date_echeance: optionnel(fd, "date_echeance"),
    checklist: checklist.length ? checklist : null,
    recurrence: recurrence ? { frequence: recurrence } : null,
    visible_conseil: champ(fd, "visible_conseil") === "on",
  };
}

export async function creerTache(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const pieces = await televerserPieces(fd);
  if ("erreur" in pieces) return pieces.erreur;
  const res = await apiFetch<TacheDetail>("/taches", { method: "POST", body: { ...corps(fd), pieces_jointes: pieces } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  redirect(`/${locale}${BASE}/${res.data.id}?cree=1`);
}

export async function modifierTache(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "tache_id");
  const pieces = await televerserPieces(fd);
  if ("erreur" in pieces) return pieces.erreur;
  const res = await apiFetch<TacheDetail>(`/taches/${id}`, { method: "PATCH", body: { ...corps(fd), ...(pieces.length ? { pieces_jointes: pieces } : {}) } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  redirect(`/${locale}${BASE}/${id}?maj=1`);
}

export async function changerStatut(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "tache_id");
  const pieces = await televerserPieces(fd, "photo");
  if ("erreur" in pieces) return pieces.erreur;
  const res = await apiFetch<TacheDetail>(`/taches/${id}/statut`, { method: "POST", body: { statut: champ(fd, "statut"), commentaire: optionnel(fd, "commentaire"), piece_jointe: pieces[0] ?? null } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success(undefined, { suivante_id: res.data.suivante_id ?? null });
}

export async function assignerTache(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "tache_id");
  const res = await apiFetch<TacheDetail>(`/taches/${id}/assigner`, { method: "POST", body: { assignee_id: optionnel(fd, "assignee_id") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success();
}

export async function basculerEtape(locale: string, id: string, itemId: string, fait: boolean): Promise<void> {
  await apiFetch(`/taches/${id}/checklist`, { method: "PATCH", body: { item_id: itemId, fait } });
  revalider(locale, `${BASE}/${id}`);
}

export async function commenterTache(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "tache_id");
  const res = await apiFetch(`/taches/${id}/commentaires`, { method: "POST", body: { contenu: champ(fd, "contenu") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success();
}
