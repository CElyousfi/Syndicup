"use server";

/** Server Actions — Justificatifs de paiement (M17). Écritures probantes : `idempotent: true`. */
import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../../lib/forms";
import type { Justificatif, CompteBancaire } from "../../../../../lib/api/types";

function champ(fd: FormData, name: string): string { return String(fd.get(name) ?? "").trim(); }
function optionnel(fd: FormData, name: string): string | null { const v = champ(fd, name); return v === "" ? null : v; }
function revalider(locale: string, ...paths: string[]) {
  for (const p of ["/finances/justificatifs", "/finances/payer", "/finances/especes", "/tableau-de-bord", ...paths]) revalidatePath(`/${locale}${p}`);
}

async function televerserPreuve(fd: FormData, name = "preuve"): Promise<{ storage_path: string; nom: string } | null | { erreur: FormState }> {
  const f = fd.get(name);
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.size > 15 * 1024 * 1024) return { erreur: { status: "error", code: "VALIDATION_ERROR", message: "Fichier trop lourd (15 Mo max).", fields: { [name]: "15 Mo max." } } };
  const contentType = f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  const prep = await apiFetch<{ storage_path: string; upload_url: string }>("/finances/justificatifs/upload-url", { method: "POST", body: { nom_fichier: f.name || "preuve.jpg", content_type: contentType } });
  if (!prep.ok) return { erreur: fromApiError(prep) };
  const up = await fetch(prep.data.upload_url, { method: "PUT", headers: { "Content-Type": contentType, "x-upsert": "true" }, body: await f.arrayBuffer() });
  if (!up.ok) return { erreur: { status: "error", code: "INTERNAL_ERROR", message: `Téléversement refusé par le stockage (${up.status}).` } };
  return { storage_path: prep.data.storage_path, nom: f.name || "preuve.jpg" };
}

export async function declarerJustificatif(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const preuve = await televerserPreuve(fd);
  if (preuve && "erreur" in preuve) return preuve.erreur;
  const pourLot = champ(fd, "au_nom") === "1";
  const appel = optionnel(fd, "appel_de_fonds_lot_id");
  const res = await apiFetch<Justificatif>("/finances/justificatifs", {
    method: "POST",
    idempotent: true,
    body: {
      ...(pourLot ? { pour_lot_id: champ(fd, "lot_id") } : { lot_id: champ(fd, "lot_id") }),
      appel_de_fonds_lot_id: appel === "SOLDE" ? null : appel,
      montant: champ(fd, "montant"),
      methode: champ(fd, "methode"),
      date_paiement: champ(fd, "date_paiement"),
      banque_emettrice: optionnel(fd, "banque_emettrice"),
      beneficiaire: champ(fd, "beneficiaire") || optionnel(fd, "beneficiaire_libre") || "—",
      reference: optionnel(fd, "reference"),
      preuve,
    },
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/lots/${champ(fd, "lot_id")}`);
  return success(undefined, { id: res.data.id });
}

async function transition(fd: FormData, action: "valider" | "rejeter" | "annuler", body?: unknown): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "justificatif_id");
  const res = await apiFetch<Justificatif>(`/finances/justificatifs/${id}/${action}`, { method: "POST", idempotent: true, body: body ?? {} });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/finances/justificatifs/${id}`, `/lots/${res.data.lotId}`);
  return success(undefined, { statut: res.data.statut });
}
export async function validerJustificatif(_prev: FormState, fd: FormData): Promise<FormState> {
  return transition(fd, "valider", { date_valeur: optionnel(fd, "date_valeur") });
}
export async function rejeterJustificatif(_prev: FormState, fd: FormData): Promise<FormState> {
  return transition(fd, "rejeter", { motif: champ(fd, "motif") });
}
export async function annulerJustificatif(_prev: FormState, fd: FormData): Promise<FormState> {
  return transition(fd, "annuler");
}

export async function saisirEspeces(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const preuve = await televerserPreuve(fd);
  if (preuve && "erreur" in preuve) return preuve.erreur;
  const appel = optionnel(fd, "appel_de_fonds_lot_id");
  const res = await apiFetch<{ type: "JUSTIFICATIF" | "PAIEMENT" }>("/finances/paiements/especes", {
    method: "POST",
    idempotent: true,
    body: { lot_id: champ(fd, "lot_id"), appel_de_fonds_lot_id: appel === "SOLDE" || !appel ? null : appel, montant: champ(fd, "montant"), date_paiement: optionnel(fd, "date_paiement") ?? undefined, commentaire: optionnel(fd, "commentaire"), preuve },
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/lots/${champ(fd, "lot_id")}`);
  return success(undefined, { type: res.data.type });
}

export async function remplacerComptes(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const coproprieteId = champ(fd, "copropriete_id");
  const libelles = fd.getAll("libelle").map(String);
  const banques = fd.getAll("banque").map(String);
  const ribs = fd.getAll("rib").map((r) => String(r).replace(/\s+/g, ""));
  const comptes = libelles.map((l, i) => ({ libelle: l.trim(), banque: (banques[i] ?? "").trim(), rib: ribs[i] ?? "" })).filter((c) => c.libelle || c.banque || c.rib);
  const res = await apiFetch<CompteBancaire[]>(`/coproprietes/${coproprieteId}/comptes-bancaires`, { method: "PUT", body: { comptes } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success();
}

export async function lireRibCompte(_prev: FormState, fd: FormData): Promise<FormState> {
  const res = await apiFetch<{ rib: string }>(`/coproprietes/${champ(fd, "copropriete_id")}/comptes-bancaires/${champ(fd, "index")}/rib`);
  if (!res.ok) return fromApiError(res);
  return success(undefined, { rib: res.data.rib });
}
