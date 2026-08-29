"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { Invitation, Lot, LotOccupant, LotProprietaire } from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}
function champOuNull(fd: FormData, name: string): string | null {
  const v = champ(fd, name);
  return v === "" ? null : v;
}

export async function creerLot(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const etage = champ(fd, "etage");
  const res = await apiFetch<Lot>("/lots", {
    method: "POST",
    body: {
      type_lot: champ(fd, "type_lot"),
      type_usage: champOuNull(fd, "type_usage"),
      numero: champ(fd, "numero"),
      etage: etage === "" ? null : Number(etage),
      tantiemes: champ(fd, "tantiemes"),
      superficie: champOuNull(fd, "superficie"),
      lot_parent_id: champOuNull(fd, "lot_parent_id"),
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/lots`);
  redirect(`/${locale}/lots/${res.data.id}`);
}

export async function modifierLot(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const lotId = champ(fd, "lot_id");
  const etage = champ(fd, "etage");
  const res = await apiFetch<Lot>(`/lots/${lotId}`, {
    method: "PATCH",
    body: {
      type_lot: champ(fd, "type_lot"),
      type_usage: champOuNull(fd, "type_usage"),
      numero: champ(fd, "numero"),
      etage: etage === "" ? null : Number(etage),
      tantiemes: champ(fd, "tantiemes"),
      superficie: champOuNull(fd, "superficie"),
      statut: champ(fd, "statut") || undefined,
      lot_parent_id: champOuNull(fd, "lot_parent_id"),
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/lots`);
  redirect(`/${locale}/lots/${lotId}`);
}

export async function ajouterProprietaire(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const lotId = champ(fd, "lot_id");
  const typePropriete = champ(fd, "type_propriete");
  const dateDebut = champ(fd, "date_debut");
  const representant = champ(fd, "representant_index");
  const ids = fd.getAll("utilisateur_id").map((v) => String(v).trim());
  const quotes = fd.getAll("quote_part").map((v) => String(v).trim());
  const proprietaires = ids.map((utilisateur_id, i) => ({
    utilisateur_id,
    quote_part: quotes[i] ?? "0",
    type_propriete: typePropriete,
    est_representant_indivision: typePropriete === "INDIVISION" && representant === String(i),
    date_debut: dateDebut,
  }));
  // Indivision = tous les co-indivisaires dans la même requête (transaction unique côté API).
  const res = await apiFetch<LotProprietaire | LotProprietaire[]>(`/lots/${lotId}/proprietaires`, {
    method: "POST",
    body: proprietaires.length === 1 ? proprietaires[0] : { proprietaires },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/lots/${lotId}`);
  return success();
}

export async function ajouterOccupant(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const lotId = champ(fd, "lot_id");
  const res = await apiFetch<LotOccupant>(`/lots/${lotId}/occupants`, {
    method: "POST",
    body: {
      utilisateur_id: champ(fd, "utilisateur_id"),
      type_occupation: champ(fd, "type_occupation"),
      date_debut: champ(fd, "date_debut"),
      date_fin: champOuNull(fd, "date_fin"),
      acces_finances_accorde: fd.get("acces_finances_accorde") === "on",
      recoit_convocations: fd.get("recoit_convocations") === "on",
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/lots/${lotId}`);
  return success();
}

/** C5 — transfert de propriété : écriture probante, Idempotency-Key obligatoire. */
export async function transfererPropriete(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const lotId = champ(fd, "lot_id");
  const email = champOuNull(fd, "email");
  const telephone = champOuNull(fd, "telephone");
  const res = await apiFetch<Invitation>(`/lots/${lotId}/transfert-propriete`, {
    method: "POST",
    idempotent: true,
    body: {
      nouveau_proprietaire: { email, telephone },
      dette_reprise_acquereur: fd.get("dette_reprise_acquereur") === "on",
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/lots/${lotId}`);
  return success(undefined, { code: res.data.code, expireLe: res.data.expireLe });
}

export async function supprimerLot(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<{ id: string }>(`/lots/${champ(fd, "lot_id")}`, { method: "DELETE" });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/lots`);
  redirect(`/${locale}/lots`);
}
