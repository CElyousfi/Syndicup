"use server";

/** Server Actions — Parkings (M23) : emplacements, attributions, véhicules, badges, places visiteurs, véhicule gênant. */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { BadgeAcces, Emplacement, EmplacementDetail, RechercheVehicule, Vehicule } from "../../../../lib/api/types";

const BASE = "/parkings";
function champ(fd: FormData, name: string): string { return String(fd.get(name) ?? "").trim(); }
function optionnel(fd: FormData, name: string): string | null { const v = champ(fd, name); return v === "" ? null : v; }
function revalider(locale: string, ...suffixes: string[]) {
  for (const s of [BASE, "/visites", "/lots", ...suffixes]) revalidatePath(`/${locale}${s}`);
}

export async function creerEmplacement(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Emplacement>("/emplacements", { method: "POST", body: { type: champ(fd, "type"), code: champ(fd, "code"), niveau: optionnel(fd, "niveau"), attribuable: champ(fd, "attribuable") === "on", notes: optionnel(fd, "notes") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}
export async function modifierEmplacement(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "emplacement_id");
  const statut = optionnel(fd, "statut");
  const res = await apiFetch<Emplacement>(`/emplacements/${id}`, { method: "PATCH", body: { type: champ(fd, "type"), code: champ(fd, "code"), niveau: optionnel(fd, "niveau"), attribuable: champ(fd, "attribuable") === "on", notes: optionnel(fd, "notes"), ...(statut ? { statut } : {}) } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success(undefined, res.data);
}
export async function supprimerEmplacement(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "emplacement_id");
  const res = await apiFetch<{ id: string }>(`/emplacements/${id}`, { method: "DELETE" });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  redirect(`/${locale}${BASE}?onglet=emplacements&supprime=1`);
}
export async function attribuerEmplacement(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "emplacement_id");
  const res = await apiFetch<EmplacementDetail>(`/emplacements/${id}/attribuer`, { method: "POST", idempotent: true, body: { lot_id: champ(fd, "lot_id"), type: champ(fd, "type"), date_debut: champ(fd, "date_debut"), date_fin: optionnel(fd, "date_fin"), resolution_ag_id: optionnel(fd, "resolution_ag_id"), redevance_mensuelle: optionnel(fd, "redevance_mensuelle"), notes: optionnel(fd, "notes") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success(undefined, res.data);
}
export async function libererEmplacement(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "emplacement_id");
  const dateFin = optionnel(fd, "date_fin");
  const res = await apiFetch<EmplacementDetail>(`/emplacements/${id}/liberer`, { method: "POST", body: { ...(dateFin ? { date_fin: dateFin } : {}), motif: optionnel(fd, "motif") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `${BASE}/${id}`);
  return success(undefined, res.data);
}

export async function creerVehicule(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Vehicule>("/vehicules", { method: "POST", body: { lot_id: champ(fd, "lot_id"), immatriculation: champ(fd, "immatriculation"), marque: optionnel(fd, "marque"), couleur: optionnel(fd, "couleur"), type: champ(fd, "type") || "VOITURE" } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}
export async function modifierVehicule(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "vehicule_id");
  const res = await apiFetch<Vehicule>(`/vehicules/${id}`, { method: "PATCH", body: { immatriculation: champ(fd, "immatriculation"), marque: optionnel(fd, "marque"), couleur: optionnel(fd, "couleur"), type: champ(fd, "type") || "VOITURE", actif: champ(fd, "actif") !== "off" } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}
export async function retirerVehicule(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Vehicule>(`/vehicules/${champ(fd, "vehicule_id")}`, { method: "DELETE" });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}
export async function rechercherVehicule(_prev: FormState, fd: FormData): Promise<FormState> {
  const res = await apiFetch<RechercheVehicule>("/vehicules/recherche", { searchParams: { immatriculation: champ(fd, "immatriculation") } });
  if (!res.ok) return fromApiError(res);
  return success(undefined, res.data);
}

export async function creerBadge(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<BadgeAcces>("/badges", { method: "POST", body: { lot_id: champ(fd, "lot_id"), type: champ(fd, "type"), identifiant: champ(fd, "identifiant"), remis_le: champ(fd, "remis_le"), caution_montant: optionnel(fd, "caution_montant"), caution_paiement_id: optionnel(fd, "caution_paiement_id"), notes: optionnel(fd, "notes") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}
export async function modifierBadge(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<BadgeAcces>(`/badges/${champ(fd, "badge_id")}`, { method: "PATCH", body: { identifiant: champ(fd, "identifiant"), caution_montant: optionnel(fd, "caution_montant"), caution_paiement_id: optionnel(fd, "caution_paiement_id"), notes: optionnel(fd, "notes") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}
export async function badgePerdu(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<BadgeAcces>(`/badges/${champ(fd, "badge_id")}/perdu`, { method: "POST", body: { commentaire: optionnel(fd, "commentaire"), creer_tache: true } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, "/taches");
  return success(undefined, res.data);
}
export async function badgeRestituer(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const restitueLe = optionnel(fd, "restitue_le");
  const res = await apiFetch<BadgeAcces>(`/badges/${champ(fd, "badge_id")}/restituer`, { method: "POST", body: { ...(restitueLe ? { restitue_le: restitueLe } : {}), caution_rendue: champ(fd, "caution_rendue") === "on" } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}
export async function badgeDesactiver(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<BadgeAcces>(`/badges/${champ(fd, "badge_id")}/desactiver`, { method: "POST" });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}

/** Place visiteur d'une visite (gardien / syndic) — `emplacement_id` vide = retirer. */
export async function placeVisiteur(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const heure = optionnel(fd, "heure_limite");
  const res = await apiFetch<unknown>(`/visites/${champ(fd, "visite_id")}/emplacement`, { method: "POST", body: { emplacement_id: optionnel(fd, "emplacement_id"), immatriculation: optionnel(fd, "immatriculation"), heure_limite: heure ? new Date(heure).toISOString() : null } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success();
}
/** « Véhicule sur ma place » — le gardien / syndic prévient le lot propriétaire de la plaque. */
export async function notifierVehicule(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "incident_id");
  const res = await apiFetch<{ immatriculation: string; lot: string | null; notifies: number }>(`/incidents/${id}/notifier-vehicule`, { method: "POST", body: { ...(optionnel(fd, "immatriculation") ? { immatriculation: champ(fd, "immatriculation") } : {}), message: optionnel(fd, "message") } });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/incidents/${id}`);
  return success(undefined, res.data);
}
