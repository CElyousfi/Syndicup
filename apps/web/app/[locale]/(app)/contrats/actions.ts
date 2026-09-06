"use server";

/** Server Actions — Contrats (M19). Transitions et génération de dépense = écritures probantes (`idempotent: true`) ; fichiers téléversés depuis l'action. */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { Contrat, ContratEcheance } from "../../../../lib/api/types";

const BASE = "/contrats";
function champ(fd: FormData, name: string): string { return String(fd.get(name) ?? "").trim(); }
function optionnel(fd: FormData, name: string): string | null { const v = champ(fd, name); return v === "" ? null : v; }
function revalider(locale: string, ...suffixes: string[]) {
  for (const s of [BASE, `${BASE}/calendrier`, "/rapports", "/tableau-de-bord", ...suffixes]) revalidatePath(`/${locale}${s}`);
}

async function televerserPiece(fd: FormData, name: string): Promise<{ storage_path: string; nom: string } | null | { erreur: FormState }> {
  const f = fd.get(name);
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.size > 15 * 1024 * 1024) return { erreur: { status: "error", code: "VALIDATION_ERROR", message: "Fichier trop lourd (15 Mo max).", fields: { [name]: "15 Mo max." } } };
  const contentType = f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  const prep = await apiFetch<{ storage_path: string; upload_url: string }>("/contrats/upload-url", { method: "POST", body: { nom_fichier: f.name || "contrat.pdf", content_type: contentType } });
  if (!prep.ok) return { erreur: fromApiError(prep) };
  const up = await fetch(prep.data.upload_url, { method: "PUT", headers: { "Content-Type": contentType, "x-upsert": "true" }, body: await f.arrayBuffer() });
  if (!up.ok) return { erreur: { status: "error", code: "INTERNAL_ERROR", message: `Téléversement refusé par le stockage (${up.status}).` } };
  return { storage_path: prep.data.storage_path, nom: f.name || "contrat.pdf" };
}

function corpsContrat(fd: FormData, estAssurance: boolean) {
  const garanties = champ(fd, "garanties").split("\n").map((g) => g.trim()).filter(Boolean);
  const preavis = optionnel(fd, "preavis_jours");
  return {
    type: champ(fd, "type"),
    libelle: champ(fd, "libelle"),
    reference: optionnel(fd, "reference"),
    prestataire_id: optionnel(fd, "prestataire_id"),
    date_debut: champ(fd, "date_debut"),
    date_fin: optionnel(fd, "date_fin"),
    tacite: champ(fd, "tacite") === "on",
    preavis_jours: preavis ? Number(preavis) : null,
    periodicite: champ(fd, "periodicite"),
    montant_periode: optionnel(fd, "montant_periode"),
    budget_poste_id: optionnel(fd, "budget_poste_id"),
    resolution_ag_id: optionnel(fd, "resolution_ag_id"),
    notes: optionnel(fd, "notes"),
    details_assurance: estAssurance && champ(fd, "assureur") ? { assureur: champ(fd, "assureur"), numero_police: champ(fd, "numero_police"), garanties, franchise: optionnel(fd, "franchise"), capital_assure: optionnel(fd, "capital_assure") } : null,
  };
}

export async function creerContrat(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const type = champ(fd, "type");
  const [doc, att] = await Promise.all([televerserPiece(fd, "document_fichier"), televerserPiece(fd, "attestation_fichier")]);
  if (doc && "erreur" in doc) return doc.erreur;
  if (att && "erreur" in att) return att.erreur;
  const res = await apiFetch<Contrat>("/contrats", { method: "POST", body: { ...corpsContrat(fd, type.startsWith("ASSURANCE")), document: doc, attestation: att } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  redirect(`/${locale}${BASE}/${res.data.id}?cree=1`);
}

export async function modifierContrat(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "contrat_id");
  const type = champ(fd, "type");
  const [doc, att] = await Promise.all([televerserPiece(fd, "document_fichier"), televerserPiece(fd, "attestation_fichier")]);
  if (doc && "erreur" in doc) return doc.erreur;
  if (att && "erreur" in att) return att.erreur;
  const res = await apiFetch<Contrat>(`/contrats/${id}`, { method: "PATCH", body: { ...corpsContrat(fd, type.startsWith("ASSURANCE")), ...(doc ? { document: doc } : {}), ...(att ? { attestation: att } : {}) } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  redirect(`/${locale}${BASE}/${id}`);
}

async function transition(fd: FormData, action: "activer" | "suspendre" | "resilier", body?: unknown): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "contrat_id");
  const res = await apiFetch<Contrat>(`/contrats/${id}/${action}`, { method: "POST", idempotent: true, body: body ?? {} });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success(undefined, { statut: res.data.statut });
}
export async function activerContrat(_prev: FormState, fd: FormData): Promise<FormState> { return transition(fd, "activer"); }
export async function suspendreContrat(_prev: FormState, fd: FormData): Promise<FormState> { return transition(fd, "suspendre", { motif: optionnel(fd, "motif") }); }
export async function resilierContrat(_prev: FormState, fd: FormData): Promise<FormState> { return transition(fd, "resilier", { motif: champ(fd, "motif"), ...(optionnel(fd, "date_resiliation") ? { date_resiliation: champ(fd, "date_resiliation") } : {}) }); }

export async function regenererEcheances(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "contrat_id");
  const res = await apiFetch<{ creees: number }>(`/contrats/${id}/echeances`, { method: "POST", body: {} });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success(undefined, { creees: res.data.creees });
}

export async function ajouterEcheance(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "contrat_id");
  const res = await apiFetch<ContratEcheance>(`/contrats/${id}/echeances`, { method: "POST", body: { type: champ(fd, "type"), date_echeance: champ(fd, "date_echeance"), montant: optionnel(fd, "montant") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success();
}

export async function modifierEcheance(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "contrat_id");
  const eid = champ(fd, "echeance_id");
  const res = await apiFetch<ContratEcheance>(`/contrats/${id}/echeances/${eid}`, { method: "PATCH", body: { statut: champ(fd, "statut") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success(undefined, { statut: res.data.statut });
}

export async function genererDepense(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "contrat_id");
  const eid = champ(fd, "echeance_id");
  const res = await apiFetch<{ depense: { id: string } }>(`/contrats/${id}/echeances/${eid}/generer-depense`, { method: "POST", idempotent: true, body: { source: champ(fd, "source") || "COMPTE_COURANT", ...(optionnel(fd, "montant_ttc") ? { montant_ttc: champ(fd, "montant_ttc") } : {}), ...(optionnel(fd, "date_depense") ? { date_depense: champ(fd, "date_depense") } : {}) } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`, "/finances/depenses");
  return success(undefined, { depense_id: res.data.depense.id });
}
