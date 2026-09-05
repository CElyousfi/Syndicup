"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type {
  LcdDeclaration,
  LcdGestionnaireResult,
  LcdReglement,
  LcdSejour,
} from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

/** "" → null, sinon entier (les paramètres légaux vides restent NULL — jamais devinés). */
function entierOuNull(fd: FormData, name: string): number | null {
  const v = champ(fd, name);
  if (v === "") return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function optionnel(fd: FormData, name: string): string | null {
  const v = champ(fd, name);
  return v === "" ? null : v;
}

const BASE = "/location-courte-duree";

function revalider(locale: string, ...suffixes: string[]) {
  revalidatePath(`/${locale}${BASE}`);
  for (const s of suffixes) revalidatePath(`/${locale}${BASE}${s}`);
}

// ── Règlement (syndic) ───────────────────────────────────────────────────────

export async function mettreAJourReglement(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const regime = champ(fd, "regime_lcd");
  const agResolutionId = optionnel(fd, "ag_resolution_id");
  const body: Record<string, unknown> = { regime_lcd: regime };
  if (regime === "ENCADREE") {
    body.parametres_lcd_json = {
      declaration_prealable_obligatoire: fd.get("declaration_prealable_obligatoire") === "on",
      delai_declaration_heures: entierOuNull(fd, "delai_declaration_heures"),
      nb_nuits_max_par_an: entierOuNull(fd, "nb_nuits_max_par_an"),
      nb_voyageurs_max_par_lot: entierOuNull(fd, "nb_voyageurs_max_par_lot"),
      gestionnaire_obligatoire_si_proprietaire_absent:
        fd.get("gestionnaire_obligatoire_si_proprietaire_absent") === "on",
      contact_gardien_obligatoire: fd.get("contact_gardien_obligatoire") === "on",
    };
  }
  if (agResolutionId) body.ag_resolution_id = agResolutionId;
  const res = await apiFetch<LcdReglement>("/lcd/reglement", { method: "PUT", body });
  if (!res.ok) return fromApiError(res);
  revalider(locale, "/reglement");
  return success();
}

// ── Déclarations de lots ─────────────────────────────────────────────────────

function plateformes(fd: FormData): string[] | undefined {
  const brut = champ(fd, "plateformes");
  if (brut === "") return undefined;
  const liste = brut
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return liste.length > 0 ? liste : undefined;
}

export async function declarerLot(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const gestionnaireId = optionnel(fd, "gestionnaire_id");
  const dateDebut = optionnel(fd, "date_debut");
  const res = await apiFetch<LcdDeclaration>("/lcd/declarations", {
    method: "POST",
    body: {
      lot_id: champ(fd, "lot_id"),
      ...(gestionnaireId ? { gestionnaire_id: gestionnaireId } : {}),
      ...(plateformes(fd) ? { plateformes: plateformes(fd) } : {}),
      contact_urgence_nom: optionnel(fd, "contact_urgence_nom"),
      contact_urgence_telephone: optionnel(fd, "contact_urgence_telephone"),
      ...(dateDebut ? { date_debut: dateDebut } : {}),
    },
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, { statut: res.data.statut, id: res.data.id });
}

export async function modifierDeclaration(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "declaration_id");
  const res = await apiFetch<LcdDeclaration>(`/lcd/declarations/${id}`, {
    method: "PATCH",
    body: {
      ...(plateformes(fd) ? { plateformes: plateformes(fd) } : {}),
      contact_urgence_nom: optionnel(fd, "contact_urgence_nom"),
      contact_urgence_telephone: optionnel(fd, "contact_urgence_telephone"),
    },
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/declarations/${id}`);
  return success();
}

/** Décision du syndic — valeur probante (audit_log + notification), Idempotency-Key obligatoire. */
export async function deciderDeclaration(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "declaration_id");
  const decision = champ(fd, "decision");
  const motif = optionnel(fd, "motif");
  const res = await apiFetch<LcdDeclaration>(`/lcd/declarations/${id}/decision`, {
    method: "POST",
    idempotent: true,
    body: { decision, ...(motif ? { motif } : {}) },
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/declarations/${id}`);
  return success();
}

export async function cloturerDeclaration(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "declaration_id");
  const dateFin = optionnel(fd, "date_fin");
  const res = await apiFetch<LcdDeclaration>(`/lcd/declarations/${id}/cloturer`, {
    method: "POST",
    body: dateFin ? { date_fin: dateFin } : {},
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/declarations/${id}`);
  return success();
}

export async function designerGestionnaire(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "declaration_id");
  const mode = champ(fd, "mode");
  const body: Record<string, unknown> = { canal: champ(fd, "canal") || "SMS" };
  if (mode === "compte") body.utilisateur_id = champ(fd, "utilisateur_id");
  else if (mode === "email") body.email = champ(fd, "email");
  else body.telephone = champ(fd, "telephone");
  const res = await apiFetch<LcdGestionnaireResult>(`/lcd/declarations/${id}/gestionnaire`, {
    method: "POST",
    body,
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/declarations/${id}`);
  return success(undefined, { invitation: res.data.invitation });
}

// ── Séjours ──────────────────────────────────────────────────────────────────

function corpsSejour(fd: FormData): Record<string, unknown> {
  const nbVoyageurs = Number.parseInt(champ(fd, "nb_voyageurs"), 10);
  const nationalite = optionnel(fd, "voyageur_nationalite");
  return {
    date_arrivee: champ(fd, "date_arrivee"),
    date_depart: champ(fd, "date_depart"),
    heure_arrivee_prevue: optionnel(fd, "heure_arrivee_prevue"),
    nb_voyageurs: Number.isNaN(nbVoyageurs) ? undefined : nbVoyageurs,
    voyageur_principal_nom: champ(fd, "voyageur_principal_nom"),
    voyageur_telephone: optionnel(fd, "voyageur_telephone"),
    voyageur_nationalite: nationalite ? nationalite.toUpperCase() : null,
    piece_identite_type: optionnel(fd, "piece_identite_type"),
    piece_identite_fin: optionnel(fd, "piece_identite_fin"),
    plaque_vehicule: optionnel(fd, "plaque_vehicule"),
  };
}

/** Déclaration d'un séjour — le gardien est notifié : écriture probante, idempotente. */
export async function declarerSejour(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<LcdSejour>("/lcd/sejours", {
    method: "POST",
    idempotent: true,
    body: { lot_id: champ(fd, "lot_id"), ...corpsSejour(fd) },
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale, "/sejours");
  redirect(`/${locale}${BASE}/sejours/${res.data.id}?declare=1`);
}

export async function modifierSejour(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "sejour_id");
  const res = await apiFetch<LcdSejour>(`/lcd/sejours/${id}`, {
    method: "PATCH",
    body: corpsSejour(fd),
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/sejours/${id}`);
  redirect(`/${locale}${BASE}/sejours/${id}?modifie=1`);
}

export async function annulerSejour(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "sejour_id");
  const motif = optionnel(fd, "motif");
  const res = await apiFetch<LcdSejour>(`/lcd/sejours/${id}/annuler`, {
    method: "POST",
    idempotent: true,
    body: motif ? { motif } : {},
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/sejours/${id}`);
  return success();
}

/** Gardien / syndic — qui est dans l'immeuble : valeur probante, idempotente. */
export async function confirmerArrivee(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "sejour_id");
  const constate = entierOuNull(fd, "nb_voyageurs_constate");
  const res = await apiFetch<LcdSejour>(`/lcd/sejours/${id}/arrivee`, {
    method: "POST",
    idempotent: true,
    body: constate === null ? {} : { nb_voyageurs_constate: constate },
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/sejours/${id}`);
  return success();
}

export async function confirmerDepart(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "sejour_id");
  const res = await apiFetch<LcdSejour>(`/lcd/sejours/${id}/depart`, {
    method: "POST",
    idempotent: true,
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/sejours/${id}`);
  return success();
}
