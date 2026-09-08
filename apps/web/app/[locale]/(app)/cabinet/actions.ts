"use server";

/** Server Actions — Cabinet (M25) : membres, mandats, prestataires, paramètres, confirmation de passation (contexte copropriété). */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import { writeCoproprieteId } from "../../../../lib/session";
import type { Cabinet, CabinetMandat, CabinetMembre, CabinetPrestataire, Profil } from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string { return String(fd.get(name) ?? "").trim(); }
function optionnel(fd: FormData, name: string): string | null { const v = champ(fd, name); return v === "" ? null : v; }
function revalider(locale: string) { for (const s of ["/cabinet", "/parametres", "/tableau-de-bord"]) revalidatePath(`/${locale}${s}`); }

export async function ajouterMembre(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const contact = champ(fd, "contact");
  const res = await apiFetch<CabinetMembre>(`/cabinets/${champ(fd, "cabinet_id")}/membres`, { method: "POST", body: { ...(contact.includes("@") ? { email: contact } : { telephone: contact }), role: champ(fd, "role") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}
export async function modifierMembre(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const actif = optionnel(fd, "actif");
  const res = await apiFetch<CabinetMembre>(`/cabinets/${champ(fd, "cabinet_id")}/membres/${champ(fd, "membre_id")}`, { method: "PATCH", body: { ...(optionnel(fd, "role") ? { role: champ(fd, "role") } : {}), ...(actif !== null ? { actif: actif === "true" } : {}) } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}
export async function proposerMandat(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const mode = champ(fd, "mode");
  const res = await apiFetch<CabinetMandat>(`/cabinets/${champ(fd, "cabinet_id")}/coproprietes`, { method: "POST", body: {
    ...(mode === "nouvelle" ? { nouvelle_copropriete: { nom: champ(fd, "nom"), adresse: champ(fd, "adresse"), ville: champ(fd, "ville"), nb_lots: Number(champ(fd, "nb_lots")) || 1 } } : { copropriete_id: champ(fd, "copropriete_id") }),
    gestionnaire_principal_id: optionnel(fd, "gestionnaire_principal_id"),
    date_debut_mandat: champ(fd, "date_debut_mandat"),
    date_fin_mandat: optionnel(fd, "date_fin_mandat"),
    honoraires_mensuels: optionnel(fd, "honoraires_mensuels"),
    resolution_ag_id: optionnel(fd, "resolution_ag_id"),
  } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}
export async function modifierMandat(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<CabinetMandat>(`/cabinets/${champ(fd, "cabinet_id")}/coproprietes/${champ(fd, "mandat_id")}`, { method: "PATCH", body: { gestionnaire_principal_id: optionnel(fd, "gestionnaire_principal_id"), date_fin_mandat: optionnel(fd, "date_fin_mandat"), honoraires_mensuels: optionnel(fd, "honoraires_mensuels") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}
export async function terminerMandat(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<{ mandat_id: string }>(`/cabinets/${champ(fd, "cabinet_id")}/coproprietes/${champ(fd, "mandat_id")}/terminer`, { method: "POST", body: { ...(optionnel(fd, "date_fin") ? { date_fin: champ(fd, "date_fin") } : {}), motif: optionnel(fd, "motif") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success();
}
export async function confirmerMandat(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<{ mandat_id: string; statut: string }>(`/cabinets/${champ(fd, "cabinet_id")}/coproprietes/${champ(fd, "copropriete_id")}/confirmer`, { method: "POST" });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}
export async function creerPrestataireModele(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<CabinetPrestataire>(`/cabinets/${champ(fd, "cabinet_id")}/prestataires`, { method: "POST", body: { nom: champ(fd, "nom"), specialite: champ(fd, "specialite"), telephone: optionnel(fd, "telephone"), email: optionnel(fd, "email"), ice: optionnel(fd, "ice"), rc: optionnel(fd, "rc"), adresse: optionnel(fd, "adresse"), notes: optionnel(fd, "notes") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}
export async function copierPrestataire(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<{ prestataire_id: string; copie: boolean }>(`/cabinets/${champ(fd, "cabinet_id")}/prestataires/${champ(fd, "modele_id")}/copier`, { method: "POST", body: { copropriete_id: champ(fd, "copropriete_id") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}
export async function modifierCabinet(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const seuil = optionnel(fd, "seuil_recouvrement"), delai = optionnel(fd, "delai_justificatifs_jours");
  const res = await apiFetch<Cabinet>(`/cabinets/${champ(fd, "cabinet_id")}`, { method: "PATCH", body: { nom: champ(fd, "nom"), raison_sociale: optionnel(fd, "raison_sociale"), telephone: optionnel(fd, "telephone"), email: optionnel(fd, "email"), adresse: optionnel(fd, "adresse"), parametres: { ...(seuil ? { seuil_recouvrement: Number(seuil) } : {}), ...(delai ? { delai_justificatifs_jours: Number(delai) } : {}) } } });
  if (!res.ok) return fromApiError(res);
  revalider(locale);
  return success(undefined, res.data);
}
/** Ouvrir une copropriété du portefeuille (bascule la copropriété active, vérifiée contre les rôles réels). */
export async function ouvrirCopropriete(fd: FormData): Promise<void> {
  const locale = champ(fd, "locale") || "fr";
  const coproId = champ(fd, "copropriete_id");
  const next = champ(fd, "next") || "/tableau-de-bord";
  const me = await apiFetch<Profil>("/users/me");
  if (!me.ok) redirect(`/${locale}/connexion`);
  const autorise = (me.data.roles ?? []).some((r) => r.actif && r.copropriete_id === coproId) || (me.data.roles ?? []).some((r) => r.actif && r.role === "SUPER_ADMIN");
  if (!autorise) redirect(`/${locale}/cabinet?refus=1`);
  await writeCoproprieteId(coproId);
  redirect(`/${locale}${next.startsWith("/") ? next : `/${next}`}`);
}
