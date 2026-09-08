"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { readSession } from "../../../../lib/session";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { Copropriete } from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

async function patchCopro(
  locale: string,
  body: Record<string, unknown>,
  coproIdExplicite?: string
): Promise<FormState> {
  const coproprieteId = coproIdExplicite || (await readSession()).coproprieteId;
  if (!coproprieteId) {
    return { status: "error", code: "UNAUTHENTICATED", message: "Session absente." };
  }
  const res = await apiFetch<Copropriete>(`/coproprietes/${coproprieteId}`, {
    method: "PATCH",
    body,
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/parametres`);
  return success();
}

export async function modifierIdentite(_prev: FormState, fd: FormData): Promise<FormState> {
  return patchCopro(champ(fd, "locale"), {
    nom: champ(fd, "nom"),
    adresse: champ(fd, "adresse"),
    ville: champ(fd, "ville"),
    nb_lots: Number(champ(fd, "nb_lots")),
  });
}

export async function modifierReglement(_prev: FormState, fd: FormData): Promise<FormState> {
  const total = champ(fd, "total_tantiemes");
  return patchCopro(champ(fd, "locale"), {
    total_tantiemes: total === "" ? null : total,
  });
}

export async function modifierOptions(_prev: FormState, fd: FormData): Promise<FormState> {
  return patchCopro(champ(fd, "locale"), {
    config_json: {
      locataire_voit_pv: fd.get("locataire_voit_pv") === "on",
      reservation_espaces_proprietaires_only:
        fd.get("reservation_espaces_proprietaires_only") === "on",
    },
  });
}

/** Délais d'escalade (jours après échéance) — clés partielles, défauts Doc A §3.3 sinon. */
export async function modifierRecouvrement(_prev: FormState, fd: FormData): Promise<FormState> {
  const politique: Record<string, number> = {};
  for (const niveau of ["N1", "N2", "N3", "N4", "N5", "N6"]) {
    const v = champ(fd, niveau);
    if (v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0) {
      politique[niveau] = Number(v);
    }
  }
  return patchCopro(champ(fd, "locale"), { politique_recouvrement_json: politique });
}

/**
 * ⚠️ Paramètres légaux — saisis UNIQUEMENT avec des valeurs juridiquement confirmées
 * (docs/LEGAL_QUESTIONS_BRIEF.md). Vide = non configuré = fonctions AG verrouillées (voulu).
 */
export async function modifierLegaux(_prev: FormState, fd: FormData): Promise<FormState> {
  const delai = champ(fd, "delai_convocation_jours");
  const quorum = champ(fd, "quorum_premiere_convocation");
  const limite = champ(fd, "limite_procurations_mandataire");
  const retention = champ(fd, "retention_desactivation_mois");
  const delaiExec = champ(fd, "delai_execution_resolution_jours");
  return patchCopro(champ(fd, "locale"), {
    delai_execution_resolution_jours: delaiExec === "" ? null : Number(delaiExec),
    delai_convocation_jours: delai === "" ? null : Number(delai),
    quorum_premiere_convocation: quorum === "" ? null : quorum,
    limite_procurations_mandataire: limite === "" ? null : Number(limite),
    retention_desactivation_mois: retention === "" ? null : Number(retention),
  });
}

/** Logo de la résidence : URL signée → PUT direct au stockage → PATCH du chemin. */
export async function televerserLogo(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const fichier = fd.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { status: "error", code: "VALIDATION_ERROR", message: "Image manquante.", fields: { fichier: "Image manquante." } };
  }
  if (fichier.size > 2 * 1024 * 1024) {
    return { status: "error", code: "VALIDATION_ERROR", message: "Image trop lourde (2 Mo max).", fields: { fichier: "2 Mo max." } };
  }
  const coproprieteId = champ(fd, "copro_id") || (await readSession()).coproprieteId;
  if (!coproprieteId) return { status: "error", code: "UNAUTHENTICATED", message: "Session absente." };

  const prep = await apiFetch<{ storage_path: string; upload_url: string }>(`/coproprietes/${coproprieteId}/logo/upload-url`, {
    method: "POST",
    body: { nom_fichier: fichier.name, content_type: fichier.type || "image/png" },
  });
  if (!prep.ok) return fromApiError(prep);
  const upload = await fetch(prep.data.upload_url, {
    method: "PUT",
    headers: { "Content-Type": fichier.type || "image/png", "x-upsert": "true" },
    body: await fichier.arrayBuffer(),
  });
  if (!upload.ok) {
    return { status: "error", code: "INTERNAL_ERROR", message: `Téléversement refusé par le stockage (${upload.status}).` };
  }
  const res = await patchCopro(locale, { logo_storage_path: prep.data.storage_path }, coproprieteId);
  if (res.status !== "success") return res;
  revalidatePath(`/${locale}`, "layout");
  return success(champ(fd, "message_succes") || undefined);
}

export async function retirerLogo(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await patchCopro(locale, { logo_storage_path: null }, champ(fd, "copro_id") || undefined);
  if (res.status !== "success") return res;
  revalidatePath(`/${locale}`, "layout");
  return success(champ(fd, "message_succes") || undefined);
}

/**
 * Photos de la résidence (M20) : URL signée → PUT direct au stockage → PATCH de la carte
 * `photos_json` (fusionnée avec l'existant : un emplacement à la fois).
 */
async function photosActuelles(coproprieteId: string): Promise<Record<string, string>> {
  const copro = await apiFetch<{ photosJson?: Record<string, string> | null }>(`/coproprietes/${coproprieteId}`, { coproprieteId });
  return copro.ok ? { ...(copro.data.photosJson ?? {}) } : {};
}

export async function televerserPhoto(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const cle = champ(fd, "cle");
  const fichier = fd.get("fichier");
  if (!/^(accueil|entree|cour|salle|piscine|espace:[0-9a-f-]{36})$/i.test(cle)) {
    return { status: "error", code: "VALIDATION_ERROR", message: "Emplacement inconnu." };
  }
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { status: "error", code: "VALIDATION_ERROR", message: "Image manquante.", fields: { fichier: "Image manquante." } };
  }
  if (fichier.size > 5 * 1024 * 1024) {
    return { status: "error", code: "VALIDATION_ERROR", message: "Image trop lourde (5 Mo max).", fields: { fichier: "5 Mo max." } };
  }
  const coproprieteId = champ(fd, "copro_id") || (await readSession()).coproprieteId;
  if (!coproprieteId) return { status: "error", code: "UNAUTHENTICATED", message: "Session absente." };

  const prep = await apiFetch<{ storage_path: string; upload_url: string }>(`/coproprietes/${coproprieteId}/photos/upload-url`, {
    method: "POST",
    body: { cle, nom_fichier: fichier.name, content_type: fichier.type || "image/jpeg" },
  });
  if (!prep.ok) return fromApiError(prep);
  const upload = await fetch(prep.data.upload_url, {
    method: "PUT",
    headers: { "Content-Type": fichier.type || "image/jpeg", "x-upsert": "true" },
    body: await fichier.arrayBuffer(),
  });
  if (!upload.ok) {
    return { status: "error", code: "INTERNAL_ERROR", message: `Téléversement refusé par le stockage (${upload.status}).` };
  }
  const photos = { ...(await photosActuelles(coproprieteId)), [cle]: prep.data.storage_path };
  const res = await patchCopro(locale, { photos_json: photos }, coproprieteId);
  if (res.status !== "success") return res;
  revalidatePath(`/${locale}`, "layout");
  return success(champ(fd, "message_succes") || undefined);
}

export async function retirerPhoto(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const cle = champ(fd, "cle");
  const coproprieteId = champ(fd, "copro_id") || (await readSession()).coproprieteId;
  if (!coproprieteId) return { status: "error", code: "UNAUTHENTICATED", message: "Session absente." };
  const photos = await photosActuelles(coproprieteId);
  delete photos[cle];
  const res = await patchCopro(locale, { photos_json: Object.keys(photos).length ? photos : null }, coproprieteId);
  if (res.status !== "success") return res;
  revalidatePath(`/${locale}`, "layout");
  return success(champ(fd, "message_succes") || undefined);
}

/** M20 — paramètres de paie (PROVISOIRES, brief §11) : PATCH /coproprietes/{id}/parametres-paie ; « effacer » = null. */
export async function modifierParametresPaie(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const coproprieteId = (await readSession()).coproprieteId;
  if (!coproprieteId) return { status: "error", code: "UNAUTHENTICATED", message: "Session absente." };
  let body: Record<string, unknown> | null = null;
  if (fd.get("effacer") !== "1") {
    const tranches: { jusqua: string | null; taux: string; deduction: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const taux = champ(fd, `t_taux_${i}`);
      if (!taux) continue;
      const jusqua = champ(fd, `t_jusqua_${i}`);
      tranches.push({ jusqua: jusqua || null, taux, deduction: champ(fd, `t_deduction_${i}`) || "0.00" });
    }
    const v = (k: string) => champ(fd, k);
    body = {
      smig_mensuel: v("smig_mensuel") || null,
      taux_cnss_salarial: v("taux_cnss_salarial"), plafond_cnss: v("plafond_cnss"), taux_amo_salarial: v("taux_amo_salarial"),
      taux_cnss_patronal: v("taux_cnss_patronal"), taux_allocations_familiales: v("taux_allocations_familiales"), taux_amo_patronal: v("taux_amo_patronal"), taux_formation_pro: v("taux_formation_pro"),
      taux_frais_professionnels: v("taux_frais_professionnels"), plafond_frais_professionnels_mensuel: v("plafond_frais_professionnels_mensuel"),
      tranches_ir: tranches,
      jours_conge_annuels: v("jours_conge_annuels") || null,
      jours_ouvres_mois: Number(v("jours_ouvres_mois") || 26),
      retenue_absence_injustifiee: fd.get("retenue_absence_injustifiee") === "on",
      source: v("source") || null,
    };
  }
  const res = await apiFetch(`/coproprietes/${coproprieteId}/parametres-paie`, { method: "PATCH", body: { parametres_paie: body } });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/parametres`);
  return success();
}
