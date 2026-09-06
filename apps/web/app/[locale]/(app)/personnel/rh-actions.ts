"use server";

/** Server Actions — Personnel RH (M20). Paie / congés / pointage = écritures probantes (`idempotent: true`) ; fichiers téléversés depuis l'action. */
import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { readSession } from "../../../../lib/session";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { Conge, FichePaie, PersonnelRh } from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string { return String(fd.get(name) ?? "").trim(); }
function optionnel(fd: FormData, name: string): string | null { const v = champ(fd, name); return v === "" ? null : v; }
function revalider(locale: string, ...paths: string[]) {
  for (const p of ["/personnel", "/personnel/planning", "/personnel/paie", "/finances/depenses", "/tableau-de-bord", ...paths]) revalidatePath(`/${locale}${p}`);
}
async function televerser(fd: FormData, name: string): Promise<{ storage_path: string; nom: string } | null | { erreur: FormState }> {
  const f = fd.get(name);
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.size > 15 * 1024 * 1024) return { erreur: { status: "error", code: "VALIDATION_ERROR", message: "Fichier trop lourd (15 Mo max).", fields: { [name]: "15 Mo max." } } };
  const contentType = f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  const prep = await apiFetch<{ storage_path: string; upload_url: string }>("/personnel/upload-url", { method: "POST", body: { nom_fichier: f.name || "piece.pdf", content_type: contentType } });
  if (!prep.ok) return { erreur: fromApiError(prep) };
  const up = await fetch(prep.data.upload_url, { method: "PUT", headers: { "Content-Type": contentType, "x-upsert": "true" }, body: await f.arrayBuffer() });
  if (!up.ok) return { erreur: { status: "error", code: "INTERNAL_ERROR", message: `Téléversement refusé par le stockage (${up.status}).` } };
  return { storage_path: prep.data.storage_path, nom: f.name || "piece.pdf" };
}

const JOURS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"] as const;
export async function modifierDossier(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "personnel_id");
  const contrat = await televerser(fd, "contrat_fichier");
  if (contrat && "erreur" in contrat) return contrat.erreur;
  const horaires: Record<string, { debut: string; fin: string }[]> = {};
  for (const j of JOURS) {
    const plages = [1, 2].map((i) => ({ debut: champ(fd, `${j}_debut_${i}`), fin: champ(fd, `${j}_fin_${i}`) })).filter((p) => p.debut && p.fin);
    if (plages.length) horaires[j] = plages;
  }
  const salaire = optionnel(fd, "salaire_brut_mensuel");
  const cnss = optionnel(fd, "numero_cnss");
  const preavis = optionnel(fd, "date_fin_contrat");
  const res = await apiFetch<PersonnelRh>(`/personnel/${id}`, {
    method: "PATCH",
    body: {
      poste: champ(fd, "poste") || undefined,
      type_contrat: optionnel(fd, "type_contrat"),
      date_embauche: optionnel(fd, "date_embauche"),
      date_fin_contrat: preavis,
      salaire_brut_mensuel: salaire,
      ...(cnss ? { numero_cnss: cnss } : {}),
      contact_urgence: optionnel(fd, "contact_urgence"),
      horaires,
      notes: optionnel(fd, "notes"),
      statut: champ(fd, "statut") || undefined,
      logement_lot_id: champ(fd, "logement_lot_id") === "__none__" ? null : optionnel(fd, "logement_lot_id"),
      ...(contrat ? { contrat_travail: contrat } : {}),
    },
  });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/personnel/${id}`);
  return success();
}

export async function lireCnss(_prev: FormState, fd: FormData): Promise<FormState> {
  const res = await apiFetch<{ numero_cnss: string | null }>(`/personnel/${champ(fd, "personnel_id")}/cnss`);
  if (!res.ok) return fromApiError(res);
  return success(undefined, { numero_cnss: res.data.numero_cnss });
}

export async function preparerFiche(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "personnel_id");
  const abs = optionnel(fd, "jours_absence_injustifiee");
  const res = await apiFetch<FichePaie>(`/personnel/${id}/fiches-paie`, { method: "POST", body: { periode: champ(fd, "periode"), brut: optionnel(fd, "brut") ?? undefined, primes: optionnel(fd, "primes"), retenues: optionnel(fd, "retenues"), ...(abs ? { jours_absence_injustifiee: Number(abs) } : {}) } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/personnel/${id}`);
  return success(undefined, { id: res.data.id });
}

export async function validerFiche(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "personnel_id");
  const res = await apiFetch<FichePaie>(`/personnel/${id}/fiches-paie/${champ(fd, "fiche_id")}/valider`, { method: "POST", idempotent: true, body: {} });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/personnel/${id}`);
  return success(undefined, { depense_id: res.data.depenseId });
}

export async function payerFiche(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "personnel_id");
  const preuve = await televerser(fd, "preuve");
  if (preuve && "erreur" in preuve) return preuve.erreur;
  // La preuve de paiement vit dans le périmètre `depenses/` : re-téléversée via l'API dépenses si fournie.
  let justificatif: { storage_path: string; nom: string } | null = null;
  if (preuve) {
    const f = fd.get("preuve") as File;
    const contentType = f.type || "application/pdf";
    const prep = await apiFetch<{ storage_path: string; upload_url: string }>("/depenses/upload-url", { method: "POST", body: { nom_fichier: f.name || "preuve.pdf", content_type: contentType } });
    if (prep.ok) {
      const up = await fetch(prep.data.upload_url, { method: "PUT", headers: { "Content-Type": contentType, "x-upsert": "true" }, body: await f.arrayBuffer() });
      if (up.ok) justificatif = { storage_path: prep.data.storage_path, nom: f.name || "preuve.pdf" };
    }
  }
  const res = await apiFetch<{ fiche_id: string }>(`/personnel/${id}/fiches-paie/${champ(fd, "fiche_id")}/payer`, { method: "POST", idempotent: true, body: { methode: champ(fd, "methode"), reference: optionnel(fd, "reference"), date_paiement: champ(fd, "date_paiement"), justificatif } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/personnel/${id}`);
  return success();
}

export async function demanderConge(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = optionnel(fd, "personnel_id");
  const certificat = await televerser(fd, "certificat");
  if (certificat && "erreur" in certificat) return certificat.erreur;
  const res = await apiFetch<Conge>(id ? `/personnel/${id}/conges` : "/personnel/conges", { method: "POST", idempotent: true, body: { type: champ(fd, "type"), date_debut: champ(fd, "date_debut"), date_fin: champ(fd, "date_fin"), nb_jours: optionnel(fd, "nb_jours") ?? undefined, motif: optionnel(fd, "motif"), certificat, remplacant_personnel_id: optionnel(fd, "remplacant_personnel_id") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, ...(id ? [`/personnel/${id}`] : []));
  return success();
}

export async function deciderConge(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const decision = champ(fd, "decision") === "refuser" ? "refuser" : "approuver";
  const res = await apiFetch<Conge>(`/personnel/conges/${champ(fd, "conge_id")}/${decision}`, { method: "POST", idempotent: true, body: decision === "refuser" ? { motif_refus: champ(fd, "motif_refus") } : { remplacant_personnel_id: optionnel(fd, "remplacant_personnel_id") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/personnel/${res.data.personnelId}`);
  return success(undefined, { statut: res.data.statut });
}

export async function annulerConge(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Conge>(`/personnel/conges/${champ(fd, "conge_id")}/annuler`, { method: "POST", body: {} });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/personnel/${res.data.personnelId}`);
  return success();
}

export async function saisirPresences(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "personnel_id");
  const presences: { date: string; statut: string }[] = [];
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("p_") && typeof v === "string" && v) presences.push({ date: k.slice(2), statut: v });
  }
  if (presences.length === 0) return success();
  const res = await apiFetch(`/personnel/${id}/presences`, { method: "POST", body: { presences } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/personnel/${id}`);
  return success();
}

export async function pointer(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch("/personnel/me/presence", { method: "POST", idempotent: true, body: { statut: "PRESENT" } });
  if (!res.ok) return fromApiError(res);
  const session = await readSession();
  void session;
  revalider(locale, `/personnel/${champ(fd, "personnel_id")}`);
  return success();
}

export async function evaluer(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const id = champ(fd, "personnel_id");
  const res = await apiFetch(`/personnel/${id}/evaluations`, { method: "POST", body: { periode: champ(fd, "periode"), note: Number(champ(fd, "note")), commentaire: optionnel(fd, "commentaire") } });
  if (!res.ok) return fromApiError(res);
  revalider(locale, `/personnel/${id}`);
  return success();
}
