"use server";

/**
 * M29 — Server Actions de la console opérateur (abonnements, factures, clients, utilisateurs).
 * Chaque action relaie le formulaire à l'API (Zod côté API) et rafraîchit la console.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { Abonnement, ClientFacturation, FactureCourte } from "../../../../lib/api/console-types";

const champ = (fd: FormData, n: string) => String(fd.get(n) ?? "").trim();
const facultatif = (fd: FormData, n: string) => champ(fd, n) || undefined;
const nullable = (fd: FormData, n: string) => champ(fd, n) || null;
const entier = (fd: FormData, n: string) => (champ(fd, n) ? Number(champ(fd, n)) : undefined);
const montant = (fd: FormData, n: string) => (champ(fd, n) ? champ(fd, n).replace(",", ".").replace(/\s/g, "") : undefined);

function rafraichir(locale: string) {
  revalidatePath(`/${locale}/admin`, "layout");
}

function ficheClient(fd: FormData, prefixe = "") {
  const p = (n: string) => `${prefixe}${n}`;
  return {
    raison_sociale: nullable(fd, p("raison_sociale")),
    ice: nullable(fd, p("ice")),
    rc: nullable(fd, p("rc")),
    identifiant_fiscal: nullable(fd, p("identifiant_fiscal")),
    adresse: nullable(fd, p("adresse")),
    ville: nullable(fd, p("ville")),
    contact_nom: nullable(fd, p("contact_nom")),
    contact_email: nullable(fd, p("contact_email")),
    contact_telephone: nullable(fd, p("contact_telephone")),
    notes: nullable(fd, p("notes_client")),
  };
}

export async function creerAbonnementAction(_p: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const modeClient = champ(fd, "mode_client");
  const essai = champ(fd, "essai") !== "non";
  const body = {
    ...(modeClient === "existant"
      ? { client_id: champ(fd, "client_id") }
      : { nouveau_client: { type: champ(fd, "nc_type") || "SYNDICAT", nom: champ(fd, "nc_nom"), ...ficheClient(fd, "nc_") } }),
    copropriete_ids: fd.getAll("copropriete_ids").map(String).filter(Boolean),
    formule: champ(fd, "formule"),
    periodicite: champ(fd, "periodicite") || "ANNUELLE",
    lots_contractes: entier(fd, "lots_contractes"),
    prix_lot: montant(fd, "prix_lot"),
    tarif_fondateur: champ(fd, "tarif_fondateur") === "on",
    forfait_accompagne: montant(fd, "forfait_accompagne") ?? null,
    date_debut: champ(fd, "date_debut"),
    essai,
    fin_essai: essai ? facultatif(fd, "fin_essai") : undefined,
    fin_periode: essai ? undefined : facultatif(fd, "fin_periode"),
    delai_grace_jours: entier(fd, "delai_grace_jours"),
    notes: nullable(fd, "notes"),
  };
  const res = await apiFetch<Abonnement>("/admin/abonnements", { method: "POST", body });
  if (!res.ok) return fromApiError(res);
  rafraichir(locale);
  redirect(`/${locale}/admin/abonnements/${res.data.id}`);
}

export async function actionAbonnementAction(_p: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "abonnement_id");
  const action = champ(fd, "action");
  const body: Record<string, unknown> = { action };
  for (const k of ["fin_essai", "jusqu_au", "fin_periode", "motif"]) {
    const v = facultatif(fd, k);
    if (v) body[k] = v;
  }
  const res = await apiFetch<Abonnement>(`/admin/abonnements/${id}/actions`, { method: "POST", body });
  if (!res.ok) return fromApiError(res);
  rafraichir(locale);
  return success(champ(fd, "succes") || undefined);
}

export async function modifierConditionsAction(_p: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "abonnement_id");
  const body: Record<string, unknown> = {
    formule: facultatif(fd, "formule"),
    periodicite: facultatif(fd, "periodicite"),
    lots_contractes: entier(fd, "lots_contractes"),
    prix_lot: montant(fd, "prix_lot"),
    minimum_mensuel: montant(fd, "minimum_mensuel") ?? null,
    taux_tva: montant(fd, "taux_tva"),
    forfait_accompagne: montant(fd, "forfait_accompagne") ?? null,
    delai_grace_jours: entier(fd, "delai_grace_jours"),
    prix_garanti_jusqu_au: nullable(fd, "prix_garanti_jusqu_au"),
    notes: nullable(fd, "notes"),
  };
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
  const res = await apiFetch<Abonnement>(`/admin/abonnements/${id}`, { method: "PATCH", body });
  if (!res.ok) return fromApiError(res);
  rafraichir(locale);
  return success(champ(fd, "succes") || undefined);
}

export async function emettreFactureAction(_p: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "abonnement_id");
  const libelle = champ(fd, "ligne_libelle");
  const ligneMontant = montant(fd, "ligne_montant");
  const body = {
    periode_debut: facultatif(fd, "periode_debut"),
    lots: entier(fd, "lots"),
    echeance_jours: entier(fd, "echeance_jours") ?? 15,
    lignes_supplementaires: libelle && ligneMontant ? [{ libelle, montant: ligneMontant }] : undefined,
  };
  const res = await apiFetch<FactureCourte>(`/admin/abonnements/${id}/factures`, { method: "POST", body });
  if (!res.ok) return fromApiError(res);
  rafraichir(locale);
  return success(champ(fd, "succes") || undefined, res.data);
}

export async function enregistrerPaiementAction(_p: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const factureId = champ(fd, "facture_id");
  const res = await apiFetch<{ facture_soldee: boolean; reste_du: string }>(`/admin/factures/${factureId}/paiements`, {
    method: "POST",
    // Clé posée à l'ouverture du formulaire : un double clic / un « Réessayer » ne double jamais l'encaissement.
    idempotencyKey: champ(fd, "cle") || undefined,
    idempotent: true,
    body: { montant: montant(fd, "montant"), mode: champ(fd, "mode"), reference: nullable(fd, "reference"), recu_le: champ(fd, "recu_le") },
  });
  if (!res.ok) return fromApiError(res);
  rafraichir(locale);
  return success(res.data.facture_soldee ? champ(fd, "succes_solde") : champ(fd, "succes"));
}

export async function annulerFactureAction(_p: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch(`/admin/factures/${champ(fd, "facture_id")}/annuler`, { method: "POST", body: { motif: champ(fd, "motif") } });
  if (!res.ok) return fromApiError(res);
  rafraichir(locale);
  return success(champ(fd, "succes") || undefined);
}

export async function rattacherCoproAction(_p: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch(`/admin/abonnements/${champ(fd, "abonnement_id")}/coproprietes`, { method: "POST", body: { copropriete_id: champ(fd, "copropriete_id") } });
  if (!res.ok) return fromApiError(res);
  rafraichir(locale);
  return success(champ(fd, "succes") || undefined);
}

export async function retirerCoproAction(_p: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch(`/admin/abonnements/${champ(fd, "abonnement_id")}/coproprietes/${champ(fd, "copropriete_id")}`, { method: "DELETE" });
  if (!res.ok) return fromApiError(res);
  rafraichir(locale);
  return success(champ(fd, "succes") || undefined);
}

export async function enregistrerClientAction(_p: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "client_id");
  const body = { nom: champ(fd, "nom"), ...ficheClient(fd), ...(id ? {} : { type: champ(fd, "type") || "SYNDICAT" }) };
  const res = id
    ? await apiFetch<ClientFacturation>(`/admin/clients/${id}`, { method: "PATCH", body })
    : await apiFetch<ClientFacturation>("/admin/clients", { method: "POST", body });
  if (!res.ok) return fromApiError(res);
  rafraichir(locale);
  return success(champ(fd, "succes") || undefined);
}

export async function statutUtilisateurAction(_p: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch(`/admin/utilisateurs/${champ(fd, "utilisateur_id")}`, { method: "PATCH", body: { statut_compte: champ(fd, "statut_compte"), motif: facultatif(fd, "motif") } });
  if (!res.ok) return fromApiError(res);
  rafraichir(locale);
  return success(champ(fd, "succes") || undefined);
}

/** Prix proposé par la grille (appelé en direct par le formulaire d'ouverture). */
export async function simulerTarifAction(params: { formule: string; lots: number; periodicite: string; fondateur: boolean }) {
  if (!params.lots || params.lots < 1) return null;
  const res = await apiFetch<import("../../../../lib/api/console-types").TarifSuggere>("/admin/tarifs", {
    searchParams: { formule: params.formule, lots: params.lots, periodicite: params.periodicite, fondateur: String(params.fondateur) },
  });
  return res.ok ? res.data : null;
}
