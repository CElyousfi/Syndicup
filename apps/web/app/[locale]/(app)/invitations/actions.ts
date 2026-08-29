"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "../../../../lib/api/client";
import { fromApiError, success, type FormState } from "../../../../lib/forms";
import type { Invitation } from "../../../../lib/api/types";

function champ(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

export async function creerInvitation(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const lotId = champ(fd, "lot_id");
  const res = await apiFetch<Invitation>("/invitations", {
    method: "POST",
    body: {
      role_cible: champ(fd, "role_cible"),
      canal: champ(fd, "canal"),
      lot_id: lotId === "" ? null : lotId,
    },
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/invitations`);
  return success(undefined, { code: res.data.code, expireLe: res.data.expireLe });
}

export async function regenererInvitation(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Invitation>(
    `/invitations/${champ(fd, "invitation_id")}/regenerer`,
    { method: "POST" }
  );
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/invitations`);
  return success(undefined, { code: res.data.code });
}

export async function annulerInvitation(_prev: FormState, fd: FormData): Promise<FormState> {
  const locale = champ(fd, "locale");
  const res = await apiFetch<Invitation>(`/invitations/${champ(fd, "invitation_id")}`, {
    method: "DELETE",
  });
  if (!res.ok) return fromApiError(res);
  revalidatePath(`/${locale}/invitations`);
  return success();
}
