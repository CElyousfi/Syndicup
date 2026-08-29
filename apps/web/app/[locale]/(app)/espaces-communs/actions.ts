"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { EspaceCommun, Reservation } from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

export async function creerEspace(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const capacite = champ(fd, "capacite");
  const res = await apiFetch<EspaceCommun>("/espaces-communs", {
    method: "POST",
    body: {
      nom: champ(fd, "nom"),
      type: champ(fd, "type"),
      capacite: capacite === "" ? null : Number(capacite),
      reservable: fd.get("reservable") === "on",
      validation_automatique: fd.get("validation_automatique") === "on",
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/espaces-communs`);
  return success();
}

export async function reserverEspace(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const nombreInvites = champ(fd, "nombre_invites");
  const res = await apiFetch<Reservation>("/reservations", {
    method: "POST",
    body: {
      espace_id: champ(fd, "espace_id"),
      lot_id: champ(fd, "lot_id"),
      date_debut: new Date(champ(fd, "date_debut")).toISOString(),
      date_fin: new Date(champ(fd, "date_fin")).toISOString(),
      nombre_invites: nombreInvites === "" ? null : Number(nombreInvites),
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/reservations`);
  return success(undefined, { statut: res.data.statut });
}

export async function annulerReservation(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Reservation>(`/reservations/${champ(fd, "reservation_id")}`, {
    method: "PATCH",
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/reservations`);
  return success();
}

export async function validerReservation(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Reservation>(
    `/reservations/${champ(fd, "reservation_id")}/valider`,
    { method: "POST" }
  );
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/reservations`);
  return success();
}

export async function rejeterReservation(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Reservation>(
    `/reservations/${champ(fd, "reservation_id")}/rejeter`,
    { method: "POST", body: { motif: champ(fd, "motif") } }
  );
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/reservations`);
  return success();
}

export async function modifierEspace(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const capacite = champ(fd, "capacite");
  const res = await apiFetch<EspaceCommun>(`/espaces-communs/${champ(fd, "espace_id")}`, {
    method: "PATCH",
    body: {
      nom: champ(fd, "nom"),
      type: champ(fd, "type"),
      capacite: capacite === "" ? null : Number(capacite),
      reservable: fd.get("reservable") === "on",
      validation_automatique: fd.get("validation_automatique") === "on",
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/espaces-communs`);
  return success();
}

export async function supprimerEspace(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<{ id: string }>(`/espaces-communs/${champ(fd, "espace_id")}`, {
    method: "DELETE",
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/espaces-communs`);
  return success();
}
