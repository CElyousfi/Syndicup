"use server";

/**
 * Server Actions — Dépenses (M16). Toute écriture financière/probante porte `idempotent: true`
 * (Idempotency-Key générée côté serveur web) ; les fichiers (facture, preuve) sont téléversés
 * depuis l'action vers l'URL signée du stockage — le navigateur ne parle jamais au stockage.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../../lib/forms";
import type { Depense, DepenseDetail, Facture, BudgetPoste } from "../../../../../lib/api/types";

const BASE = "/finances/depenses";

function champ(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}
function optionnel(fd: FormData, name: string): string | null {
  const v = champ(fd, name);
  return v === "" ? null : v;
}
function revalider(locale: string, ...suffixes: string[]) {
  revalidatePath(`/${locale}${BASE}`);
  for (const s of suffixes) revalidatePath(`/${locale}${s}`);
}

/** Téléverse UN fichier (facture / preuve) via l'URL signée de l'API ; renvoie le chemin storage. */
async function televerserPiece(fd: FormData, name: string): Promise<{ storage_path: string; nom: string } | null | { erreur: FormState }> {
  const f = fd.get(name);
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.size > 15 * 1024 * 1024) {
    return { erreur: { status: "error", code: "VALIDATION_ERROR", message: "Fichier trop lourd (15 Mo max).", fields: { [name]: "15 Mo max." } } };
  }
  const contentType = f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  const prep = await apiFetch<{ storage_path: string; upload_url: string }>("/depenses/upload-url", {
    method: "POST",
    body: { nom_fichier: f.name || "piece.jpg", content_type: contentType },
  });
  if (!prep.ok) return { erreur: fromApiError(prep) };
  const upload = await fetch(prep.data.upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType, "x-upsert": "true" },
    body: await f.arrayBuffer(),
  });
  if (!upload.ok) {
    return { erreur: { status: "error", code: "INTERNAL_ERROR", message: `Téléversement refusé par le stockage (${upload.status}).` } };
  }
  return { storage_path: prep.data.storage_path, nom: f.name || "piece.jpg" };
}

function corpsDepense(fd: FormData) {
  const ht = optionnel(fd, "montant_ht");
  const tva = optionnel(fd, "tva");
  return {
    categorie: champ(fd, "categorie"),
    libelle: champ(fd, "libelle"),
    description: optionnel(fd, "description"),
    montant_ht: ht,
    tva: ht ? tva : null,
    montant_ttc: champ(fd, "montant_ttc"),
    date_depense: champ(fd, "date_depense"),
    source: champ(fd, "source"),
    budget_poste_id: optionnel(fd, "budget_poste_id"),
    prestataire_id: optionnel(fd, "prestataire_id"),
    resolution_ag_id: optionnel(fd, "resolution_ag_id"),
  };
}

export async function creerDepense(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Depense>("/depenses", { method: "POST", body: corpsDepense(fd) });
  if (!res.ok) return fromApiError(res);
  // Facture jointe dès la création (facultatif) : ajoutée juste après, même écran.
  const piece = await televerserPiece(fd, "facture_fichier");
  if (piece && "erreur" in piece) return piece.erreur;
  if (piece) {
    const f = await apiFetch<Facture>(`/depenses/${res.data.id}/factures`, {
      method: "POST",
      idempotent: true,
      body: {
        numero: optionnel(fd, "facture_numero"),
        date_facture: optionnel(fd, "facture_date") ?? champ(fd, "date_depense"),
        date_echeance: optionnel(fd, "facture_echeance"),
        montant_ttc: champ(fd, "montant_ttc"),
        document: piece,
      },
    });
    if (!f.ok) return fromApiError(f);
  }
  revalider(locale);
  redirect(`/${locale}${BASE}/${res.data.id}?creee=1`);
}

export async function modifierDepense(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "depense_id");
  const res = await apiFetch<Depense>(`/depenses/${id}`, { method: "PATCH", body: corpsDepense(fd) });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  redirect(`/${locale}${BASE}/${id}`);
}

async function transition(fd: FormData, action: "soumettre" | "approuver" | "rejeter" | "annuler", body?: unknown): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "depense_id");
  const res = await apiFetch<DepenseDetail>(`/depenses/${id}/${action}`, { method: "POST", idempotent: true, body: body ?? {} });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`, "/tableau-de-bord");
  return success(undefined, { statut: res.data.statut });
}

export async function soumettreDepense(_prev: FormState, fd: FormData): Promise<FormState> {
  return transition(fd, "soumettre");
}
export async function approuverDepense(_prev: FormState, fd: FormData): Promise<FormState> {
  return transition(fd, "approuver");
}
export async function rejeterDepense(_prev: FormState, fd: FormData): Promise<FormState> {
  return transition(fd, "rejeter", { motif: champ(fd, "motif") });
}
export async function annulerDepense(_prev: FormState, fd: FormData): Promise<FormState> {
  return transition(fd, "annuler", { motif: optionnel(fd, "motif") });
}

export async function payerDepense(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "depense_id");
  const piece = await televerserPiece(fd, "justificatif");
  if (piece && "erreur" in piece) return piece.erreur;
  const res = await apiFetch<DepenseDetail>(`/depenses/${id}/payer`, {
    method: "POST",
    idempotent: true,
    body: {
      methode: champ(fd, "methode"),
      reference: optionnel(fd, "reference"),
      date_paiement: champ(fd, "date_paiement"),
      justificatif: piece,
    },
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`, "/tableau-de-bord", "/finances/budgets");
  return success(undefined, { source: res.data.source });
}

export async function ajouterFacture(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "depense_id");
  const piece = await televerserPiece(fd, "fichier");
  if (!piece) return { status: "error", code: "VALIDATION_ERROR", message: "Le fichier de la facture est obligatoire.", fields: { fichier: "Fichier obligatoire." } };
  if ("erreur" in piece) return piece.erreur;
  const res = await apiFetch<Facture>(`/depenses/${id}/factures`, {
    method: "POST",
    idempotent: true,
    body: {
      numero: optionnel(fd, "numero"),
      date_facture: champ(fd, "date_facture"),
      date_echeance: optionnel(fd, "date_echeance"),
      montant_ttc: champ(fd, "montant_ttc"),
      prestataire_id: optionnel(fd, "prestataire_id"),
      document: piece,
    },
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success();
}

export async function changerStatutFacture(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "depense_id");
  const res = await apiFetch<Facture>(`/depenses/${id}/factures/${champ(fd, "facture_id")}`, {
    method: "PATCH",
    body: { statut: champ(fd, "statut") },
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success();
}

// ── Postes budgétaires ───────────────────────────────────────────────────────
export async function creerPoste(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const budgetId = champ(fd, "budget_id");
  const res = await apiFetch<{ poste: BudgetPoste }>(`/finances/budgets/${budgetId}/postes`, {
    method: "POST",
    body: { categorie: champ(fd, "categorie"), libelle: champ(fd, "libelle"), montant_prevu: champ(fd, "montant_prevu") },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/finances/budgets`);
  revalidatePath(`/${locale}/finances/budgets/${budgetId}`);
  return success();
}

export async function modifierPoste(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const budgetId = champ(fd, "budget_id");
  const res = await apiFetch<{ poste: BudgetPoste }>(`/finances/budgets/${budgetId}/postes/${champ(fd, "poste_id")}`, {
    method: "PATCH",
    body: { categorie: champ(fd, "categorie"), libelle: champ(fd, "libelle"), montant_prevu: champ(fd, "montant_prevu") },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/finances/budgets`);
  revalidatePath(`/${locale}/finances/budgets/${budgetId}`);
  return success();
}

export async function supprimerPoste(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const budgetId = champ(fd, "budget_id");
  const res = await apiFetch<{ id: string }>(`/finances/budgets/${budgetId}/postes/${champ(fd, "poste_id")}`, { method: "DELETE" });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/finances/budgets`);
  revalidatePath(`/${locale}/finances/budgets/${budgetId}`);
  return success();
}

// ── Incidents ────────────────────────────────────────────────────────────────
export async function creerDepenseDepuisIncident(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const incidentId = champ(fd, "incident_id");
  const ht = optionnel(fd, "montant_ht");
  const res = await apiFetch<Depense>(`/incidents/${incidentId}/depense`, {
    method: "POST",
    body: {
      montant_ttc: champ(fd, "montant_ttc"),
      montant_ht: ht,
      tva: ht ? optionnel(fd, "tva") : null,
      libelle: optionnel(fd, "libelle") ?? undefined,
      budget_poste_id: optionnel(fd, "budget_poste_id"),
      source: champ(fd, "source") || "COMPTE_COURANT",
    },
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/incidents/${incidentId}`);
  redirect(`/${locale}${BASE}/${res.data.id}?creee=1`);
}

export async function evaluerPrestataire(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const incidentId = champ(fd, "incident_id");
  const res = await apiFetch<{ note_moyenne: string | null }>(`/incidents/${incidentId}/evaluation`, {
    method: "POST",
    body: { note: Number(champ(fd, "note")), commentaire: optionnel(fd, "commentaire") },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/incidents/${incidentId}`);
  revalidatePath(`/${locale}/prestataires`);
  return success();
}

// ── Fournisseur : RIB complet (lecture auditée côté API) ─────────────────────
export async function lireRib(_prev: FormState, fd: FormData): Promise<FormState> {
  const res = await apiFetch<{ rib: string | null }>(`/prestataires/${champ(fd, "prestataire_id")}/rib`);
  if (!res.ok) return fromApiError(res);
  return success(undefined, { rib: res.data.rib });
}
